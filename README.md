# CropTips

**Hey pal, what’s growing? 🌱**

<img src="frontend/public/mascot.png" alt="Tip, the CropTips farming companion" width="180" />
Our project's mascot -- Tip was drawn and animated by our team member Adrian Woźny during the Hackaton event.

Choosing your next crop takes more than checking the weather. CropTips brings your soil, past crops, water and equipment together to help you decide what could grow next. Choose what matters to you: a good harvest, healthier soil, less water or earning more.

Meet **Tip**, your friendly farming companion. Click the mascot to ask about crops, soil or planting. Tip finds information in the project’s farming references and shows the sources, using plain language instead of technical jargon.

**This is a demo for California only.** It supports planting now; planning for later dates and multiple years is not available yet. Select **California demo** in the app to explore Valley Farm: a 32-hectare example farm in Fresno County with three sectors.

## What can you do?

- **Keep your field details together.** In My Field, save your soil, field size, sectors, past crops, fertilisers and water source. This gives crop checks the context of your own farm instead of treating every field the same.
- **Find your next crop.** Ask for suggestions for the whole field, one sector or a mix across sectors. Choose what matters most to you: harvest, soil health, water or earnings. You can also search for a crop you already have in mind and see what needs checking before planting.
- **Understand each suggestion.** Green, yellow and red labels help you spot soil and crop-history matches or problems. Short explanations show why a crop was suggested and what is still unknown. Edit field details directly in Crop Rotation without leaving the page.
- **Look ahead before sowing.** Compare estimated air and soil temperatures, rain and soil moisture for the first 10 days or the full 100 days. Open the extra details for charts, data sources and average test errors.
- **Check harvest equipment.** Record what you own in My Gear so crop checks can flag whether you may need different equipment or outside help at harvest.
- **Keep an eye on water and fire.** View readings from your chosen water station and official warnings and fire reports. These help you notice conditions worth checking locally; a river reading does not measure your well or confirm water available to your field.
- **Ask Tip.** Click the mascot when you have a question about crops, soil or planting. Tip uses the project’s farming references and includes sources so you can read more. Each question starts fresh, without saved conversation history. 
- **Make the app easier to read.** Choose light or dark mode and adjust text size, including extra large text for people with reduced vision. Plain language, written status labels alongside colours and a short FAQ help explain the app.

**Browser and mobile:** CropTips has a browser app built with React and Vite and a separate Android/iOS app built with Expo and React Native in `mobile/`.

## Data and models

The backend uses Django, the browser app uses React and Vite, and the Android/iOS app uses Expo and React Native.

- **NASA Earthdata:** MERRA-2 air temperature, GPM IMERG rainfall, and SMAP soil temperature and moisture. These combine observations with models; they are not sensors on the farm.
- **Crop knowledge:** EcoCrop requirements, Dryad research data and reviewed agricultural references in `data/`.
- **Water and hazards:** USGS, NWS and NIFC APIs.
- **ML:** histogram gradient boosting for estimates and quantiles, compared with a historical seasonal baseline. Validation selects the method for each variable and time window. Seven outputs cover air temperature (average/min/max), soil temperature, rain and soil moisture near seeds and roots.
- **RAG:** Ollama `ministral-3:3b`, `embeddinggemma`, and hybrid text/vector retrieval from `data/`.

Trained models are saved as `.joblib` files in `backend/analytics/artifacts/`. Training code, data provenance and evaluation reports are in `ml/`. Raw NASA downloads stay outside Git. Crop ranking uses rules and goal weights; it is not a trained yield or profit model.

## Accuracy and demo limits

Some short-term results are encouraging. Average errors in locations excluded from training were:

| Estimate | Period | Average error |
|---|---|---:|
| Soil temperature | First 10 days | 2.0°C |
| Root-zone soil moisture | First 10 days | 1.2 percentage points |
| Average air temperature | Full 100 days | 2.8°C |

These are historical tests against regional NASA data. Individual errors can be larger. The intended 80% ranges do not consistently reach 80% coverage; full-period soil-temperature coverage in new areas was about 45%. Many 100-day estimates use the seasonal baseline rather than ML. See [full test results](ml/reports/README.md).

The models use roughly five years of data. A production version needs more years, broader regional testing, current forecast inputs and better-calibrated uncertainty ranges. More training years alone do not guarantee accurate forecasts. Estimates and crop colours do not guarantee frost safety, yield or profit. If observations are outdated, the app shows the dates of the last estimate rather than presenting it as a forecast from today.

**Market prices are mock data.** The team did not identify a suitable regularly updated 2026 price feed during development. A production version must connect current market values. Today's price would still not predict the price at harvest.

## Run locally

Use Python 3.11+ and Node.js 22.12+.

**Backend — terminal 1:**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-analytics.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

**Web app — terminal 2:**

```bash
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite, normally **http://localhost:5173**. The frontend proxies `/api` to Django on port 8000. Click **California demo** to load the example farm; no demo password is needed.

**Chatbot — optional:** install [Ollama](https://ollama.com/) and run `ollama serve`. In another terminal, from the repository root:

```bash
ollama pull ministral-3:3b
ollama pull embeddinggemma
source backend/.venv/bin/activate
python backend/manage.py build_rag_index
```

Keep Ollama running and rebuild the index after changing knowledge files. Response speed depends on hardware. See [chatbot setup](backend/rag/README.md) and [model training](ml/README.md) for details.
