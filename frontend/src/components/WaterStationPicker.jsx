import { useEffect, useState } from 'react'
import './WaterStationPicker.css'

const STATIONS = [
  ['USGS-11446500', 'American River · Fair Oaks'],
  ['USGS-11377100', 'Sacramento River · Red Bluff'],
  ['USGS-11251000', 'San Joaquin River · Friant'],
  ['USGS-11152500', 'Salinas River · Spreckels'],
  ['USGS-11074000', 'Santa Ana River · Prado Dam'],
]

export default function WaterStationPicker({ stationId, onSave }) {
  const [candidate, setCandidate] = useState(stationId || '')
  const [search, setSearch] = useState('')
  const [custom, setCustom] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!candidate) return
    const controller = new AbortController()
    async function check() {
      try {
        const response = await fetch(`/api/environment/water/?station=${encodeURIComponent(candidate)}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Could not verify this California station. Check the ID or try again later.')
        const result = await response.json()
        setPreview({ id: candidate, ...result.data })
      } catch (failure) {
        if (failure.name !== 'AbortError') setError(failure.message)
      }
    }
    check()
    return () => controller.abort()
  }, [candidate])

  function choose(id) {
    setCandidate(id)
    setPreview(null)
    setError('')
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      await onSave(candidate)
      setSaved(true)
    } catch {
      setError('Your station could not be saved. Please try again.')
    } finally { setSaving(false) }
  }

  const verified = preview?.id === candidate ? preview : null
  const visible = STATIONS.filter(([id, name]) => `${id} ${name}`.toLowerCase().includes(search.toLowerCase()))
  return <section className="station-picker" aria-labelledby="water-station-heading">
    <h2 id="water-station-heading">Water monitoring station</h2>
    <p>Choose the station that represents your field’s river or water source.</p>
    <p>Saved station: <strong>{stationId || 'None selected'}</strong></p>
    <label>Search pilot stations
      <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="River, location or USGS ID" />
    </label>
    <fieldset><legend>California pilot stations</legend>
      {visible.map(([id, name]) => <label className="station-option" key={id}>
        <input type="radio" name="water-station" value={id} checked={candidate === id} onChange={() => choose(id)} />
        <span>{name}<small>{id}</small></span>
      </label>)}
      {visible.length === 0 && <p>No pilot stations match your search.</p>}
    </fieldset>
    <form onSubmit={event => {
      event.preventDefault()
      const id = custom.trim().toUpperCase()
      if (!/^USGS-\d{8,15}$/.test(id)) { setError('Enter a station ID such as USGS-11446500.'); return }
      choose(id)
    }}>
      <label>Another California station
        <input value={custom} onChange={event => setCustom(event.target.value)} placeholder="USGS-11446500" />
      </label>
      <button type="submit">Check station</button>
    </form>
    {candidate && !verified && !error && <p role="status">Checking station with USGS…</p>}
    {verified && <div className="station-preview">
      <h3>{verified.station.properties.monitoring_location_name}</h3>
      <p>{candidate} · {verified.station.properties.county_name || 'California'}</p>
      <p>{verified.station.geometry.coordinates[1].toFixed(4)}° latitude, {verified.station.geometry.coordinates[0].toFixed(4)}° longitude</p>
      <p>{verified.observations.length ? 'Current observations are available.' : 'No current observations are available at this station.'}</p>
      <a href={`https://waterdata.usgs.gov/monitoring-location/${candidate}/`} target="_blank" rel="noreferrer">View station on USGS</a>
    </div>}
    <p>The nearest station may monitor a different watershed. Confirm the river or water source before saving.</p>
    {error && <p className="station-error" role="alert">{error}</p>}
    <button type="button" disabled={!verified || saving} onClick={save}>{saving ? 'Saving…' : 'Save station'}</button>
    {saved && <p role="status">Water monitoring station saved for this field.</p>}
  </section>
}
