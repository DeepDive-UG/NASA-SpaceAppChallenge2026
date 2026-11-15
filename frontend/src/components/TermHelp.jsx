import { useId } from 'react'
import './TermHelp.css'

export default function TermHelp({ term, children }) {
  const id = useId()
  return <span className="term-help"><button type="button" className="term-help-trigger" popoverTarget={id} aria-label={`Explain ${term}`}>i</button><span id={id} popover="auto" className="term-help-popover"><strong>{term}</strong><span>{children}</span><button type="button" popoverTarget={id} popoverTargetAction="hide" aria-label={`Close explanation of ${term}`}>Got it</button></span></span>
}
