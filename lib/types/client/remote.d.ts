import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client';
/** One indexed workspace file (mirror of the host FileEntry wire value). */
export interface FileEntry {
    readonly path: string;
    readonly relative: string;
}
/** One bounded text-file read (mirror of the host FileContent wire value). */
export interface FileContent {
    readonly content: string;
    readonly bytes: number;
}
/** The atFile Remote namespace's strict invocation descriptors. */
export declare const AT_FILE_REMOTE: TypertRemoteContribution;
declare module '@deepseek-ai/dsh-typert-protocol' {
    /** The `atFile` namespace face mounted under `ctx.remote.atFile`. */
    interface TypertRemoteNamespace$617446696c65 {
        search: (agentId: SessionId, signal?: AbortSignal) => Promise<RemoteResult<readonly FileEntry[]>>;
        read: (path: string, signal?: AbortSignal) => Promise<RemoteResult<FileContent>>;
    }
    interface TypertRemoteMap {
        'atFile/search': (agentId: SessionId, signal?: AbortSignal) => Promise<RemoteResult<readonly FileEntry[]>>;
        'atFile/read': (path: string, signal?: AbortSignal) => Promise<RemoteResult<FileContent>>;
    }
    interface TypertRemoteNamespaceMap {
        atFile: TypertRemoteNamespace$617446696c65;
    }
}
