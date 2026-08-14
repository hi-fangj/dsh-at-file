/**
 * Attached-files dock: one row per @file chip occurrence currently in the
 * draft, rendered above the composer (the 'conversation.input.dock' strip).
 * The row is the user's file link before and after send: clicking the label
 * opens the file on the host, the × drops the occurrence's placeholder from
 * the draft. Occurrences come from the input machine's chip table (each pick
 * mints one U+FFFC placeholder; the plain-text parse is gone), so the dock
 * reads them directly; the settings scope's live enable value gates the
 * strip. Each pill shows the kind icon (folder for directories, resolved
 * through the settled index) + the chip label, with the full relative path
 * on the title tooltip.
 */
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'
import type { AtFileSettings } from '../contract.ts'
import { SOURCE_NAME } from './source.ts'

/** Injected business face: open one relative path, resolve its kind, and the live settings scope. */
export interface AtFileDockInjected {
  onOpen: (relative: string) => void
  /** Kind of one ref from the settled index (undefined before the index settles). */
  kindOf: (relative: string) => 'file' | 'dir' | undefined
  hooks: { scope: SettingsScope<AtFileSettings> }
}

/** Full dock entry props: InputZone owner share + session standard kit + injected face + locale seat. */
export type AtFileDockProps = PropsRuntime<'conversation.input.dock'> & InjectFace<AtFileDockInjected> & PropsLocale<'at-file'>

/** The chip occurrence face the dock reads (the harness's full Occurrence type is not re-exported). */
export interface AtFileOccurrence {
  readonly occurrenceId: number
  readonly source: string
  readonly ref: string
  readonly offset: number
  readonly label: string
}

/** The @file chip occurrences in one occurrence table, in draft order. */
export function atFileOccurrences(occurrences: readonly AtFileOccurrence[]): readonly AtFileOccurrence[] {
  return occurrences.filter(occurrence => occurrence.source === SOURCE_NAME)
}

/** Draft text with one chip occurrence's placeholder (a single U+FFFC) removed. */
export function withoutPlaceholder(draft: string, offset: number): string {
  return draft.slice(0, offset) + draft.slice(offset + 1)
}

/**
 * Render the attached-file rows; null while the draft has no @file chip
 * occurrences or the settings switch is off.
 * @param props - runtime (input currency + actions), inject, and locale shares.
 * @returns the dock strip, or null.
 */
export function FilesDock({ input, inputActions, onOpen, kindOf, useScope, t }: AtFileDockProps) {
  const enabled = useScope(snapshot => snapshot.value?.enabled ?? true)
  if (!enabled) return null
  const occurrences = atFileOccurrences(input.occurrences)
  if (occurrences.length === 0) return null
  return (
    <div className="dsh_atFile_rail" role="group" aria-label={t('dock.aria')} data-at-file-dock>
      {occurrences.map(occurrence => {
        const kind = kindOf(occurrence.ref) ?? 'file'
        return (
          <span key={occurrence.occurrenceId} className="dsh_atFile_row" data-at-file-row data-at-file-kind={kind}>
            <button
              type="button"
              className="dsh_atFile_path"
              title={occurrence.ref}
              onClick={() => { onOpen(occurrence.ref) }}
            >
              {kind === 'dir' ? (
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
              {occurrence.label}
            </button>
            <button
              type="button"
              className="dsh_atFile_remove"
              aria-label={t('dock.remove', { name: occurrence.ref })}
              onClick={() => { inputActions.setDraft(withoutPlaceholder(input.draft, occurrence.offset)) }}
            >
              <svg viewBox="0 0 16 16" aria-hidden>
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        )
      })}
    </div>
  )
}
