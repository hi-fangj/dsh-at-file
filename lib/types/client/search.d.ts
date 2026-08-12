/**
 * Pure file-search ranking for the @file menu: case-insensitive subsequence
 * matching over the workspace-relative path, with basename matches ranked
 * above full-path matches and earlier match positions above later ones. The
 * empty query falls back to a shallow-first default order. Zero DOM, zero
 * cordis — the per-keystroke filter runs on the client's cached index.
 */
import type { FileEntry } from './remote.ts';
/** Ranked top-N files matching `query` (ties break by path length, then lexicographically). */
export declare function rankFiles(files: readonly FileEntry[], query: string, limit: number): readonly FileEntry[];
