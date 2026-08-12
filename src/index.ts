/**
 * dsh-at-file host plugin: mounts the `atFile` Typert Remote service
 * (workspace file search + bounded reads for the browser's @file picker).
 * The client half ships in the same package (`./client`); the web server
 * serves it under /plugins/dsh-at-file/client.js.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { AtFileRuntime } from './runtime.ts'
import type { ResolvedConfig } from './types.ts'

/** Cordis plugin name (the Loader entry and client bundle id). */
export const name = 'dsh-at-file'

/** Host plugin configuration, validated at load by the Loader. */
export interface Config {
  /** Hard cap on indexed files per workspace; the walk stops and reports truncation. */
  maxIndexedFiles: number
  /** Hard cap on one file read; larger files are refused, never truncated. */
  maxFileBytes: number
  /** Directory basenames the index walk skips entirely. */
  ignoreDirs: string[]
}

/**
 * Configuration schema: deployment-varying bounds stay tunable from
 * cordis.yml. The inferred schema type keeps the callable form accepting
 * partial input, so `Config({})` yields the defaults (what the Loader does
 * for cordis.yml compositions).
 */
export const Config = z.object({
  maxIndexedFiles: z.natural().min(1).default(5000),
  maxFileBytes: z.natural().min(1).default(256 * 1024),
  ignoreDirs: z.array(z.string()).default(['.git', 'node_modules']),
})

/**
 * Mount the atFile service.
 * @param ctx - host cordis context.
 * @param config - validated plugin configuration (schema defaults applied).
 */
export function apply(ctx: Context, config?: Config): void {
  const resolved: ResolvedConfig = Config(config ?? {})
  new AtFileRuntime(ctx, resolved)
}
