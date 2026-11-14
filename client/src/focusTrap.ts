/**
 * Keyboard-focus helpers for modal dialogs.
 *
 * Kept free of React and of any DOM-specific import so the tab-wrapping rules can
 * be unit tested without a browser.
 */

/** Elements that can take part in the dialog tab cycle. */
export const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, [tabindex]'

/**
 * Return the "index" of the element that should receive focus after a Tab
 * (backwards = false) or Shift+Tab (backwards = true) press.
 *
 * `current` is the index of the element that holds focus, or -1 when focus sits
 * on the dialog itself or anywhere outside it. Returns -1 when there is nothing
 * to focus.
 */
export function nextFocusIndex(current: number, count: number, backwards: boolean): number {
  if (count <= 0) return -1
  if (current < 0) return backwards ? count - 1 : 0
  return backwards ? (current - 1 + count) % count : (current + 1) % count
}

/**
 * Elements inside `root` that can receive focus right now: not disabled, not
 * hidden from assistive technology and reachable with the keyboard.
 */
export function focusableElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      element.tabIndex >= 0,
  )
}
