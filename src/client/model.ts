/**
 * Pure display projections for the @file picker: the split of a relative path
 * into the row's name + path texts, and the inverse reconstruction the pick
 * route uses to resolve the candidate back to its index entry. (The model
 * forms moved to the Host's mention expansion, which is the sole content
 * producer now.)
 */

/** The directory prefix of a forward-slash relative path ('' for root-level files). */
export function dirnameOf(relative: string): string {
  const at = relative.lastIndexOf('/')
  return at < 0 ? '' : relative.slice(0, at)
}

/** The basename of a forward-slash relative path. */
export function basenameOf(relative: string): string {
  const at = relative.lastIndexOf('/')
  return at < 0 ? relative : relative.slice(at + 1)
}

/** The picker row's dimmed path text: the directory portion, or './' for root-level entries. */
export function rowDescription(relative: string): string {
  const dir = dirnameOf(relative)
  return dir === '' ? './' : dir
}

/**
 * Reconstruct the workspace-relative path from one picker row (its name and
 * path texts). The projection is lossless: dirname + basename identifies the
 * entry uniquely and './' stands for the root. A trailing slash on the name
 * is tolerated and stripped (the @path token grammar marks directories that
 * way, though picker rows no longer display it).
 */
export function relativeFromRow(name: string, description: string): string {
  const base = name.endsWith('/') ? name.slice(0, -1) : name
  const dir = description === './' ? '' : description
  return dir === '' ? base : `${dir}/${base}`
}
