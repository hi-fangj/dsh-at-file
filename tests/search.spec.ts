/**
 * Pure projection behaviors: the @file smart-search ranking and the model-form
 * / path helpers. Deterministic fixtures only — the ranking must stay stable
 * per keystroke (ties break by kind, length, then lexicographically).
 */
import { describe, expect, it } from 'vitest'
import { rankFiles } from '../src/client/search.ts'
import { basenameOf, dirnameOf, relativeFromRow, rowDescription } from '../src/client/model.ts'
import type { FileEntry } from '../src/client/remote.ts'

function entry(relative: string, kind: 'file' | 'dir' = 'file'): FileEntry {
  return { path: `/ws/${relative}`, relative, kind }
}

const FILES: readonly FileEntry[] = [
  entry('README.md'),
  entry('src', 'dir'),
  entry('src/index.ts'),
  entry('src/lint/check.ts'),
  entry('src/lint/run.ts'),
  entry('tests/view.spec.ts'),
]

describe('rankFiles', () => {
  it('lists directories first, then files, each alphabetical, on an empty query', () => {
    expect(rankFiles(FILES, '', 3)).toEqual([
      entry('src', 'dir'),
      entry('README.md'),
      entry('src/index.ts'),
    ])
  })

  it('matches a case-insensitive subsequence anywhere in the path', () => {
    expect(rankFiles(FILES, 'ST', 3)).toEqual([
      entry('tests/view.spec.ts'),
      entry('src/index.ts'),
      entry('src/lint/run.ts'),
    ])
  })

  it('ranks basename matches above directory matches, files before directories', () => {
    expect(rankFiles(FILES, 'in', 3)).toEqual([
      entry('src/index.ts'),
      entry('src/lint/run.ts'),
      entry('src/lint/check.ts'),
    ])
  })

  it('returns only the files the query matches', () => {
    expect(rankFiles(FILES, 'view', 3)).toEqual([entry('tests/view.spec.ts')])
  })

  it('drops files the query does not match', () => {
    expect(rankFiles(FILES, 'zzz', 3)).toEqual([])
  })

  it('respects the limit and never reorders equal-score files', () => {
    expect(rankFiles(FILES, 'ts', 2)).toEqual([
      entry('src/lint/run.ts'),
      entry('src/index.ts'),
    ])
  })

  it('breaks equal scores by length, then lexicographically', () => {
    const tied = [
      entry('deep/nested/x.ts'),
      entry('x.ts'),
      entry('src/a/x.ts'),
      entry('src/b/x.ts'),
    ]
    expect(rankFiles(tied, 'x', 4)).toEqual([
      entry('x.ts'),
      entry('src/a/x.ts'),
      entry('src/b/x.ts'),
      entry('deep/nested/x.ts'),
    ])
  })

  it('treats whitespace-only queries as empty', () => {
    expect(rankFiles(FILES, '   ', 1)).toEqual([entry('src', 'dir')])
  })
})

describe('path projections', () => {
  it('splits basename and directory with forward slashes', () => {
    expect(basenameOf('src/client/view.ts')).toBe('view.ts')
    expect(dirnameOf('src/client/view.ts')).toBe('src/client')
  })

  it('treats root-level files as directory-less', () => {
    expect(basenameOf('README.md')).toBe('README.md')
    expect(dirnameOf('README.md')).toBe('')
  })

  it('projects the picker row name and path texts', () => {
    expect(rowDescription('src/client/view.ts')).toBe('src/client')
    expect(rowDescription('README.md')).toBe('./')
    expect(rowDescription('src')).toBe('./')
  })

  it('reconstructs the relative path from a row losslessly', () => {
    expect(relativeFromRow('view.ts', 'src/client')).toBe('src/client/view.ts')
    expect(relativeFromRow('components/', 'src')).toBe('src/components')
    expect(relativeFromRow('README.md', './')).toBe('README.md')
    expect(relativeFromRow('src/', './')).toBe('src')
  })
})
