import { useEffect, useRef, useState } from 'react'
import DecisionDisclaimer from '../../components/DecisionDisclaimer'
import TermHelp from '../../components/TermHelp'
import './Alerts.css'

export default function Alerts({ onClose }) {
  const dialog = useRef(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showAllFires, setShowAllFires] = useState(false)
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    return () => element.close()
  }, [])
  const [alerts, setAlerts] = useState(null)
  const [fires, setFires] = useState(null)
  const [errors, setErrors] = useState({})
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
        await Promise.all(['alerts', 'fires'].map(async source => {
          try {
            const response = await fetch(`/api/environment/${source}/`, { signal: controller.signal })
            if (!response.ok) throw new Error('Could not load this source. Try again later.')
            const result = await response.json()
            if (source === 'alerts') setAlerts(result.data)
            else setFires([...result.data.features].sort((a, b) => (Date.parse(b.properties.ModifiedOnDateTime_dt) || 0) - (Date.parse(a.properties.ModifiedOnDateTime_dt) || 0)))
            setUpdated(current => ({ ...current, [source]: result.retrieved_at }))
            setErrors(current => ({ ...current, [source]: '' }))
          } catch (failure) {
            if (failure.name !== 'AbortError') setErrors(current => ({ ...current, [source]: failure.message }))
          }
        }))
      } finally { running = false }
    }
    refresh()
    const timer = setInterval(refresh, 300000)
    return () => { clearInterval(timer); controller.abort() }
  }, [refreshKey])

  function markRead(alert) {
    const next = [...new Set([...read, alert.id + alert.revision])].slice(-500)
    setRead(next)
    try { localStorage.setItem('croptips-read-alerts', JSON.stringify(next)) }
    catch { /* Read state remains available for the current session. */ }
  }

  const water = alerts?.filter(alert => alert.category === 'water')
  const fireWeather = alerts?.filter(alert => alert.category !== 'water')
  const formatTime = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString() : 'Not supplied'
  function warningCards(items) {
    if (errors.alerts) return <p role="alert">{errors.alerts} Older warnings below may be out of date.</p>
    if (!items) return <p role="status">Loading weather warnings…</p>
    if (!items.length) return <p className="alerts-empty">No warnings listed here right now.</p>
    return null
  }
  function warningCard(alert) {
    return <article className={`alert-card alert-card--${alert.category}`} key={alert.id}>
      <div className="alert-card-top"><span>{read.includes(alert.id + alert.revision) ? 'Read' : 'New warning'}</span></div>
      <h3>{alert.event || alert.headline}</h3><p className="alert-area">{alert.area}</p>

      <details><summary>What does this mean?</summary><p>Official level: {alert.severity || 'Not supplied'}. Until {formatTime(alert.expires)}.</p>{alert.headline && <p>{alert.headline}</p>}{alert.instruction && <p className="alert-instruction">{alert.instruction}</p>}<p className="alert-text">{alert.description}</p><a href="https://www.weather.gov/" target="_blank" rel="noreferrer">National Weather Service</a></details>
      {!read.includes(alert.id + alert.revision) && <button className="alert-read" onClick={() => markRead(alert)}>Mark as read</button>}
    </article>
  }
  return <dialog ref={dialog} className="environment-dialog" aria-labelledby="alerts-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <header className="alerts-header"><div><h2 id="alerts-title">Water & fire alerts</h2><p>California · Check the place name before you act.</p></div><button className="close-alerts" onClick={onClose} aria-label="Close alerts">Close ×</button></header>
    {(errors.alerts || errors.fires) && <button type="button" onClick={() => setRefreshKey(value => value + 1)}>Try loading again</button>}
    <section className="alerts-group alerts-group--water" aria-label="Water warnings"><h3>Water warnings <span>{water?.length ?? '…'}</span></h3><p>Places with possible flooding.</p>{warningCards(water)}{water?.map(warningCard)}</section>
    <section className="alerts-group alerts-group--fire" aria-label="Fire weather warnings"><h3>Fire weather <span>{fireWeather?.length ?? '…'}</span><TermHelp term="Fire weather">Weather that can help a fire start or spread. A fire weather warning does not mean a fire has been found.</TermHelp></h3><p>Dry or windy weather that can help fires spread. It does not mean a fire has started.</p>{warningCards(fireWeather)}{fireWeather?.map(warningCard)}</section>
    <section className="alerts-group alerts-group--fire" aria-label="Reported wildfires"><h3>Reported fires <span>{fires?.length ?? '…'}</span></h3><p>Places where fire crews have reported a fire. This is not an order to leave.</p>
      {errors.fires && <p role="alert">{errors.fires} Older reports below may be out of date.</p>}
      {!fires && !errors.fires && <p role="status">Loading fire reports…</p>}
      {fires?.length === 0 && <p className="alerts-empty">No fires listed here right now. Reports may arrive late.</p>}
      {fires?.slice(0, showAllFires ? fires.length : 3).map(fire => <article className="alert-card" key={fire.properties.IrwinID}><h3>{fire.properties.IncidentName || 'Unnamed incident'}</h3><p className="alert-area">{fire.properties.POOCounty ? `${fire.properties.POOCounty} County` : 'County not supplied'}</p><details><summary>Fire details</summary><p>Containment: {fire.properties.PercentContained != null ? `${fire.properties.PercentContained}%` : 'Not reported'}<TermHelp term="Containment">How much of the fire’s edge crews say they have a line around to help stop it spreading. It does not mean the fire is out or the area is safe.</TermHelp></p><p>Updated {formatTime(fire.properties.ModifiedOnDateTime_dt)}</p><a href="https://data-nifc.opendata.arcgis.com/" target="_blank" rel="noreferrer">National Interagency Fire Center</a></details></article>)}
      {fires?.length > 3 && <button type="button" className="alerts-more" onClick={() => setShowAllFires(value => !value)}>{showAllFires ? 'Show fewer fires' : `Show all ${fires.length} reports`}</button>}
    </section>
    <details className="alerts-sources"><summary>Sources & update times</summary><p>Weather warnings: {formatTime(updated?.alerts)}. Fire reports: {formatTime(updated?.fires)}.</p><p>Checked every 5 minutes while this window is open. Incident reports can be delayed.</p><a href="https://www.weather.gov/" target="_blank" rel="noreferrer">NWS weather warnings</a><br /><a href="https://data-nifc.opendata.arcgis.com/" target="_blank" rel="noreferrer">NIFC fire reports</a></details>
    <DecisionDisclaimer variant="compact" title="Follow local emergency advice." context="Reports can arrive late. Follow local emergency services if they tell you to leave." />
  </dialog>
}
