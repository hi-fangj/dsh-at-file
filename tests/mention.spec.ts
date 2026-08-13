/**
 * The Host pre-step mention expansion: token recognition, workspace
 * confinement, file vs directory content injection, and the unknown-path /
 * non-user-source skips.
 */
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { expandMentions, mentionPreStep, scanMentions } from '../src/mention.ts'
import type { ResolvedConfig } from '../src/types.ts'

const CONFIG: ResolvedConfig = { maxIndexedFiles: 100, maxFileBytes: 1024, ignoreDirs: ['.git', 'node_modules'] }

function user(text: string): UserMessage {
  return createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
}

describe('scanMentions', () => {
  it('recognizes @path tokens, strips the directory slash, and deduplicates', () => {
    expect(scanMentions('fix @src/index.ts and @docs/ ')).toEqual(['src/index.ts', 'docs'])
    expect(scanMentions('@a.ts again @a.ts')).toEqual(['a.ts'])
  })
})

describe('expandMentions', () => {
  it('injects one file block per mentioned file, tagged with its source', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-mention-'))
    await writeFile(join(root, 'a.ts'), 'content\n')
    try {
      const injections = await expandMentions([user('read @a.ts')], root, CONFIG, new AbortController().signal)
      expect(injections).toHaveLength(1)
      expect(injections[0]!.source).toEqual({ kind: 'at-file-mention', relative: 'a.ts' })
      expect(injections[0]!.content[0]).toEqual({ type: 'text', text: '<file path="a.ts">\ncontent\n</file>' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('injects a directory block over the subtree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-mention-'))
    await mkdir(join(root, 'src', 'nested'), { recursive: true })
    await writeFile(join(root, 'src', 'a.ts'), 'a\n')
    await writeFile(join(root, 'src', 'nested', 'b.ts'), 'b\n')
    try {
      const injections = await expandMentions([user('attach @src/')], root, CONFIG, new AbortController().signal)
      expect(injections).toHaveLength(1)
      expect(injections[0]!.content[0]).toEqual({
        type: 'text',
        text: '<directory path="src">\n<file path="src/a.ts">\na\n</file>\n<file path="src/nested/b.ts">\nb\n</file>\n</directory>',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('normalizes a missing trailing newline and marks directory truncation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-mention-'))
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'a.ts'), 'no-newline')
    await writeFile(join(root, 'src', 'a.ts'), 'a')
    await writeFile(join(root, 'src', 'b.ts'), 'b')
    try {
      const files = await expandMentions([user('read @a.ts')], root, CONFIG, new AbortController().signal)
      expect(files[0]!.content[0]).toEqual({ type: 'text', text: '<file path="a.ts">\nno-newline\n</file>' })
      // A directory cut by the cap folds in the truncation marker.
      const smallConfig: ResolvedConfig = { ...CONFIG, maxIndexedFiles: 1 }
      const dir = await expandMentions([user('attach @src/')], root, smallConfig, new AbortController().signal)
      expect((dir[0]!.content[0] as { text: string }).text).toContain('<!-- directory truncated')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('skips non-text blocks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-mention-'))
    try {
      const message = createUserMessage({
        content: [{ type: 'text', text: 'no mention' }, { type: 'image', attachment: { attachmentId: 'x' } as never }],
        source: { kind: 'user' },
      })
      expect(await expandMentions([message], root, CONFIG, new AbortController().signal)).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('skips unknown paths and non-user message sources', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-mention-'))
    try {
      const injections = await expandMentions([user('read @missing.ts')], root, CONFIG, new AbortController().signal)
      expect(injections).toEqual([])
      const plugin = createUserMessage({ content: [{ type: 'text', text: '@a.ts' }], source: { kind: 'plugin', plugin: 'x' } })
      await writeFile(join(root, 'a.ts'), 'x\n')
      expect(await expandMentions([plugin], root, CONFIG, new AbortController().signal)).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('refuses tokens that escape the workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-mention-'))
    try {
      const injections = await expandMentions([user('read @../secret.ts')], root, CONFIG, new AbortController().signal)
      expect(injections).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('treats a relative cwd as unavailable', async () => {
    expect(await expandMentions([user('read @a.ts')], 'relative/cwd', CONFIG, new AbortController().signal)).toEqual([])
  })
})

describe('mentionPreStep', () => {
  const agent = { session: { header: { cwd: '/ws' } } }

  it('appends injections to the downstream enter decision', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-mention-'))
    await writeFile(join(root, 'a.ts'), 'x\n')
    try {
      const decision = await mentionPreStep(
        { session: { header: { cwd: root } } },
        CONFIG,
        () => true,
        [user('read @a.ts')],
        new AbortController().signal,
        async () => ({ kind: 'enter', messages: [] }),
      )
      expect(decision.kind).toBe('enter')
      expect(decision.messages).toHaveLength(1)
      expect(decision.messages![0]!.source).toEqual({ kind: 'at-file-mention', relative: 'a.ts' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('returns the downstream decision when disabled or rejected', async () => {
    const decision = async () => ({ kind: 'enter', messages: [] })
    const disabled = await mentionPreStep(agent, CONFIG, () => false, [user('@a.ts')], new AbortController().signal, decision)
    expect(disabled.messages).toEqual([])
    const rejected = await mentionPreStep(agent, CONFIG, () => true, [user('@a.ts')], new AbortController().signal, async () => ({ kind: 'reject' }))
    expect(rejected.kind).toBe('reject')
    // An enabled run with no resolvable mention leaves the decision untouched.
    const unmatched = await mentionPreStep({ session: { header: { cwd: '/ws' } } }, CONFIG, () => true, [user('@missing.ts')], new AbortController().signal, decision)
    expect(unmatched.messages).toEqual([])
  })
})
