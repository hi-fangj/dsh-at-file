/**
 * Pure file-search ranking for the @file menu: case-insensitive subsequence
 * matching over the workspace-relative path, with basename matches ranked
 * above full-path matches and earlier match positions above later ones. The
 * empty query falls back to directories first (so the picker reads as a
 * browsable tree, not a root-file list), then files, each alphabetical. Zero
 * DOM, zero cordis — the per-keystroke filter runs on the client's cached index.
 */
import type { FileEntry } from './remote.ts'

/** Ranked top-N files matching `query` (ties break by kind, length, then lexicographically). */
export function rankFiles(
  files: readonly FileEntry[],
  query: string,
  limit: number,
): readonly FileEntry[] {
  const q = query.trim().toLowerCase()
  if (q === '') {
    return [...files].sort(byDefault).slice(0, limit)
  }
  return files
    .map(file => ({ file, score: scorePath(file.relative, q) }))
    .filter(entry => entry.score >= 0)
    .sort((a, b) => b.score - a.score
      || (a.file.kind === 'dir' ? 1 : 0) - (b.file.kind === 'dir' ? 1 : 0)
      || a.file.relative.length - b.file.relative.length
      || (a.file.relative < b.file.relative ? -1 : 1))
    .slice(0, limit)
    .map(entry => entry.file)
}

/** Default order: directories first (alphabetical), then files (alphabetical). */
function byDefault(a: FileEntry, b: FileEntry): number {
  if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
  // Unique relative paths make the equality arm unreachable.
  /* v8 ignore next -- identical paths cannot both exist in one index. */
  return a.relative < b.relative ? -1 : 1
}

/**
 * Match score for one path against one normalized query; -1 means no match.
 * A basename subsequence wins over a full-path one, and the earliest greedy
 * match position wins inside each tier (a basename prefix match ranks top).
 * @param path - workspace-relative path with forward slashes.
 * @param q - lowercased trimmed query.
 * @returns non-negative score, or -1 when the query is not a subsequence.
 */
function scorePath(path: string, q: string): number {
  const lower = path.toLowerCase()
  const base = lower.slice(lower.lastIndexOf('/') + 1)
  const inBase = subsequenceIndices(base, q)
  if (inBase !== null) return 2000 - inBase[0]
  const inPath = subsequenceIndices(lower, q)
  if (inPath !== null) return 1000 - inPath[0] - path.length
  return -1
}

/**
 * Greedy earliest subsequence match of `needle` inside `hay`.
 * @returns the matched indices, or null when `needle` is not a subsequence.
 */
function subsequenceIndices(hay: string, needle: string): readonly number[] | null {
  /* v8 ignore next -- rankFiles guards the empty query before any score call. */
  if (needle === '') return []
  const indices: number[] = []
  let at = 0
  for (const ch of needle) {
    const found = hay.indexOf(ch, at)
    if (found < 0) return null
    indices.push(found)
    at = found + 1
  }
  return indices
}
