/**
 * The '@' input-trigger source: turns the ui-input-trigger pipeline into the
 * Codex-style file picker. `candidates` serves the smart-searched rows (the
 * workspace index is fetched once per session and filtered locally per
 * keystroke), `onPick` lands a chip carrying the absolute path, and the
 * reference codec expands that chip into the file content at submit time —
 * so the model reads the file while the draft keeps the short `@path`
 * clipboard projection. Pure factory over injected deps: the browser bundle
 * wires the real Remote and clock, tests wire stubs.
 */
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { modelForm, dirnameOf } from './model.ts'
import { rankFiles } from './search.ts'
import type { FileContent, FileEntry } from './remote.ts'
import type { AtFileKey } from './locales.ts'

/** Owner source name (the occurrence serializer routing key and chip owner). */
export const SOURCE_NAME = 'at-file'

/** Design cap on visible picker rows (menu height mirrors the slash menu). */
export const MAX_CANDIDATES = 12

/** How long one session's index stays hot before the next menu open refetches. */
export const INDEX_TTL_MS = 30_000

/** Per-session index fetch: the shared promise, its abort handle, and the settled snapshot. */
interface IndexCache {
  readonly promise: Promise<readonly FileEntry[]>
  readonly abort: AbortController
  /** Settled snapshot backing synchronous reads (lexicon); unset while in flight. */
  settled?: readonly FileEntry[]
  /** Monotonic clock reading at fetch start (TTL base). */
  readonly at: number
}

/** Everything the source needs that the browser bundle supplies (tests stub). */
export interface AtFileSourceDeps {
  /** Search the addressed session's workspace index (Remote wrapper). */
  search(sessionId: SessionId, signal: AbortSignal): Promise<readonly FileEntry[]>
  /** Read one absolute path under the complete-result bounds; rejects on failure. */
  read(path: string, signal: AbortSignal): Promise<FileContent>
  /** Localized submit-failure copy. */
  t: (key: AtFileKey, params?: Record<string, string>) => string
  /** Monotonic clock for index freshness (default Date.now). */
  now?: () => number
}

/** The registered source plus the cache teardown the wiring layer owns. */
export interface AtFileSource {
  readonly source: InputTriggerSource
  /** Drop every per-session cache and path map (connection reset). */
  invalidateAll(): void
}

/**
 * Build the '@' trigger source over the injected deps. One source per plugin
 * fiber; per-session caches live in the returned closure and die with it.
 * @param deps - Remote, locale, and clock faces.
 * @returns the source to register with `inputTriggers.registerSource`, plus
 *   the cache invalidator.
 */
export function createAtFileSource(deps: AtFileSourceDeps): AtFileSource {
  const now = deps.now ?? (() => Date.now())
  const fetches = new Map<SessionId, IndexCache>()
  // Absolute → relative display map for codec-time projections (chip insert
  // caches the same projection on the occurrence, but paste-path occurrences
  // and serialization consult this).
  const relativeOf = new Map<string, string>()
  const lexiconListeners = new Map<SessionId, Set<() => void>>()

  const notifyLexicon = (sessionId: SessionId): void => {
    for (const listener of [...(lexiconListeners.get(sessionId) ?? [])]) {
      try {
        listener()
      } catch (error) {
        // Contain listener failures: settlement notifies from an ignored
        // promise chain, and one faulty consumer must not starve the others.
        console.error('[dsh-at-file] lexicon listener failed:', error)
      }
    }
  }

  const fetchIndex = (sessionId: SessionId, signal?: AbortSignal): Promise<readonly FileEntry[]> => {
    const existing = fetches.get(sessionId)
    const fresh = existing !== undefined && now() - existing.at < INDEX_TTL_MS
    if (fresh) {
      if (existing.settled !== undefined) return Promise.resolve(existing.settled)
      // In flight and fresh: join it. The candidate caller's own signal is
      // superseded per keystroke; the shared fetch outlives the menu.
      return existing.promise
    }
    if (existing !== undefined) {
      fetches.delete(sessionId)
      existing.abort.abort()
    }
    const abort = new AbortController()
    const promise = deps.search(sessionId, abort.signal)
    const entry: IndexCache = { promise, abort, at: now() }
    fetches.set(sessionId, entry)
    promise.then(
      (files) => {
        entry.settled = files
        for (const file of files) relativeOf.set(file.path, file.relative)
        notifyLexicon(sessionId)
      },
      () => {
        // A failed fetch must not poison the key: the next consumer retries.
        if (fetches.get(sessionId) === entry) fetches.delete(sessionId)
      },
    )
    if (signal !== undefined) {
      // A superseded keystroke just yields early; the shared fetch stays warm
      // and its own handlers already contain its settlement.
      return promise.then(files => (signal.aborted ? [] : files))
    }
    return promise
  }

  const findFile = (sessionId: SessionId, relative: string): FileEntry | undefined =>
    fetches.get(sessionId)?.settled?.find(file => file.relative === relative)

  const invalidateAll = (): void => {
    for (const [key, entry] of [...fetches]) {
      fetches.delete(key)
      entry.abort.abort()
    }
    relativeOf.clear()
    for (const listeners of [...lexiconListeners.values()]) {
      for (const listener of listeners) listener()
    }
  }

  const source: InputTriggerSource = {
    trigger: '@',
    name: SOURCE_NAME,
    async candidates(session, { query, signal }) {
      const files = await fetchIndex(session.sessionId, signal)
      if (signal.aborted) return []
      return rankFiles(files, query, MAX_CANDIDATES).map(file => {
        const dir = dirnameOf(file.relative)
        return {
          name: file.relative,
          ...(dir === '' ? {} : { description: dir }),
        }
      })
    },
    warm(session) {
      // Fire-and-forget scope-birth prewarm; the shared fetch reports
      // through candidates.
      fetchIndex(session.sessionId).catch(() => {})
    },
    onPick({ candidate, session }) {
      const file = findFile(session.sessionId, candidate.name)
      if (file === undefined) return undefined
      return {
        insert: {
          source: SOURCE_NAME,
          ref: file.path,
          label: file.relative,
          clipboardText: `@${file.relative}`,
        },
      }
    },
    lexicon(session) {
      return fetches.get(session.sessionId)?.settled?.map(file => file.relative)
    },
    subscribeLexicon(session, listener) {
      const key = session.sessionId
      const listeners = lexiconListeners.get(key) ?? new Set()
      listeners.add(listener)
      lexiconListeners.set(key, listeners)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) lexiconListeners.delete(key)
      }
    },
    codec: {
      clipboardText(ref) {
        return `@${relativeOf.get(ref) ?? ref}`
      },
      async serialize(ref, signal) {
        const relative = relativeOf.get(ref) ?? ref
        try {
          const result = await deps.read(ref, signal)
          return modelForm(relative, result.content)
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          throw new Error(deps.t('error.read', { name: relative, message }))
        }
      },
    },
  }

  return { source, invalidateAll }
}
