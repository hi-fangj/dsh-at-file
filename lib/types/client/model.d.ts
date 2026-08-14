/**
 * Pure display projections for the @file picker: the split of a relative path
 * into its directory prefix and basename (the pick route resolves candidates
 * through the source-owned `value`, never a name+path reconstruction). The
 * model forms moved to the Host's mention expansion, which is the sole
 * content producer now.
 */
/** The directory prefix of a forward-slash relative path ('' for root-level files). */
export declare function dirnameOf(relative: string): string;
/** The basename of a forward-slash relative path. */
export declare function basenameOf(relative: string): string;
