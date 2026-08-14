// @vitest-environment jsdom
/**
 * Attached-files dock presentation behavior: rows render for the @file chip
 * occurrences in the input state, the label button opens the file on the
 * host, the × drops the occurrence's placeholder from the draft, and the
 * settings switch hides the strip.
 */
import { describe, expect, it, vi } from 'vitest'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { ReactElement } from 'react'
import { atFileOccurrences, FilesDock, withoutPlaceholder, type AtFileDockProps, type AtFileOccurrence } from '../src/client/FilesDock.tsx'
import { fmt, zh } from '../src/client/locales.ts'

// jsdom + React 18 without the act harness: flushSync commits renders, and
// plain clicks dispatch real handlers.
globalThis.IS_REACT_ACT_ENVIRONMENT = false

const t = (key: string, params?: Record<string, string>): string => fmt(zh[key] ?? key, params)

const occ = (over: Partial<AtFileOccurrence> & { occurrenceId: number; ref: string }): AtFileOccurrence => ({
  source: 'at-file',
  offset: 0,
  label: over.ref.split('/').pop() as string,
  ...over,
})

/** Minimal runtime stub cast onto the derived dock props. */
function props(over: {
  draft?: string
  occurrences?: readonly AtFileOccurrence[]
  kindOf?: (relative: string) => 'file' | 'dir' | undefined
  onOpen?: (relative: string) => void
  setDraft?: (text: string) => void
  enabled?: boolean
} = {}): AtFileDockProps {
  const stub = {
    session: {},
    input: {
      draft: over.draft ?? 'fix \uFFFC please',
      imageIds: [],
      draftRev: 0,
      phase: 'plain',
      occurrences: over.occurrences ?? [],
      queue: [],
    },
    inputActions: {
      setDraft: over.setDraft ?? (() => {}),
      addImages: () => false,
      removeImage: () => {},
      pruneImages: () => {},
      submit: () => {},
    },
    onOpen: over.onOpen ?? (() => {}),
    kindOf: over.kindOf ?? (() => 'file'),
    useScope: (selector: (snapshot: { value?: { enabled?: boolean } }) => boolean) =>
      selector(over.enabled === undefined ? {} : { value: { enabled: over.enabled } }),
    t,
  }
  return stub as unknown as AtFileDockProps
}

function mount(element: ReactElement): { root: Root; container: HTMLDivElement } {
  const container = document.createElement('div')
  const root = createRoot(container)
  flushSync(() => { root.render(element) })
  return { root, container }
}

function click(element: Element | null): void {
  expect(element).not.toBeNull()
  element!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('atFileOccurrences', () => {
  it('filters the chip table to the @file source, keeping draft order', () => {
    expect(atFileOccurrences([
      occ({ occurrenceId: 1, ref: 'a.ts' }),
      { occurrenceId: 2, source: 'skill', ref: 'x', offset: 3, label: 'x' },
      occ({ occurrenceId: 3, ref: 'src/b.ts' }),
    ])).toEqual([
      occ({ occurrenceId: 1, ref: 'a.ts' }),
      occ({ occurrenceId: 3, ref: 'src/b.ts' }),
    ])
  })

  it('returns nothing for an empty or foreign chip table', () => {
    expect(atFileOccurrences([])).toEqual([])
    expect(atFileOccurrences([{ occurrenceId: 1, source: 'skill', ref: 'x', offset: 0, label: 'x' }])).toEqual([])
  })
})

describe('withoutPlaceholder', () => {
  it('drops the single U+FFFC at the occurrence offset', () => {
    expect(withoutPlaceholder('a\uFFFCb\uFFFCc', 3)).toBe('a\uFFFCbc')
    expect(withoutPlaceholder('x\uFFFC', 1)).toBe('x')
  })
})

describe('FilesDock', () => {
  it('renders one row per @file chip occurrence with its label and the full-path tooltip', () => {
    const { root, container } = mount(<FilesDock {...props({
      occurrences: [occ({ occurrenceId: 1, ref: 'a.ts' }), occ({ occurrenceId: 2, ref: 'src/b.ts', offset: 1 })],
    })} />)
    expect(container.querySelectorAll('[data-at-file-row]')).toHaveLength(2)
    expect(container.textContent).toContain('a.ts')
    expect(container.textContent).toContain('b.ts')
    expect(container.querySelector('[title="a.ts"]')).not.toBeNull()
    const nested = container.querySelector('[title="src/b.ts"]')
    expect(nested).not.toBeNull()
    expect(nested?.textContent).toBe('b.ts')
    root.unmount()
  })

  it('renders a directory occurrence with a folder icon and the path tooltip', () => {
    const { root, container } = mount(<FilesDock {...props({
      kindOf: relative => (relative === 'src' ? 'dir' : 'file'),
      occurrences: [occ({ occurrenceId: 1, ref: 'src' }), occ({ occurrenceId: 2, ref: 'a.ts', offset: 1 })],
    })} />)
    const dirRow = container.querySelector('[data-at-file-kind="dir"]')
    expect(dirRow?.querySelector('button')?.textContent).toBe('src')
    expect(dirRow?.querySelector('button')?.getAttribute('title')).toBe('src')
    const fileRow = container.querySelector('[data-at-file-kind="file"]')
    expect(fileRow?.querySelector('button')?.textContent).toBe('a.ts')
    root.unmount()
  })

  it('falls back to the file icon before the index settles', () => {
    const { root, container } = mount(<FilesDock {...props({
      kindOf: () => undefined,
      occurrences: [occ({ occurrenceId: 1, ref: 'src' })],
    })} />)
    expect(container.querySelector('[data-at-file-kind="file"]')).not.toBeNull()
    root.unmount()
  })

  it('renders nothing when the draft has no @file chip occurrences', () => {
    const { root, container } = mount(<FilesDock {...props({
      occurrences: [{ occurrenceId: 1, source: 'skill', ref: 'x', offset: 0, label: 'x' }],
    })} />)
    expect(container.querySelectorAll('[data-at-file-row]')).toHaveLength(0)
    root.unmount()
  })

  it('hides the strip while the settings switch is off', () => {
    const { root, container } = mount(<FilesDock {...props({ occurrences: [occ({ occurrenceId: 1, ref: 'a.ts' })], enabled: false })} />)
    expect(container.querySelectorAll('[data-at-file-row]')).toHaveLength(0)
    root.unmount()
  })

  it('defaults to enabled before the first settings read', () => {
    const { root, container } = mount(<FilesDock {...props({ occurrences: [occ({ occurrenceId: 1, ref: 'a.ts' })], enabled: undefined })} />)
    expect(container.querySelectorAll('[data-at-file-row]')).toHaveLength(1)
    root.unmount()
  })

  it('opens the file through the host opener with the occurrence ref', () => {
    const onOpen = vi.fn()
    const { root, container } = mount(<FilesDock {...props({
      onOpen,
      occurrences: [occ({ occurrenceId: 1, ref: 'src/client/view.ts' })],
    })} />)
    click(container.querySelector('[data-at-file-row] button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith('src/client/view.ts')
    root.unmount()
  })

  it('removes exactly one chip occurrence from the draft', () => {
    const setDraft = vi.fn()
    const { root, container } = mount(<FilesDock {...props({
      draft: 'x\uFFFCy\uFFFCz',
      setDraft,
      occurrences: [occ({ occurrenceId: 1, ref: 'a.ts', offset: 1 }), occ({ occurrenceId: 2, ref: 'b.ts', offset: 3 })],
    })} />)
    const rows = container.querySelectorAll('[data-at-file-row]')
    click(rows[1]!.querySelectorAll('button')[1]!)
    expect(setDraft).toHaveBeenCalledWith('x\uFFFCyz')
    root.unmount()
  })
})
