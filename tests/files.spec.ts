/**
 * Host filesystem behaviors: bounded index walks (ignore dirs, symlinked
 * directories skipped, cap truncation, forward-slash relative paths) and
 * complete-result-bounded reads (absolute-path fence, missing/directory/
 * oversized/binary refusals, abort racing).
 */
import { mkdtemp, mkdir, symlink, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { indexWorkspace, isIgnoredFileType, readFileText, readTree } from '../src/files.ts'
import { DEFAULT_IGNORE_DIRS } from '../src/defaults.ts'
import { GitignoreMatcher } from '../src/gitignore.ts'

/** Build a fresh fixture tree and hand back its root (caller removes it). */
async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-'))
  await mkdir(join(root, 'src', 'client'), { recursive: true })
  await mkdir(join(root, 'node_modules', 'pkg'), { recursive: true })
  await mkdir(join(root, '.git', 'objects'), { recursive: true })
  await mkdir(join(root, 'empty'), { recursive: true })
  await writeFile(join(root, 'README.md'), '# root\n')
  await writeFile(join(root, 'src', 'index.ts'), 'export {}\n')
  await writeFile(join(root, 'src', 'client', 'view.ts'), 'export {}\n')
  await writeFile(join(root, 'node_modules', 'pkg', 'ignored.ts'), 'ignored\n')
  await writeFile(join(root, '.git', 'config'), '[core]\n')
  await symlink(join(root, 'src'), join(root, 'linked-src'), 'dir')
  await writeFile(join(root, 'data.bin'), Buffer.from([0x00, 0x01, 0x02]))
  return root
}

describe('indexWorkspace', () => {
  it('collects files and directories as forward-slash relative entries, sorted by path', async () => {
    const root = await fixture()
    try {
      const { files, truncated } = await indexWorkspace(root, { maxFiles: 100, ignoreDirs: ['.git', 'node_modules'], ignoreFileExtensions: [] })
      expect(truncated).toBe(false)
      expect(files.map(file => `${file.kind}:${file.relative}`)).toEqual([
        'file:README.md',
        'file:data.bin',
        'dir:empty',
        'dir:src',
        'dir:src/client',
        'file:src/client/view.ts',
        'file:src/index.ts',
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('skips ignore dirs and symlinked directories, includes every remaining file', async () => {
    const root = await fixture()
    try {
      const { files } = await indexWorkspace(root, { maxFiles: 100, ignoreDirs: ['.git', 'node_modules'], ignoreFileExtensions: [] })
      const relatives = files.map(file => file.relative)
      expect(relatives).toContain('src/index.ts')
      expect(relatives).toContain('src/client/view.ts')
      expect(relatives).toContain('data.bin')
      expect(files.find(file => file.relative === 'src')?.kind).toBe('dir')
      expect(relatives.some(rel => rel.includes('node_modules'))).toBe(false)
      expect(relatives.some(rel => rel.includes('.git'))).toBe(false)
      expect(relatives.some(rel => rel.startsWith('linked-src'))).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('default ignores remove common IDE metadata, caches, dependencies, and build output', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-default-ignore-'))
    const ignored = [
      '.idea', '.vs', '.vscode', '.settings', '.gradle', '.cxx', 'build', 'bin', 'target',
      'cmake-build-debug', '.pytest_cache', 'DerivedData', 'node_modules',
    ]
    try {
      for (const directory of ignored) {
        await mkdir(join(root, directory), { recursive: true })
        await writeFile(join(root, directory, 'noise.txt'), 'noise\n')
      }
      await mkdir(join(root, 'src'), { recursive: true })
      await writeFile(join(root, 'src', 'main.kt'), 'fun main() {}\n')

      const { files } = await indexWorkspace(root, { maxFiles: 100, ignoreDirs: DEFAULT_IGNORE_DIRS, ignoreFileExtensions: [] })
      const relatives = files.map(file => file.relative)
      expect(relatives).toContain('src/main.kt')
      for (const directory of ignored) {
        expect(relatives.some(path => path === directory || path.startsWith(`${directory}/`))).toBe(false)
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('carries the absolute path on every entry', async () => {
    const root = await fixture()
    try {
      const { files } = await indexWorkspace(root, { maxFiles: 100, ignoreDirs: [], ignoreFileExtensions: [] })
      const readme = files.find(file => file.relative === 'README.md')
      expect(readme?.path).toBe(join(root, 'README.md'))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('stops at the file cap and reports truncation honestly', async () => {
    const root = await fixture()
    try {
      const { files, truncated } = await indexWorkspace(root, { maxFiles: 2, ignoreDirs: ['.git', 'node_modules'], ignoreFileExtensions: [] })
      expect(files).toHaveLength(2)
      expect(truncated).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a missing root with a readable error', async () => {
    await expect(indexWorkspace(
      join(tmpdir(), 'dsh-at-file-missing-root'),
      { maxFiles: 10, ignoreDirs: [], ignoreFileExtensions: [] },
      new AbortController().signal,
    )).rejects.toThrow(/cannot list/)
  })

  it('races the walk against an already-aborted signal', async () => {
    const root = await fixture()
    try {
      const controller = new AbortController()
      controller.abort(new Error('gone'))
      await expect(indexWorkspace(root, { maxFiles: 10, ignoreDirs: [], ignoreFileExtensions: [] }, controller.signal))
        .rejects.toThrow('gone')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('wraps a non-Error abort reason into an Error', async () => {
    const root = await fixture()
    try {
      const controller = new AbortController()
      controller.abort('plain reason')
      await expect(indexWorkspace(root, { maxFiles: 10, ignoreDirs: [], ignoreFileExtensions: [] }, controller.signal))
        .rejects.toThrow('plain reason')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('skips non-file dirents such as named pipes', async (context) => {
    if (process.platform === 'win32') return context.skip()
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-fifo-'))
    const { execFileSync } = await import('node:child_process')
    execFileSync('mkfifo', [join(root, 'pipe')])
    try {
      const { files } = await indexWorkspace(root, { maxFiles: 10, ignoreDirs: [], ignoreFileExtensions: [] })
      expect(files).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('skips files whose extension is ignored (case-insensitive, dot-optional) and keeps extension-less files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-ext-'))
    await writeFile(join(root, 'keep.ts'), 'keep\n')
    await writeFile(join(root, 'skip.png'), 'skip\n')
    await writeFile(join(root, 'photo.JPG'), 'jpg\n')
    await writeFile(join(root, 'README'), 'no extension\n')
    try {
      const { files } = await indexWorkspace(root, {
        maxFiles: 10,
        ignoreDirs: [],
        ignoreFileExtensions: ['.png', 'jpg'],
      })
      expect(files.map(file => file.relative)).toEqual(['README', 'keep.ts'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('isIgnoredFileType', () => {
  it('matches by extension case-insensitively and tolerates a missing leading dot', () => {
    expect(isIgnoredFileType('a/b.png', ['.png'])).toBe(true)
    expect(isIgnoredFileType('a/b.PNG', ['png'])).toBe(true)
    expect(isIgnoredFileType('a/b.ts', ['.png'])).toBe(false)
    expect(isIgnoredFileType('a/README', ['.png'])).toBe(false)
    expect(isIgnoredFileType('a/b.png', [])).toBe(false)
  })
})

describe('readFileText', () => {
  it('reads a text file with its exact byte length', async () => {
    const root = await fixture()
    try {
      const result = await readFileText(join(root, 'README.md'), 1024)
      expect(result.content).toBe('# root\n')
      expect(result.bytes).toBe(7)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('refuses relative paths instead of rebasing them', async () => {
    await expect(readFileText('README.md', 1024)).rejects.toThrow(/not an absolute path/)
  })

  it('refuses missing files', async () => {
    await expect(readFileText(join(tmpdir(), 'dsh-at-file-never.md'), 1024, new AbortController().signal))
      .rejects.toThrow(/cannot read/)
  })

  it('refuses directories', async () => {
    const root = await fixture()
    try {
      await expect(readFileText(join(root, 'src'), 1024)).rejects.toThrow(/is a directory/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('refuses files over the byte cap without truncating', async () => {
    const root = await fixture()
    try {
      await expect(readFileText(join(root, 'README.md'), 3)).rejects.toThrow(/limit is 3 bytes/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('refuses binary files', async () => {
    const root = await fixture()
    try {
      await expect(readFileText(join(root, 'data.bin'), 1024)).rejects.toThrow(/binary/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('races the read against an already-aborted signal', async () => {
    const root = await fixture()
    try {
      const controller = new AbortController()
      controller.abort(new Error('gone'))
      await expect(readFileText(join(root, 'README.md'), 1024, controller.signal)).rejects.toThrow('gone')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('readTree', () => {
  it('reads every file under a directory, relative to that directory root', async () => {
    const root = await fixture()
    try {
      const result = await readTree(join(root, 'src'), { maxFiles: 100, maxBytes: 1024, ignoreDirs: [], ignoreFileExtensions: [] })
      expect(result.truncated).toBe(false)
      expect(result.files.map(file => file.relative)).toEqual(['client/view.ts', 'index.ts'])
      expect(result.files.find(file => file.relative === 'index.ts')?.content).toBe('export {}\n')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('refuses non-directory and relative paths', async () => {
    const root = await fixture()
    try {
      await expect(readTree(join(root, 'README.md'), { maxFiles: 10, maxBytes: 1024, ignoreDirs: [], ignoreFileExtensions: [] })).rejects.toThrow(/not a directory/)
      await expect(readTree('src', { maxFiles: 10, maxBytes: 1024, ignoreDirs: [], ignoreFileExtensions: [] })).rejects.toThrow(/not an absolute path/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reports truncation when the file cap cuts the subtree', async () => {
    const root = await fixture()
    try {
      const result = await readTree(join(root, 'src'), { maxFiles: 1, maxBytes: 1024, ignoreDirs: [], ignoreFileExtensions: [] })
      expect(result.files).toHaveLength(1)
      expect(result.truncated).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('skips ignored extensions when reading a directory tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-tree-ext-'))
    await mkdir(join(root, 'src'))
    await writeFile(join(root, 'src', 'a.ts'), 'a\n')
    await writeFile(join(root, 'src', 'b.png'), 'b\n')
    try {
      const result = await readTree(join(root, 'src'), { maxFiles: 100, maxBytes: 1024, ignoreDirs: [], ignoreFileExtensions: ['.png'] })
      expect(result.files.map(file => file.relative)).toEqual(['a.ts'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('gitignore integration', () => {
  it('indexWorkspace skips entries matched by the workspace .gitignore', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-git-'))
    await mkdir(join(root, 'dist'), { recursive: true })
    await writeFile(join(root, '.gitignore'), 'dist/\n*.log\n')
    await writeFile(join(root, 'a.ts'), 'a\n')
    await writeFile(join(root, 'b.log'), 'b\n')
    await writeFile(join(root, 'dist', 'bundle.js'), 'c\n')
    try {
      const gitignore = await GitignoreMatcher.load(root)
      const { files } = await indexWorkspace(root, {
        maxFiles: 100,
        ignoreDirs: [],
        ignoreFileExtensions: [],
        gitignore,
      })
      expect(files.map(file => file.relative)).toEqual(['.gitignore', 'a.ts'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('readTree skips gitignored files relative to the workspace root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-git-'))
    await mkdir(join(root, 'src', 'generated'), { recursive: true })
    await writeFile(join(root, '.gitignore'), 'src/generated/\n')
    await writeFile(join(root, 'src', 'a.ts'), 'a\n')
    await writeFile(join(root, 'src', 'generated', 'b.ts'), 'b\n')
    try {
      const gitignore = await GitignoreMatcher.load(root)
      const result = await readTree(join(root, 'src'), {
        maxFiles: 100,
        maxBytes: 1024,
        ignoreDirs: [],
        ignoreFileExtensions: [],
        gitignore,
      })
      expect(result.files.map(file => file.relative)).toEqual(['a.ts'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('readTree anchors nested rules to the workspace root, not the attached directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-git-'))
    await mkdir(join(root, 'src', 'nested'), { recursive: true })
    await writeFile(join(root, '.gitignore'), 'nested/\n')
    await writeFile(join(root, 'src', 'a.ts'), 'a\n')
    await writeFile(join(root, 'src', 'nested', 'b.ts'), 'b\n')
    try {
      const gitignore = await GitignoreMatcher.load(root)
      const result = await readTree(join(root, 'src'), {
        maxFiles: 100,
        maxBytes: 1024,
        ignoreDirs: [],
        ignoreFileExtensions: [],
        gitignore,
      })
      // The root rule `nested/` matches any directory named nested under the
      // workspace, including src/nested — proving the matcher walks the ancestor
      // chain back to the workspace root rather than re-rooting at src.
      expect(result.files.map(file => file.relative)).toEqual(['a.ts'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
