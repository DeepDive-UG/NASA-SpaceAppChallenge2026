import { useEffect, useRef, useState } from 'react'
import './MascotChat.css'

// Samodzielny komponent: wystarczy wstawić <MascotChat /> na dowolnej stronie.
// Opcjonalnie: <MascotChat src="/inny.gif" />
export default function MascotChat({ src = '/Scene1.gif' }) {
  const [open, setOpen] = useState(false)
  const [answer, setAnswer] = useState(null) // prawidłowa odpowiedź z API

  function close() {
    setOpen(false)
    setAnswer(null)
  }

  return (
    <div
      className="mascot-widget"
      onKeyDown={event => { if (event.key === 'Escape') close() }}
    >
      {open && !answer && <ChatBubble onClose={close} onAnswer={setAnswer} />}
      {open && answer && (
        <AnswerBubble result={answer} onClose={close} onAskAgain={() => setAnswer(null)} />
      )}
      <button
        type="button"
        className="mascot-toggle"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls="mascot-bubble"
        aria-label={open ? 'Close CropTips chat' : 'Open CropTips chat'}
      >
        <img src={src} className="mascot" alt="" />
      </button>
    </div>
  )
}

// Okno z pytaniem. Po prawidłowej odpowiedzi znika (przekazuje wynik do rodzica).
function ChatBubble({ onClose, onAnswer }) {
  const controller = useRef(null)
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Zamknięcie dymka przerywa trwające żądanie.
  useEffect(() => () => controller.current?.abort(), [])

  async function send(event) {
    event.preventDefault()
    const text = question.trim()
    if (!text || busy) return
    const ctrl = new AbortController()
    controller.current = ctrl
    const timeout = setTimeout(() => ctrl.abort(), 240000)
    setBusy(true)
    setError('')
    try {
      await fetch('/api/health/', { signal: ctrl.signal })
      const token = document.cookie.split('; ').find(part => part.startsWith('csrftoken='))?.split('=')[1]
      const response = await fetch('/api/chat/', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token || '' },
        body: JSON.stringify({ message: text }),
      })
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error(response.status === 403 ? 'Session verification failed. Reload this page and try again.' : 'The assistant could not be reached. Please try again later.')
      }
      const answer = await response.json()
      if (!response.ok) throw new Error(answer.error || 'The local assistant is unavailable.')
      if (typeof answer.answer !== 'string' || !answer.answer.trim()) {
        throw new Error('The assistant returned an empty answer. Please try again.')
      }
      onAnswer(answer) // prawidłowa odpowiedź -> okno z pytaniem się zamyka
    } catch (failure) {
      if (ctrl.signal.aborted) setError('Request cancelled or timed out. Try a shorter question.')
      else setError(failure.message)
    } finally { clearTimeout(timeout); setBusy(false) }
  }

  return (
    <div id="mascot-bubble" className="mascot-bubble" role="dialog" aria-modal="false" aria-labelledby="mascot-chat-title">
      <div className="mascot-bubble-inner">
        <header>
          <h2 id="mascot-chat-title">Chat with Tip</h2>
          <button type="button" className="mascot-close" onClick={onClose} aria-label="Close chat">×</button>
        </header>
        <p>Ask a question about crops, growing conditions or rotation. Each question is answered independently.</p>
        <form onSubmit={send}>
          <label htmlFor="mascot-question">Your question</label>
          <textarea id="mascot-question" autoFocus value={question} onChange={event => setQuestion(event.target.value)} maxLength={2000} rows={2} required disabled={busy} placeholder="What temperatures does okra prefer?" />
          <button type="submit" disabled={busy || !question.trim()}>{busy ? 'Preparing answer…' : 'Ask'}</button>
          {busy && <button type="button" onClick={() => controller.current?.abort()}>Cancel request</button>}
        </form>
        {busy && <p role="status">Searching sources and preparing an answer locally…</p>}
        {error && <p className="mascot-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}

// Owalny dymek z odpowiedzią i animacją pisania.
function AnswerBubble({ result, onClose, onAskAgain }) {
  const full = result.answer
  const [shown, setShown] = useState(0)
  const timer = useRef(null)
  const done = shown >= full.length

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(full.length)
      return
    }
    setShown(0)
    const step = Math.max(1, Math.ceil(full.length / 350)) // długie odpowiedzi nie piszą się w nieskończoność
    let count = 0
    timer.current = setInterval(() => {
      count = Math.min(count + step, full.length)
      setShown(count)
      if (count >= full.length) clearInterval(timer.current)
    }, 22)
    return () => clearInterval(timer.current)
  }, [full])

  // Kliknięcie w tekst pomija animację.
  function skip() {
    clearInterval(timer.current)
    setShown(full.length)
  }

  return (
    <div id="mascot-bubble" className="mascot-bubble mascot-bubble--answer" role="dialog" aria-modal="false" aria-label="Tip's answer">
      <div className="mascot-bubble-inner">
        <header>
          <h2>Tip</h2>
          <button type="button" className="mascot-close" onClick={onClose} aria-label="Close chat">×</button>
        </header>

        {/* Czytniki ekranu dostają pełny tekst od razu, bez efektu pisania. */}
        <span className="mascot-sr-only" role="status">{full}</span>
        <p className="mascot-answer mascot-typing" aria-hidden="true" onClick={skip}>
          <span>{full.slice(0, shown)}</span>
          {!done && <span className="mascot-caret" />}
          <span className="mascot-untyped">{full.slice(shown)}</span>
        </p>

        {done && <>
          {result.insufficient_evidence && <p>The available sources do not fully answer this question.</p>}
          {result.sources?.length > 0 && <details><summary>Sources ({result.sources.length})</summary>
            {result.sources.map(source => <div className="mascot-source" key={source.reference}>
              <strong>[{source.reference}] {source.title}</strong><p>{source.file}{source.line ? ` · CSV line ${source.line}` : ''}</p>
              {source.url && <a href={source.url} target="_blank" rel="noreferrer">Original source</a>}
              <details><summary>Retrieved excerpt</summary><p className="mascot-answer">{source.text}</p></details>
            </div>)}
          </details>}
          <button type="button" onClick={onAskAgain}>Ask another question</button>
        </>}
      </div>
    </div>
  )
} 