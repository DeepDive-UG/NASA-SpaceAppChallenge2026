import { useEffect, useState } from 'react'
import Navigation from '../../components/Navigation/Navigation'
import DecisionDisclaimer from '../../components/DecisionDisclaimer'
import WaterStation from '../../components/WaterStation'
import WaterStationPicker from '../../components/WaterStationPicker'
import { GOALS, SOILS, fieldApi, useField } from '../../lib/field'
import './myField.css'

const TODAY = new Date().toLocaleDateString('en-CA')
const YEAR = new Date().getFullYear()
function Input({ label, hint, value, onChange, options, ...props }) {
  return <label className="field-input">{label}{hint && <small>{hint}</small>}{options ? <select value={value ?? ''} onChange={e => onChange(e.target.value)} {...props}>{options.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select> : <input value={value ?? ''} onChange={e => onChange(e.target.value)} {...props} />}</label>
}
function Panel({ step, title, description, children }) {
  return <section className="field-paper"><div className="field-section-heading"><span>{step}</span><div><h2>{title}</h2>{description && <p>{description}</p>}</div></div>{children}</section>
}

export default function MyField() {
  const { record, loading, saving, error, save } = useField()
  const [draft, setDraft] = useState(null)
  const [crops, setCrops] = useState([])
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fieldApi('crops/', { signal: controller.signal }).then(result => setCrops(result.crops)).catch(() => {})
    return () => controller.abort()
  }, [])
  const value = draft || record?.field
  function edit(key, next) { setDraft(previous => ({ ...(previous || record.field), [key]: next })); setDirty(true); setNotice('') }
  function rowEdit(key,id,name,next) { edit(key,value[key].map(row => row.id === id ? {...row,[name]:next} : row)) }
  function add(key,row) { edit(key,[...value[key],{id:crypto.randomUUID(),...row}]) }
  function remove(key,id) { edit(key,value[key].filter(row => row.id !== id)) }
  async function persist(event) {
    event.preventDefault()
    try { await save(value); setDraft(null); setDirty(false); setNotice('Saved.') }
    catch { setNotice('Changes have not been saved. Check the message above.') }
  }
  const areas = [['','Whole field'],...(value?.sectors || []).map(row => [row.id,row.name || 'Unnamed sector'])]
  const details = (key,label,hint,props={}) => <Input label={label} hint={hint} value={value[key]} onChange={next => edit(key,next)} {...props} />
  const item = (group,row,key,label,hint,props={}) => <Input label={label} hint={hint} value={row[key]} onChange={next => rowEdit(group,row.id,key,next)} {...props} />

  return <div className="mf-layout"><Navigation /><main className="mf-main field-ledger">
    <header className="field-heading"><div><p className="field-eyebrow">MY FIELD</p><h1>{record?.revision ? record.field.name : 'My field'}</h1><p></p></div><span className="field-save-state">{dirty ? 'Unsaved changes' : record?.saved_at ? `Saved ${new Date(record.saved_at).toLocaleDateString()}` : 'Not saved yet'}</span></header>
    {loading && <p role="status">Loading your field…</p>}{error && <p className="field-error" role="alert">{error}</p>}
    {value && <><form onSubmit={persist}>
      <Panel step="01" title="Field details" description="">
        <div className="field-form-grid">
          {details('name','Field name',null,{required:true,maxLength:100,placeholder:'Name this field'})}
          {details('area_ha','Field size','hectares',{type:'number',required:true,min:0.001,step:0.001})}
          {details('soil_texture','Soil texture',null,{options:SOILS})}
          {details('soil_class','Soil class','US classes I–VIII',{options:[['unknown','Not known yet'],...['I','II','III','IV','V','VI','VII','VIII'].map(id => [id,`Class ${id}`])]})}
          {details('soil_ph','Soil pH','from a soil test, optional',{type:'number',min:0,max:14,step:0.1})}
          {details('irrigation','Watering method',null,{options:[['unknown','Not known yet'],['rainfed','Rainfed'],['drip','Drip irrigation'],['sprinkler','Sprinkler'],['furrow','Furrow irrigation'],['other','Other']]})}
        </div>
        <details className="field-details"><summary>Field location for regional conditions</summary><p>California coordinates match your field to environmental observations.</p><div className="field-form-grid">{details('latitude','Latitude',null,{type:'number',step:'any',min:32.53,max:42.01})}{details('longitude','Longitude',null,{type:'number',step:'any',min:-124.48,max:-114.13})}</div></details>
      </Panel>
      <Panel step="02" title="Goal" description=""><fieldset className="field-goals"><legend className="field-sr-only">Main farming goal</legend>{GOALS.map(([id,title]) => <label key={id} className={value.goal===id ? 'selected' : ''}><input type="radio" name="field-goal" checked={value.goal===id} onChange={() => edit('goal',id)} /><span><strong>{title}</strong></span></label>)}</fieldset></Panel>
      <Panel step="03" title="Sectors" description="Optional. Add sectors if parts of your field differ.">
        {!value.sectors.length && <p className="field-empty">No sectors added.</p>}
        {value.sectors.map((row,index) => <div className="field-entry" key={row.id}><div className="field-entry-top"><strong>Sector {index+1}</strong><button className="field-text-button" type="button" onClick={() => remove('sectors',row.id)}>Remove sector</button></div><div className="field-form-grid">
          {item('sectors',row,'name','Sector name',null,{required:true})}{item('sectors',row,'area_ha','Area','hectares',{type:'number',required:true,min:0.001,step:0.001})}
          {item('sectors',row,'soil_texture','Sector soil texture',null,{options:SOILS.map(([id,label]) => [id,id==='unknown' ? 'Use field information' : label])})}
          {item('sectors',row,'soil_ph','Sector pH','optional override',{type:'number',min:0,max:14,step:0.1})}
        </div></div>)}
        <button className="field-secondary" type="button" onClick={() => add('sectors',{name:'',area_ha:'',soil_texture:'unknown',soil_ph:null})}>+ Add sector</button>
        {value.sectors.length>0 && <p className="field-footnote">Assigned area: {value.sectors.reduce((sum,row) => sum+(Number(row.area_ha)||0),0).toLocaleString()} / {value.area_ha || '—'} ha. Reassign history before removing a sector it refers to.</p>}
      </Panel>
      <Panel step="04" title="Previous crops" description="">
        {!value.crop_history.length && <p className="field-empty">No crops added.</p>}
        <datalist id="field-crop-options">{crops.map(crop => <option key={crop.id} value={crop.name}>{crop.scientific_name}</option>)}</datalist>
        {value.crop_history.map(row => <div className="field-entry" key={row.id}><div className="field-entry-top"><strong>Crop record</strong><button className="field-text-button" type="button" onClick={() => remove('crop_history',row.id)}>Remove record</button></div><div className="field-form-grid">
          <Input label="Crop" value={row.crop_name} required list="field-crop-options" placeholder="Choose or enter a crop" onChange={name => {const found=crops.find(crop => crop.name.toLowerCase()===name.toLowerCase() || crop.scientific_name.toLowerCase()===name.toLowerCase());edit('crop_history',value.crop_history.map(previous => previous.id===row.id ? {...previous,crop_name:name,crop_id:found?.id||''} : previous))}} />
          {item('crop_history',row,'year','Year',null,{type:'number',required:true,min:1900,max:YEAR})}{item('crop_history',row,'sector_id','Area',null,{options:areas})}{item('crop_history',row,'notes','Notes','disease, cover crop, residue',{maxLength:1000})}
        </div></div>)}
        <button className="field-secondary" type="button" onClick={() => add('crop_history',{crop_id:'',crop_name:'',year:YEAR-1,sector_id:null,notes:''})}>+ Add previous crop</button>
      </Panel>
      <Panel step="05" title="Fertilisers" description="">
        {!value.fertilisers.length && <p className="field-empty">No applications added.</p>}
        {value.fertilisers.map(row => <div className="field-entry" key={row.id}><div className="field-entry-top"><strong>Application record</strong><button className="field-text-button" type="button" onClick={() => remove('fertilisers',row.id)}>Remove record</button></div><div className="field-form-grid">
          {item('fertilisers',row,'product','Product or amendment',null,{required:true,maxLength:120})}{item('fertilisers',row,'date','Application date',null,{type:'date',required:true,max:TODAY})}
          {item('fertilisers',row,'amount','Amount',null,{type:'number',min:0.001,step:'any',required:true})}{item('fertilisers',row,'unit','Unit',null,{options:['kg/ha','t/ha','L/ha'].map(unit => [unit,unit])})}
          {item('fertilisers',row,'sector_id','Area',null,{options:areas})}{item('fertilisers',row,'nitrogen_pct','Nitrogen content','% on label, optional',{type:'number',min:0,max:100,step:'any'})}{item('fertilisers',row,'notes','Notes',null,{maxLength:1000})}
        </div></div>)}
        <button className="field-secondary" type="button" onClick={() => add('fertilisers',{product:'',date:TODAY,amount:'',unit:'kg/ha',nitrogen_pct:null,sector_id:null,notes:''})}>+ Add application</button>
      </Panel>
      <div className="field-save-bar"><div><strong>{dirty ? 'Unsaved changes' : 'Field records'}</strong><p role="status">{notice || (!record.revision ? 'Save these details to use them in Crop rotation.' : record.storage==='account' ? 'Saved to your account.' : 'Saved for this browser session. Sign in to keep it with your account.')}</p></div><button className="field-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
    </form>
    {record.revision>0 && <section className="field-paper"><WaterStation key={record.field.water_station_id || 'none'} stationId={record.field.water_station_id} /><details className="field-details"><summary>{record.field.water_station_id ? 'Change water monitoring station' : 'Assign a water monitoring station'}</summary><WaterStationPicker stationId={record.field.water_station_id} onSave={async id => {await save({...value,water_station_id:id});setDraft(null);setDirty(false)}} /></details></section>}
    </>}
    <DecisionDisclaimer
      variant="footer"
      context="Field records, soil classifications, and water station data power automated decision-support tools and do not replace accredited soil testing, irrigation engineering, or human agronomic expertise."
    />
  </main></div>
}
