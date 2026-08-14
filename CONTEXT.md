# dsh-at-file

The @file mention surface of the composer: typing @ searches the workspace index, picking a file or directory lands a plain-text `@path` token in the draft, and the Host expands that token into file content at send time. Two surfaces show these references: the 弹出列表 (picker) and the 附加条 (dock).

## Language

**@path 引用 (mention token)**:
The plain-text `@相对路径` token in the draft that the Host expands at its pre-step boundary; directories carry a trailing slash.
_Avoid_: chip, attachment

**弹出列表 (picker)**:
The floating candidate list opened by @ in the composer; one row per entry, each showing 图标 + 名称 + 路径.
_Avoid_: 弹窗, menu

**附加条 (dock)**:
The strip above the composer with one pill per @path token currently in the draft; clicking a pill opens the file, × removes the token.
_Avoid_: 附件条

**名称 (name)**:
The basename of the workspace-relative path — the primary text of a picker row or dock pill.
_Avoid_: 文件名全称, 路径

**路径 (path)**:
The directory portion of the workspace-relative path — the dimmed secondary text of a picker row; root-level entries show `./`.
_Avoid_: 目录

**目录 (directory)**:
A workspace folder entry (kind `dir`); the picker and dock show a distinct icon for it.
_Avoid_: 文件夹

**图标 (icon)**:
The kind glyph (文件/目录) shown before the 名称.
