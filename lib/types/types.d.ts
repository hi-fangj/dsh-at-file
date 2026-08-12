/**
 * dsh-at-file host contract types: the workspace file projection the search
 * Remote returns and the bounded text read the read Remote returns.
 */
/** One indexed workspace file, addressed by absolute and workspace-relative path. */
export interface FileEntry {
    /** Absolute path on the host filesystem (the read Remote's address). */
    readonly path: string;
    /** Workspace-root-relative display path, always forward-slash separated. */
    readonly relative: string;
}
/** One bounded text-file read served to the prompt serializer. */
export interface FileContent {
    /** Complete UTF-8 content, exactly `bytes` bytes. */
    readonly content: string;
    /** Byte length of `content`. */
    readonly bytes: number;
}
/** Resolved plugin configuration (schema defaults applied). */
export interface ResolvedConfig {
    /** Hard cap on indexed files per workspace; the walk stops and reports truncation. */
    readonly maxIndexedFiles: number;
    /** Hard cap on one read; larger files are refused, never truncated. */
    readonly maxFileBytes: number;
    /** Directory basenames the index walk skips entirely. */
    readonly ignoreDirs: readonly string[];
}
