/**
 * `at-file` locale namespace: the attached-files dock copy and the submit-time
 * read-failure notice. Chinese is the product copy; English mirrors it.
 */
/** Simplified Chinese dictionary (the key-set source of truth). */
export declare const zh: {
    'dock.aria': string;
    'dock.remove': string;
    'error.read': string;
};
/** The `at-file` namespace key union. */
export type AtFileKey = keyof typeof zh;
/** English dictionary, checked complete against the zh key set. */
export declare const en: {
    'dock.aria': string;
    'dock.remove': string;
    'error.read': string;
};
/** Locale namespace id registered under ctx.locale. */
export declare const NS = "at-file";
/**
 * Fill one dictionary template's `{name}`-style placeholders.
 * @param template - dictionary text.
 * @param params - placeholder values; absent params replace nothing.
 * @returns the filled text.
 */
export declare function fmt(template: string, params?: Record<string, string>): string;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The @file dock and failure copy. */
        [NS]: AtFileKey;
    }
}
