/**
 * `at-file` locale namespace: the attached-files dock copy and the submit-time
 * read-failure notice. Chinese is the product copy; English mirrors it.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'dock.aria': '已附加的文件',
  'dock.remove': '移除 {name}',
  'error.read': '无法读取 {name}：{message}',
  'nav': '文件提及',
  'settings.title': '工作区文件提及',
  'settings.subtitle': '在输入框输入 @ 智能搜索工作区文件，回车附加后随消息把完整内容交给模型。',
  'settings.enabled': '启用 @ 文件提及',
  'settings.enabledDesc': '关闭后隐藏 @ 文件选择器与附加条，模型不再收到附加文件内容。',
} satisfies Record<string, string>

/** The `at-file` namespace key union. */
export type AtFileKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'dock.aria': 'Attached files',
  'dock.remove': 'Remove {name}',
  'error.read': 'Cannot read {name}: {message}',
  'nav': 'File mentions',
  'settings.title': 'Workspace file mentions',
  'settings.subtitle': 'Type @ in the composer to smart-search workspace files; press Enter to attach one and ship its full content to the model.',
  'settings.enabled': 'Enable @ file mentions',
  'settings.enabledDesc': 'Turning this off hides the @ picker and the attached-files dock, and the model no longer receives attached file content.',
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
