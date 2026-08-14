# AGENTS.md

Out-of-tree DeepSeek Harness plugin (host + Web client bundle). Read [dsh-plugin-create](../../dsh/.agents/skills/dsh-plugin-create/SKILL.md) for the recipe this repo follows; the harness checkout sits at `../dsh`.

## Layout

```
src/index.ts        host entry: function plugin (name/inject/Config/apply, no default export)
src/runtime.ts      AtFileRuntime (TypertRemoteService, @Remote search) — wire namespace `atFile`
src/mention.ts      Host pre-step mention expansion (scan @path, read file/dir, inject content) + mentionPreStep
src/contract.ts     one shared descriptor set + zod codecs + the FileEntry/FileContent types
src/typert.ts       strict host Typert manifest, registered via ctx.typert.register
src/settings.ts     the `at-file` settings namespace (enable switch)
src/files.ts        bounded workspace index walk + complete-result-bounded reads over node:fs
src/invariant.ts    ./invariant companion (real `No runtime invariant:` reason)
src/client/         browser half, served as the single file /plugins/dsh-at-file/client.js
  index.ts          apply: $mount the Remote contribution, register the @ source + dock + section + locale + styles
  remote.ts         hand-written TypertRemoteContribution + ctx.remote.atFile type merges
  source.ts         InputTriggerSource factory (per-session index cache, chip-reference picks + codec)
  search.ts         pure ranking (subsequence match, basename tier, dirs-first default)
  FilesDock.tsx     input.dock rows read from the input machine's chip occurrences (open/remove)
  SettingsSection.tsx  one labeled native enable checkbox over the settings scope
tests/              node-env specs; jsdom pragma on the browser specs
```

## Contracts with the harness (do not drift)

- The only wire endpoint is `atFile/search` (agent lookup → workspace index). File content NEVER crosses the wire: the Host expands `@path` tokens at the `agent/pre-step` boundary (see `src/mention.ts`) and injects user-role messages with source `at-file-mention`.
- The Host Gateway resolves the endpoint through the **strict Typert manifest** (`src/typert.ts`, registered via `ctx.typert.register`) — never through `@Remote` marker tables, because the harness's source-launch dev environment loads the gateway from protocol `src` while a profile-loaded plugin bundle loads protocol `lib` (two marker tables). The `@Remote` decorator stays for documentation and lib-consistent deployments.
- The descriptor set lives in `src/contract.ts` and is shared verbatim by the host manifest and the client contribution; the agent lookup codec's `typeSymbol` must stay `@deepseek-ai/dsh-session/types#SessionId`.
- The client composes only through the standing seams (`ctx.remote.$mount`, `inputTriggers.registerSource`, `ctx.slots.register`, `ctx.locale.register`, `ctx.settingsScope.bind`). The mounted Remote namespace is resolved through `ctx.reflect.get('remote.atFile')` — NOT the dotted `ctx.remote.atFile` read, which walks the fiber chain and stops at the Loader's runtime-less forks (verified live; the store path resolves by isolation label).
- The `@path` token grammar is `@[^\s@]+` and is produced in exactly two places: the source's codec (serialize/clipboardText emit it from chip refs at submit time) and the Host's `scanMentions` (which consumes it at the pre-step boundary). The client pick mints chip references (U+FFFC placeholders, basename labels) instead of writing tokens; the dock reads the input machine's occurrence table, never the raw draft. The grammar is the recognition contract, not one copy.
- Picked entries become **chip references**, not plain-text tokens: `onPick` returns an `insert` outcome (ref = full relative path, label = `@basename`) and the source owns a `codec` — `serialize` emits the full `@path` token (with the directory trailing slash and a separator space) that the Host expands; `clipboardText` emits the full token for copy/paste round-trips (paste-upgrade matches it against the lexicon roll).
- The `at-file` settings namespace is exposed to the Web by a one-line entry in the harness `WEB_SETTINGS_NAMESPACES` allowlist (harness-side commit); the plugin registers it via `ctx.settings.register` and the client reads/writes it through `ctx.settingsScope.bind`.
- The web server serves exactly one file per client plugin: keep the client bundle single-file; styles are the injected `styles.ts` string (no CSS artifacts).

## Check ladder

`pnpm run check` (typecheck + tests + build) must be green before every commit; `lib/` is committed (file: profile installs run without a build). Coverage: statements/branches/lines 100% per source file (`src/types.ts` is type-only and excluded); defensive arms take a `/* v8 ignore -- reason */` comment.

## Copy

Product copy is Chinese (locale dictionary in `src/client/locales.ts`); code comments, JSDoc, and the English README are English.
