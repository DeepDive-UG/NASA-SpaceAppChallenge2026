import { useState } from 'react'
import TermHelp from '../../components/TermHelp'
const metrics = { temperature_mean: ['Average temperature', '°C', 1], temperature_min: ['Lowest temperature', '°C', 1], temperature_max: ['Highest temperature', '°C', 1], precipitation: ['Rainfall', 'mm', 1], soil_moisture: ['Soil water', '% by volume', 100] }
const methods = { seasonal_baseline: 'Historical seasonal pattern', hist_gradient_boosting: 'Gradient boosting model' }
export default function AdvancedForecast({ prediction, archived, observedThrough, distance }) {
  const [metric, setMetric] = useState('temperature_mean')
  const [label, unit, scale] = metrics[metric]
  const values = prediction.periods.map(period => ({ ...period.conditions[metric], day: (period.lead_start + period.lead_end) / 2 }))
  const numbers = values.flatMap(value => [...value.interval_80, value.mean_estimate, value.seasonal_reference]).map(value => value * scale)
  const low = Math.min(...numbers), span = Math.max(...numbers) - low || 1
  const x = index => 48 + index / Math.max(1, values.length - 1) * 500
  const y = value => 220 - (value * scale - low) / span * 180
  const path = key => values.map((value, index) => `${index ? 'L' : 'M'}${x(index)},${y(value[key])}`).join(' ')
  const band = values.map((value, index) => `${x(index)},${y(value.interval_80[1])}`).concat([...values].reverse().map((value, index) => `${x(values.length - 1 - index)},${y(value.interval_80[0])}`)).join(' ')
  const overall = prediction.whole_period.conditions[metric]
  const quality = overall.validation
  return <details className="cr-advanced"><summary>Take a closer look</summary>
    <div className="cr-data-explainer">
      <h3>A look at the season ahead</h3>
      <p>Your crop will spend weeks in the ground. We estimate the next 100 days to help you weigh up heat, cold and water before planting.</p>
      <p>We look for patterns in five years of NASA data. These are satellite readings combined with weather and soil models, not sensors on your farm. Past patterns give us a guide, not a promise.</p>
    </div>
    <p>Estimates for {prediction.whole_period.start_date} to {prediction.whole_period.end_date}.{archived ? ` These use observations through ${observedThrough}; they are not a current forecast from today.` : ''}</p>
    <label className="cr-select-label">Show<select value={metric} onChange={event => setMetric(event.target.value)}>{Object.entries(metrics).map(([key, item]) => <option key={key} value={key}>{item[0]}</option>)}</select></label>
    <figure className="cr-model-chart"><svg viewBox="0 0 580 270" role="img" aria-label={`${label}, ten 10-day periods. Shaded band: estimated uncertainty; solid line: estimate; dashed line: historical reference.`}>
      {[0, .5, 1].map(fraction => <g key={fraction}><line x1="48" x2="548" y1={220 - fraction * 180} y2={220 - fraction * 180} className="cr-chart-grid" /><text x="40" y={225 - fraction * 180} textAnchor="end">{(low + span * fraction).toFixed(1)}</text></g>)}
      <polygon points={band} className="cr-chart-band" /><path d={path('seasonal_reference')} className="cr-chart-reference" /><path d={path('mean_estimate')} className="cr-chart-line" />
      {values.map((value, index) => <g key={value.day}><circle cx={x(index)} cy={y(value.mean_estimate)} r="3" className="cr-chart-point"><title>Days {index * 10 + 1}–{index * 10 + 10}: {(value.mean_estimate * scale).toFixed(1)} {unit}</title></circle><text x={x(index)} y="246" textAnchor="middle">{index * 10 + 1}–{index * 10 + 10}</text></g>)}
    </svg><figcaption>{label} ({unit}) · days after the period starts</figcaption></figure>
    <div className="cr-chart-key"><span>━ Estimate</span><span>┄ Historical reference<TermHelp term="Historical reference">The usual pattern in our past data for this place and season. It is a short record, not a long-term climate average.</TermHelp></span><span>▧ Estimated 80% interval<TermHelp term="Estimated range">The shaded area shows how uncertain the estimate is. We aim for 8 out of 10 results to fall inside it, but tests can do worse. The test results below show how often that happened.</TermHelp></span></div>
    <p>Method: {methods[overall.method] || overall.method}. Whole-period estimate: {(overall.mean_estimate * scale).toFixed(1)} {unit}.</p>
    <p>The shaded range is uncertain. It is not a guarantee and does not describe the daily low-to-high temperature range.</p>
    {quality?.known_test_coverage != null && <p>In held-out tests, the nominal 80% interval covered the true value in {(quality.known_test_coverage * 100).toFixed(0)}% of cases at sampled locations and {(quality.unseen_test_coverage * 100).toFixed(0)}% at new locations.</p>}
    <h3>Where the data comes from</h3><ul className="cr-source-list"><li><a href="https://gmao.gsfc.nasa.gov/reanalysis/MERRA-2/" target="_blank" rel="noreferrer">NASA MERRA-2</a> · air temperature and wind, worked out from weather observations and a computer model</li><li><a href="https://smap.jpl.nasa.gov/data/" target="_blank" rel="noreferrer">NASA SMAP</a> · water and temperature in the soil, estimated with a land model that uses satellite readings</li><li><a href="https://gpm.nasa.gov/data/imerg" target="_blank" rel="noreferrer">NASA GPM IMERG</a> · rain estimates from satellites, with rain-gauge corrections where available</li></ul>
    <p>Model: {prediction.model_version}. Inputs end on {prediction.observation_date}. Regional grid{distance != null ? ` approximately ${distance} km from your field` : ''}; temperature grid about 0.5° × 0.625°. These are not measurements taken on your field.</p>
    <details><summary>Data table & model limits</summary><div className="cr-period-table"><table><thead><tr><th>Days</th><th>Estimate ({unit})</th><th>Lower</th><th>Upper</th></tr></thead><tbody>{values.map((value, index) => <tr key={value.day}><td>{index * 10 + 1}–{index * 10 + 10}</td><td>{(value.mean_estimate * scale).toFixed(1)}</td>{value.interval_80.map((number, position) => <td key={position}>{(number * scale).toFixed(1)}</td>)}</tr>)}</tbody></table></div><ul>{prediction.limitations.map(note => <li key={note}>{note}</li>)}</ul></details>
  </details>
}
