# AGENTS.md

Out-of-tree DeepSeek Harness plugin (host + Web client bundle). Read [dsh-plugin-create](../../dsh/.agents/skills/dsh-plugin-create/SKILL.md) for the recipe this repo follows; the harness checkout sits at `../dsh`.

## Layout

```
src/index.ts        host entry: function plugin (name/inject/Config/apply, no default export)
src/runtime.ts      AtFileRuntime (TypertRemoteService, @Remote search/read) — wire namespace `atFile`
src/files.ts        bounded workspace index walk + complete-result-bounded reads over node:fs
src/invariant.ts    ./invariant companion (real `No runtime invariant:` reason)
src/client/         browser half, served as the single file /plugins/dsh-at-file/client.js
  index.ts          apply: $mount the Remote contribution, register the @ source + dock + locale + styles
  remote.ts         hand-written TypertRemoteContribution (strict zod codecs) + ctx.remote.atFile type merges
  source.ts         InputTriggerSource factory (per-session index cache, codec serialization)
  search.ts         pure ranking (subsequence match, basename tier, deterministic ties)
  FilesDock.tsx     input.dock rows: open file via host.openPath, remove chip via setDraft
tests/              node-env specs; jsdom pragma on the two browser specs
```

## Contracts with the harness (do not drift)

- The wire endpoints are `atFile/search` (agent lookup → workspace index) and `atFile/read` (absolute path → bounded text). The Host Gateway resolves them from the `@Remote` methods' parameter NAMES (`agent`, `signal`); the client descriptors in `remote.ts` must keep the same wire fields (`agentId`, `path`).
- Client code composes only through the standing seams: `ctx.remote.$mount`, `inputTriggers.registerSource`, `ctx.slots.register`, `ctx.locale.register`. No harness source is imported at runtime; every harness package is an optional peer (type-only where possible).
- The web server serves exactly one file per client plugin: keep the client bundle single-file; styles are the injected `styles.ts` string (no CSS artifacts).

## Check ladder

`pnpm run check` (typecheck + tests + build) must be green before every commit; `lib/` is committed (file: profile installs run without a build). Coverage: statements/branches/lines 100% per source file (`src/types.ts` is type-only and excluded); defensive arms take a `/* v8 ignore -- reason */` comment.

## Copy

Product copy is Chinese (locale dictionary in `src/client/locales.ts`); code comments, JSDoc, and the English README are English.
