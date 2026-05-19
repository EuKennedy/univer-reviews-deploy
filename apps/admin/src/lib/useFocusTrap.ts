import { useEffect, useRef, type RefObject } from 'react'

/**
 * Focus-trap hook for modal dialogs.
 *
 * When `active` is true:
 *   - On mount: stores the previously focused element, then moves focus to the
 *     first focusable descendant of the container (or the container itself).
 *   - While active: traps Tab/Shift+Tab inside the container so focus cycles
 *     between the first and last focusable elements.
 *   - On Escape: invokes `onEscape` if provided.
 *   - On unmount / deactivation: returns focus to the previously focused
 *     element (typically the modal trigger button).
 *
 * No dependencies — vanilla DOM. ~50 lines.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onEscape?: () => void,
): RefObject<T | null> {
  const containerRef = useRef<T | null>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    previouslyFocused.current =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null

    const focusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          [
            'a[href]',
            'button:not([disabled])',
            'textarea:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
          ].join(','),
        ),
      ).filter(
        (el) =>
          !el.hasAttribute('aria-hidden') &&
          el.offsetParent !== null /* visible */,
      )

    // Initial focus: first focusable, else container itself.
    const queue = focusables()
    if (queue.length > 0) {
      queue[0].focus()
    } else {
      container.tabIndex = -1
      container.focus()
    }

    // `container` was narrowed to non-null above (line 27 guard) but TS loses
    // that narrowing across the closure boundary; alias to a non-null local
    // so the handler doesn't need a runtime nullcheck or non-null assertion.
    const trapContainer: HTMLElement = container

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && onEscape) {
        e.stopPropagation()
        onEscape()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) {
        e.preventDefault()
        return
      }
      const first = list[0]
      const last = list[list.length - 1]
      const activeEl = document.activeElement as HTMLElement | null
      if (e.shiftKey) {
        if (activeEl === first || !activeEl || !trapContainer.contains(activeEl)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (activeEl === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // Return focus to the trigger when the modal closes.
      previouslyFocused.current?.focus?.()
    }
  }, [active, onEscape])

  return containerRef
}
