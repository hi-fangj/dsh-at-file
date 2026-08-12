/**
 * Pure projection behaviors: the @file smart-search ranking and the model-form
 * / path helpers. Deterministic fixtures only — the ranking must stay stable
 * per keystroke (ties break by length, then lexicographically).
 */
import { describe, expect, it } from 'vitest'
import { rankFiles } from '../src/client/search.ts'
import { basenameOf, dirnameOf, modelForm } from '../src/client/model.ts'
import type { FileEntry } from '../src/client/remote.ts'

function entry(relative: string): FileEntry {
  return { path: `/ws/${relative}`, relative }
}

const FILES: readonly FileEntry[] = [
  entry('README.md'),
  entry('src/index.ts'),
  entry('src/lint/check.ts'),
  entry('src/lint/run.ts'),
  entry('tests/view.spec.ts'),
]

describe('rankFiles', () => {
  it('falls back to shallow-first default order on an empty query', () => {
    expect(rankFiles(FILES, '', 3)).toEqual([
      entry('README.md'),
      entry('src/index.ts'),
      entry('tests/view.spec.ts'),
    ])
  })

  it('matches a case-insensitive subsequence anywhere in the path', () => {
    expect(rankFiles(FILES, 'ST', 3)).toEqual([
      entry('tests/view.spec.ts'),
      entry('src/index.ts'),
      entry('src/lint/run.ts'),
    ])
  })

  it('ranks basename matches above directory matches', () => {
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

  it('breaks equal scores by path length, then lexicographically', () => {
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
    expect(rankFiles(FILES, '   ', 1)).toEqual([entry('README.md')])
  })
})

describe('modelForm', () => {
  it('wraps the content in a path-tagged block', () => {
    expect(modelForm('src/index.ts', 'export {}')).toBe(
      '<file path="src/index.ts">\nexport {}\n</file>',
    )
  })

  it('never joins the closing tag to the content', () => {
    expect(modelForm('a.ts', 'line\n')).toBe('<file path="a.ts">\nline\n</file>')
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
})
