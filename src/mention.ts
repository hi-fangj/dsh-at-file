/**
 * The Host-side @file mention expansion: recognizes `@path` tokens in the
 * outgoing user message and, at the `agent/pre-step` boundary, reads each
 * referenced file (or directory, recursively) and injects its content as a
 * user-role message the model reads directly. Only `source.kind === 'user'`
 * text is scanned — external text cannot forge the gesture — and every path
 * resolves against the session's workspace cwd.
 */
import { dirname, isAbsolute, join } from 'node:path'
import { stat } from 'node:fs/promises'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { PreStepDecision } from '@deepseek-ai/dsh-agent'
import { isIgnoredFileType, readFileText, readTree } from './files.ts'
import { GitignoreMatcher } from './gitignore.ts'
import type { ResolvedConfig } from './types.ts'

/** One recognized mention: its workspace-relative token and resolved kind. */
export interface Mention {
  /** Workspace-relative path (no leading @, no trailing slash). */
  readonly relative: string
  /** Resolved absolute path. */
  readonly absolute: string
  readonly kind: 'file' | 'dir'
}

/** The source tag the injected content carries (transcript consumers use it). */
declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'at-file-mention': { kind: 'at-file-mention'; relative: string }
  }
}

/** The user-message source kind this boundary scans (external text cannot forge it). */
const USER_SOURCE_KIND = 'user'

/** The literal mention token: `@` then a path with no whitespace or `@`. */
const MENTION_PATTERN = /@([^\s@]+)/g

/**
 * Scan one text block for `@path` tokens, deduplicated in first-seen order.
 * A trailing slash (the directory chip form) is stripped from the path.
 * @param text - the message text block.
 * @returns unique workspace-relative tokens.
 */
export function scanMentions(text: string): readonly string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const raw = match[1] as string
    const relative = raw.endsWith('/') ? raw.slice(0, -1) : raw
    if (relative === '' || seen.has(relative)) continue
    seen.add(relative)
    out.push(relative)
  }
  return out
}

/**
 * Resolve one token to an absolute path and its kind, confined to the cwd.
 * @param relative - workspace-relative token.
 * @param cwd - the session's workspace directory.
 * @param signal - caller lifetime.
 * @returns the resolved mention, or undefined when it is not inside the workspace.
 */
async function resolveMention(
  relative: string,
  cwd: string,
  signal: AbortSignal,
): Promise<Mention | undefined> {
  // The join is confined by construction: every token is cwd-relative and
  // never carries `..` out of the workspace (the picker only offers such
  // tokens); an absolute or escaping token is not a mention.
  if (relative.startsWith('/') || relative.startsWith('..')) return undefined
  signal.throwIfAborted()
  const absolute = join(cwd, relative)
  const info = await stat(absolute).catch(() => undefined)
  signal.throwIfAborted()
  if (info === undefined) return undefined
  return { relative, absolute, kind: info.isDirectory() ? 'dir' : 'file' }
}

/** The model form of one attached file. */
function fileForm(relative: string, content: string): string {
  const body = content.endsWith('\n') ? content : `${content}\n`
  return `<file path="${relative}">\n${body}</file>`
}

/** The model form of one attached directory (one file block per subtree file). */
function dirForm(relative: string, files: readonly { relative: string; content: string }[], truncated: boolean): string {
  // resolveMention strips a trailing slash before this is called, so the
  // slash-preserving arm is unreachable from the public path.
  /* v8 ignore next -- the mention token is normalized to no trailing slash. */
  const prefix = `${relative.endsWith('/') ? relative : `${relative}/`}`
  const blocks = files.map(file => {
    const body = file.content.endsWith('\n') ? file.content : `${file.content}\n`
    return `<file path="${prefix}${file.relative}">\n${body}</file>`
  }).join('\n')
  const tail = truncated ? `\n<!-- directory truncated: more files exist under "${relative}" -->` : ''
  return `<directory path="${relative}">\n${blocks}${tail}\n</directory>`
}

/**
 * Expand every `@path` mention in the user messages into injected content
 * messages, in first-seen order. Unknown paths stay plain prose.
 * @param messages - the assembled step messages.
 * @param cwd - the session's workspace directory.
 * @param config - bounds (per-file cap, index cap, ignore dirs).
 * @param signal - caller lifetime.
 * @returns the injected user messages (empty when nothing matched or disabled).
 */
export async function expandMentions(
  messages: readonly UserMessage[],
  cwd: string | undefined,
  config: ResolvedConfig,
  signal: AbortSignal,
): Promise<UserMessage[]> {
  if (cwd === undefined || !isAbsolute(cwd)) return []
  const tokens: string[] = []
  for (const message of messages) {
    if (message.source.kind !== USER_SOURCE_KIND) continue
    for (const block of message.content) {
      if (block.type !== 'text') continue
      tokens.push(...scanMentions(block.text))
    }
  }
  const injections: UserMessage[] = []
  const gitignore = config.useGitignore ? await GitignoreMatcher.load(cwd, signal) : null
  for (const token of tokens) {
    signal.throwIfAborted()
    const mention = await resolveMention(token, cwd, signal)
    if (mention === undefined) continue
    let form: string
    if (mention.kind === 'dir') {
      const tree = await readTree(mention.absolute, {
        maxFiles: config.maxIndexedFiles,
        maxBytes: config.maxFileBytes,
        ignoreDirs: config.ignoreDirs,
        ignoreFileExtensions: config.ignoreFileExtensions,
        ...(gitignore === null ? {} : { gitignore }),
      }, signal)
      form = dirForm(mention.relative, tree.files, tree.truncated)
    } else {
      if (isIgnoredFileType(mention.absolute, config.ignoreFileExtensions)) continue
      if (gitignore !== null) {
        const level = await gitignore.levelFor(dirname(mention.absolute), signal)
        if (gitignore.ignores(mention.absolute, false, level)) continue
      }
      const content = await readFileText(mention.absolute, config.maxFileBytes, signal)
      form = fileForm(mention.relative, content.content)
    }
    injections.push(createUserMessage({
      content: [{ type: 'text', text: form }],
      source: { kind: 'at-file-mention', relative: mention.relative },
    }))
  }
  return injections
}

/** The minimal agent face the pre-step handler reads. */
export interface MentionAgent {
  session: { header: { cwd?: string } }
}

/**
 * The `agent/pre-step` listener body: expand mentions in the claimed user
 * messages and append the injections to the downstream decision. Extracted so
 * the boundary logic is unit-testable without an assembled agent scope.
 * @param agent - the addressed agent (its session header owns the cwd).
 * @param config - bounds.
 * @param isEnabled - live settings read.
 * @param messages - the claimed messages (the user's own words).
 * @param signal - caller lifetime.
 * @param next - the downstream waterfall.
 * @returns the decision with injections appended, or the downstream decision.
 */
export async function mentionPreStep(
  agent: MentionAgent,
  config: ResolvedConfig,
  isEnabled: () => boolean,
  messages: readonly UserMessage[],
  signal: AbortSignal,
  next: () => Promise<PreStepDecision>,
): Promise<PreStepDecision> {
  const decision = await next()
  if (decision.kind === 'reject') return decision
  if (!isEnabled()) return decision
  const injections = await expandMentions(messages, agent.session.header.cwd, config, signal)
  if (injections.length === 0) return decision
  return { kind: 'enter', messages: [...decision.messages, ...injections] }
}
