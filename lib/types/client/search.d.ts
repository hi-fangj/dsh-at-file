/**
 * Pure file-search ranking for the @file menu: case-insensitive subsequence
 * matching over the workspace-relative path, with basename matches ranked
 * above full-path matches and earlier match positions above later ones. The
 * empty query falls back to directories first (so the picker reads as a
 * browsable tree, not a root-file list), then files, each alphabetical. Zero
 * DOM, zero cordis — the per-keystroke filter runs on the client's cached index.
 */
import type { FileEntry } from './remote.ts';
/** Ranked top-N files matching `query` (ties break by kind, length, then lexicographically). */
export declare function rankFiles(files: readonly FileEntry[], query: string, limit: number): readonly FileEntry[];
