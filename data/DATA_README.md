### Data sources

# Effects_of_crop_species_on_soil_functions.csv
Dataset DOI: 10.5061/dryad.t76hdr8c7

### External water and hazard data

USGS daily discharge history and current station readings are stored outside the repository at `/home/martinez/CropTips-data/california/environment`. The initial archive covers 2021-11-14 through 2026-11-13 for five California pilot river stations, with 9,130 daily records. `manifest.json` in that directory records retrieval timestamps, record counts and file hashes. This is pilot coverage, not all California stations.

Current NWS water/fire warnings and NIFC wildfire incident snapshots are also archived there. Runtime requests use the official APIs; archived alerts are not treated as current. See `backend/api/ENVIRONMENT.md` for sources, endpoints and refresh commands. These sources have not been added to the existing trained models or to a RAG index.

# Feedback_Data_for_Dryad.csv
Dataset DOI: 10.5061/dryad.t76hdr8c7
