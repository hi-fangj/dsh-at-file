/**
 * The client-side Typert Remote contribution for the dsh-at-file host
 * service: mounts the shared strict descriptors into `ctx.remote.atFile`.
 * The descriptors and codecs come from the shared contract module, so the
 * browser bundle and the host manifest stay on one wire definition.
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { AT_FILE_INVOCATIONS } from '../contract.ts'

export type { FileContent, FileEntry } from '../contract.ts'

/** The atFile Remote namespace's client contribution. */
export const AT_FILE_REMOTE: TypertRemoteContribution = {
  package: 'dsh-at-file',
  descriptors: AT_FILE_INVOCATIONS,
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  /** The `atFile` namespace face mounted under `ctx.remote.atFile`. */
  interface TypertRemoteNamespace$617446696c65 {
    search: (agentId: SessionId, signal?: AbortSignal) => Promise<RemoteResult<readonly import('../contract.ts').FileEntry[]>>
    read: (path: string, signal?: AbortSignal) => Promise<RemoteResult<import('../contract.ts').FileContent>>
  }
  interface TypertRemoteMap {
    'atFile/search': (agentId: SessionId, signal?: AbortSignal) => Promise<RemoteResult<readonly import('../contract.ts').FileEntry[]>>
    'atFile/read': (path: string, signal?: AbortSignal) => Promise<RemoteResult<import('../contract.ts').FileContent>>
  }
  interface TypertRemoteNamespaceMap {
    atFile: TypertRemoteNamespace$617446696c65
  }
}
