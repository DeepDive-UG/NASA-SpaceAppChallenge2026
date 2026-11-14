import { useEffect, useRef, useState } from 'react'
import './Alerts.css'

export default function Alerts({ onClose }) {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])
  const [alerts, setAlerts] = useState(null)
  const [fires, setFires] = useState(null)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(null)
  const [read, setRead] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('croptips-read-alerts') || '[]')
      return Array.isArray(stored) ? stored : []
    }
    catch { return [] }
  })
  useEffect(() => {
    const controller = new AbortController()
    let running = false
    async function refresh() {
      if (running) return
      running = true
      try {
        const results = await Promise.all(['alerts', 'fires'].map(async source => {
          const response = await fetch(`/api/environment/${source}/`, { signal: controller.signal })
          if (!response.ok) throw new Error('Official data is temporarily unavailable. Please try again later.')
          return response.json()
        }))
        setAlerts(results[0].data)
        setFires(results[1].data.features)
        setUpdated(results[0].retrieved_at)
        setError('')
      } catch (failure) {
        if (failure.name !== 'AbortError') setError(failure.message)
      } finally { running = false }
    }
    refresh()
    const timer = setInterval(refresh, 300000)
    return () => { clearInterval(timer); controller.abort() }
  }, [])

  function markRead(alert) {
    const next = [...new Set([...read, alert.id + alert.revision])].slice(-500)
    setRead(next)
    try { localStorage.setItem('croptips-read-alerts', JSON.stringify(next)) }
    catch { /* Read state remains available for the current session. */ }
  }

  return <dialog ref={dialog} className="environment-dialog" aria-labelledby="alerts-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <button className="close-alerts" onClick={onClose} aria-label="Close alerts">Close ×</button>
    <h2 id="alerts-title">Water & fire alerts</h2>
    <p>California · Official NWS warnings and NIFC wildfire reports. Refreshes every 5 minutes while this page is open.</p>
    <p>Statewide overview. Check the affected area for each warning. Fire weather warnings describe conditions that favour fires.</p>
    {error && <p role="alert">{error} Previously loaded information may be outdated.</p>}
    {!updated && !error && <p role="status">Loading official sources…</p>}
    {updated && <p>Last retrieved: {new Date(updated).toLocaleString()}</p>}
    <section aria-label="Official warnings" aria-live="polite">
      {alerts?.length === 0 && <p>No active water or fire warnings were returned by NWS.</p>}
      {alerts?.map(alert => <article key={alert.id}>
        <p>{alert.category === 'water' ? 'Water' : 'Fire'} · {alert.severity} · {read.includes(alert.id + alert.revision) ? 'Read' : 'New'}</p>
        <h2>{alert.headline || alert.event}</h2><p>{alert.area}</p>
        <p className="alert-text">{alert.description}</p><p className="alert-text">{alert.instruction}</p>
        <p>Expires: {new Date(alert.expires).toLocaleString()}</p>
        <button onClick={() => markRead(alert)}>Mark as read</button>
        <a href="https://www.weather.gov/" target="_blank" rel="noreferrer">NWS source</a>
      </article>)}
    </section>
    <section aria-label="Reported wildfires"><h2>Reported wildfires</h2>
      {fires?.length === 0 && <p>No current California wildfires were returned by NIFC.</p>}
      {fires?.map(fire => <article key={fire.properties.IrwinID}>
        <h3>{fire.properties.IncidentName}</h3><p>{fire.properties.POOCounty}</p>
        <p>Containment: {fire.properties.PercentContained ?? 'Unknown'}{fire.properties.PercentContained != null ? '%' : ''}</p>
        {fire.properties.ModifiedOnDateTime_dt && <p>Report updated: {new Date(fire.properties.ModifiedOnDateTime_dt).toLocaleString()}</p>}
      </article>)}
      <a href="https://data-nifc.opendata.arcgis.com/" target="_blank" rel="noreferrer">NIFC source</a>
      <p>Incident reports may be delayed. Follow local authorities for evacuation instructions.</p>
    </section>
  </dialog>
}
