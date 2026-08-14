/**
 * Workspace gitignore support: reads the workspace's own git ignore rules
 * (the root `.gitignore`, nested `.gitignore` files, and `.git/info/exclude`)
 * and answers whether a path is ignored, with git's own precedence — a deeper
 * rule overrides a shallower one, and a negation re-includes. When the
 * workspace has no ignore files the matcher is a no-op, so the walk and the
 * mention boundary can consult it unconditionally.
 *
 * The matcher is confined to the workspace root: rules above it (a parent
 * repository when the session cwd is a subdirectory) are never read, matching
 * the walk's existing confinement.
 */
import ignore from 'ignore';
/** One rule level: the rules read from one `.gitignore` (or info/exclude), relative to `dir`. */
export interface GitignoreLevel {
    /** Absolute directory the level's patterns are relative to. */
    readonly dir: string;
    /** The enclosing level (the directory's own rules extend it). */
    readonly parent: GitignoreLevel | null;
    /** The matcher for this level's patterns, testing paths relative to `dir`. */
    readonly matcher: ignore.Ignore;
}
/** The workspace's gitignore matcher, rooted at the session cwd. */
export declare class GitignoreMatcher {
    readonly workspaceRoot: string;
    readonly root: GitignoreLevel | null;
    private constructor();
    /**
     * Load the workspace's root rules: the root `.gitignore` and
     * `.git/info/exclude` (both relative to the workspace root).
     * @param workspaceRoot - the session cwd (absolute).
     * @param signal - caller lifetime.
     */
    static load(workspaceRoot: string, signal?: AbortSignal): Promise<GitignoreMatcher>;
    /**
     * Whether the absolute `path` is ignored by the rule chain ending at `level`.
     * The chain is walked deepest-first so a deeper (or negating) rule overrides
     * a shallower one, matching git's precedence.
     * @param path - absolute path to test.
     * @param isDirectory - append a trailing slash so directory-only patterns match.
     * @param level - the chain head (the deepest loaded level on the path).
     */
    ignores(path: string, isDirectory: boolean, level: GitignoreLevel | null): boolean;
    /**
     * Load the rule level for a directory by reading its `.gitignore` (if any),
     * extending `parent`. Returns `parent` unchanged when the file is absent.
     * @param dir - absolute directory whose `.gitignore` to load.
     * @param parent - the enclosing level.
     * @param signal - caller lifetime.
     */
    childLevel(dir: string, parent: GitignoreLevel | null, signal?: AbortSignal): Promise<GitignoreLevel | null>;
    /**
     * Build the chain of levels from the workspace root down to `dir` (inclusive
     * of `dir`'s own `.gitignore`), so a walk starting at `dir` can test its
     * children against the complete ancestor rules.
     * @param dir - absolute directory under the workspace root.
     * @param signal - caller lifetime.
     */
    levelFor(dir: string, signal?: AbortSignal): Promise<GitignoreLevel | null>;
}
