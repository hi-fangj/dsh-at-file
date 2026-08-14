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
import ignore from 'ignore'
import { readFile } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'

/** One rule level: the rules read from one `.gitignore` (or info/exclude), relative to `dir`. */
export interface GitignoreLevel {
  /** Absolute directory the level's patterns are relative to. */
  readonly dir: string
  /** The enclosing level (the directory's own rules extend it). */
  readonly parent: GitignoreLevel | null
  /** The matcher for this level's patterns, testing paths relative to `dir`. */
  readonly matcher: ignore.Ignore
}

/** True when `path` equals `root` or sits underneath it. */
function isWithin(root: string, path: string): boolean {
  return path === root || path.startsWith(`${root}${sep}`)
}

/** Read one ignore file's text, or null when it is absent or unreadable. */
async function readIfExists(path: string, signal: AbortSignal | undefined): Promise<string | null> {
  signal?.throwIfAborted()
  try {
    return await readFile(path, 'utf8')
  } catch {
    // Missing .gitignore is the common case; any read failure degrades to
    // "no rules here" rather than failing the walk.
    return null
  }
}

/** The workspace's gitignore matcher, rooted at the session cwd. */
export class GitignoreMatcher {
  private constructor(
    readonly workspaceRoot: string,
    readonly root: GitignoreLevel | null,
  ) {}

  /**
   * Load the workspace's root rules: the root `.gitignore` and
   * `.git/info/exclude` (both relative to the workspace root).
   * @param workspaceRoot - the session cwd (absolute).
   * @param signal - caller lifetime.
   */
  static async load(workspaceRoot: string, signal?: AbortSignal): Promise<GitignoreMatcher> {
    const matcher = ignore()
    const rootGitignore = await readIfExists(join(workspaceRoot, '.gitignore'), signal)
    const infoExclude = await readIfExists(join(workspaceRoot, '.git', 'info', 'exclude'), signal)
    if (rootGitignore !== null) matcher.add(rootGitignore)
    if (infoExclude !== null) matcher.add(infoExclude)
    const root: GitignoreLevel | null =
      rootGitignore !== null || infoExclude !== null
        ? { dir: workspaceRoot, parent: null, matcher }
        : null
    return new GitignoreMatcher(workspaceRoot, root)
  }

  /**
   * Whether the absolute `path` is ignored by the rule chain ending at `level`.
   * The chain is walked deepest-first so a deeper (or negating) rule overrides
   * a shallower one, matching git's precedence.
   * @param path - absolute path to test.
   * @param isDirectory - append a trailing slash so directory-only patterns match.
   * @param level - the chain head (the deepest loaded level on the path).
   */
  ignores(path: string, isDirectory: boolean, level: GitignoreLevel | null): boolean {
    for (let current = level; current !== null; current = current.parent) {
      const rel = relative(current.dir, path)
      // Only descendant paths are meaningful for this level's rules.
      if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`)) continue
      const probe = isDirectory ? `${rel}/` : rel
      const result = current.matcher.test(probe)
      if (result.ignored) return true
      if (result.unignored) return false
    }
    return false
  }

  /**
   * Load the rule level for a directory by reading its `.gitignore` (if any),
   * extending `parent`. Returns `parent` unchanged when the file is absent.
   * @param dir - absolute directory whose `.gitignore` to load.
   * @param parent - the enclosing level.
   * @param signal - caller lifetime.
   */
  async childLevel(
    dir: string,
    parent: GitignoreLevel | null,
    signal?: AbortSignal,
  ): Promise<GitignoreLevel | null> {
    const content = await readIfExists(join(dir, '.gitignore'), signal)
    if (content === null) return parent
    return { dir, parent, matcher: ignore().add(content) }
  }

  /**
   * Build the chain of levels from the workspace root down to `dir` (inclusive
   * of `dir`'s own `.gitignore`), so a walk starting at `dir` can test its
   * children against the complete ancestor rules.
   * @param dir - absolute directory under the workspace root.
   * @param signal - caller lifetime.
   */
  async levelFor(dir: string, signal?: AbortSignal): Promise<GitignoreLevel | null> {
    if (!isWithin(this.workspaceRoot, dir)) return this.root
    const chain: string[] = []
    let current = dir
    while (current !== this.workspaceRoot) {
      chain.unshift(current)
      current = dirname(current)
    }
    let level = this.root
    for (const directory of chain) {
      level = await this.childLevel(directory, level, signal)
    }
    return level
  }
}
