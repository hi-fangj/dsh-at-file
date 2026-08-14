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
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
import type { AtFileSettings } from '../contract.ts';
/** Injected business face: open one relative path, resolve its kind, and the live settings scope. */
export interface AtFileDockInjected {
    onOpen: (relative: string) => void;
    /** Kind of one ref from the settled index (undefined before the index settles). */
    kindOf: (relative: string) => 'file' | 'dir' | undefined;
    hooks: {
        scope: SettingsScope<AtFileSettings>;
    };
}
/** Full dock entry props: InputZone owner share + session standard kit + injected face + locale seat. */
export type AtFileDockProps = PropsRuntime<'conversation.input.dock'> & InjectFace<AtFileDockInjected> & PropsLocale<'at-file'>;
/** The chip occurrence face the dock reads (the harness's full Occurrence type is not re-exported). */
export interface AtFileOccurrence {
    readonly occurrenceId: number;
    readonly source: string;
    readonly ref: string;
    readonly offset: number;
    readonly label: string;
}
/** The @file chip occurrences in one occurrence table, in draft order. */
export declare function atFileOccurrences(occurrences: readonly AtFileOccurrence[]): readonly AtFileOccurrence[];
/** The chip label without its leading kind icon (identity for foreign labels). */
export declare function labelText(label: string): string;
/** Draft text with one chip occurrence's placeholder (a single U+FFFC) removed. */
export declare function withoutPlaceholder(draft: string, offset: number): string;
/**
 * Render the attached-file rows; null while the draft has no @file chip
 * occurrences or the settings switch is off.
 * @param props - runtime (input currency + actions), inject, and locale shares.
 * @returns the dock strip, or null.
 */
export declare function FilesDock({ input, inputActions, onOpen, kindOf, useScope, t }: AtFileDockProps): import("react").JSX.Element | null;
