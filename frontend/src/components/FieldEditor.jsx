import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Onboarding from '../pages/onboarding/Onboarding'
import './FieldEditor.css'

export default function FieldEditor({ section = 7, onClose }) {
  const dialog = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current
    element.showModal()
    return () => { element.close(); previous?.focus() }
  }, [])
  return createPortal(<dialog className="field-editor-dialog" ref={dialog} aria-label="Edit field" onCancel={event => { event.preventDefault(); onClose() }}><div className="field-editor-toolbar"><strong>My field</strong><button type="button" onClick={onClose} aria-label="Close field editor">Close ×</button></div><Onboarding embedded initialStep={section} onSaved={onClose} /></dialog>, document.body)
}
