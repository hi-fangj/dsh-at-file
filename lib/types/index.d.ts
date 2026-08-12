/**
 * dsh-at-file host plugin: mounts the `atFile` Typert Remote service
 * (workspace file search + bounded reads for the browser's @file picker) and
 * registers its strict Typert manifest so the Host Gateway resolves the wire
 * endpoints without consulting decorator marker tables. The client half
 * ships in the same package (`./client`); the web server serves it under
 * /plugins/dsh-at-file/client.js.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis plugin name (the Loader entry and client bundle id). */
export declare const name = "dsh-at-file";
/** Services required before load: the Typert registry the manifest registers into. */
export declare const inject: string[];
/** Host plugin configuration, validated at load by the Loader. */
export interface Config {
    /** Hard cap on indexed files per workspace; the walk stops and reports truncation. */
    maxIndexedFiles: number;
    /** Hard cap on one file read; larger files are refused, never truncated. */
    maxFileBytes: number;
    /** Directory basenames the index walk skips entirely. */
    ignoreDirs: string[];
}
/**
 * Configuration schema: deployment-varying bounds stay tunable from
 * cordis.yml. The inferred schema type keeps the callable form accepting
 * partial input, so `Config({})` yields the defaults (what the Loader does
 * for cordis.yml compositions).
 */
export declare const Config: z<Schemastery.ObjectS<{
    maxIndexedFiles: z<number, number>;
    maxFileBytes: z<number, number>;
    ignoreDirs: z<string[], string[]>;
}>, Schemastery.ObjectT<{
    maxIndexedFiles: z<number, number>;
    maxFileBytes: z<number, number>;
    ignoreDirs: z<string[], string[]>;
}>>;
/**
 * Mount the atFile service.
 * @param ctx - host cordis context.
 * @param config - validated plugin configuration (schema defaults applied).
 */
export declare function apply(ctx: Context, config?: Config): void;
