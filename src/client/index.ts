/**
 * dsh-at-file client plugin: the browser half of the Codex-style @file
 * mention. Mounts the atFile Remote namespace, registers the '@' trigger
 * source (floating picker + chip + submit-time content serialization), the
 * attached-files dock above the composer, and the locale dictionaries.
 * Everything composes through the existing seams: `ctx.remote.$mount` for
 * the wire face, `inputTriggers.registerSource` for the picker pipeline,
 * `ctx.slots.register` for the dock, `ctx.locale.register` for copy.
 */
// Type-only: the ctx.remote merge and the forwarded Host-event face.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ConnectionHandle, SessionId } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { InputTriggerServiceContract } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
// Type-only: the conversation SlotMap / standard-kit merges for the dock seat.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the ctx.locale Context merge.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { AT_FILE_REMOTE, type FileContent, type FileEntry } from './remote.ts'
import { createAtFileSource } from './source.ts'
import { FilesDock, type AtFileDockInjected } from './FilesDock.tsx'
import { NS, en, zh } from './locales.ts'
import { adoptStyles } from './styles.ts'

/** Required services: picker pipeline, session projection, carrier, Remote face, slots, locale. */
export const inject = ['inputTriggers', 'sessions', 'connection', 'remote', 'slots', 'locale']

/** The mounted atFile namespace service's callable face. */
interface AtFileNamespaceFace {
  search(sessionId: SessionId, signal?: AbortSignal): Promise<{ ok: true; value: readonly FileEntry[] } | { ok: false; error: { code: string; message: string; details: object } }>
  read(path: string, signal?: AbortSignal): Promise<{ ok: true; value: FileContent } | { ok: false; error: { code: string; message: string; details: object } }>
}

/**
 * Compose the @file surface.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  adoptStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-at-file: dictionaries')

  // The mounted namespace handle. It resolves through the service store
  // (`ctx.reflect.get`), not through `ctx.remote.atFile`: the generated-style
  // dotted read walks the cordis fiber chain, which stops at the Loader's
  // runtime-less internal forks between a plugin entry and the root fiber —
  // the namespace service mounted under the gateway entry is unreachable
  // that way (the store path resolves it by isolation label instead).
  let atFile: AtFileNamespaceFace | undefined
  ctx.effect(async () => {
    const dispose = await ctx.remote.$mount(AT_FILE_REMOTE)
    atFile = (ctx.reflect as unknown as { get(name: string): unknown }).get('remote.atFile') as AtFileNamespaceFace | undefined
    if (atFile === undefined) {
      throw new Error('dsh-at-file: the atFile Remote namespace did not mount')
    }
    return () => {
      atFile = undefined
      void dispose()
    }
  }, 'dsh-at-file: remote')

  const connection = ctx.get('connection') as ConnectionHandle
  const inputTriggers = ctx.get('inputTriggers') as InputTriggerServiceContract
  const t = ctx.locale.bind(NS)

  const search = async (sessionId: SessionId, signal: AbortSignal): Promise<readonly FileEntry[]> => {
    if (atFile === undefined) throw new Error('dsh-at-file: the atFile Remote is not mounted')
    const result = await atFile.search(sessionId, signal)
    if (!result.ok) throw new Error(`search failed: ${result.error.code}: ${result.error.message}`)
    return result.value
  }

  const read = async (path: string, signal: AbortSignal): Promise<FileContent> => {
    if (atFile === undefined) throw new Error('dsh-at-file: the atFile Remote is not mounted')
    const result = await atFile.read(path, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  const { source, invalidateAll } = createAtFileSource({ search, read, t })
  // Reconnect may have rebuilt the host: cached indexes and path maps die with it.
  ctx.on('connection/reset', invalidateAll)
  ctx.effect(() => inputTriggers.registerSource(source), 'dsh-at-file: source')

  // The wire face of host.openPath (typed structurally: the connection
  // handle's IApiClient type lives behind the apiproxy package this plugin
  // does not import).
  interface OpenPathResponse {
    result: { ok: true } | { ok: false; error: { message: string } }
  }

  const openPath = (path: string): void => {
    void connection.api.host.openPath({ path }).then((response: OpenPathResponse) => {
      if (!response.result.ok) console.error('[dsh-at-file] open failed:', response.result.error.message)
    }, (error: unknown) => {
      console.error('[dsh-at-file] open failed:', error)
    })
  }

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'at-file',
    order: 20,
    locale: NS,
    inject: (): AtFileDockInjected => ({ onOpen: openPath }),
  }, FilesDock))
}
