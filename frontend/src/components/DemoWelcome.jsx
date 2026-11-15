import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { fieldApi, useField } from '../lib/field'
import './DemoWelcome.css'

const NOTICE_KEY = 'croptips-demo-welcome-dismissed'
function dismissed() { try { return sessionStorage.getItem(NOTICE_KEY) === 'yes' } catch { return false } }
export default function DemoWelcome() {
  const { record, loading } = useField()
  const { pathname } = useLocation()
  const [closed, setClosed] = useState(dismissed)
  const [info, setInfo] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef(null)
  useEffect(() => {
    const abort = new AbortController()
    fieldApi('demo/', { signal: abort.signal }).then(setInfo).catch(() => {})
    return () => abort.abort()
  }, [])
  const eligible = !record?.revision || record?.field.example_data
  const show = !closed && info?.enabled && !loading && record && eligible && ['/', '/myField', '/crop-rotation'].includes(pathname)
  useEffect(() => { if (show && !dialog.current.open) dialog.current.showModal() }, [show])
  function remember() { try { sessionStorage.setItem(NOTICE_KEY, 'yes') } catch { /* The notice can still be dismissed without session storage. */ } }
  function close() { remember(); setClosed(true) }
  async function enter() {
    setBusy(true); setError('')
    try {
      await fieldApi('demo/start/', { method: 'POST', body: {} })
      remember()
      window.location.assign('/myField')
    } catch (failure) { setError(failure.message); setBusy(false) }
  }
  if (!show) return info?.enabled && !loading && eligible && ['/', '/myField', '/crop-rotation'].includes(pathname) ? <button type="button" className="demo-launch" onClick={() => setClosed(false)}>California demo</button> : null
  return <dialog ref={dialog} className="demo-welcome" aria-labelledby="demo-title" onCancel={event => { event.preventDefault(); close() }}><button type="button" className="demo-close" onClick={close} aria-label="Close demo welcome" disabled={busy}>×</button><p className="demo-location">CALIFORNIA DEMO</p><h1 id="demo-title">Welcome to Valley Farm</h1><p>Explore a 32-hectare farm in Fresno County, California.</p><div className="demo-farm-facts"><span>3 field sectors</span><span>2 years of crop & fertiliser history</span><span>Equipment & water station included</span></div><p className="demo-example-note">This fictional farm is on the shared <strong>croptips_demo</strong> account. Use example records only.</p><div className="demo-actions"><button type="button" className="demo-enter" disabled={busy} onClick={enter}>{busy ? 'Opening farm…' : 'Open demo farm'}</button><button type="button" className="demo-own" disabled={busy} onClick={close}>Use my own field</button></div>{error && <p role="alert" className="demo-error">{error}</p>}</dialog>
}
