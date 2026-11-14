import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Navigation from '../components/Navigation/Navigation'
import { GOALS, fieldApi, useField } from '../lib/field'
import './CropRotation.css'

function CropCard({ candidate, sector }) {
  const { crop, status, label, reasons, checks_needed: checks } = candidate
  return <article className={`cr-result cr-${status}`}>
    <p className="cr-result-sector">{sector.name} · {sector.area_ha} ha</p>
    <div className="cr-result-heading"><div><h3>{crop.name}</h3><p>{crop.scientific_name} · {crop.family}</p></div><span className={`cr-status cr-status-${status}`}>{status === 'red' ? '×' : '!'} {label}</span></div>
    <ul>{reasons.slice(0, 2).map(reason => <li key={reason}>{reason}</li>)}</ul>
    <details open={status === 'red'}><summary>Checks and sources</summary><ul>{[...reasons.slice(2), ...checks].map(check => <li key={check}>{check}</li>)}</ul><p>Source: {crop.source.file}, row {crop.source.line}. Crop descriptors are not variety-specific planting instructions.</p></details>
  </article>
}
function Outlook({ outlook }) {
  const conditions = outlook?.prediction?.whole_period?.conditions
  return <section className="cr-panel"><h2>The next 100 days</h2>{!outlook ? <><p>Run a crop check to see the available forecast.</p><p className="cr-muted">Temperature · rain · soil moisture</p></> : !outlook.available ? <div className="cr-cold-note" role="status"><strong>Forecast unavailable</strong><p>{outlook.reason}</p><p>Results use soil and crop history. Weather is not checked.</p></div> : <><p className="cr-muted">Experimental regional estimates · grid {outlook.grid_distance_km} km from your field</p><div className="cr-weather-grid">{Object.entries(conditions || {}).map(([name, value]) => <div key={name}><span>{name.replaceAll('_', ' ')}</span><strong>{Number(value.mean_estimate).toFixed(1)} <small>{value.units}</small></strong><span>80% estimated range: {value.interval_80?.join(' – ')}</span><span>Reference difference: {value.reference_difference}</span></div>)}</div><p>These estimates do not predict individual frost events or guarantee safe planting.</p></>}</section>
}
export default function CropRotation() {
  const { record, loading, error: fieldError } = useField()
  return <div className="cr-layout"><Navigation /><main className="cr-main"><header className="cr-page-header"><div><h1>Crop rotation</h1><p>Choose an area. Find a crop or check your own.</p></div><Link to="/myField" className="cr-small-tag">My field ↗</Link></header>{loading ? <p role="status">Loading your field…</p> : fieldError ? <p role="alert">{fieldError}</p> : record ? <>{!record.revision && <section className="cr-panel cr-setup-note"><h2>Add your field first</h2><p>Save your field details to check crops.</p><Link to="/myField">Add field details →</Link></section>}<Planner key={record.revision} record={record} /></> : null}</main></div>
}
function Planner({ record }) {
  const field = record.field
  const [scope, setScope] = useState('whole')
  const [ids, setIds] = useState([])
  const [mode, setMode] = useState('suggest')
  const [query, setQuery] = useState('')
  const [crops, setCrops] = useState([])
  const [assessment, setAssessment] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef(null)
  const results = useRef(null)
  useEffect(() => {
    const abort = new AbortController()
    fieldApi('crops/', { signal: abort.signal }).then(data => setCrops(data.crops)).catch(failure => { if (!abort.signal.aborted) setError(failure.message) })
    return () => { abort.abort(); controller.current?.abort() }
  }, [])
  function change(setter, value) { controller.current?.abort(); setBusy(false); setter(value); setAssessment(null); setError('') }
  function chooseArea(next) { change(setScope, next); setIds(next === 'single' ? field.sectors.slice(0, 1).map(row => row.id) : next === 'mix' ? field.sectors.map(row => row.id) : []) }
  const crop = crops.find(item => [item.name, item.scientific_name].some(name => name.toLowerCase() === query.trim().toLowerCase()))
  const goal = GOALS.find(([id]) => id === field.goal)
  async function submit(event) {
    event.preventDefault(); controller.current?.abort()
    const abort = new AbortController(); controller.current = abort
    setBusy(true); setError(''); setAssessment(null)
    try {
      const data = await fieldApi('rotation/', { method: 'POST', signal: abort.signal, body: { revision: record.revision, scope, sector_ids: ids, ...(mode === 'check' ? { crop_id: crop.id } : {}) } })
      if (!abort.signal.aborted) { setAssessment(data); requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: 'instant', block: 'start' })) }
    } catch (failure) { if (!abort.signal.aborted) setError(failure.message) }
    finally { if (!abort.signal.aborted) setBusy(false) }
  }
  return <>
    <section aria-labelledby="cr-timing"><h2 id="cr-timing" className="cr-section-title">When?</h2><div className="cr-timing-options">{[['Plant now', 'Planting today'], ['Plant later', 'Choose a date'], ['Plan several years', 'Long-term rotation']].map(([title, subtitle], index) => <button type="button" key={title} disabled={index > 0} className={`cr-timing ${index === 0 ? 'cr-timing-active' : ''}`} aria-pressed={index === 0}><strong>{title}</strong><span>{subtitle}</span><small>{index > 0 ? 'Coming later' : 'Next 100 days'}</small></button>)}</div></section>
    <div className="cr-workspace"><form className="cr-controls" onSubmit={submit}>
      <section className="cr-panel"><h2><span className="cr-step">1</span> Where?</h2><p className="cr-muted">{field.name || 'Your field'} · {field.area_ha ?? '—'} ha · {field.sectors.length ? `${field.sectors.length} sectors` : 'One continuous field'}</p><fieldset className="cr-segment"><legend className="cr-sr-only">Planning area</legend>{[['whole', 'Whole field'], ['single', 'One sector'], ['mix', 'Sector mix']].map(([id, label]) => <label key={id} className={scope === id ? 'is-selected' : ''}><input type="radio" name="scope" checked={scope === id} disabled={id === 'single' ? !field.sectors.length : id === 'mix' && field.sectors.length < 2} onChange={() => chooseArea(id)} />{label}</label>)}</fieldset>
      {scope !== 'whole' && <fieldset className="cr-sector-picker"><legend>{scope === 'mix' ? 'Choose at least two sectors' : 'Choose a sector'}</legend>{field.sectors.map(sector => <label key={sector.id}><input type={scope === 'single' ? 'radio' : 'checkbox'} name="sectors" checked={ids.includes(sector.id)} onChange={() => change(setIds, scope === 'single' ? [sector.id] : ids.includes(sector.id) ? ids.filter(id => id !== sector.id) : [...ids, sector.id])} /><strong>{sector.name}</strong><span>{sector.area_ha} ha</span></label>)}</fieldset>}
      <details className="cr-history"><summary>Previous crops</summary>{field.crop_history.length ? field.crop_history.filter(row => scope === 'whole' || !row.sector_id || ids.includes(row.sector_id)).map(row => <p key={row.id}>{row.year} · {row.crop_name} · {field.sectors.find(sector => sector.id === row.sector_id)?.name || 'Whole field'}</p>) : <p>No previous crops recorded.</p>}<p>{field.fertilisers.length} fertiliser records · soil pH {field.soil_ph ?? 'not recorded'}</p><Link to="/myField">Update field records</Link></details></section>
      <section className="cr-panel"><h2><span className="cr-step">2</span> Your goal</h2><h3>{goal?.[1]}</h3><Link to="/myField">Change in My field ↗</Link></section>
      <section className="cr-panel"><h2><span className="cr-step">3</span> Choose a crop</h2><fieldset className="cr-search-mode"><legend className="cr-sr-only">Search method</legend><label><input type="radio" name="method" checked={mode === 'suggest'} onChange={() => change(setMode, 'suggest')} />Suggest crops</label><label><input type="radio" name="method" checked={mode === 'check'} onChange={() => change(setMode, 'check')} />Check a crop</label></fieldset>{mode === 'check' && <label className="cr-select-label">Crop name<input list="cr-crops" value={query} placeholder="Type a crop name" onChange={event => change(setQuery, event.target.value)} autoComplete="off" /><datalist id="cr-crops">{crops.map(item => <option key={item.id} value={item.name}>{item.scientific_name}</option>)}</datalist>{query && !crop && <small>Choose a crop from the list.</small>}</label>}<button className="cr-primary" disabled={!record.revision || busy || !crops.length || (mode === 'check' && !crop) || (scope !== 'whole' && ids.length < (scope === 'mix' ? 2 : 1))}>{busy ? 'Checking your field…' : mode === 'check' ? 'Check this crop →' : scope === 'mix' ? 'Suggest a mix →' : 'Show crops →'}</button>{error && <p role="alert" className="cr-error">{error}</p>}</section>
    </form><aside className="cr-outlook"><Outlook outlook={assessment?.outlook} /><details className="cr-help"><summary>What is checked?</summary><p>Soil pH and previous crop families. Fertiliser records provide context. Soil class and texture are saved but do not yet affect crop selection.</p></details></aside></div>
    <section className="cr-results" ref={results} aria-live="polite"><h2>{assessment ? mode === 'check' ? 'Crop check' : scope === 'mix' ? 'Suggested sector mix' : 'Crop options' : 'Results'}</h2>{assessment ? <><p className="cr-results-context">{field.name} · {assessment.planting_date} · {goal?.[1]}</p><div className="cr-legend"><span><i className="cr-dot-green" />Checks passed</span><span><i className="cr-dot-amber" />Review needed</span><span><i className="cr-dot-red" />Mismatch found</span></div><div className={scope === 'mix' ? 'cr-mix-results' : 'cr-result-list'}>{assessment.groups.flatMap(group => group.candidates.map(candidate => <CropCard key={`${group.sector.id}-${candidate.crop.id}`} candidate={candidate} sector={group.sector} />))}</div><details className="cr-history"><summary>How this is checked</summary><p>{assessment.basis}</p><ul>{assessment.limitations.map(note => <li key={note}>{note}</li>)}</ul></details></> : <p className="cr-muted">Select an area and press Show crops.</p>}</section>
    <footer className="cr-disclaimer"><strong>Estimates only. Check with a local agronomist before planting.</strong><p></p></footer>
  </>
}
