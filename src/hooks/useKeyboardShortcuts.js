import { useHotkeys } from 'react-hotkeys-hook'
import { useMapStore } from '../store/mapStore'

// Section 4.6 — keyboard shortcuts. Delete/Backspace on a selected node or
// edge is already handled natively by React Flow's `deleteKeyCode` prop.
export function useKeyboardShortcuts() {
  useHotkeys(
    'tab',
    (e) => {
      e.preventDefault()
      const selected = useMapStore.getState().nodes.find((n) => n.selected && n.type !== 'boundaryGroup')
      if (selected) useMapStore.getState().addChildNode(selected.id)
    },
    { enableOnFormTags: false }
  )

  useHotkeys(
    'enter',
    (e) => {
      const selected = useMapStore.getState().nodes.find((n) => n.selected && n.type !== 'boundaryGroup')
      if (selected) {
        e.preventDefault()
        useMapStore.getState().addSiblingNode(selected.id)
      }
    },
    { enableOnFormTags: false }
  )

  useHotkeys('mod+z', (e) => {
    e.preventDefault()
    useMapStore.getState().undo()
  })

  useHotkeys(['mod+y', 'mod+shift+z'], (e) => {
    e.preventDefault()
    useMapStore.getState().redo()
  })
}
