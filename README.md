# dsh-at-file

Codex-style `@file` mentions for the DeepSeek Harness web GUI. Type `@` in the composer, search the workspace files as you type, and press Enter to attach a file to the prompt. The attached file travels to the model as its content; a chip row above the composer stays clickable so you can open the file on the host.

```
composer:  fix the README  @README.  ← floating picker over the token
            ┌────────────────────────────┐
            │ README.md                  │
            │ docs/README.zh.md          │
            └────────────────────────────┘
draft:     fix the README [README.md ×]  ← chip in the draft
dock:      📄 README.md  ×               ← clickable file link above the input
submit:    fix the README
           <file path="README.md">
           …complete content…
           </file>
```

## Install

```sh
dsh plugin --profile <name> add file:/path/to/dsh-at-file
```

Then restart the web server so the host half and the served client bundle pick up the plugin. The plugin needs the standard web bundle composition (the `ui-input-trigger` `@` pipeline, `api-gateway` client Remote, and the conversation slots) — the default `dsh web` profile has all of them.

## Configuration

Host-side tunables live on the plugin row in `cordis.yml`:

```yaml
- id: dsh-at-file
  name: dsh-at-file
  config:
    maxIndexedFiles: 5000      # hard cap on indexed files per workspace (walk stops, menu reports truncation)
    maxFileBytes: 262144       # hard cap on one attached file; larger files are refused, never truncated
    ignoreDirs: ['.git', 'node_modules']   # directory basenames the walk skips
```

## Model experience

| Aspect | Effect |
| --- | --- |
| Token cost | One attached file adds its complete content (up to `maxFileBytes`) to the user message at submit time. |
| Tool calls | None — the content is already in the prompt; the model never calls a tool to read attached files. |
| Message format | Each attachment serializes as `<file path="<workspace-relative>">\n<content>\n</file>` inside the user message. |
| Limits | Attaching a file over `maxFileBytes`, a binary file, or a directory blocks the send with an error notice; the draft and chips are kept. |

## Permission boundary

- The picker only offers files under the session's workspace directory (`maxIndexedFiles` files, `.git`/`node_modules` skipped by default). `read` accepts any absolute path the host process can read: it is the user's own picker surface over their own session, not a model capability — the model never sees the `atFile/search` or `atFile/read` methods.
- `host.openPath` (the click-to-open action) is the harness's own loopback-pinned endpoint.

## Development

```sh
pnpm install            # links the sibling dsh checkout for build and tests
pnpm run check          # typecheck + tests + build
pnpm run test           # vitest (host fs/runtime, client source/dock/apply)
pnpm run build          # esbuild host/client/invariant bundles + tsc declarations
```

The repo expects the harness checkout at `../dsh` (relative to this repo) for the dev-time `link:` resolutions and the test aliases.

## Known limitations

- The workspace index is cached per session for 30 seconds; files created later appear on the next menu open after that window.
- Pasting an `@path` token does not upgrade it to a chip (menu picks only); a typed `@` path is decorated when it matches an indexed file.
- The picker group title renders the source name (`at-file`) because the slash menu's title dictionary is owned by the harness.

## License

MIT
