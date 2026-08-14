/**
 * Workspace gitignore support: reading the root/nested .gitignore files and
 * .git/info/exclude, git-precedence matching (deeper rules and negations
 * override shallower ones), directory-only patterns, and the workspace-root
 * confinement of levelFor.
 */
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GitignoreMatcher } from '../src/gitignore.ts'

/** Write one file per entry (keys are forward-slash paths relative to root). */
async function writeTree(root: string, entries: Record<string, string>): Promise<void> {
  for (const [rel, content] of Object.entries(entries)) {
    const path = join(root, ...rel.split('/'))
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content)
  }
}

describe('GitignoreMatcher.load', () => {
  it('is a no-op matcher when the workspace has no ignore files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      const matcher = await GitignoreMatcher.load(root)
      expect(matcher.root).toBeNull()
      expect(matcher.ignores(join(root, 'a.ts'), false, matcher.root)).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reads the root .gitignore', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, { '.gitignore': 'dist/\n*.log\n' })
      const matcher = await GitignoreMatcher.load(root)
      expect(matcher.root).not.toBeNull()
      expect(matcher.ignores(join(root, 'dist'), true, matcher.root)).toBe(true)
      expect(matcher.ignores(join(root, 'a.log'), false, matcher.root)).toBe(true)
      expect(matcher.ignores(join(root, 'a.ts'), false, matcher.root)).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('merges .git/info/exclude into the root rules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, { '.git/info/exclude': 'secret.txt\n' })
      const matcher = await GitignoreMatcher.load(root)
      expect(matcher.root).not.toBeNull()
      expect(matcher.ignores(join(root, 'secret.txt'), false, matcher.root)).toBe(true)
      expect(matcher.ignores(join(root, 'a.ts'), false, matcher.root)).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('combines both the root .gitignore and .git/info/exclude', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, { '.gitignore': 'a.log\n', '.git/info/exclude': 'b.log\n' })
      const matcher = await GitignoreMatcher.load(root)
      expect(matcher.ignores(join(root, 'a.log'), false, matcher.root)).toBe(true)
      expect(matcher.ignores(join(root, 'b.log'), false, matcher.root)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('races the load against an already-aborted signal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      const controller = new AbortController()
      controller.abort(new Error('gone'))
      await expect(GitignoreMatcher.load(root, controller.signal)).rejects.toThrow('gone')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('GitignoreMatcher.ignores', () => {
  it('matches a directory-only pattern only when the probe carries the trailing slash', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, { '.gitignore': 'config/\n' })
      const matcher = await GitignoreMatcher.load(root)
      expect(matcher.ignores(join(root, 'config'), true, matcher.root)).toBe(true)
      expect(matcher.ignores(join(root, 'config'), false, matcher.root)).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('re-includes a path a later negation un-ignores within one level', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, { '.gitignore': '*.log\n!keep.log\n' })
      const matcher = await GitignoreMatcher.load(root)
      expect(matcher.ignores(join(root, 'keep.log'), false, matcher.root)).toBe(false)
      expect(matcher.ignores(join(root, 'other.log'), false, matcher.root)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('lets a deeper level override a shallower one', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, { '.gitignore': '*.log\n', 'sub/.gitignore': '!keep.log\n' })
      const matcher = await GitignoreMatcher.load(root)
      const subLevel = await matcher.childLevel(join(root, 'sub'), matcher.root)
      expect(matcher.ignores(join(root, 'sub', 'keep.log'), false, subLevel)).toBe(false)
      expect(matcher.ignores(join(root, 'sub', 'other.log'), false, subLevel)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('falls through to not-ignored when no level matches', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, { '.gitignore': '*.log\n' })
      const matcher = await GitignoreMatcher.load(root)
      expect(matcher.ignores(join(root, 'a.ts'), false, matcher.root)).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('ignores a path tested against its own level (empty relative path)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, { '.gitignore': '*.log\n' })
      const matcher = await GitignoreMatcher.load(root)
      expect(matcher.ignores(root, true, matcher.root)).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('ignores a path outside the level directory (parent and sibling relative paths)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, { '.gitignore': '*.log\n', 'sub/.gitignore': 'x.txt\n' })
      const matcher = await GitignoreMatcher.load(root)
      const subLevel = await matcher.childLevel(join(root, 'sub'), matcher.root)
      // The level's dir is root/sub; root is its parent and sibling is a sibling.
      expect(matcher.ignores(root, true, subLevel)).toBe(false)
      expect(matcher.ignores(join(root, 'sibling'), true, subLevel)).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('GitignoreMatcher.childLevel', () => {
  it('returns the parent unchanged when the directory has no .gitignore', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, { '.gitignore': '*.log\n' })
      const matcher = await GitignoreMatcher.load(root)
      const empty = join(root, 'empty')
      await mkdir(empty)
      expect(await matcher.childLevel(empty, matcher.root)).toBe(matcher.root)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('returns a new level extending the parent when a .gitignore exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, { '.gitignore': '*.log\n', 'sub/.gitignore': 'x.txt\n' })
      const matcher = await GitignoreMatcher.load(root)
      const level = await matcher.childLevel(join(root, 'sub'), matcher.root)
      expect(level).not.toBeNull()
      expect(level!.dir).toBe(join(root, 'sub'))
      expect(level!.parent).toBe(matcher.root)
      expect(matcher.ignores(join(root, 'sub', 'x.txt'), false, level)).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('GitignoreMatcher.levelFor', () => {
  it('returns the root level for a path outside the workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, { '.gitignore': '*.log\n' })
      const matcher = await GitignoreMatcher.load(root)
      expect(await matcher.levelFor(join(tmpdir(), 'elsewhere'))).toBe(matcher.root)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('returns the root level for the workspace root itself', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, { '.gitignore': '*.log\n' })
      const matcher = await GitignoreMatcher.load(root)
      expect(await matcher.levelFor(root)).toBe(matcher.root)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('builds the ancestor chain for a nested directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-gitignore-'))
    try {
      await writeTree(root, {
        '.gitignore': '*.log\n',
        'a/.gitignore': 'skip.txt\n',
        'a/b/.gitignore': 'deep.txt\n',
      })
      const matcher = await GitignoreMatcher.load(root)
      const level = await matcher.levelFor(join(root, 'a', 'b'))
      expect(matcher.ignores(join(root, 'a', 'b', 'x.log'), false, level)).toBe(true)
      expect(matcher.ignores(join(root, 'a', 'b', 'skip.txt'), false, level)).toBe(true)
      expect(matcher.ignores(join(root, 'a', 'b', 'deep.txt'), false, level)).toBe(true)
      expect(matcher.ignores(join(root, 'a', 'b', 'ok.ts'), false, level)).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
