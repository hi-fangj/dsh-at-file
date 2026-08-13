/**
 * The atFile wire contract, shared verbatim by the host manifest
 * (`ctx.typert.register` in typert.ts) and the client contribution
 * (`ctx.remote.$mount` in client/remote.ts). The only Remote endpoint is the
 * workspace index search; file content reaches the model through the Host's
 * `agent/pre-step` boundary, not through a wire read.
 */
import { z } from 'zod';
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol';
/** One indexed workspace entry (a file or a directory), with its display path. */
export interface FileEntry {
    readonly path: string;
    readonly relative: string;
    readonly kind: 'file' | 'dir';
}
/** One bounded text-file read (the Host mention expansion's file result). */
export interface FileContent {
    readonly content: string;
    readonly bytes: number;
}
/** One file read inside a directory attachment. */
export interface ReadTreeFile {
    readonly path: string;
    readonly relative: string;
    readonly content: string;
    readonly bytes: number;
}
/** One bounded directory read (the Host mention expansion's directory result). */
export interface ReadTreeResult {
    readonly files: readonly ReadTreeFile[];
    readonly truncated: boolean;
}
/** The `at-file` settings namespace's durable shape (host and client share it). */
export interface AtFileSettings {
    /** Whether the @file surface is enabled; false hides picker, dock, and expansion. */
    readonly enabled: boolean;
}
/** Wire codec: one session identity (branded string on the wire). */
export declare const sessionIdSchema: z.ZodString;
/** Wire codec: one workspace entry (file or directory). */
export declare const fileEntrySchema: z.ZodReadonly<z.ZodObject<{
    path: z.ZodString;
    relative: z.ZodString;
    kind: z.ZodEnum<{
        file: "file";
        dir: "dir";
    }>;
}, z.core.$strip>>;
/** The atFile Remote namespace's strict invocation descriptors. */
export declare const AT_FILE_INVOCATIONS: readonly InvocationDescriptor[];
