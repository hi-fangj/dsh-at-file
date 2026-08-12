/**
 * Attached-files dock: one row per @file chip currently in the draft, rendered
 * above the composer (the 'conversation.input.dock' strip). The row is the
 * user's file link before and after send: clicking the path opens the file on
 * the host, the × removes the chip from the draft. State arrives through the
 * InputZone owner currency (the skeleton re-renders entries on input-store
 * changes); removal goes through the public `inputActions.setDraft` write path.
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Injected business face: open one absolute path through the host opener. */
export interface AtFileDockInjected {
    onOpen: (path: string) => void;
}
/** Full dock entry props: InputZone owner share + session standard kit + injected face + locale seat. */
export type AtFileDockProps = PropsRuntime<'conversation.input.dock'> & AtFileDockInjected & PropsLocale<'at-file'>;
/** Draft text with one chip's placeholder removed (the machine reconciles the occurrence). */
export declare function withoutOccurrence(draft: string, offset: number): string;
/**
 * Render the attached-file rows; null while the draft has no @file chips.
 * @param props - runtime (input currency + actions), inject, and locale shares.
 * @returns the dock strip, or null.
 */
export declare function FilesDock({ input, inputActions, onOpen, t }: AtFileDockProps): import("react").JSX.Element | null;
