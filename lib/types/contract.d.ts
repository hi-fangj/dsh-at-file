/**
 * The atFile wire contract, shared verbatim by the host manifest
 * (`ctx.typert.register` in typert.ts) and the client contribution
 * (`ctx.remote.$mount` in client/remote.ts). One descriptor set is what pins
 * the wire names (`agentId`, `path`), the cancellation parameter, and the
 * result fields across the boundary: the client validates outbound and
 * inbound values against these strict codecs, and the Host Gateway resolves
 * and invokes the same endpoints through its registry.
 */
import { z } from 'zod';
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol';
/** One indexed workspace file (search result row). */
export interface FileEntry {
    readonly path: string;
    readonly relative: string;
}
/** One bounded text-file read (read result). */
export interface FileContent {
    readonly content: string;
    readonly bytes: number;
}
/** Wire codec: one session identity (branded string on the wire). */
export declare const sessionIdSchema: z.ZodString;
/** Wire codec: one workspace file entry. */
export declare const fileEntrySchema: z.ZodReadonly<z.ZodObject<{
    path: z.ZodString;
    relative: z.ZodString;
}, z.core.$strip>>;
/** Wire codec: one bounded text-file read. */
export declare const fileContentSchema: z.ZodReadonly<z.ZodObject<{
    content: z.ZodString;
    bytes: z.ZodNumber;
}, z.core.$strip>>;
/** The atFile Remote namespace's strict invocation descriptors. */
export declare const AT_FILE_INVOCATIONS: readonly InvocationDescriptor[];
