/**
 * Pure display projections for the @file picker: the split of a relative path
 * into the row's name + path texts, and the inverse reconstruction the pick
 * route uses to resolve the candidate back to its index entry. (The model
 * forms moved to the Host's mention expansion, which is the sole content
 * producer now.)
 */
/** The directory prefix of a forward-slash relative path ('' for root-level files). */
export declare function dirnameOf(relative: string): string;
/** The basename of a forward-slash relative path. */
export declare function basenameOf(relative: string): string;
/** The picker row's dimmed path text: the directory portion, or './' for root-level entries. */
export declare function rowDescription(relative: string): string;
/**
 * Reconstruct the workspace-relative path from one picker row (its name and
 * path texts). The projection is lossless: dirname + basename identifies the
 * entry uniquely and './' stands for the root. A trailing slash on the name
 * is tolerated and stripped (the @path token grammar marks directories that
 * way, though picker rows no longer display it).
 */
export declare function relativeFromRow(name: string, description: string): string;
