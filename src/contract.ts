/**
 * The atFile wire contract, shared verbatim by the host manifest
 * (`ctx.typert.register` in typert.ts) and the client contribution
 * (`ctx.remote.$mount` in client/remote.ts). One descriptor set is what pins
 * the wire names (`agentId`, `path`), the cancellation parameter, and the
 * result fields across the boundary: the client validates outbound and
 * inbound values against these strict codecs, and the Host Gateway resolves
 * and invokes the same endpoints through its registry.
 */
import { z } from 'zod'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'

/** One indexed workspace file (search result row). */
export interface FileEntry {
  readonly path: string
  readonly relative: string
}

/** One bounded text-file read (read result). */
export interface FileContent {
  readonly content: string
  readonly bytes: number
}

/** Wire codec: one session identity (branded string on the wire). */
export const sessionIdSchema = z.string().min(1)

/** Wire codec: one workspace file entry. */
export const fileEntrySchema = z.object({
  path: z.string().min(1),
  relative: z.string().min(1),
}).readonly()

/** Wire codec: one bounded text-file read. */
export const fileContentSchema = z.object({
  content: z.string(),
  bytes: z.number().int().nonnegative(),
}).readonly()

/** The atFile Remote namespace's strict invocation descriptors. */
export const AT_FILE_INVOCATIONS: readonly InvocationDescriptor[] = [
  {
    id: 'dsh-at-file#atFile/search',
    service: 'atFile',
    namespace: 'atFile',
    method: 'search',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'agent',
        wire: 'agentId',
        source: 'lookup',
        lookup: 'agent',
        // The type symbol must equal the agent lookup provider's wire identity
        // exactly — the gateway's strict path rejects a mismatched symbol.
        codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', schema: sessionIdSchema },
      },
    ],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-at-file#FileEntry[]',
      schema: z.array(fileEntrySchema),
    },
  },
  {
    id: 'dsh-at-file#atFile/read',
    service: 'atFile',
    namespace: 'atFile',
    method: 'read',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'path',
        wire: 'path',
        source: 'json',
        codec: { mode: 'strict', typeSymbol: 'dsh-at-file#Path', schema: z.string().min(1) },
      },
    ],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: 'dsh-at-file#FileContent',
      schema: fileContentSchema,
    },
  },
]
