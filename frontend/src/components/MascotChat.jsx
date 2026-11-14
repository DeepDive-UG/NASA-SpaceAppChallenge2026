import { useEffect, useRef, useState } from 'react'
import './MascotChat.css'

export default function MascotChat({ open, onClose }) {
  return open ? <ChatDialog onClose={onClose} /> : null
}

function ChatDialog({ onClose }) {
  const dialog = useRef(null)
  const controller = useRef(null)
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => { controller.current?.abort(); element.close() }
  }, [])

  async function send(event) {
    event.preventDefault()
    const text = question.trim()
    if (!text || busy) return
    controller.current = new AbortController()
    const timeout = setTimeout(() => controller.current?.abort(), 240000)
    setBusy(true)
    setError('')
    setResult(null)
    try {
      await fetch('/api/health/', { signal: controller.current.signal })
      const token = document.cookie.split('; ').find(part => part.startsWith('csrftoken='))?.split('=')[1]
      const response = await fetch('/api/chat/', {
        method: 'POST', signal: controller.current.signal,
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token || '' },
        body: JSON.stringify({ message: text }),
      })
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error(response.status === 403 ? 'Session verification failed. Reload this page and try again.' : 'The assistant could not be reached. Please try again later.')
      }
      const answer = await response.json()
      if (!response.ok) throw new Error(answer.error || 'The local assistant is unavailable.')
      setResult(answer)
    } catch (failure) {
      if (!controller.current.signal.aborted) setError(failure.message)
      else setError('Request cancelled or timed out. Try a shorter question.')
    } finally { clearTimeout(timeout); setBusy(false) }
  }

  return <dialog ref={dialog} className="mascot-chat" aria-labelledby="mascot-chat-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <header><h2 id="mascot-chat-title">Ask CropTips</h2><button type="button" onClick={onClose} aria-label="Close chat">Close ×</button></header>
    <p>Ask a question about crops, growing conditions or rotation. Each question is answered independently.</p>
    <form onSubmit={send}>
      <label htmlFor="mascot-question">Your question</label>
      <textarea id="mascot-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} rows={3} required disabled={busy} placeholder="What temperatures does okra prefer?" />
      <button type="submit" disabled={busy || !question.trim()}>{busy ? 'Preparing answer…' : 'Ask'}</button>
      {busy && <button type="button" onClick={() => controller.current?.abort()}>Cancel request</button>}
    </form>
    {busy && <p role="status">Searching sources and preparing an answer locally…</p>}
    {error && <p className="mascot-error" role="alert">{error}</p>}
    {result && <section aria-label="Answer" aria-live="polite">
      <p className="mascot-answer">{result.answer}</p>
      {result.insufficient_evidence && <p>The available sources do not fully answer this question.</p>}
      {result.sources?.length > 0 && <details><summary>Sources ({result.sources.length})</summary>
        {result.sources.map(source => <div className="mascot-source" key={source.reference}>
          <strong>[{source.reference}] {source.title}</strong><p>{source.file}{source.line ? ` · CSV line ${source.line}` : ''}</p>
          {source.url && <a href={source.url} target="_blank" rel="noreferrer">Original source</a>}
          <details><summary>Retrieved excerpt</summary><p className="mascot-answer">{source.text}</p></details>
        </div>)}
      </details>}
    </section>}
  </dialog>
}
