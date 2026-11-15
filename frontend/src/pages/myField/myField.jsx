import { useState } from 'react'
import Navigation from '../../components/Navigation/Navigation'
import TermHelp from '../../components/TermHelp'
import FieldEditor from '../../components/FieldEditor'
import WaterStation from '../../components/WaterStation'
import WaterStationPicker from '../../components/WaterStationPicker'
import { SOILS, useField } from '../../lib/field'
import './myField.css'
import MascotChat from '../../components/MascotChat'
import DecisionDisclaimer from '../../components/DecisionDisclaimer'

const number = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
const directions = { N: 'North', NE: 'Northeast', E: 'East', SE: 'Southeast', S: 'South', SW: 'Southwest', W: 'West', NW: 'Northwest', Center: 'Centre', Other: '' }
const fertiliserNames = { N: 'Nitrogen (N)', P: 'Phosphorus (P)', K: 'Potassium (K)', NPK: 'Mixed nutrients (NPK)', manure: 'Manure', compost: 'Compost', lime: 'Lime', none: 'No fertiliser', other: 'Other fertiliser' }
function soilLabel(value) { return value && value !== 'unknown' ? `Class ${value}` : 'Not known' }
function Season({ row }) {
  return <article className="field-season"><div className="field-season-heading"><strong>{row.crop === 'Other' ? row.otherCrop : row.crop}</strong><span className="field-area-label">{row.area}</span></div><p className="field-season-fertiliser"><small>Fertiliser</small> {row.fertilizers.map(value => fertiliserNames[value] || value).join(', ') || 'Fertiliser not recorded'}{row.amountKgHa != null ? ` (${number(row.amountKgHa)} kg/ha)` : ''}</p><details><summary>Harvest details</summary><dl className="field-season-facts"><div><dt>Fertiliser</dt><dd>{row.fertilizers.map(value => fertiliserNames[value] || value).join(', ') || 'Not recorded'}</dd></div>{row.amountKgHa != null && <div><dt>Amount</dt><dd>{number(row.amountKgHa)} kg/ha</dd></div>}<div><dt>Harvested amount</dt><dd>{row.yield || 'Not recorded'}</dd></div></dl></details></article>
}


function SectorOverview({ field, profile }) {
  const [selectedId, setSelectedId] = useState(null)
  const selected = field.sectors.find(sector => sector.id === selectedId) || field.sectors[0]
  const source = profile?.sectors.find(sector => sector.id === selected.id)
  const previous = [...(profile?.cropHistory.sameForAllSectors ? profile.cropHistory.shared : profile?.cropHistory.bySector[selected.id] || [])].sort((a, b) => b.year - a.year)[0]
  const assigned = field.sectors.reduce((sum, sector) => sum + Number(sector.area_ha || 0), 0)
  const unassigned = Math.max(0, Number(field.area_ha || 0) - assigned)
  return <div className="field-sector-overview">
    <figure className="field-area-figure">
      <div className="field-area-diagram" aria-label="Sector areas">
        {field.sectors.map((sector, index) => <button type="button" key={sector.id}
          className={`field-area-piece field-area-tone-${index % 3}${selected.id === sector.id ? ' is-selected' : ''}`}
          style={{ flexGrow: Number(sector.area_ha) || 1 }}
          aria-pressed={selected.id === sector.id} onClick={() => setSelectedId(sector.id)}>
          <strong>{sector.name}</strong><span>{number(sector.area_ha)} ha</span>
        </button>)}
        {unassigned > 0.01 && <div className="field-area-unassigned" style={{ flexGrow: unassigned }}>Unassigned <span>{number(unassigned)} ha</span></div>}
      </div>
      <figcaption>Area overview · not field boundaries</figcaption>
    </figure>
    <div className="field-selected-sector" aria-live="polite">
      <span className="field-area-label">{directions[source?.direction] || 'Selected sector'}</span>
      <h3>{selected.name}</h3>
      <p className="field-sector-size">{number(selected.area_ha)} <small>ha</small></p>
      <dl><div><dt>Soil</dt><dd>{soilLabel(source?.soilClass || field.soil_class)}</dd></div>
        <div><dt>Last crop</dt><dd>{previous ? <>{previous.crop === 'Other' ? previous.otherCrop : previous.crop}<small>{previous.year}</small></> : 'Not recorded'}</dd></div></dl>
      <p className="field-sector-hint">Choose a sector to see its details.</p>
    </div>
  </div>
}


export default function MyField() {
  const { record, loading, error, save, saving, loadExample } = useField()
  const [section, setSection] = useState(null)
  const field = record?.field
  const profile = field?.farm_profile
  const [soil, setSoil] = useState(null)
  const [notice, setNotice] = useState('')
  async function saveSoil(event) {
    event.preventDefault(); setNotice('')
    try { await save({ ...field, ...soil }); setSoil(null); setNotice('Saved.') } catch { setNotice('Could not save changes.') }
  }
  const open = step => setSection(step)
  const seasons = (profile ? profile.cropHistory.unknown ? [] : profile.cropHistory.sameForAllSectors ? profile.cropHistory.shared.map(row => ({ ...row, area: 'Whole field' })) : profile.sectors.flatMap(sector => (profile.cropHistory.bySector[sector.id] || []).map(row => ({ ...row, area: sector.name }))) : []).sort((a, b) => b.year - a.year)
  return <div className="mf-layout"><Navigation /><main className="mf-main field-ledger">
    <header className="field-heading"><div><h1>My field</h1>{record?.revision > 0 && <p>{field.name}</p>}</div>{record?.revision > 0 && <button type="button" className="field-primary" onClick={() => open(7)}>Edit field</button>}</header>
    {loading && <p role="status">Loading field…</p>}{error && <p role="alert" className="field-error">{error}</p>}
    {field && !record.revision && <section className="field-paper field-start"><h2>Add your field</h2><p>Keep your field size, soil and past crops in one place.</p><div className="field-start-actions"><button type="button" className="field-primary" onClick={() => open(0)} disabled={saving}>Add field details</button><button type="button" className="field-secondary" disabled={saving} onClick={async () => { try { await loadExample() } catch { /* FieldProvider displays the failure. */ } }}>{saving ? 'Loading…' : 'Try a California farm'}</button></div></section>}
    {field && record.revision > 0 && <>
      <section className="field-paper"><div className="field-entry-top"><h2>Field details</h2><button className="field-secondary" onClick={() => open(7)} aria-label="Edit field details">Edit</button></div><dl className="field-facts"><div><dt>Size</dt><dd>{profile ? `${number(profile.originalArea.value)} ${profile.originalArea.unit}` : field.area_ha ? `${number(field.area_ha)} ha` : 'Not added'}</dd></div><div><dt>Soil class<TermHelp term="Soil class">This describes how easy the land is to farm. Higher numbers mean more limits, such as slope or poor drainage. It does not tell us the soil’s acidity or nutrients.</TermHelp></dt><dd>{soilLabel(field.soil_class)}</dd></div><div><dt>Location</dt><dd>{field.latitude == null ? 'Not recorded' : <details><summary>Location saved</summary><span>{field.latitude}, {field.longitude}</span></details>}</dd></div></dl></section>
      <section className="field-paper"><div className="field-entry-top"><h2>Sectors</h2><button className="field-secondary" onClick={() => open(3)} aria-label="Edit sectors">Edit</button></div>{field.sectors.length ? <SectorOverview field={field} profile={profile} /> : <p className="field-empty">No sectors added.</p>}</section>
      <section className="field-paper field-history-paper"><div className="field-entry-top"><h2>Past crops</h2><button className="field-secondary" onClick={() => open(4)} aria-label="Edit past crops and fertilisers">Edit</button></div>{seasons.length ? <div className="field-years">{[...new Set(seasons.map(row => row.year))].map(year => <section className="field-year" key={year}><h3>{year}</h3><div className="field-season-list">{seasons.filter(row => row.year === year).map((row, index) => <Season key={`${row.id}-${index}`} row={row} />)}</div></section>)}</div> : field.crop_history.length ? field.crop_history.map(row => <p key={row.id}>{row.year} · {row.crop_name}</p>) : <p className="field-empty">{profile?.cropHistory.unknown ? 'History not known.' : 'No crops added.'}</p>}{field.fertilisers.length > 0 && <details className="field-details"><summary>More fertiliser records ({field.fertilisers.length})</summary>{field.fertilisers.map(row => <p key={row.id}>{row.date} · {row.product} · {row.amount} {row.unit}</p>)}</details>}</section>
      <section className="field-paper"><div className="field-entry-top"><h2>Your crop rotation goals</h2><button className="field-secondary" onClick={() => open(5)} aria-label="Edit farming goals">Edit</button></div>{profile ? <><div className="field-priority-list">{[['yield', 'A good harvest'], ['soilHealth', 'Healthy soil'], ['water', 'Using less water'], ['profit', 'Earn more']].sort((a, b) => (profile.goals[b[0]] || 0) - (profile.goals[a[0]] || 0)).map(([key, label]) => <div key={key} data-goal={key}><span>{label}</span><meter min="0" max="100" value={profile.goals[key] || 0} aria-label={`${label}: ${profile.goals[key] || 0}% priority`} /></div>)}</div><details className="field-details"><summary>Priority percentages</summary><p>Harvest {profile.goals.yield}% · Soil {profile.goals.soilHealth}% · Water {profile.goals.water}% · Earn more {profile.goals.profit || 0}%</p></details></> : <p>Set your priorities.</p>}</section>
      <section className="field-paper field-water-paper"><div className="field-entry-top"><h2>Water source</h2><button className="field-secondary" onClick={() => open(6)} aria-label="Edit water source">Edit</button></div>{profile ? <><div className="field-water-source"><span className="field-area-label">{profile.waterSource.type}</span><h3>{profile.waterSource.name || profile.waterSource.type}</h3><p>{profile.waterSource.type?.toLowerCase() === 'well' ? 'Well supply has not been measured in this app.' : 'Water supply for this field has not been confirmed.'}</p></div><p>{profile.waterSource.address}</p>{!profile.waterSource.address && profile.waterSource.lat != null && <details className="field-details"><summary>Water source location</summary><p>{profile.waterSource.lat}, {profile.waterSource.lon}</p></details>}{profile.waterSource.description && <p>{profile.waterSource.description}</p>}</> : <p>Not added.</p>}{record.revision > 0 && <><details className="field-details field-river-details"><summary>Nearby river readings</summary><p>These readings describe the river, not your {profile?.waterSource.type?.toLowerCase() === 'well' ? 'well' : 'field’s water supply'}.</p><WaterStation stationId={field.water_station_id} /></details><details className="field-details"><summary>{field.water_station_id ? 'Change water station' : 'Choose a water station'}</summary><WaterStationPicker stationId={field.water_station_id} onSave={id => save({ ...field, water_station_id: id })} /></details></>}</section>
      {record.revision > 0 && <details className="field-paper"><summary>Soil test & watering method</summary><form onSubmit={saveSoil} className="field-form-grid field-supplement"><label className="field-input">Soil pH<input type="number" min="0" max="14" step="0.1" value={soil?.soil_ph ?? field.soil_ph ?? ''} onChange={event => setSoil({ ...soil, soil_ph: event.target.value })} /></label><label className="field-input">Soil texture<select value={soil?.soil_texture ?? field.soil_texture} onChange={event => setSoil({ ...soil, soil_texture: event.target.value })}>{SOILS.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label><label className="field-input">Watering method<select value={soil?.irrigation ?? field.irrigation} onChange={event => setSoil({ ...soil, irrigation: event.target.value })}>{['unknown','rainfed','drip','sprinkler','furrow','other'].map(value => <option key={value} value={value}>{value === 'unknown' ? 'Not known' : value}</option>)}</select></label><button className="field-primary" disabled={saving}>Save</button><p role="status">{notice}</p></form></details>}
    </>}
    {section !== null && <FieldEditor section={section} onClose={() => setSection(null)} />}
    <DecisionDisclaimer
      variant="footer"
      context="Your records help us suggest crops. They do not replace a soil test or advice from someone who knows your land."
    />
  </main>
    <MascotChat />
  </div>
}
