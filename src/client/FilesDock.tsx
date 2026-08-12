/**
 * Attached-files dock: one row per @file chip currently in the draft, rendered
 * above the composer (the 'conversation.input.dock' strip). The row is the
 * user's file link before and after send: clicking the path opens the file on
 * the host, the × removes the chip from the draft. State arrives through the
 * InputZone owner currency (the skeleton re-renders entries on input-store
 * changes); removal goes through the public `inputActions.setDraft` write path.
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { SOURCE_NAME } from './source.ts'

/** Injected business face: open one absolute path through the host opener. */
export interface AtFileDockInjected {
  onOpen: (path: string) => void
}

/** Full dock entry props: InputZone owner share + session standard kit + injected face + locale seat. */
export type AtFileDockProps = PropsRuntime<'conversation.input.dock'> & AtFileDockInjected & PropsLocale<'at-file'>

/** Draft text with one chip's placeholder removed (the machine reconciles the occurrence). */
export function withoutOccurrence(draft: string, offset: number): string {
  return draft.slice(0, offset) + draft.slice(offset + 1)
}

/**
 * Render the attached-file rows; null while the draft has no @file chips.
 * @param props - runtime (input currency + actions), inject, and locale shares.
 * @returns the dock strip, or null.
 */
export function FilesDock({ input, inputActions, onOpen, t }: AtFileDockProps) {
  const attached = input.occurrences.filter(occurrence => occurrence.source === SOURCE_NAME)
  if (attached.length === 0) return null
  return (
    <div className="dsh_atFile_rail" role="group" aria-label={t('dock.aria')} data-at-file-dock>
      {attached.map(occurrence => (
        <span key={occurrence.occurrenceId} className="dsh_atFile_row" data-at-file-row>
          <button
            type="button"
            className="dsh_atFile_path"
            title={occurrence.ref}
            onClick={() => { onOpen(occurrence.ref) }}
          >
            <svg className="dsh_atFile_icon" viewBox="0 0 16 16" aria-hidden>
              <path d="M3 2.5A1.5 1.5 0 0 1 4.5 1h3l3 3v9.5A1.5 1.5 0 0 1 9 15H4.5A1.5 1.5 0 0 1 3 13.5v-11Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M7.5 1v3h3" fill="none" stroke="currentColor" strokeWidth="1.2" />
              <path d="M13 4.5v8A1.5 1.5 0 0 1 11.5 14H5" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            {occurrence.label}
          </button>
          <button
            type="button"
            className="dsh_atFile_remove"
            aria-label={t('dock.remove', { name: occurrence.label })}
            onClick={() => { inputActions.setDraft(withoutOccurrence(input.draft, occurrence.offset)) }}
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
