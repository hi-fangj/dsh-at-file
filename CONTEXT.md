# dsh-at-file

The @file mention surface of the composer: typing @ searches the workspace index, picking a file or directory mints a chip reference in the draft, and at send time the chip serializes to the full `@路径` token the Host expands into file content. Two surfaces show these references: the 弹出列表 (picker) and the 附加条 (dock).

## Language

**@路径 引用 (mention)**:
The picked file or directory, represented in the draft as a chip (placeholder + basename label) and serialized to the full `@相对路径` token the Host expands at its pre-step boundary.
_Avoid_: attachment, plain-text token

**芯片 (chip)**:
The inline placeholder rendering of a picked mention in the composer: the 名称 alone in a monospace gray code-style chip fitted to the harness's fixed 64px placeholder slot, longer basenames ellipsized (injected styles replace the harness's chip box with the code pill); the full path lives in the chip's ref and surfaces in the 附加条 tooltip.
_Avoid_: token

**弹出列表 (picker)**:
The floating candidate list opened by @ in the composer; one row per entry, each showing 图标 + 名称 + 路径.
_Avoid_: 弹窗, menu

**附加条 (dock)**:
The strip above the composer with one pill per 芯片 occurrence currently in the draft; clicking a pill opens the file, × removes the occurrence.
_Avoid_: 附件条

**名称 (name)**:
The basename of the workspace-relative path — the primary text of a picker row, chip, or dock pill.
_Avoid_: 文件名全称, 路径

**路径 (path)**:
The directory portion of the workspace-relative path — the dimmed secondary text of a picker row.
_Avoid_: 目录

**完整路径 (full path)**:
The complete workspace-relative path of an entry: its 名称 joined to its 路径 (e.g. `src/client/source.ts`). Shown on the picker row and dock pill hover tooltip.
_Avoid_: 相对路径, 绝对路径

**目录 (directory)**:
A workspace folder entry (kind `dir`); the picker and dock show a distinct icon for it.
_Avoid_: 文件夹

**图标 (icon)**:
The kind glyph (文件/目录) shown before the 名称.
