/**
 * Pure projections shared by the @file source and its tests: the model form
 * one attached file becomes inside the outgoing prompt, and the display split
 * of a relative path into basename + directory for the picker rows.
 */
/**
 * The prompt serialization of one attached file: a path-tagged block the
 * model reads as "this file, its content". The tag mirrors the picker's
 * workspace-relative path so the model can quote it back to the user.
 * @param relative - workspace-relative display path.
 * @param content - complete file content.
 * @returns the literal model text replacing the chip placeholder at submit.
 */
export declare function modelForm(relative: string, content: string): string;
/** The directory prefix of a forward-slash relative path ('' for root-level files). */
export declare function dirnameOf(relative: string): string;
/** The basename of a forward-slash relative path. */
export declare function basenameOf(relative: string): string;
