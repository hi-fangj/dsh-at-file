/**
 * Attached-files dock: one row per @path token currently in the draft,
 * rendered above the composer (the 'conversation.input.dock' strip). The row
 * is the user's file link before and after send: clicking the path opens the
 * file on the host, the × removes the token from the draft. The draft holds
 * plain-text @path tokens (the plain-text-reference decision), so the dock
 * parses them directly; the settings scope's live enable value gates the
 * strip. Each pill shows the kind icon (folder for directory tokens, whose
 * grammar carries a trailing slash) + the basename, with the full relative
 * path on the title tooltip.
 */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { AtFileSettings } from '../contract.ts'
import { basenameOf } from './model.ts'

/** Injected business face: open one relative path, and the live settings scope. */
export interface AtFileDockInjected {
  onOpen: (relative: string) => void
  hooks: { scope: SettingsScope<AtFileSettings> }
}

/** Full dock entry props: InputZone owner share + session standard kit + injected face + locale seat. */
export type AtFileDockProps = PropsRuntime<'conversation.input.dock'> & InjectFace<AtFileDockInjected> & PropsLocale<'at-file'>

/** The same token grammar the Host's mention expansion scans. */
const MENTION_PATTERN = /@([^\s@]+)/g

/** One parsed mention token in the draft, with its span for precise removal. */
interface DraftMention {
  readonly relative: string
  readonly start: number
  readonly end: number
  /** Token-shape directory marker: the raw token ends with '/' (the same grammar the picker and the Host use). */
  readonly dir: boolean
}

/** Parse the draft's @path tokens in order, deduplicating by relative path. */
export function draftMentions(draft: string): readonly DraftMention[] {
  const seen = new Set<string>()
  const out: DraftMention[] = []
  for (const match of draft.matchAll(MENTION_PATTERN)) {
    const raw = match[1] as string
    const dir = raw.endsWith('/')
    const relative = dir ? raw.slice(0, -1) : raw
    if (relative === '' || seen.has(relative)) continue
    seen.add(relative)
    out.push({ relative, start: match.index, end: match.index + match[0].length, dir })
  }
  return out
}

/** Draft text with one token span removed. */
export function withoutToken(draft: string, start: number, end: number): string {
  return draft.slice(0, start) + draft.slice(end)
}

/**
 * Render the attached-file rows; null while the draft has no @path tokens or
 * the settings switch is off.
 * @param props - runtime (input currency + actions), inject, and locale shares.
 * @returns the dock strip, or null.
 */
export function FilesDock({ input, inputActions, onOpen, useScope, t }: AtFileDockProps) {
  const enabled = useScope(snapshot => snapshot.value?.enabled ?? true)
  if (!enabled) return null
  const mentions = draftMentions(input.draft)
  if (mentions.length === 0) return null
  return (
    <div className="dsh_atFile_rail" role="group" aria-label={t('dock.aria')} data-at-file-dock>
      {mentions.map(mention => (
        <span key={`${mention.start}:${mention.relative}`} className="dsh_atFile_row" data-at-file-row data-at-file-kind={mention.dir ? 'dir' : 'file'}>
          <button
            type="button"
            className="dsh_atFile_path"
            title={mention.relative}
            onClick={() => { onOpen(mention.relative) }}
          >
            {mention.dir ? (
              <svg className="dsh_atFile_icon" viewBox="0 0 16 16" aria-hidden>
                <path d="M2 5.5A1.5 1.5 0 0 1 3.5 4h2.9l1.5 1.5H12.5A1.5 1.5 0 0 1 14 7v5.5A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-7Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            ) : (
              <svg className="dsh_atFile_icon" viewBox="0 0 16 16" aria-hidden>
                <path d="M3 2.5A1.5 1.5 0 0 1 4.5 1h3l3 3v9.5A1.5 1.5 0 0 1 9 15H4.5A1.5 1.5 0 0 1 3 13.5v-11Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d="M7.5 1v3h3" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <path d="M13 4.5v8A1.5 1.5 0 0 1 11.5 14H5" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            )}
            {basenameOf(mention.relative)}
          </button>
          <button
            type="button"
            className="dsh_atFile_remove"
            aria-label={t('dock.remove', { name: mention.relative })}
            onClick={() => { inputActions.setDraft(withoutToken(input.draft, mention.start, mention.end)) }}
          >
            <svg viewBox="0 0 16 16" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      ))}
    </div>
  )
}
