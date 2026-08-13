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
import { indexWorkspace, readFileText, readTree } from '../src/files.ts'

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
      const { files, truncated } = await indexWorkspace(root, { maxFiles: 100, ignoreDirs: ['.git', 'node_modules'] })
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
      const { files } = await indexWorkspace(root, { maxFiles: 100, ignoreDirs: ['.git', 'node_modules'] })
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

  it('carries the absolute path on every entry', async () => {
    const root = await fixture()
    try {
      const { files } = await indexWorkspace(root, { maxFiles: 100, ignoreDirs: [] })
      const readme = files.find(file => file.relative === 'README.md')
      expect(readme?.path).toBe(join(root, 'README.md'))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('stops at the file cap and reports truncation honestly', async () => {
    const root = await fixture()
    try {
      const { files, truncated } = await indexWorkspace(root, { maxFiles: 2, ignoreDirs: ['.git', 'node_modules'] })
      expect(files).toHaveLength(2)
      expect(truncated).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('rejects a missing root with a readable error', async () => {
    await expect(indexWorkspace(
      join(tmpdir(), 'dsh-at-file-missing-root'),
      { maxFiles: 10, ignoreDirs: [] },
      new AbortController().signal,
    )).rejects.toThrow(/cannot list/)
  })

  it('races the walk against an already-aborted signal', async () => {
    const root = await fixture()
    try {
      const controller = new AbortController()
      controller.abort(new Error('gone'))
      await expect(indexWorkspace(root, { maxFiles: 10, ignoreDirs: [] }, controller.signal))
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
      await expect(indexWorkspace(root, { maxFiles: 10, ignoreDirs: [] }, controller.signal))
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
      const { files } = await indexWorkspace(root, { maxFiles: 10, ignoreDirs: [] })
      expect(files).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
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
      const result = await readTree(join(root, 'src'), 100, 1024, [])
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
      await expect(readTree(join(root, 'README.md'), 10, 1024, [])).rejects.toThrow(/not a directory/)
      await expect(readTree('src', 10, 1024, [])).rejects.toThrow(/not an absolute path/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reports truncation when the file cap cuts the subtree', async () => {
    const root = await fixture()
    try {
      const result = await readTree(join(root, 'src'), 1, 1024, [])
      expect(result.files).toHaveLength(1)
      expect(result.truncated).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
