import { useEffect, useRef, useState } from 'react'
import Navigation from '../../components/Navigation/Navigation'
import FieldEditor from '../../components/FieldEditor'
import DecisionDisclaimer from '../../components/DecisionDisclaimer'
import { GOALS, fieldApi, useField } from '../../lib/field'
import './CropRotation.css'
import AdvancedForecast from './AdvancedForecast'
import Resources from './Resources'

function CropCard({ candidate, sector, photo }) {
  const { crop, status, reasons, checks_needed: checks, practical } = candidate
  const [imageFailed, setImageFailed] = useState(false)
  const mainReason = status === 'red' ? reasons.find(reason => /outside|unsuitable|does not match/i.test(reason)) || reasons[0] : reasons.find(reason => /preferred texture|pH/.test(reason)) || reasons[0]
  return <article className={`cr-result cr-${status}`}>
    {photo && !imageFailed && <img className="cr-crop-photo" src={photo.src} alt={crop.name} loading="lazy" onError={() => setImageFailed(true)} />}
    <div className="cr-crop-content"><p className="cr-result-sector">{sector.name} · {Number(sector.area_ha).toLocaleString(undefined, { maximumFractionDigits: 2 })} ha</p>
    <div className="cr-result-heading"><h3>{crop.name}</h3><span className={`cr-status cr-status-${status}`}>{status === 'red' ? '× Mismatch found' : status === 'green' ? '✓ Good soil & rotation fit' : '! Check before planting'}</span></div>
    {mainReason && <p className="cr-crop-reason">{mainReason}</p>}
    {practical && <dl className="cr-practical"><div><dt>Harvest</dt><dd>{practical.equipment.text}</dd></div><div><dt>Water</dt><dd>{practical.water.text}</dd></div></dl>}
    <details><summary>Checks & sources</summary><p><em>{crop.scientific_name}</em></p><ul>{[...reasons, ...checks].map(note => <li key={note}>{note}</li>)}</ul>{practical && <p>{practical.scope}</p>}<ul className="cr-source-list">{candidate.sources.map((source, index) => <li key={index}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : <a href="https://cgiar-climate-data-hub.github.io/catalog/ecocrop/" target="_blank" rel="noreferrer">EcoCrop crop requirements</a>}</li>)}</ul>
    {photo && <div className="cr-photo-credit"><strong>Photo credit</strong><p><a href={photo.source_url} target="_blank" rel="noreferrer">{photo.title}</a> · {photo.author}</p><p>{photo.license_url ? <a href={photo.license_url.replace('http:', 'https:')} target="_blank" rel="noreferrer">{photo.license}</a> : photo.license} · {photo.changes}</p></div>}</details></div>
  </article>
}
const weatherLabels = { temperature_mean: ['Average temperature', '°C', 1], temperature_min: ['Lowest temperature', '°C', 1], temperature_max: ['Highest temperature', '°C', 1], precipitation: ['Total rain', 'mm', 1], soil_moisture: ['Water in soil', '% by volume', 100] }
function Outlook({ outlook, loading, error }) {
  const archived = !outlook?.available && outlook?.last_model_run
  const run = archived || outlook
  const prediction = run?.prediction
  const conditions = prediction?.whole_period?.conditions
  return <section className="cr-panel cr-forecast"><h2>{archived ? 'Estimated growing conditions' : 'The next 100 days'}</h2>
    {loading && <p role="status">Loading model estimates…</p>}
    {error && <p role="alert">{error}</p>}
    {outlook && !outlook.available && !archived && <div className="cr-cold-note" role="status"><strong>Estimates unavailable</strong><p>{outlook.reason}</p></div>}
    {prediction && <><p className="cr-forecast-dates">{new Date(`${prediction.whole_period.start_date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} – {new Date(`${prediction.whole_period.end_date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</p><p className="cr-forecast-caption"><span>100-day estimates</span><span>NASA data</span></p><div className="cr-weather-grid">{Object.entries(conditions).map(([key, value]) => { const [label, unit, scale] = weatherLabels[key] || [key, value.units, 1]; return <div key={key}><span>{label}</span><strong>{(value.mean_estimate * scale).toFixed(1)} <small>{unit}</small></strong><span className="cr-forecast-anomaly">{value.reference_difference >= 0 ? '+' : ''}{(value.reference_difference * scale).toFixed(1)} {scale === 100 ? 'percentage points' : unit} vs historical reference</span></div> })}</div>
    <AdvancedForecast prediction={prediction} archived={Boolean(archived)} observedThrough={outlook.available_through} distance={run.grid_distance_km} /></>}
  </section>
}
export default function CropRotation() {
  const { record, loading, error: fieldError } = useField()
  const [editSection, setEditSection] = useState(null)
  return <div className="cr-layout"><Navigation /><main className="cr-main"><header className="cr-page-header"><div><h1>Crop rotation</h1><p>Choose an area. Find a crop or check your own.</p></div><button type="button" className="cr-small-tag" onClick={() => setEditSection(7)}>Edit field</button></header>{loading ? <p role="status">Loading your field…</p> : fieldError ? <p role="alert">{fieldError}</p> : record ? <>{!record.revision && <section className="cr-panel cr-setup-note"><h2>Add your field first</h2><p>Save your field details to check crops.</p><button type="button" className="cr-edit-button" onClick={() => setEditSection(0)}>Add field details →</button></section>}<Planner key={record.revision} record={record} onEdit={setEditSection} /></> : null}<DecisionDisclaimer variant="footer" context="Crop rotation checks, soil compatibility flags, and experimental weather outlooks are estimates designed to support your decisions — they do not replace human expertise. Always verify variety suitability, local pest pressure, and soil lab results with a certified agronomist before planting." />{editSection !== null && <FieldEditor section={editSection} onClose={() => setEditSection(null)} />}</main></div>
}
function Planner({ record, onEdit }) {
  const field = record.field
  const [scope, setScope] = useState(field.example_data && field.sectors.length > 1 ? 'mix' : 'whole')
  const [ids, setIds] = useState(field.example_data ? field.sectors.map(sector => sector.id) : [])
  const [mode, setMode] = useState('suggest')
  const [query, setQuery] = useState('')
  const [crops, setCrops] = useState([])
  const [photos, setPhotos] = useState({})
  const [assessment, setAssessment] = useState(null)
  const [outlook, setOutlook] = useState(null)
  const [outlookLoading, setOutlookLoading] = useState(true)
  const [outlookError, setOutlookError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const controller = useRef(null)
  const results = useRef(null)
  useEffect(() => {
    const abort = new AbortController()
    fetch('/crops/credits.json', { signal: abort.signal }).then(response => { if (!response.ok) throw new Error('Photos unavailable'); return response.json() }).then(data => { if (!abort.signal.aborted) setPhotos(data) }).catch(() => {})
    fieldApi('field/outlook/', { signal: abort.signal }).then(data => { if (!abort.signal.aborted) setOutlook(data) }).catch(failure => { if (!abort.signal.aborted) setOutlookError(failure.message) }).finally(() => { if (!abort.signal.aborted) setOutlookLoading(false) })
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
      <section className="cr-panel"><h2><span className="cr-step">1</span> Where?</h2><button type="button" className="cr-edit-button" onClick={() => onEdit(3)}>Edit field & sectors</button><p className="cr-muted">{field.name || 'Your field'} · {field.area_ha ?? '—'} ha · {field.sectors.length ? `${field.sectors.length} sectors` : 'One continuous field'}</p><fieldset className="cr-segment"><legend className="cr-sr-only">Planning area</legend>{[['whole', 'Whole field'], ['single', 'One sector'], ['mix', 'Sector mix']].map(([id, label]) => <label key={id} className={scope === id ? 'is-selected' : ''}><input type="radio" name="scope" checked={scope === id} disabled={id === 'single' ? !field.sectors.length : id === 'mix' && field.sectors.length < 2} onChange={() => chooseArea(id)} />{label}</label>)}</fieldset>
        {scope !== 'whole' && <fieldset className="cr-sector-picker"><legend>{scope === 'mix' ? 'Choose at least two sectors' : 'Choose a sector'}</legend>{field.sectors.map(sector => <label key={sector.id}><input type={scope === 'single' ? 'radio' : 'checkbox'} name="sectors" checked={ids.includes(sector.id)} onChange={() => change(setIds, scope === 'single' ? [sector.id] : ids.includes(sector.id) ? ids.filter(id => id !== sector.id) : [...ids, sector.id])} /><strong>{sector.name}</strong><span>{sector.area_ha} ha</span></label>)}</fieldset>}
        <details className="cr-history"><summary>Previous crops</summary>{field.crop_history.length ? field.crop_history.filter(row => scope === 'whole' || !row.sector_id || ids.includes(row.sector_id)).map(row => <p key={row.id}>{row.year} · {row.crop_name} · {field.sectors.find(sector => sector.id === row.sector_id)?.name || 'Whole field'}</p>) : <p>No previous crops recorded.</p>}<p>{field.fertilisers.length} fertiliser records · soil pH {field.soil_ph ?? 'not recorded'}</p><button type="button" className="cr-edit-button" onClick={() => onEdit(4)}>Edit history</button></details></section>
      <section className="cr-panel"><h2><span className="cr-step">2</span> Your goal</h2>{field.farm_profile ? <p className="cr-goal-weights">Harvest {field.farm_profile.goals.yield}% · Soil {field.farm_profile.goals.soilHealth}% · Water {field.farm_profile.goals.water}%</p> : <h3>{goal?.[1]}</h3>}<button type="button" className="cr-edit-button" onClick={() => onEdit(5)}>Edit goals</button></section>
      <section className="cr-panel"><h2><span className="cr-step">3</span> Choose a crop</h2><fieldset className="cr-search-mode"><legend className="cr-sr-only">Search method</legend><label><input type="radio" name="method" checked={mode === 'suggest'} onChange={() => change(setMode, 'suggest')} />Suggest crops</label><label><input type="radio" name="method" checked={mode === 'check'} onChange={() => change(setMode, 'check')} />Check a crop</label></fieldset>{mode === 'check' && <label className="cr-select-label">Crop name<input list="cr-crops" value={query} placeholder="Type a crop name" onChange={event => change(setQuery, event.target.value)} autoComplete="off" /><datalist id="cr-crops">{crops.map(item => <option key={item.id} value={item.name} />)}</datalist>{query && !crop && <small>Choose a crop from the list.</small>}</label>}<button className="cr-primary" disabled={!record.revision || busy || !crops.length || (mode === 'check' && !crop) || (scope !== 'whole' && ids.length < (scope === 'mix' ? 2 : 1))}>{busy ? 'Checking your field…' : mode === 'check' ? 'Check this crop →' : scope === 'mix' ? 'Suggest a mix →' : 'Show crops →'}</button>{error && <p role="alert" className="cr-error">{error}</p>}</section>
    </form><aside className="cr-outlook"><Outlook outlook={assessment?.outlook || outlook} loading={outlookLoading} error={outlookError} /><details className="cr-help"><summary>What is checked?</summary><p>Checks use your soil, past crops, available equipment and recorded water access. Current weather fit still needs a current forecast.</p></details></aside></div>
    <section className="cr-results" ref={results} aria-live="polite"><h2>{assessment ? mode === 'check' ? 'Crop check' : scope === 'mix' ? 'Suggested sector mix' : 'Crop options' : 'Results'}</h2>{assessment ? <><p className="cr-results-context">{field.name} · {assessment.planting_date} · {goal?.[1]}</p><div className="cr-legend"><span><i className="cr-dot-green" />Good soil & rotation fit</span><span><i className="cr-dot-amber" />Review needed</span><span><i className="cr-dot-red" />Mismatch found</span></div><p className="cr-result-scope">Colours show soil and crop-history fit. Weather, harvest arrangements and water supply still need checking.</p><Resources resources={assessment.resources} /><div className={scope === 'mix' ? 'cr-mix-results' : 'cr-result-list'}>{assessment.groups.flatMap(group => group.candidates.map(candidate => <CropCard photo={photos[candidate.crop.name]} key={`${group.sector.id}-${candidate.crop.id}`} candidate={candidate} sector={group.sector} />))}</div><details className="cr-history"><summary>How this is checked</summary><p>{assessment.basis}</p><ul>{assessment.limitations.map(note => <li key={note}>{note}</li>)}</ul></details></> : <p className="cr-muted">Select an area and press Show crops.</p>}</section>
  </>
}
