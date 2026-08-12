/**
 * `at-file` locale namespace: the attached-files dock copy and the submit-time
 * read-failure notice. Chinese is the product copy; English mirrors it.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'dock.aria': '已附加的文件',
  'dock.remove': '移除 {name}',
  'error.read': '无法读取 {name}：{message}',
} satisfies Record<string, string>

/** The `at-file` namespace key union. */
export type AtFileKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'dock.aria': 'Attached files',
  'dock.remove': 'Remove {name}',
  'error.read': 'Cannot read {name}: {message}',
} satisfies Record<AtFileKey, string>

/** Locale namespace id registered under ctx.locale. */
export const NS = 'at-file'

/**
 * Fill one dictionary template's `{name}`-style placeholders.
 * @param template - dictionary text.
 * @param params - placeholder values; absent params replace nothing.
 * @returns the filled text.
 */
export function fmt(template: string, params?: Record<string, string>): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => params[key] ?? whole)
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The @file dock and failure copy. */
    [NS]: AtFileKey
  }
}
