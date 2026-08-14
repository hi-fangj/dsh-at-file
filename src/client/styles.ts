/**
 * The dock stylesheet, hand-written as a template string and injected once by
 * the plugin body: the web server serves exactly one file per client plugin,
 * so no separate CSS artifact may exist. Tokens come only from the shared
 * `--dsw-alias-*` design platform (no literal colors); class names carry the
 * `dsh_atFile` prefix to stay unique in the assembled shell.
 */

/** Stable `<style>` element id (idempotent injection across HMR re-runs). */
export const STYLE_ID = 'dsh-at-file-style'

/** The dock's injected stylesheet text. */
export const cssText = `
.dsh_atFile_rail {
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  /* Align the pill strip with the input card it sits above: the card is the
     centered (card-max-width) capsule inset by the shared side clearance, so
     the strip reuses that exact geometry — first pill on the card's left edge,
     strip clipped to the card's right edge, at every viewport width. The
     custom properties inherit from the conversation root (ui-conversation). */
  width: calc(100% - 2 * var(--dsh-composer-side-clearance));
  max-width: var(--dsh-composer-card-max-width);
  margin: 0 auto;
}
.dsh_atFile_row {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  max-width: 100%;
  height: 28px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 14px;
  background: var(--dsw-alias-bg-layer-1);
}
.dsh_atFile_path {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 360px;
  height: 100%;
  padding: 0 6px 0 10px;
  border: 0;
  background: none;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 18px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh_atFile_path:hover {
  color: var(--dsw-alias-brand-primary);
}
.dsh_atFile_icon {
  flex: none;
  width: 14px;
  height: 14px;
}
.dsh_atFile_remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 20px;
  height: 20px;
  margin-right: 4px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--dsw-alias-label-dimmed);
  cursor: pointer;
}
.dsh_atFile_remove svg {
  width: 12px;
  height: 12px;
}
.dsh_atFile_remove:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh_atFile_section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.dsh_atFile_title {
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 18px;
  line-height: 26px;
  font-weight: 600;
}
.dsh_atFile_card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  padding: 14px 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  cursor: pointer;
}
.dsh_atFile_checkbox {
  flex: none;
  width: 18px;
  height: 18px;
  margin: 2px 0 0;
  accent-color: var(--dsw-alias-brand-primary);
  cursor: pointer;
}
.dsh_atFile_cardText {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.dsh_atFile_cardTitle {
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  line-height: 22px;
}
.dsh_atFile_cardDesc {
  color: var(--dsw-alias-label-tertiary);
  font-size: 13px;
  line-height: 20px;
}
/* Composer chips (data-decoration="chip" is the harness's stable attribute):
   the placeholder slot is a fixed 64px (the U+FFFC glyph's advance in the
   DshChipCell font; the caret and the draft mirror anchor to it, so the slot
   itself must not resize). The label overlay becomes the visible chip: the
   @basename in the code font, drawn as a blue code-style pill
   (translucent neutral fill + small radius) that starts at the token
   position and is ellipsized at the slot's right edge — so the caret always
   lands at (or past) the visible pill's end and typing after the chip stays
   clear for any basename length (the harness's own chips fit their labels
   inside the slot the same way). The full name is one hover (the chip title)
   or one glance at the dock away. */
[data-decoration="chip"] {
  background: transparent !important;
}
[data-decoration="chip"] > span {
  position: absolute !important;
  top: 50% !important;
  left: 0 !important;
  transform: translateY(-50%) !important;
  display: block !important;
  box-sizing: border-box !important;
  width: max-content !important;
  max-width: 64px !important;
  padding: 0 6px !important;
  border-radius: 4px !important;
  background: var(--dsw-alias-interactive-bg-hover) !important;
  color: var(--dsw-alias-state-business-primary) !important;
  font-family: var(--ds-font-family-code) !important;
  font-size: 12px !important;
  line-height: 18px !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
`

/**
 * Inject the dock stylesheet once (stable id; HMR-safe).
 */
export function adoptStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = cssText
  document.head.appendChild(style)
}
