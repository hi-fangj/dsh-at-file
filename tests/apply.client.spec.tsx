// @vitest-environment jsdom
/**
 * Client plugin wiring over stubbed services: mounting the atFile Remote
 * contribution, registering the '@' source with the trigger pipeline, the
 * dock entry with its inject face, the locale dictionaries, the one-shot
 * stylesheet injection, and the Remote failure routing the source surfaces.
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'
import { AT_FILE_REMOTE } from '../src/client/remote.ts'
import { NS, en, zh } from '../src/client/locales.ts'
import { SOURCE_NAME } from '../src/client/source.ts'
import { STYLE_ID } from '../src/client/styles.ts'

type RemoteResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string; details: object } }

interface BootOptions {
  atFileSearch?: (sessionId: SessionId, signal: AbortSignal) => Promise<RemoteResult<readonly { path: string; relative: string }[]>>
  atFileRead?: (path: string, signal: AbortSignal) => Promise<RemoteResult<{ content: string; bytes: number }>>
  openPath?: () => Promise<{ result: { ok: true } | { ok: false; error: { message: string } } }>
}

/** One registered trigger source, narrowed to the members the assertions read. */
interface RegisteredSource {
  trigger: string
  name: string
  candidates: (session: { sessionId: SessionId }, req: { query: string; position: 'leading' | 'inline'; signal: AbortSignal }) => Promise<readonly { name: string }[]>
  codec?: { serialize: (ref: string, signal: AbortSignal) => Promise<string> }
}

/** Boot the plugin body over a stub-service context and return the recorded surfaces. */
async function boot(options: BootOptions = {}) {
  const ctx = new Context()
  const registerSource = vi.fn(() => () => {})
  const mount = vi.fn(async () => () => {})
  const localeRegister = vi.fn(() => () => {})
  const bind = vi.fn(() => (key: string) => key)
  const slotsRegister = vi.fn()
  const slotsInject = vi.fn((_name: string, factory: () => void) => { factory() })
  const openPath = vi.fn(options.openPath ?? (async () => ({ result: { ok: true as const } })))
  ctx.provide('inputTriggers', { registerSource })
  ctx.provide('connection', { api: { host: { openPath } } })
  ctx.provide('remote', {
    $mount: mount,
    atFile: {
      search: options.atFileSearch ?? (async () => ({ ok: true as const, value: [] })),
      read: options.atFileRead ?? (async () => ({ ok: true as const, value: { content: 'x\n', bytes: 2 } })),
    },
  })
  ctx.provide('slots', { inject: slotsInject, register: slotsRegister })
  ctx.provide('locale', { register: localeRegister, bind })
  ctx.provide('sessions', {})
  apply(ctx as unknown as Parameters<typeof apply>[0])
  // The Remote mount effect is asynchronous; settle one tick.
  await Promise.resolve()
  await Promise.resolve()
  return { ctx, registerSource, mount, localeRegister, bind, slotsRegister, slotsInject, openPath }
}

/** The source the wiring registered, if any. */
function registered(booted: Awaited<ReturnType<typeof boot>>): RegisteredSource {
  expect(booted.registerSource).toHaveBeenCalled()
  return booted.registerSource.mock.calls[0]![0] as RegisteredSource
}

const s1 = { sessionId: 's1' as SessionId }
const signal = () => new AbortController().signal

describe('dsh-at-file client apply', () => {
  it('declares the picker and carrier services', () => {
    expect(inject).toEqual(['inputTriggers', 'sessions', 'connection', 'remote', 'slots', 'locale'])
  })

  it('mounts the atFile Remote contribution and registers the @ source', async () => {
    const { mount, registerSource } = await boot()
    expect(mount).toHaveBeenCalledWith(AT_FILE_REMOTE)
    expect(registerSource).toHaveBeenCalledTimes(1)
    const source = registerSource.mock.calls[0]![0] as RegisteredSource
    expect(source.trigger).toBe('@')
    expect(source.name).toBe(SOURCE_NAME)
  })

  it('routes candidate searches through the Remote namespace', async () => {
    const atFileSearch = vi.fn(async () => ({ ok: true as const, value: [{ path: '/ws/a.ts', relative: 'a.ts' }] }))
    const booted = await boot({ atFileSearch })
    const rows = await registered(booted).candidates(s1, { query: 'a', position: 'inline', signal: signal() })
    expect(rows.map(row => row.name)).toEqual(['a.ts'])
    expect(atFileSearch).toHaveBeenCalledWith('s1', expect.any(AbortSignal))
  })

  it('turns a failed remote search into a rejection', async () => {
    const atFileSearch = vi.fn(async () => ({ ok: false as const, error: { code: 'search-down', message: 'boom', details: {} } }))
    const booted = await boot({ atFileSearch })
    await expect(registered(booted).candidates(s1, { query: 'a', position: 'inline', signal: signal() }))
      .rejects.toThrow(/search failed: search-down: boom/)
  })

  it('serializes a failed remote read into a localized rejection', async () => {
    const atFileRead = vi.fn(async () => ({ ok: false as const, error: { code: 'read-down', message: 'boom', details: {} } }))
    const booted = await boot({ atFileRead })
    await expect(registered(booted).codec!.serialize('/ws/a.ts', signal())).rejects.toThrow('error.read')
  })

  it('serializes a successful remote read into the model form', async () => {
    const booted = await boot()
    const text = await registered(booted).codec!.serialize('/ws/a.ts', signal())
    expect(text).toBe('<file path="/ws/a.ts">\nx\n</file>')
  })

  it('registers the dock with its inject face routed to the host opener', async () => {
    const { slotsInject, slotsRegister, openPath } = await boot()
    expect(slotsInject).toHaveBeenCalledWith('conversation.input.dock', expect.any(Function))
    expect(slotsRegister).toHaveBeenCalledTimes(1)
    const registration = slotsRegister.mock.calls[0]![0] as {
      name: string
      id: string
      order: number
      locale: string
      inject: (sessionId: string) => { onOpen: (path: string) => void }
    }
    expect(registration).toMatchObject({ name: 'conversation.input.dock', id: 'at-file', order: 20, locale: NS })
    const face = registration.inject('s1')
    face.onOpen('/ws/a.ts')
    expect(openPath).toHaveBeenCalledWith({ path: '/ws/a.ts' })
  })

  it('logs failed and rejecting host opens', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const failed = await boot({ openPath: async () => ({ result: { ok: false, error: { message: 'nope' } } }) })
      const face = (failed.slotsRegister.mock.calls[0]![0] as { inject: (id: string) => { onOpen: (p: string) => void } }).inject('s1')
      face.onOpen('/ws/a.ts')
      await Promise.resolve()
      expect(errorSpy).toHaveBeenCalledWith('[dsh-at-file] open failed:', 'nope')
      errorSpy.mockClear()
      const rejecting = await boot({ openPath: async () => { throw new Error('carrier down') } })
      const rejectingFace = (rejecting.slotsRegister.mock.calls[0]![0] as { inject: (id: string) => { onOpen: (p: string) => void } }).inject('s1')
      rejectingFace.onOpen('/ws/a.ts')
      await Promise.resolve()
      expect(errorSpy).toHaveBeenCalledWith('[dsh-at-file] open failed:', expect.any(Error))
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('disposes the mounted Remote namespace and the source registration with its fiber', async () => {
    const ctx = new Context()
    const unmount = vi.fn(async () => {})
    const registerDispose = vi.fn()
    const mount = vi.fn(async () => unmount)
    ctx.provide('inputTriggers', { registerSource: vi.fn(() => registerDispose) })
    ctx.provide('connection', { api: { host: { openPath: async () => ({ result: { ok: true as const } }) } } })
    ctx.provide('remote', { $mount: mount, atFile: { search: async () => ({ ok: true as const, value: [] }), read: async () => ({ ok: true as const, value: { content: 'x\n', bytes: 2 } }) } })
    ctx.provide('slots', { inject: vi.fn(), register: vi.fn() })
    ctx.provide('locale', { register: vi.fn(() => () => {}), bind: vi.fn(() => (key: string) => key) })
    ctx.provide('sessions', {})
    const fiber = ctx.plugin({ inject, apply })
    await fiber
    await Promise.resolve()
    expect(mount).toHaveBeenCalled()
    await fiber.dispose()
    expect(unmount).toHaveBeenCalled()
    expect(registerDispose).toHaveBeenCalled()
  })

  it('registers the bilingual dictionaries and binds the namespace', async () => {
    const { localeRegister, bind } = await boot()
    expect(localeRegister).toHaveBeenCalledWith(NS, { zh, en })
    expect(bind).toHaveBeenCalledWith(NS)
  })

  it('injects the dock stylesheet exactly once', async () => {
    await boot()
    const style = document.getElementById(STYLE_ID)
    expect(style).not.toBeNull()
    expect(style!.textContent).toContain('dsh_atFile_rail')
    // The stable id keeps a second application (HMR re-run) idempotent.
    await boot()
    expect(document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1)
  })
})
