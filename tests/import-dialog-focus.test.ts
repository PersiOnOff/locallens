import { test } from 'node:test'
import assert from 'node:assert/strict'
import { focusableElements, nextFocusIndex } from '../client/src/focusTrap.ts'

type FakeElement = {
  hasAttribute: (name: string) => boolean
  getAttribute: (name: string) => string | null
  tabIndex: number
}

function element({ disabled = false, hidden = false, tabIndex = 0 }: { disabled?: boolean; hidden?: boolean; tabIndex?: number }): FakeElement {
  return {
    hasAttribute: (name) => (name === 'disabled' ? disabled : false),
    getAttribute: (name) => (name === 'aria-hidden' && hidden ? 'true' : null),
    tabIndex,
  }
}

function root(children: FakeElement[]) {
  return { querySelectorAll: () => children } as unknown as ParentNode
}

test('tab order stops inside the dialog and wraps in both directions', () => {
  // Focus on the last element: Tab must wrap to the first one.
  assert.equal(nextFocusIndex(2, 3, false), 0)
  // Focus on the first element: Shift+Tab must wrap to the last one.
  assert.equal(nextFocusIndex(0, 3, true), 2)
  // Mid-list moves stay adjacent.
  assert.equal(nextFocusIndex(0, 3, false), 1)
  assert.equal(nextFocusIndex(2, 3, true), 1)
})

test('focus outside the dialog enters at the correct end of the cycle', () => {
  assert.equal(nextFocusIndex(-1, 3, false), 0)
  assert.equal(nextFocusIndex(-1, 3, true), 2)
  assert.equal(nextFocusIndex(0, 0, false), -1)
  assert.equal(nextFocusIndex(-1, 0, true), -1)
})

test('disabled, hidden and keyboard-unreachable elements are skipped', () => {
  const close = element({})
  const disabledSubmit = element({ disabled: true })
  const hiddenHint = element({ hidden: true })
  const inert = element({ tabIndex: -1 })
  const pathInput = element({})
  const elements = focusableElements(root([close, disabledSubmit, hiddenHint, inert, pathInput]))
  assert.deepEqual(elements, [close, pathInput])
})
