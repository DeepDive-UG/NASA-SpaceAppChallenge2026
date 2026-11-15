import { useEffect, useRef, useState } from 'react'
import Navigation from '../../components/Navigation/Navigation'
import TermHelp from '../../components/TermHelp'
import FieldEditor from '../../components/FieldEditor'
import DecisionDisclaimer from '../../components/DecisionDisclaimer'
import { GOALS, fieldApi, useField } from '../../lib/field'
import './CropRotation.css'
import AdvancedForecast from './AdvancedForecast'
import Resources from './Resources'
import MascotChat from '../../components/MascotChat'

const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
function MarketPrice({ market }) {
  if (!market) return <p className="cr-no-price">No price available.</p>
  return <div className="cr-market-price"><div className="cr-price-heading"><span>{market.is_example ? 'Example price' : 'Price'}</span><TermHelp term="Market price">This is a sample selling price, not a live offer from a buyer. The price you get may differ by place, quality and sale date.</TermHelp></div><strong className="cr-price-value">${market.price.toFixed(2)} <small>per {market.unit.replace('USD/', '')}</small></strong><p>{market.region} · {market.as_of}</p><small>Price may change before harvest.</small><details><summary>Price details</summary><TermHelp term="Bushel & tonne">A bushel measures grain volume. Its weight depends on the crop. A metric tonne is 1,000 kg. We convert prices to tonnes before comparing them.</TermHelp><p>{money(market.usd_per_tonne)} per metric tonne. Example data from the app’s market values file.</p><a href={market.conversion_source} target="_blank" rel="noreferrer">USDA unit conversions</a></details></div>
}

function CropCard({ candidate, sector, photo }) {
  const { crop, status, reasons, checks_needed: checks, practical } = candidate
  const [imageFailed, setImageFailed] = useState(false)
  const mainReason = status === 'red' ? reasons.find(reason => /outside|unsuitable|does not match/i.test(reason)) || reasons[0] : reasons.find(reason => /preferred texture|pH/.test(reason)) || reasons[0]
  return <article className={`cr-result cr-${status}`}>
    {photo && !imageFailed && <img className="cr-crop-photo" src={photo.src} alt={crop.name} loading="lazy" onError={() => setImageFailed(true)} />}
    <div className="cr-crop-content"><p className="cr-result-sector">{sector.name} · {Number(sector.area_ha).toLocaleString(undefined, { maximumFractionDigits: 2 })} ha</p>
    <div className="cr-result-heading"><h3>{crop.name}</h3><span className={`cr-status cr-status-${status}`}>{status === 'red' ? '× May not suit this field' : status === 'green' ? '✓ A good fit' : '! Check first'}</span></div>
    {mainReason && <p className="cr-crop-reason">{mainReason}</p>}
    <MarketPrice market={candidate.market} />
    {practical && <dl className="cr-practical"><div><dt>Harvest</dt><dd>{practical.equipment.text}</dd></div><div><dt>Water</dt><dd>{practical.water.text}</dd></div></dl>}
    {candidate.goal_effects?.some(item => item.weight > 0) && <details className="cr-goal-effects"><summary>Why this crop?</summary><dl>{candidate.goal_effects.filter(item => item.weight > 0).sort((a, b) => b.weight - a.weight).map(item => <div key={item.goal}><dt>{item.label} <small>{item.weight}% importance</small></dt><dd>{item.text}</dd></div>)}</dl></details>}
    <details><summary>More details & sources</summary><p><em>{crop.scientific_name}</em></p><ul>{[...reasons, ...checks].map(note => <li key={note}>{note}</li>)}</ul>{practical && <p>{practical.scope}</p>}<ul className="cr-source-list">{candidate.sources.map((source, index) => <li key={index}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : <a href="https://cgiar-climate-data-hub.github.io/catalog/ecocrop/" target="_blank" rel="noreferrer">EcoCrop crop requirements</a>}</li>)}</ul>
    {photo && <div className="cr-photo-credit"><strong>Photo credit</strong><p><a href={photo.source_url} target="_blank" rel="noreferrer">{photo.title}</a> · {photo.author}</p><p>{photo.license_url ? <a href={photo.license_url.replace('http:', 'https:')} target="_blank" rel="noreferrer">{photo.license}</a> : photo.license} · {photo.changes}</p></div>}</details></div>
  </article>
}
const weatherLabels = { temperature_mean: ['Average temperature', '°C', 1], temperature_min: ['Lowest temperature', '°C', 1], temperature_max: ['Highest temperature', '°C', 1], precipitation: ['Total rain', 'mm', 1], soil_moisture: ['Water at root depth', '%', 100], soil_temperature: ['Soil temperature', '°C', 1], surface_soil_moisture: ['Water at seed depth', '%', 100] }
function Outlook({ outlook, loading, error }) {
  const [horizon, setHorizon] = useState('10')
  const archived = !outlook?.available && outlook?.last_model_run
  const run = archived || outlook
  const prediction = run?.prediction
  const period = horizon === '10' ? prediction?.periods?.[0] : prediction?.whole_period
  const conditions = period?.conditions
  return <section className="cr-panel cr-forecast"><h2>Growing conditions</h2>
    {loading && <p role="status">Loading model estimates…</p>}
    {error && <p role="alert">{error}</p>}
    {outlook && !outlook.available && !archived && <div className="cr-cold-note" role="status"><strong>Estimates unavailable</strong><p>{outlook.reason}</p></div>}
    {prediction && period && <><div className="cr-horizon" role="group" aria-label="Estimate period">{[['10', archived ? 'First 10 days' : 'Next 10 days'], ['100', archived ? 'Full 100 days' : 'Next 100 days']].map(([value, label]) => <button type="button" key={value} aria-pressed={horizon === value} onClick={() => setHorizon(value)}>{label}</button>)}</div><p className="cr-period-meaning">{horizon === '10' ? 'Conditions during the first 10 days.' : 'Conditions across all 100 days, including the first 10.'}</p><p className="cr-forecast-dates">{new Date(`${period.start_date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })} – {new Date(`${period.end_date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</p><p className="cr-forecast-caption"><span>{horizon}-day estimates</span><span>NASA data</span></p><p className="cr-period-meaning">How does it compare with usual?<TermHelp term="What does usual mean?">We compare with the pattern in our past NASA data for this area and time of year. This is a short historical record, not a long-term climate average. Warmer or drier describes the difference from that pattern, not how certain the estimate is.</TermHelp></p><div className="cr-weather-grid">{['temperature_mean', 'soil_temperature', 'temperature_min', 'temperature_max', 'surface_soil_moisture', 'soil_moisture', 'precipitation'].filter(key => conditions[key]).map(key => [key, conditions[key]]).map(([key, value]) => { const [label, unit, scale] = weatherLabels[key] || [key, value.units, 1]; return <div key={key}><span>{label}{key === 'soil_temperature' && <TermHelp term="Soil temperature">An estimate for the top layer of NASA’s soil model, about 10 cm thick. It uses one reading around 13:30 UTC each day, not the coldest soil temperature overnight. Check your seedbed with a soil thermometer before sowing.</TermHelp>}{key === 'surface_soil_moisture' && <TermHelp term="Water at seed depth">How much of the top 5 cm of soil is water. Higher means wetter. This is an estimate for the area; check the soil where you plant.</TermHelp>}{key === 'soil_moisture' && <TermHelp term="Water at root depth">How much of the soil down to 1 metre is water. Higher means wetter. The surface can be much drier than the soil below.</TermHelp>}</span><strong>{(value.mean_estimate * scale).toFixed(1)} <small>{unit}</small></strong><span className="cr-forecast-anomaly">{Math.abs(value.reference_difference * scale) < .05 ? 'About the same as usual' : `${Math.abs(value.reference_difference * scale).toFixed(1)} ${scale === 100 ? 'points' : unit} ${key === 'precipitation' ? value.reference_difference > 0 ? 'more rain than usual' : 'less rain than usual' : scale === 100 ? value.reference_difference > 0 ? 'wetter than usual' : 'drier than usual' : value.reference_difference > 0 ? 'warmer than usual' : 'cooler than usual'}`}</span></div> })}</div>
    <details className="cr-reliability"><summary>How reliable are these estimates?</summary><p>These numbers are a guide. In tests in new areas, our estimates were off by the amounts below, on average. Some errors were larger.</p><dl>{Object.entries(conditions).filter(([, value]) => value.validation?.unseen_test_mae != null).map(([key, value]) => { const [label, unit, scale] = weatherLabels[key]; return <div key={key}><dt>{label}</dt><dd>About {(value.validation.unseen_test_mae * scale).toFixed(1)} {scale === 100 ? 'percentage points' : unit}</dd></div> })}</dl><p>Test results cover the selected {horizon} days and compare estimates with regional NASA data, not sensors on your field.</p></details>
    <p className="cr-period-meaning">A seasonal guide. Check local weather and your soil before planting.{archived ? ' These estimates start on the dates above, not today.' : ''}</p>
    <AdvancedForecast prediction={prediction} archived={Boolean(archived)} observedThrough={outlook.available_through} distance={run.grid_distance_km} /></>}
  </section>
}
export default function CropRotation() {
  const { record, loading, error: fieldError } = useField()
  const [editSection, setEditSection] = useState(null)
  return <div className="cr-layout"><Navigation /><main className="cr-main"><header className="cr-page-header"><div><h1>Crop rotation</h1><p>Choose an area. Find a crop or check your own.</p></div><button type="button" className="cr-small-tag" onClick={() => setEditSection(7)}>Edit field</button></header>{loading ? <p role="status">Loading your field…</p> : fieldError ? <p role="alert">{fieldError}</p> : record ? <>{!record.revision && <section className="cr-panel cr-setup-note"><h2>Add your field first</h2><p>Save your field details to check crops.</p><button type="button" className="cr-edit-button" onClick={() => setEditSection(0)}>Add field details →</button></section>}<Planner key={record.revision} record={record} onEdit={setEditSection} /></> : null}<DecisionDisclaimer variant="footer" context="These are estimates, not a promise of a safe crop or good harvest. Check your field, weather and water with a local farming adviser before planting." />{editSection !== null && <FieldEditor section={editSection} onClose={() => setEditSection(null)} />}</main><MascotChat /></div>
}
function Planner({ record, onEdit }) {
  const field = record.field
  const [scope, setScope] = useState(field.example_data && field.sectors.length > 1 ? 'mix' : 'whole')
  const [ids, setIds] = useState(field.example_data ? field.sectors.map(sector => sector.id) : [])
  const planningGoal = (field.farm_profile?.goals.profit || 0) > 0 || field.goal === 'profit' ? 'earn_more' : 'field'
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
      const data = await fieldApi('rotation/', { method: 'POST', signal: abort.signal, body: { planning_goal: planningGoal, revision: record.revision, scope, sector_ids: ids, ...(mode === 'check' ? { crop_id: crop.id } : {}) } })
      if (!abort.signal.aborted) { setAssessment(data); requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: 'instant', block: 'start' })) }
    } catch (failure) { if (!abort.signal.aborted) setError(failure.message) }
    finally { if (!abort.signal.aborted) setBusy(false) }
  }
  return <>
    <section aria-labelledby="cr-timing"><h2 id="cr-timing" className="cr-section-title">When?</h2><div className="cr-timing-options">{[['Plant now', 'Planting today'], ['Plant later', 'Choose a date'], ['Plan several years', 'Long-term rotation']].map(([title, subtitle], index) => <button type="button" key={title} disabled={index > 0} className={`cr-timing ${index === 0 ? 'cr-timing-active' : ''}`} aria-pressed={index === 0}><strong>{title}</strong><span>{subtitle}</span><small>{index > 0 ? 'Coming later' : 'Next 100 days'}</small></button>)}</div></section>
    <div className="cr-workspace"><form className="cr-controls" onSubmit={submit}>
      <section className="cr-panel"><h2><span className="cr-step">1</span> Where?</h2><button type="button" className="cr-edit-button" onClick={() => onEdit(3)}>Edit field & sectors</button><p className="cr-muted">{field.name || 'Your field'} · {field.area_ha ?? '—'} ha · {field.sectors.length ? `${field.sectors.length} sectors` : 'One continuous field'}</p><fieldset className="cr-segment"><legend className="cr-sr-only">Planning area</legend>{[['whole', 'Whole field'], ['single', 'One sector'], ['mix', 'Sector mix']].map(([id, label]) => <label key={id} className={scope === id ? 'is-selected' : ''}><input type="radio" name="scope" checked={scope === id} disabled={id === 'single' ? !field.sectors.length : id === 'mix' && field.sectors.length < 2} onChange={() => chooseArea(id)} />{label}</label>)}</fieldset>
        {scope !== 'whole' && <fieldset className="cr-sector-picker"><legend>{scope === 'mix' ? 'Choose at least two sectors' : 'Choose a sector'}</legend>{field.sectors.map(sector => <label key={sector.id}><input type={scope === 'single' ? 'radio' : 'checkbox'} name="sectors" checked={ids.includes(sector.id)} onChange={() => change(setIds, scope === 'single' ? [sector.id] : ids.includes(sector.id) ? ids.filter(id => id !== sector.id) : [...ids, sector.id])} /><strong>{sector.name}</strong><span>{sector.area_ha} ha</span></label>)}</fieldset>}
        <details className="cr-history"><summary>Previous crops</summary>{field.crop_history.length ? field.crop_history.filter(row => scope === 'whole' || !row.sector_id || ids.includes(row.sector_id)).map(row => <p key={row.id}>{row.year} · {row.crop_name} · {field.sectors.find(sector => sector.id === row.sector_id)?.name || 'Whole field'}</p>) : <p>No previous crops recorded.</p>}<p>{field.fertilisers.length} fertiliser records · soil pH<TermHelp term="Soil pH">pH tells you how acidic the soil is. A soil test gives this number. Different crops grow best at different pH levels.</TermHelp> {field.soil_ph ?? 'not recorded'}</p><button type="button" className="cr-edit-button" onClick={() => onEdit(4)}>Edit history</button></details></section>
      <section className="cr-panel"><h2><span className="cr-step">2</span> What matters most for your next crop?</h2>{field.farm_profile ? <div className="cr-goal-summary">{[['yield', 'A good harvest'], ['soilHealth', 'Healthy soil'], ['water', 'Using less water'], ['profit', 'Earn more']].map(([key, title]) => <div key={key}><span>{title}</span><strong>{field.farm_profile.goals[key] || 0}%</strong></div>)}</div> : <h3>{goal?.[1]}</h3>}<button type="button" className="cr-edit-button" onClick={() => onEdit(5)}>Edit goals</button></section>
      <section className="cr-panel"><h2><span className="cr-step">3</span> Choose a crop</h2><fieldset className="cr-search-mode"><legend className="cr-sr-only">Search method</legend><label><input type="radio" name="method" checked={mode === 'suggest'} onChange={() => change(setMode, 'suggest')} />Find crops for my field</label><label><input type="radio" name="method" checked={mode === 'check'} onChange={() => change(setMode, 'check')} />Check a crop I have in mind</label></fieldset>{mode === 'check' && <label className="cr-select-label">Crop name<input list="cr-crops" value={query} placeholder="Type a crop name" onChange={event => change(setQuery, event.target.value)} autoComplete="off" /><datalist id="cr-crops">{crops.map(item => <option key={item.id} value={item.name} />)}</datalist>{query && !crop && <small>Choose a crop from the list.</small>}</label>}<button className="cr-primary" disabled={!record.revision || busy || !crops.length || (mode === 'check' && !crop) || (scope !== 'whole' && ids.length < (scope === 'mix' ? 2 : 1))}>{busy ? 'Checking your field…' : mode === 'check' ? 'Check this crop →' : scope === 'mix' ? 'Suggest a mix →' : 'Show crops →'}</button>{error && <p role="alert" className="cr-error">{error}</p>}</section>
    </form><aside className="cr-outlook"><Outlook outlook={assessment?.outlook || outlook} loading={outlookLoading} error={outlookError} /><details className="cr-help"><summary>What is checked?</summary><p>Checks use your soil, past crops, available equipment and recorded water access. Current weather fit still needs a current forecast.</p></details></aside></div>
    <section className="cr-results" ref={results} aria-live="polite"><h2>{assessment ? mode === 'check' ? 'Crop check' : scope === 'mix' ? 'What could grow in each sector' : 'Crop options' : 'Results'}</h2>{assessment ? <><p className="cr-results-context">{field.name} · {assessment.planting_date} · {planningGoal === 'earn_more' ? 'Earn more' : goal?.[1]}</p>{planningGoal === 'earn_more' && <p className="cr-market-note">Example prices as of {assessment.market_basis?.as_of}. Your Earn more priority gives a small boost to higher prices within the same fit colour. What you earn also depends on harvest size, costs and your sale price.</p>}<div className="cr-legend"><span><i className="cr-dot-green" />A good fit</span><span><i className="cr-dot-amber" />Check first</span><span><i className="cr-dot-red" />May not suit this field</span></div><p className="cr-result-scope">Colours compare your soil and past crops. Before planting, check the weather, water and equipment.</p><Resources resources={assessment.resources} /><div className={scope === 'mix' ? 'cr-mix-results' : 'cr-result-list'}>{assessment.groups.flatMap(group => group.candidates.map(candidate => <CropCard photo={photos[candidate.crop.name]} key={`${group.sector.id}-${candidate.crop.id}`} candidate={candidate} sector={group.sector} />))}</div><details className="cr-history"><summary>How this is checked</summary><p>{assessment.basis}</p><ul>{assessment.limitations.map(note => <li key={note}>{note}</li>)}</ul></details></> : <p className="cr-muted">Select an area and press Show crops.</p>}</section>
  </>
}
