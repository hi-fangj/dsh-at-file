/**
 * Host composition behavior: the plugin module boots over a real cordis
 * Context, registers the atFile service with the Gateway-visible binding, and
 * its @Remote methods answer over a fixture workspace. This is the
 * REAL-composition evidence for the host half — only the filesystem seam is
 * real, the Agent is a structural stub because the gateway's `agent` lookup
 * resolves it in the assembled host, not in this unit.
 */
import { Context, symbols } from '@deepseek-ai/cordis'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as plugin from '../src/index.ts'
import type { AtFileRuntime } from '../src/runtime.ts'

/** One structural Agent stub: only the session header the service reads. */
function agentWith(cwd: string | undefined): Agent {
  return { session: { header: { cwd } } } as unknown as Agent
}

/** The unproxied service original (cordis caller-tracking may wrap instances). */
function originalOf(service: object): object {
  const original = Reflect.get(service, symbols.original) as object | undefined
  return original ?? service
}

/** Mount the function-plugin module on a fresh context (harness test pattern). */
async function mount(ctx: Context, config?: plugin.Config): Promise<ReturnType<Context['plugin']>> {
  const registryFiber = ctx.plugin(TypertRegistry)
  await registryFiber
  const fiber = ctx.plugin({ inject: plugin.inject, apply: plugin.apply }, config)
  await fiber
  return fiber
}

describe('dsh-at-file host composition', () => {
  it('boots the plugin and registers the atFile service under its own key', async () => {
    const ctx = new Context()
    const fiber = await mount(ctx)
    const runtime = ctx.get('atFile') as AtFileRuntime | undefined
    expect(runtime).toBeDefined()
    // The Gateway source-mode binding the wire dispatch relies on.
    expect(Reflect.get(originalOf(runtime as AtFileRuntime), 'typertRemote').namespace).toBe('atFile')
    await fiber.dispose()
  })

  it('registers the strict Typert manifest so the gateway resolves both endpoints', async () => {
    const ctx = new Context()
    const fiber = await mount(ctx)
    const registry = ctx.get('typert') as TypertRegistry
    expect(registry.local.get('atFile/search')).toMatchObject({ service: 'atFile', method: 'search' })
    expect(registry.local.get('atFile/read')).toMatchObject({ service: 'atFile', method: 'read' })
    await fiber.dispose()
    expect(registry.local.get('atFile/search')).toBeUndefined()
  })

  it('exports search and read as Remote methods in declaration order', async () => {
    const ctx = new Context()
    const fiber = await mount(ctx)
    const runtime = ctx.get('atFile') as AtFileRuntime
    expect(remoteMethods(originalOf(runtime)).map(marker => marker.method)).toEqual(['search', 'read'])
    await fiber.dispose()
  })

  it('disposes the service with its fiber', async () => {
    const ctx = new Context()
    const fiber = await mount(ctx)
    expect(ctx.get('atFile')).toBeDefined()
    await fiber.dispose()
    expect(ctx.get('atFile')).toBeUndefined()
  })

  it('search indexes the addressed workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-runtime-'))
    await mkdir(join(root, 'nested'))
    await writeFile(join(root, 'a.ts'), 'a\n')
    await writeFile(join(root, 'nested', 'b.ts'), 'b\n')
    const ctx = new Context()
    const fiber = await mount(ctx)
    try {
      const runtime = ctx.get('atFile') as AtFileRuntime
      const files = await runtime.search(agentWith(root), new AbortController().signal)
      expect(files.map(file => file.relative)).toEqual(['a.ts', 'nested/b.ts'])
    } finally {
      await fiber.dispose()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('search refuses a session without a workspace', async () => {
    const ctx = new Context()
    const fiber = await mount(ctx)
    try {
      const runtime = ctx.get('atFile') as AtFileRuntime
      await expect(runtime.search(agentWith(undefined), new AbortController().signal))
        .rejects.toThrow(/no workspace directory/)
    } finally {
      await fiber.dispose()
    }
  })

  it('read serves a bounded text file and refuses oversized ones', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-at-file-runtime-'))
    await writeFile(join(root, 'c.ts'), 'content\n')
    const ctx = new Context()
    const fiber = await mount(ctx, { maxIndexedFiles: 10, maxFileBytes: 4, ignoreDirs: [] })
    try {
      const runtime = ctx.get('atFile') as AtFileRuntime
      await expect(runtime.read(join(root, 'c.ts'), new AbortController().signal))
        .rejects.toThrow(/limit is 4 bytes/)
    } finally {
      await fiber.dispose()
      await rm(root, { recursive: true, force: true })
    }
  })

  it('validates configuration through the exported schema', () => {
    expect(plugin.Config({})).toEqual({
      maxIndexedFiles: 5000,
      maxFileBytes: 262144,
      ignoreDirs: ['.git', 'node_modules'],
    })
    expect(() => plugin.Config({ maxIndexedFiles: 0 })).toThrow()
    expect(() => plugin.Config({ maxFileBytes: 0 })).toThrow()
  })
})
