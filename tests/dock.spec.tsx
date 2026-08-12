// @vitest-environment jsdom
/**
 * Attached-files dock presentation behavior: rows render only for @file
 * chips, the path button opens the file on the host, the × removes exactly
 * one chip from the draft, and an empty draft renders nothing.
 */
import { describe, expect, it, vi } from 'vitest'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import type { ReactElement } from 'react'
import { FilesDock, withoutOccurrence, type AtFileDockProps } from '../src/client/FilesDock.tsx'
import { fmt, zh } from '../src/client/locales.ts'

// jsdom + React 18 without the act harness: flushSync commits renders, and
// plain clicks dispatch real handlers.
globalThis.IS_REACT_ACT_ENVIRONMENT = false

const t = (key: string, params?: Record<string, string>): string => fmt(zh[key] ?? key, params)

/**
 * Minimal runtime stub cast onto the derived dock props. The component's
 * real contract is type-checked at its own declaration; tests feed the four
 * shares it actually destructures.
 */
function props(over: {
  draft?: string
  occurrences?: readonly unknown[]
  onOpen?: (path: string) => void
  setDraft?: (text: string) => void
} = {}): AtFileDockProps {
  const stub = {
    session: {},
    input: {
      draft: over.draft ?? '￼ check ￼',
      imageIds: [],
      draftRev: 0,
      phase: 'plain',
      occurrences: over.occurrences ?? [
        { occurrenceId: 1, source: 'at-file', ref: '/ws/a.ts', offset: 0, label: 'a.ts', clipboardText: '@a.ts' },
        { occurrenceId: 2, source: 'at-file', ref: '/ws/b.ts', offset: 8, label: 'b.ts', clipboardText: '@b.ts' },
        { occurrenceId: 3, source: 'other', ref: 'x', offset: 2, label: 'x', clipboardText: 'x' },
      ],
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

describe('FilesDock', () => {
  it('renders one row per @file chip, ignoring other sources', () => {
    const { root, container } = mount(<FilesDock {...props()} />)
    expect(container.querySelectorAll('[data-at-file-row]')).toHaveLength(2)
    expect(container.textContent).toContain('a.ts')
    expect(container.textContent).toContain('b.ts')
    root.unmount()
  })

  it('renders nothing when the draft has no @file chips', () => {
    const { root, container } = mount(<FilesDock {...props({
      occurrences: [{ occurrenceId: 3, source: 'other', ref: 'x', offset: 0, label: 'x', clipboardText: 'x' }],
    })} />)
    expect(container.querySelectorAll('[data-at-file-row]')).toHaveLength(0)
    root.unmount()
  })

  it('opens the file through the host opener when the path is clicked', () => {
    const onOpen = vi.fn()
    const { root, container } = mount(<FilesDock {...props({ onOpen })} />)
    // The row's first button is the path; the second is the remover.
    click(container.querySelector('[data-at-file-row] button'))
    expect(onOpen).toHaveBeenCalledTimes(1)
    expect(onOpen).toHaveBeenCalledWith('/ws/a.ts')
    root.unmount()
  })

  it('removes exactly one chip placeholder from the draft', () => {
    const setDraft = vi.fn()
    const { root, container } = mount(<FilesDock {...props({ setDraft })} />)
    const rows = container.querySelectorAll('[data-at-file-row]')
    click(rows[1]!.querySelectorAll('button')[1]!)
    expect(setDraft).toHaveBeenCalledWith('￼ check ')
    root.unmount()
  })

  it('computes the placeholder-free draft directly', () => {
    expect(withoutOccurrence('￼ check ￼', 0)).toBe(' check ￼')
    expect(withoutOccurrence('￼ check ￼', 8)).toBe('￼ check ')
  })
})
