# Water observations and hazard alerts

## Runtime

- `GET /api/environment/water/?station=USGS-11446500`: California station metadata and latest available sensor observations. Retains original units, observation times, qualifiers and provisional approval status. Station location must be explicitly selected for the relevant watershed; proximity alone does not establish irrigation availability.
- `GET /api/environment/alerts/`: active actual NWS water and fire warnings for California. Optional `?point=38.58,-121.49` requests warnings applicable to a location. Without a point, results are statewide. Responses retain affected areas, zones, expiry and source instructions.
- `GET /api/environment/fires/`: reported current California wildfires from NIFC WFIGS. These are incident records, not evacuation orders. A Red Flag Warning is fire weather risk, not evidence of an existing fire.

Successful responses are cached for five minutes per Django process and include retrieval timestamps. Provider failures return HTTP 503/502 rather than an empty success result. Observation timestamps can be older than retrieval timestamps. No low-water threshold or irrigation entitlement is inferred from river stage or discharge alone.

Home includes a button opening a dismissible alert dialog. The dialog supports Escape and restores focus through the native HTML dialog API. It polls while open and stores read warning revisions locally in the browser. Updated warnings appear unread.

`My field` renders the reusable `WaterStationPicker` component with `stationId` and asynchronous `onSave(id)` props. The picker searches five pilot stations or verifies another California USGS ID against the live API before saving. Onboarding can reuse the same component and save callback. The current App stores one field's station in browser localStorage under `croptips-field-water-station`; authenticated multi-field persistence remains a later integration. The `WaterStation` readings component accepts `stationId`, requests only that station and performs no request without an ID. It is not currently displayed on Home. There is no background worker, automatic scheduled job, remote push registration or push delivery yet. Expo push requires authenticated user/field subscriptions, device tokens, notification consent and a scheduled worker with persistent delivery deduplication. Do not broadcast statewide warnings as field-specific messages.

## External archive

```bash
backend/.venv/bin/python backend/manage.py sync_environment \
  --output /home/martinez/CropTips-data/california/environment --history
```

The initial historical interval is 2021-11-14 through 2026-11-13. Override `--start`, `--end` and `--stations` as needed. Daily history requests parameter `00060` (discharge), statistic `00003` (daily mean). Daily dates represent local station calendar days; continuous timestamps are UTC. Five pilot river stations provide an integration sample, not statewide hydrological coverage or groundwater coverage. Missing records remain missing. The manifest records retrieval time, record counts and SHA-256 hashes. Individual files are replaced atomically. A failed command must not be treated as a complete archive; its previous manifest describes only the previous successful run.

Optional `USGS_API_KEY` increases the public API allowance. Set `ENVIRONMENT_USER_AGENT` to a real application/contact identity for deployment. Export variables in the shell; Django does not load `.env` automatically.

## Sources

- USGS Water Data OGC API: https://api.waterdata.usgs.gov/docs/ogcapi/
- USGS v1 collections: https://api.waterdata.usgs.gov/ogcapi/v1/collections
- NWS documentation: https://www.weather.gov/documentation/services-web-api
- NWS California alerts: https://api.weather.gov/alerts/active?area=CA
- NIFC current wildfire layer: https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Incident_Locations_Current/FeatureServer/0

## Local retrieval-augmented generation: next stage

No language model or retrieval index is implemented by this module. The future local RAG should index `/data` crop datasets by named crop and structured attributes, preserving source file, row identifier, units and DOI. Add authoritative crop temperature/water tolerances and California extension guidance on planting and rotation, with document dates and citations. Resolve licensing and units before indexing; do not treat numeric CSV rows as unstructured prose alone.

Use a separate live tool for current warnings, water observations and model outputs. Every answer using live data should retain timestamps and source links. A static embedding index is unsuitable for current alert status. Expired warnings must not be returned as active. Historical water series need spatial watershed matching and a separate time-held-out evaluation before becoming model features. Current joblib models have not been retrained with USGS, LANDFIRE or fire data.

The alert dialog groups water warnings, fire weather and reported fires separately. Each feed loads independently, so failure of one does not hide the other. It initially shows five recently updated fire reports with an option to show all, preserves provider instructions in expandable details, and offers manual retry after failure. Counts describe returned reports, not proof of active fire spread or local farm danger.
