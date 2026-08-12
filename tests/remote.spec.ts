/**
 * The hand-written Remote contribution's boundary discipline: the descriptors
 * are unique and strict, their codecs accept the exact wire values the host
 * emits, and reject malformed ones. This mirrors what the Client Gateway's
 * own `requireStrictDescriptor` demands at mount time.
 */
import { describe, expect, it } from 'vitest'
import { AT_FILE_REMOTE } from '../src/client/remote.ts'

describe('AT_FILE_REMOTE', () => {
  it('owns exactly the search and read endpoints', () => {
    expect(AT_FILE_REMOTE.package).toBe('dsh-at-file')
    expect(AT_FILE_REMOTE.descriptors.map(descriptor => `${descriptor.namespace}/${descriptor.method}`))
      .toEqual(['atFile/search', 'atFile/read'])
  })

  it('declares strict codecs on every parameter and result', () => {
    for (const descriptor of AT_FILE_REMOTE.descriptors) {
      expect(descriptor.result.mode).toBe('strict')
      for (const parameter of descriptor.parameters) expect(parameter.codec.mode).toBe('strict')
    }
  })

  it('routes search through the agent lookup with a trailing signal', () => {
    const search = AT_FILE_REMOTE.descriptors[0]!
    expect(search.invocation).toEqual({ kind: 'direct' })
    expect(search.cancellation).toEqual({ parameter: 'signal' })
    expect(search.parameters).toHaveLength(1)
    expect(search.parameters[0]).toMatchObject({ name: 'agent', wire: 'agentId', source: 'lookup', lookup: 'agent' })
  })

  it('routes read as a plain json path parameter with a trailing signal', () => {
    const read = AT_FILE_REMOTE.descriptors[1]!
    expect(read.cancellation).toEqual({ parameter: 'signal' })
    expect(read.parameters).toHaveLength(1)
    expect(read.parameters[0]).toMatchObject({ name: 'path', wire: 'path', source: 'json' })
  })

  it('search codecs accept host file entries and reject malformed rows', () => {
    const search = AT_FILE_REMOTE.descriptors[0]!
    const schema = search.result.schema as { parse(value: unknown): unknown }
    expect(schema.parse([{ path: '/ws/a.ts', relative: 'a.ts' }])).toEqual([{ path: '/ws/a.ts', relative: 'a.ts' }])
    expect(() => schema.parse([{ path: '', relative: 'a.ts' }])).toThrow()
    expect(() => schema.parse([{ path: '/ws/a.ts' }])).toThrow()
    expect(() => schema.parse('nope')).toThrow()
  })

  it('read codecs accept host file contents and reject malformed values', () => {
    const read = AT_FILE_REMOTE.descriptors[1]!
    const schema = read.result.schema as { parse(value: unknown): unknown }
    expect(schema.parse({ content: 'x\n', bytes: 2 })).toEqual({ content: 'x\n', bytes: 2 })
    expect(() => schema.parse({ content: 'x', bytes: -1 })).toThrow()
    expect(() => schema.parse({ content: 'x', bytes: 1.5 })).toThrow()
    expect(() => schema.parse({ bytes: 1 })).toThrow()
  })
})
