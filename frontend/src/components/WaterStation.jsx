import { useEffect, useState } from 'react'
import './WaterStation.css'

export default function WaterStation({ stationId }) {
  const station = stationId
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [checkedAt, setCheckedAt] = useState(() => Date.now())
  useEffect(() => {
    if (!station) return
    const controller = new AbortController()
    let running = false
    async function refresh() {
      if (running) return
      running = true
      setLoading(true)
      setCheckedAt(Date.now())
      try {
        const response = await fetch(`/api/environment/water/?station=${encodeURIComponent(station)}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Water measurements are temporarily unavailable for this station.')
        const result = await response.json()
        setData({ ...result, selectedStation: station })
        setError('')
      } catch (failure) {
        if (failure.name !== 'AbortError') setError(failure.message)
      } finally {
        running = false
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    refresh()
    const timer = setInterval(refresh, 300000)
    return () => { clearInterval(timer); controller.abort() }
  }, [station])

  const current = data?.selectedStation === station ? data : null
  const names = { '00060': 'River flow', '00065': 'Gage height', '00010': 'Water temperature', '00062': 'Water level' }
  const observations = current?.data.observations.filter(item => names[item.properties.parameter_code]) || []
  const daily = (current?.data.recent_discharge || []).filter(item => {
    const p = item.properties
    return p.value != null && p.value !== '' && Number.isFinite(Number(p.value)) && Number(p.value) >= 0
  }).sort((a, b) => a.properties.time.localeCompare(b.properties.time))
  const lastDay = daily.at(-1)?.properties
  const history = lastDay ? daily.filter(item => item.properties.time_series_id === lastDay.time_series_id && item.properties.unit_of_measure === lastDay.unit_of_measure).slice(-7) : []
  const mean = history.length ? history.reduce((sum, item) => sum + Number(item.properties.value), 0) / history.length : null
  const highest = Math.max(1, ...history.map(item => Number(item.properties.value)))
  return <section className="water-conditions" aria-label="Water conditions">
    <h2>Water conditions</h2>
    {!station && <p>No water station is assigned to this field yet.</p>}
    {station && loading && <p role="status">Updating station measurements…</p>}
    {station && error && <p role="alert">{error} Previously retrieved measurements may be outdated.</p>}
    {current && <>
      <h3>{current.data.station.properties.monitoring_location_name}</h3>
      <p>{station} · {current.data.station.properties.county_name || 'California'}</p>
      <details className="water-reading-details"><summary>Reading times & updates</summary><p className="water-caption">Checked: {new Date(current.retrieved_at).toLocaleString()} · Refreshes every 5 minutes while this page is open</p></details>
      {observations.length === 0 && <p>No river flow, level or water temperature readings are available for this station.</p>}
      <div className="water-metrics">{observations.map(observation => {
        const p = observation.properties
        const ageHours = (checkedAt - Date.parse(p.time)) / 3600000
        const recent = Number.isFinite(ageHours) && ageHours >= -0.25 && ageHours <= 6
        const valid = p.value != null && p.value !== '' && Number.isFinite(Number(p.value))
        return <article key={p.time_series_id}>
          <h4>{names[p.parameter_code]}</h4>
          <strong className="water-value">{valid ? Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'Unavailable'} <small>{valid && ({ 'ft^3/s': 'ft³/s', degC: '°C' }[p.unit_of_measure] || p.unit_of_measure)}</small></strong>
          <p className={recent && valid ? 'water-recent' : 'water-old'}>{!valid ? 'No numeric reading' : recent ? 'Recent reading' : 'Older or unverified reading time'}</p>
          <details className="water-reading-details"><summary>Reading details</summary><p>Measured: {new Date(p.time).toLocaleString()}</p>
          <p>{p.approval_status === 'Provisional' ? 'Preliminary reading' : p.approval_status}</p>
          {p.qualifier && <p>Qualifier: {String(p.qualifier)}</p>}</details>
        </article>
      })}</div>
      <details className="water-reading-details"><summary>Past 7 days</summary><h3>Recent daily river flow</h3>
      {history.length > 0 ? <>
        <p>Average of {history.length} available daily readings: <strong>{mean.toLocaleString(undefined, { maximumFractionDigits: 2 })} {lastDay.unit_of_measure}</strong></p>
        <ul className="water-history" aria-label="Daily mean river flow">
          {history.map(item => <li key={item.properties.time}>
            <time>{item.properties.time}</time>
            <span className="water-bar" aria-hidden="true" style={{ width: `${Number(item.properties.value) / highest * 100}%` }} />
            <span>{Number(item.properties.value).toLocaleString()} {item.properties.unit_of_measure}</span>
          </li>)}
        </ul>
        <p className="water-caption">Daily means use local station dates. Missing days are not filled. Recent values may be provisional.</p>
      </> : <p>{current.data.history_status === 'unavailable' ? 'Recent flow history could not be loaded.' : 'No recent daily flow records are available.'}</p>}
      </details><div className="water-note"><strong>Before watering</strong>
        <p>Check your own water source, pump and local watering rules.</p>

      </div>
    </>}
    {station && <a href={`https://waterdata.usgs.gov/monitoring-location/${station}/`} target="_blank" rel="noreferrer">USGS station source</a>}

  </section>
}
