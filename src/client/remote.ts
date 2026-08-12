/**
 * Hand-written Typert Remote contribution for the dsh-at-file host service.
 * The Host Gateway resolves the wire endpoints through its source-mode
 * discovery (the AtFileRuntime @Remote methods); this module supplies the
 * strict client-side descriptors the Client Gateway mounts into
 * `ctx.remote.atFile`, with zod codecs validating every boundary value in
 * both directions. Pure data plus types — safe for the single-file browser
 * bundle and for the host-side tests that mirror it.
 */
import { z } from 'zod'
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'

/** One indexed workspace file (mirror of the host FileEntry wire value). */
export interface FileEntry {
  readonly path: string
  readonly relative: string
}

/** One bounded text-file read (mirror of the host FileContent wire value). */
export interface FileContent {
  readonly content: string
  readonly bytes: number
}

/** Wire codec: one session identity (branded string on the wire). */
const sessionIdSchema = z.string().min(1)

/** Wire codec: one workspace file entry. */
const fileEntrySchema = z.object({
  path: z.string().min(1),
  relative: z.string().min(1),
}).readonly()

/** Wire codec: one bounded text-file read. */
const fileContentSchema = z.object({
  content: z.string(),
  bytes: z.number().int().nonnegative(),
}).readonly()

/** The atFile Remote namespace's strict invocation descriptors. */
export const AT_FILE_REMOTE: TypertRemoteContribution = {
  package: 'dsh-at-file',
  descriptors: [
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
          codec: { mode: 'strict', typeSymbol: 'dsh-at-file#SessionId', schema: sessionIdSchema },
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
  ],
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  /** The `atFile` namespace face mounted under `ctx.remote.atFile`. */
  interface TypertRemoteNamespace$617446696c65 {
    search: (agentId: SessionId, signal?: AbortSignal) => Promise<RemoteResult<readonly FileEntry[]>>
    read: (path: string, signal?: AbortSignal) => Promise<RemoteResult<FileContent>>
  }
  interface TypertRemoteMap {
    'atFile/search': (agentId: SessionId, signal?: AbortSignal) => Promise<RemoteResult<readonly FileEntry[]>>
    'atFile/read': (path: string, signal?: AbortSignal) => Promise<RemoteResult<FileContent>>
  }
  interface TypertRemoteNamespaceMap {
    atFile: TypertRemoteNamespace$617446696c65
  }
}
