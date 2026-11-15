# Shared field records and crop screening

`GET /api/field/` returns `{field, revision, saved_at, storage}`. `PUT /api/field/` accepts `{field, revision}` and returns the saved record. Reuse these endpoints in onboarding; My field and Crop rotation read the same record. Preserve record IDs when editing sectors and histories. Writes require the Django CSRF cookie and header. A stale revision returns HTTP 409; reload before resolving concurrent edits.

Field data includes area in hectares, California coordinates, texture, US land capability class I–VIII, tested pH, irrigation method, selected USGS station, goal, sectors, crop history and fertiliser applications. Numeric fields are validated on the server. Sector areas cannot exceed the field area; history references must point to existing sectors. No personal names are collected.

Django stores records in the database. Anonymous records belong to the browser's Django session, not a shared global field. An authenticated user can claim their same-session record and retrieve their owned field in later authenticated sessions. Anonymous access ends when the session is lost or expires. SQLite is local development storage; configure durable database storage for deployment. Browser localStorage is not the source of field records.

`GET /api/crops/` supplies a curated food-crop subset from `data/EcoCrop_DB.csv`, with source row, family, pH and temperature descriptors. `POST /api/rotation/` accepts the saved `revision`, `scope` (`whole`, `single`, `mix`), `sector_ids`, and optional catalogue `crop_id`. It evaluates recorded pH and previous crop families, reports fertiliser applications as context, and returns per-area candidates. Diversification ranking is a heuristic, not a trained yield, economic or full agronomic rotation model. Texture and land capability class are stored but not yet crop suitability rules. Water and harvest goals explicitly identify the missing irrigation-demand and yield evidence.

The 100-day climate service uses the existing joblib models and the latest complete 30-day history from `CROPTIPS_OBSERVATIONS_PATH` (default: `~/CropTips-data/california/ml100-work/daily.csv.gz`). Observations must reach yesterday and a sampled grid cell must be within 75 km. Stale data produces an explicit unavailable response; no historical run is relabelled as today's prediction. The current common historical input ends on 2026-10-01. Refresh the environmental observations before current planting forecasts can run.

EcoCrop annual rainfall descriptors cannot be compared directly with 100-day rainfall. Average temperatures do not establish seedling frost safety. Existing experimental models do not justify green planting clearance. Red identifies a recorded mismatch; amber requests further checks. No prices, profit estimates or guaranteed planting recommendations are generated.

Run `python manage.py migrate` before starting the backend. Raw environmental observations stay outside the repository. `python manage.py test api rag analytics.tests.test_crops` covers persistence, session separation, account ownership, concurrent updates, validation and source-grounded screening, alongside the existing API and RAG tests.

## Onboarding integration

`PUT /api/field/` also accepts `{revision, onboarding_profile}`. The server validates and normalizes onboarding values and stores the complete normalized profile as `field.farm_profile`, alongside the analytical field representation. Original area units, sector directions/classes/current crops/notes, shared or per-sector season histories, fertilizer types and kg/ha amounts, yield text including its user-entered units, goal percentages and water-source details are preserved. A physical water source is distinct from the optional USGS monitoring station. Seasonal fertilizer records do not invent exact application dates or nutrient percentages.

The same onboarding component edits records from both My field and the Crop rotation modal. Saving updates FieldProvider and invalidates previous rotation results by field revision. A valid legacy `farmProfile` localStorage record is imported when the server record has no normalized onboarding profile, preserving existing soil tests and separate application records. Failed imports remain visible and the local record is retained. The server becomes authoritative after successful import. Goal percentages sum to 100; soil-health weighting affects family diversification only. Water savings and yield remain unquantified.

## Example farm

`POST /api/field/example/` creates Valley Farm, a fictional 32 ha Fresno County farm with three sectors and two seasons of illustrative crop, fertiliser and yield records. These are synthetic demonstration records, not measurements from an actual farm. The California coordinates provide regional context; they do not identify a verified property or well. No USGS station or current forecast is invented. The fixture lives in `api/fixtures/california_farm.json`. The endpoint is CSRF-protected, uses the current session/account and returns 409 if a field already exists. My field offers this action only before a field has been saved.

## Soil and outlook screening updates

EcoCrop TEXT and TEXTR supply optimal and tolerated coarse soil textures. Texture mappings are explicit screening assumptions: sand→light, sandy loam→light/medium, loam and silt loam→medium, clay loam→medium/heavy, clay→heavy. Ambiguous groups do not receive a confirmed optimal match. Land classes V–VIII flag annual cultivated crops red pending specialist assessment; I–IV do not identify a particular species without texture/pH and other checks. Source: https://efotg.sc.egov.usda.gov/references/Public/SD/landcap_introduction.pdf and https://cgiar-climate-data-hub.github.io/catalog/ecocrop/.

`GET /api/field/outlook/` loads the field outlook independently of crop requests. Stale observations return `available:false` and, when calculable, a `last_model_run` carrying its original dates and outputs. That historical estimate is shown separately and never used to assess today's crop-weather fit. Current conditions remain unassessed until fresh inputs are available.

## Equipment, water and presentation

Rotation reads equipment with the same authenticated owner or Django guest session as My gear. Available/unavailable combine status changes grain-harvest readiness. When equipment is recorded, a small explicit heuristic adjustment of ±5 × harvest-goal fraction affects grain rankings. Crop-specific headers, capacity, access to contractors and actual yield remain unverified. Missing equipment does not mean a crop is impossible to grow; vegetables may use manual harvesting or specialist machinery. Sources: https://smallgrains.ucdavis.edu/sites/g/files/dgvnsk13316/files/inline-files/8208%285%29.pdf.

Rotation retrieves the selected USGS station through the existing five-minute cache and water data loader. Readings carry timestamps, freshness and provisional status. Zero discharge is retained and flagged; negative discharge is rejected. A station outage leaves crop checks available with an explicit unavailable state. The farm's irrigation method and declared source are used as practical checks. Station flow is not a field water allocation or a quantified crop irrigation budget, so it does not grant green water clearance or invent water savings. Source: https://waterboards.ca.gov/waterrights/board_info/faqs.html.

The Advanced section provides metric selection, ten 10-day model outputs, estimated uncertainty, the historical reference, evaluation coverage, model version, observation dates, grid distance and NASA source links. Historical estimates keep their original dates. Crop photos are stored in `frontend/public/crops`; `credits.json` records each author's attribution, original file page, license and transformations. Credits are displayed in each crop card's expandable sources. Species names use italics; CSV row numbers are retained internally for traceability and omitted from farmer-facing text.

## Public demo account

`python manage.py setup_demo` creates `croptips_demo` with an unusable password, no staff privileges and membership in the dedicated public-demo group. `POST /api/demo/start/` explicitly opens a Django session for this fixed account; it never accepts an arbitrary account ID or password. A conflicting existing username is not adopted. CSRF protection applies. The welcome dialog identifies Valley Farm in Fresno County as fictional and the account as shared. Edits are shared between demo visitors. Reopening does not silently reset edits. `python manage.py setup_demo --reset` deliberately restores only the public demo fixture; its historical crop/fertiliser records, equipment and selected monitoring station are included.

Demo access defaults to enabled during local development. Set `CROPTIPS_DEMO_ENABLED=true` explicitly on the presentation host to enable the welcome dialog and entry endpoint in production. No personal farm data belongs in this public account. The original anonymous example endpoint remains available for independent browser-session copies.

The demo's selected USGS river station is `USGS-11222975`, North Fork Kings River at 24th Avenue Bridge near Lemoore, about 30.6 km from the fictional farm. The nearby monitoring-location search also found historical wells and stations with no latest-continuous observations; this is the nearest checked river station with fresh flow data, not a claim that all nearer monitoring points are inactive. Its observed flow can be zero. The farm's fictional irrigation well is not asserted to draw from this river.

Green result cards now mean **good soil and rotation fit only**: known class I/II, optimal texture and pH, and a different family from recognised latest-season crops. Weather, water allocation and harvest access remain separate visible checks. Green does not mean frost-safe planting clearance. The demo defaults to a sector mix so the two class-II sectors and class-III sector can show different results.

## Market priority

Farm goals include `yield`, `soilHealth`, `water` and `profit`, totaling 100. Old profiles default `profit` to zero. `profit` is displayed as “Earn more”. The ranking adds up to ten price-preference points scaled by this weight, comparing USD per metric tonne within each field-fit colour. Prices come from `frontend/public/data/crop-market-values.json`; its illustrative status, original units, region and dates remain visible. Crop-specific bushel weights follow USDA AMS Grain Inspection Handbook Book II. Prices are not live quotes or harvest-time forecasts. Missing market coverage stays unknown. No revenue, yield, production costs or net profit are predicted.

## Crop analysis coverage

Candidates now expose `goal_effects`, with a saved priority weight, a check status and a plain-language explanation. These are screening reasons, not predicted changes in soil quality, water consumption, yield or profit.

| Input | Current use | Limit |
|---|---|---|
| Soil class, texture and pH | Crop compatibility checks; unsuitable records can mark a mismatch | Does not measure drainage, salinity or fertility |
| Latest recorded crop families | Rotation diversification heuristic, weighted by the soil goal | Does not establish crop-specific disease break lengths |
| Fertiliser history | Recorded-use context and known applied nitrogen amounts | Not nutrients remaining in soil or a fertiliser prescription |
| Air outlook | Environmental temperature descriptors, only with current inputs | No seedling frost guarantee |
| Soil outlook | First 10-day context plus 100-day summary and charts, independently of air temperature | SMAP top-layer research estimate, not a sowing-depth probe; no crop-specific germination clearance |
| Surface/root-zone moisture | Separate 0–5 cm and 0–100 cm regional estimates | No automatic irrigation quantity or crop water-saving score |
| Equipment | Harvest readiness, weighted by the harvest goal | No yield increase prediction |
| Water source/station | Supply checks and dated station readings | Nearby river flow does not measure a well or prove entitlement |
| Market prices | Small price preference weighted by Earn more | Illustrative price per mass, not costs, revenue or net profit |
| Crop growth-day descriptors | Warning when a crop can outlast the 100-day outlook | Variety and local planting calendar still require checking |
| Current crop | Warning when a sector is recorded as occupied | User must confirm when it will be available |

`soil_conditions.current` is false for archived outlooks. Archived soil values are shown with their original dates and do not enter planting-today temperature screening. The current suggestion list remains a heuristic shortlist; it is not a globally optimized multi-year rotation. Pests, disease pressure, salinity, measured soil nutrients, cultivar-specific requirements, confirmed irrigation supply and validated future weather are not fully assessed.
