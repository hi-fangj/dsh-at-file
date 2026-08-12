/**
 * The dsh-at-file host Remote service (`ctx.atFile`, wire namespace `atFile`).
 * Registered as a TypertRemoteService so the Host Gateway's source-mode
 * discovery exports its @Remote methods to the Web client under
 * `/api/atFile/<method>` with zero generated artifacts: `search` takes the
 * resolved live Agent (the `agent` Typert lookup) and indexes its workspace,
 * `read` serves one bounded text read by absolute path.
 */
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { FileContent, FileEntry, ResolvedConfig } from './types.ts';
/** At-file workspace services: search the cwd index and read one file. */
export declare class AtFileRuntime extends TypertRemoteService {
    private readonly config;
    /**
     * Register the service under the `atFile` key (the wire namespace).
     * @param ctx - owning cordis context.
     * @param config - resolved plugin configuration.
     */
    constructor(ctx: Context, config: ResolvedConfig);
    /**
     * Index the addressed agent's workspace and return the bounded file list.
     * The client caches the list per session and filters per keystroke.
     * @param agent - the live agent resolved from the `agentId` wire field; its
     *   session header owns the workspace cwd.
     * @param signal - caller lifetime; the walk races it.
     * @returns workspace-root-relative entries with their absolute paths.
     */
    search(agent: Agent, signal: AbortSignal): Promise<readonly FileEntry[]>;
    /**
     * Read one file for the prompt serializer under the complete-result bounds.
     * @param path - absolute host path (the picker only offers such paths).
     * @param signal - caller lifetime.
     * @returns the UTF-8 content and its byte length.
     */
    read(path: string, signal: AbortSignal): Promise<FileContent>;
}
