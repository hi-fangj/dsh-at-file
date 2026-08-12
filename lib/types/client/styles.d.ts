/**
 * The dock stylesheet, hand-written as a template string and injected once by
 * the plugin body: the web server serves exactly one file per client plugin,
 * so no separate CSS artifact may exist. Tokens come only from the shared
 * `--dsw-alias-*` design platform (no literal colors); class names carry the
 * `dsh_atFile` prefix to stay unique in the assembled shell.
 */
/** Stable `<style>` element id (idempotent injection across HMR re-runs). */
export declare const STYLE_ID = "dsh-at-file-style";
/** The dock's injected stylesheet text. */
export declare const cssText = "\n.dsh_atFile_rail {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n  min-width: 0;\n}\n.dsh_atFile_row {\n  display: inline-flex;\n  align-items: center;\n  gap: 2px;\n  min-width: 0;\n  max-width: 100%;\n  height: 28px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 14px;\n  background: var(--dsw-alias-bg-layer-1);\n}\n.dsh_atFile_path {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n  max-width: 360px;\n  height: 100%;\n  padding: 0 6px 0 10px;\n  border: 0;\n  background: none;\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 13px;\n  line-height: 18px;\n  cursor: pointer;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n.dsh_atFile_path:hover {\n  color: var(--dsw-alias-brand-primary);\n}\n.dsh_atFile_icon {\n  flex: none;\n  width: 14px;\n  height: 14px;\n}\n.dsh_atFile_remove {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  flex: none;\n  width: 20px;\n  height: 20px;\n  margin-right: 4px;\n  border: 0;\n  border-radius: 10px;\n  background: none;\n  color: var(--dsw-alias-label-dimmed);\n  cursor: pointer;\n}\n.dsh_atFile_remove svg {\n  width: 12px;\n  height: 12px;\n}\n.dsh_atFile_remove:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n";
/**
 * Inject the dock stylesheet once (stable id; HMR-safe).
 */
export declare function adoptStyles(): void;
