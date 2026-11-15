import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { SOIL_CLASSES, getSoilClass } from '../../constants/soilClasses';
import DecisionDisclaimer from '../../components/DecisionDisclaimer';
import 'leaflet/dist/leaflet.css';
import './Onboarding.css';
import { SOILS, useField } from '../../lib/field';
import { profileForm, legacyFieldForm } from '../../lib/farmProfile';

const DRAFT_KEY = 'onboardingDraft';
const PROFILE_KEY = 'farmProfile';
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'Center', 'Other'];
const AREA_UNITS = ['hectares', 'acres', 'm²'];
const FERTILIZERS = ['N', 'P', 'K', 'NPK', 'manure', 'compost', 'lime', 'none', 'other'];
const CROPS = [
  'Corn',
  'Soybeans',
  'Wheat',
  'Cotton',
  'Hay',
  'Alfalfa',
  'Rice',
  'Sorghum',
  'Barley',
  'Oats',
  'Peanuts',
  'Potatoes',
  'Vegetables',
  'Fallow',
  'Other',
];

const STEP_TITLES = [
  'Location Consent',
  'Default Field Class',
  'Field Size',
  'Field Sectors',
  'Crop & Fertilizer History',
  'Farm Goals',
  'Nearest Water Source',
  'Summary',
];

const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const newSeason = () => ({
  id: uid(),
  year: '',
  crop: '',
  otherCrop: '',
  fertilizers: [],
  amountKgHa: '',
  yield: '',
});

const createInitialState = () => ({
  consent: false,
  soilTest: { ph: '', texture: 'unknown', irrigation: 'unknown' },
  farmLocation: { lat: '', lon: '' },
  defaultSoilClass: 'unknown',
  totalArea: '',
  areaUnit: 'acres',
  totalAreaHa: 0,
  sectorTemplate: '',
  sectors: [],
  historyUnknown: false,
  sameHistoryForAll: true,
  sharedHistory: [newSeason()],
  sectorHistories: {},
  goals: {
    yield: 34,
    soilHealth: 33,
    water: 33,
  },
  waterSource: {
    name: '',
    description: '',
    type: 'Well',
    lat: '',
    lon: '',
    address: '',
    distanceKm: null,
  },
});

function readJson(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function loadInitialState() {
  const draft = readJson(DRAFT_KEY);
  if (!draft) return createInitialState();

  const initial = createInitialState();

  return {
    ...initial,
    ...draft,
    farmLocation: {
      ...initial.farmLocation,
      ...draft.farmLocation,
    },
    goals: {
      ...initial.goals,
      ...draft.goals,
    },
    waterSource: {
      ...initial.waterSource,
      ...draft.waterSource,
    },
  };
}

function toHectares(value, unit) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  if (unit === 'acres') return numeric * 0.4046856422;
  if (unit === 'm²') return numeric / 10000;
  return numeric;
}

function isCoordinate(value, min, max) {
  if (value === '' || value === null || value === undefined) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function hasValidCoordinates(location) {
  return (
    isCoordinate(location?.lat, -90, 90) &&
    isCoordinate(location?.lon, -180, 180)
  );
}

function haversineDistance(first, second) {
  if (!hasValidCoordinates(first) || !hasValidCoordinates(second)) return null;

  const radiusKm = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(Number(first.lat));
  const lat2 = toRadians(Number(second.lat));
  const deltaLat = toRadians(Number(second.lat) - Number(first.lat));
  const deltaLon = toRadians(Number(second.lon) - Number(first.lon));

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function RecenterMap({ location }) {
  const map = useMap();

  useEffect(() => {
    if (hasValidCoordinates(location)) {
      map.setView([Number(location.lat), Number(location.lon)], Math.max(map.getZoom(), 13));
    }
  }, [location, map]);

  return null;
}

function MapClickHandler({ onChange }) {
  useMapEvents({
    click(event) {
      onChange({
        lat: event.latlng.lat.toFixed(6),
        lon: event.latlng.lng.toFixed(6),
      });
    },
  });

  return null;
}

function MapPicker({ location, onChange, label }) {
  const valid = hasValidCoordinates(location);
  const center = valid
    ? [Number(location.lat), Number(location.lon)]
    : [39.8283, -98.5795];

  return (
    <div className="map-container" aria-label={label}>
      <MapContainer center={center} zoom={valid ? 13 : 4} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap location={location} />
        <MapClickHandler onChange={onChange} />
        {valid && (
          <CircleMarker
            center={[Number(location.lat), Number(location.lon)]}
            radius={10}
            pathOptions={{
              color: '#254D32',
              fillColor: '#A8BBA0',
              fillOpacity: 0.9,
            }}
          >
            <Popup>{label}</Popup>
          </CircleMarker>
        )}
      </MapContainer>
    </div>
  );
}

function CoordinatesEditor({ value, onChange, prefix }) {
  return (
    <div className="coordinates-grid">
      <label className="field-label" htmlFor={`${prefix}-latitude`}>
        Latitude
        <input
          id={`${prefix}-latitude`}
          className="onboarding-input"
          type="number"
          min="-90"
          max="90"
          step="any"
          value={value.lat}
          onChange={(event) => onChange({ ...value, lat: event.target.value })}
          placeholder="39.8283"
        />
      </label>

      <label className="field-label" htmlFor={`${prefix}-longitude`}>
        Longitude
        <input
          id={`${prefix}-longitude`}
          className="onboarding-input"
          type="number"
          min="-180"
          max="180"
          step="any"
          value={value.lon}
          onChange={(event) => onChange({ ...value, lon: event.target.value })}
          placeholder="-98.5795"
        />
      </label>
    </div>
  );
}

function makeEqualAreas(total, count) {
  const safeTotal = Number(total);
  if (!safeTotal || count <= 0) return Array(count).fill('');

  const base = Math.floor((safeTotal / count) * 10000) / 10000;
  const values = Array(count).fill(base);
  values[count - 1] = Number(
    (safeTotal - base * (count - 1)).toFixed(4),
  );

  return values.map(String);
}

function templateConfiguration(template) {
  switch (template) {
    case 'Whole field':
      return [{ name: 'Whole field', direction: 'Center' }];
    case 'Halves N/S':
      return [
        { name: 'North half', direction: 'N' },
        { name: 'South half', direction: 'S' },
      ];
    case 'Halves E/W':
      return [
        { name: 'West half', direction: 'W' },
        { name: 'East half', direction: 'E' },
      ];
    case 'Quarters NW/NE/SW/SE':
      return [
        { name: 'Northwest quarter', direction: 'NW' },
        { name: 'Northeast quarter', direction: 'NE' },
        { name: 'Southwest quarter', direction: 'SW' },
        { name: 'Southeast quarter', direction: 'SE' },
      ];
    case 'Custom':
      return [{ name: 'Sector 1', direction: 'Other' }];
    default:
      return [];
  }
}

function StepHeader({ title, children }) {
  return (
    <header className="onboarding-step-header">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </header>
  );
}

function SeasonEditor({ seasons, onChange }) {
  const updateSeason = (id, key, value) => {
    onChange(
      seasons.map((season) =>
        season.id === id ? { ...season, [key]: value } : season,
      ),
    );
  };

  const toggleFertilizer = (season, fertilizer) => {
    let next;

    if (fertilizer === 'none') {
      next = season.fertilizers.includes('none') ? [] : ['none'];
    } else {
      const withoutNone = season.fertilizers.filter((item) => item !== 'none');
      next = withoutNone.includes(fertilizer)
        ? withoutNone.filter((item) => item !== fertilizer)
        : [...withoutNone, fertilizer];
    }

    updateSeason(season.id, 'fertilizers', next);
  };

  return (
    <>
      <div className="season-list">
        {seasons.map((season, index) => (
          <article className="season-row" key={season.id}>
            <div className="history-heading">
              <strong>Season {index + 1}</strong>
              {seasons.length > 1 && (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() =>
                    onChange(seasons.filter((item) => item.id !== season.id))
                  }
                >
                  Remove
                </button>
              )}
            </div>

            <div className="season-fields">
              <label className="field-label">
                Year
                <input
                  className="onboarding-input"
                  type="number"
                  min="1900"
                  max={new Date().getFullYear()}
                  value={season.year}
                  onChange={(event) =>
                    updateSeason(season.id, 'year', event.target.value)
                  }
                  placeholder="2025"
                />
              </label>

              <label className="field-label">
                Crop
                <select
                  className="onboarding-select"
                  value={season.crop}
                  onChange={(event) =>
                    updateSeason(season.id, 'crop', event.target.value)
                  }
                >
                  <option value="">Select crop</option>
                  {CROPS.map((crop) => (
                    <option value={crop} key={crop}>
                      {crop}
                    </option>
                  ))}
                </select>
              </label>

              {season.crop === 'Other' && (
                <label className="field-label">
                  Other crop
                  <input
                    className="onboarding-input"
                    value={season.otherCrop}
                    onChange={(event) =>
                      updateSeason(season.id, 'otherCrop', event.target.value)
                    }
                    placeholder="Crop name"
                  />
                </label>
              )}

              <label className="field-label">
                Fertilizer amount
                <input
                  className="onboarding-input"
                  type="number"
                  min="0"
                  step="any"
                  value={season.amountKgHa}
                  onChange={(event) =>
                    updateSeason(season.id, 'amountKgHa', event.target.value)
                  }
                  placeholder="Optional kg/ha"
                />
              </label>

              <label className="field-label">
                Yield
                <input
                  className="onboarding-input"
                  value={season.yield}
                  onChange={(event) =>
                    updateSeason(season.id, 'yield', event.target.value)
                  }
                  placeholder="Optional, e.g. 180 bu/ac"
                />
              </label>

              <fieldset className="fertilizer-fieldset">
                <legend>Fertilizers and amendments</legend>
                <div className="fertilizer-options">
                  {FERTILIZERS.map((fertilizer) => (
                    <label key={fertilizer}>
                      <input
                        type="checkbox"
                        checked={season.fertilizers.includes(fertilizer)}
                        onChange={() => toggleFertilizer(season, fertilizer)}
                      />
                      {fertilizer}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </article>
        ))}
      </div>

      <div className="history-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => onChange([...seasons, newSeason()])}
        >
          Add season
        </button>
      </div>
    </>
  );
}

export default function Onboarding(props) {
  const { loading, record, error } = useField();
  if (loading) return <p role="status">Loading field…</p>;
  if (!record) return <p role="alert">{error || 'Field service unavailable.'}</p>;
  return <FarmSetup {...props} />;
}

function FarmSetup({ embedded = false, initialStep = 0, onSaved }) {
  const navigate = useNavigate();
  const { record, saveProfile } = useField();
  const [rawForm, setRawForm] = useState(() => {
    const saved = profileForm(record?.field) || legacyFieldForm(record?.field);
    return saved ? { ...createInitialState(), ...saved, waterSource: { ...createInitialState().waterSource, ...saved.waterSource } } : loadInitialState();
  });
  const distance = haversineDistance(rawForm.farmLocation, rawForm.waterSource);
  const form = { ...rawForm, waterSource: { ...rawForm.waterSource, distanceKm: distance === null ? null : Number(distance.toFixed(2)) } };
  function setForm(updater) {
    setRawForm(current => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      if (next.sectorTemplate === 'Whole field') {
        const previous = next.sectors[0];
        const id = previous?.id || uid();
        return { ...next, sectors: [{ ...(previous || { id, name: 'Whole field', direction: 'Center', soilClass: next.defaultSoilClass, currentCrop: '', notes: '' }), areaHa: makeEqualAreas(next.totalAreaHa, 1)[0] }] };
      }
      return next;
    });
  }
  const [step, setStep] = useState(initialStep);
  const [error, setError] = useState('');
  const [geoStatus, setGeoStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      if (!embedded) localStorage.setItem(DRAFT_KEY, JSON.stringify(rawForm));
    } catch {
      // Continue without draft persistence when storage is unavailable.
    }
  }, [rawForm, embedded]);

  const assignedArea = useMemo(
    () =>
      form.sectors.reduce(
        (sum, sector) => sum + (Number(sector.areaHa) || 0),
        0,
      ),
    [form.sectors],
  );

  const remainingArea = Math.max(form.totalAreaHa - assignedArea, 0);
  const updateLocation = (location) => {
    setForm((current) => ({
      ...current,
      farmLocation: location,
    }));
  };

  const updateWaterSource = (patch) => {
    setForm((current) => ({
      ...current,
      waterSource: {
        ...current.waterSource,
        ...patch,
      },
    }));
  };

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Geolocation is unavailable. Enter coordinates or click the map.');
      return;
    }

    setGeoStatus('Requesting your location…');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation({
          lat: position.coords.latitude.toFixed(6),
          lon: position.coords.longitude.toFixed(6),
        });
        setGeoStatus('Farm coordinates captured.');
      },
      () => {
        setGeoStatus(
          'Location could not be retrieved. Enter coordinates or click the map.',
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      },
    );
  };

  const applyTemplate = (template) => {
    const configuration = templateConfiguration(template);
    const areas = makeEqualAreas(form.totalAreaHa, configuration.length);

    const sectors = configuration.map((item, index) => ({
      id: uid(),
      name: item.name,
      direction: item.direction,
      areaHa: areas[index],
      soilClass: form.defaultSoilClass,
      currentCrop: '',
      notes: '',
    }));

    setForm((current) => ({
      ...current,
      sectorTemplate: template,
      sectors,
      sectorHistories: Object.fromEntries(
        sectors.map((sector) => [sector.id, [newSeason()]]),
      ),
    }));
  };

  const updateSector = (id, key, value) => {
    setForm((current) => {
      if (
        current.sectorTemplate === 'Whole field' &&
        (key === 'areaHa' || key === 'direction')
      ) {
        return current;
      }

      return {
        ...current,
        sectors: current.sectors.map((sector) =>
          sector.id === id ? { ...sector, [key]: value } : sector,
        ),
      };
    });
  };

  const addSector = () => {
    const sector = {
      id: uid(),
      name: `Sector ${form.sectors.length + 1}`,
      direction: 'Other',
      areaHa: '',
      soilClass: form.defaultSoilClass,
      currentCrop: '',
      notes: '',
    };

    setForm((current) => ({
      ...current,
      sectorTemplate: 'Custom',
      sectors: [...current.sectors, sector],
      sectorHistories: {
        ...current.sectorHistories,
        [sector.id]: [newSeason()],
      },
    }));
  };

  const deleteSector = (id) => {
    setForm((current) => {
      const sectorHistories = { ...current.sectorHistories };
      delete sectorHistories[id];

      return {
        ...current,
        sectorTemplate: 'Custom',
        sectors: current.sectors.filter((sector) => sector.id !== id),
        sectorHistories,
      };
    });
  };

  const setSameHistoryForAll = (checked) => {
    setForm((current) => {
      if (checked) {
        return { ...current, sameHistoryForAll: true };
      }

      const sectorHistories = { ...current.sectorHistories };

      current.sectors.forEach((sector) => {
        if (!sectorHistories[sector.id]) {
          sectorHistories[sector.id] = current.sharedHistory.map((season) => ({
            ...season,
            id: uid(),
            fertilizers: [...season.fertilizers],
          }));
        }
      });

      return {
        ...current,
        sameHistoryForAll: false,
        sectorHistories,
      };
    });
  };

  const updateGoal = (changedKey, rawValue) => {
    const value = Number(rawValue);
    const keys = ['yield', 'soilHealth', 'water'];
    const otherKeys = keys.filter((key) => key !== changedKey);
    const remaining = 100 - value;
    const otherTotal =
      form.goals[otherKeys[0]] + form.goals[otherKeys[1]];

    let firstValue;

    if (otherTotal === 0) {
      firstValue = Math.round(remaining / 2);
    } else {
      firstValue = Math.round(
        remaining * (form.goals[otherKeys[0]] / otherTotal),
      );
    }

    const secondValue = remaining - firstValue;

    setForm((current) => ({
      ...current,
      goals: {
        ...current.goals,
        [changedKey]: value,
        [otherKeys[0]]: firstValue,
        [otherKeys[1]]: secondValue,
      },
    }));
  };

  const applyGoalPreset = (preset) => {
    const presets = {
      Balanced: { yield: 34, soilHealth: 33, water: 33 },
      'Yield first': { yield: 60, soilHealth: 25, water: 15 },
      'Sustainability first': { yield: 20, soilHealth: 45, water: 35 },
    };

    setForm((current) => ({
      ...current,
      goals: presets[preset],
    }));
  };

  const validateHistory = () => {
    if (form.historyUnknown) return '';

    const collections = form.sameHistoryForAll
      ? [form.sharedHistory]
      : form.sectors.map(
        (sector) => form.sectorHistories[sector.id] || [],
      );

    if (collections.some((seasons) => seasons.length === 0)) {
      return 'Add at least one season for each applicable sector, or choose “I don’t know.”';
    }

    for (const seasons of collections) {
      for (const season of seasons) {
        const year = Number(season.year);

        if (
          !Number.isInteger(year) ||
          year < 1900 ||
          year > new Date().getFullYear()
        ) {
          return 'Enter a valid year for each season.';
        }

        if (!season.crop) return 'Select a crop for each season.';

        if (season.crop === 'Other' && !season.otherCrop.trim()) {
          return 'Enter the crop name for each “Other” crop.';
        }

        if (!season.fertilizers.length) {
          return 'Select fertilizers or choose “none” for each season.';
        }

        if (
          season.amountKgHa !== '' &&
          Number(season.amountKgHa) < 0
        ) {
          return 'Fertilizer amount cannot be negative.';
        }
      }
    }

    return '';
  };

  const validateStep = (index) => {
    if (index === 0) {
      if (!form.consent) return 'You must agree to share your farm location.';
      if (!hasValidCoordinates(form.farmLocation)) {
        return 'Provide valid farm coordinates using geolocation, manual entry, or the map.';
      }
    }

    if (index === 2 && form.totalAreaHa <= 0) {
      return 'Enter a field size greater than zero.';
    }

    if (index === 3) {
      if (!form.sectors.length) return 'Choose a sector template or add a sector.';

      if (
        form.sectors.some(
          (sector) => !Number.isFinite(Number(sector.areaHa)) || Number(sector.areaHa) <= 0,
        )
      ) {
        return 'Every sector must have an area greater than zero.';
      }

      if (assignedArea > form.totalAreaHa + 0.0001) {
        return 'Assigned sector area cannot exceed the total field area.';
      }
    }

    if (index === 4) return validateHistory();

    if (index === 5) {
      const total =
        form.goals.yield + form.goals.soilHealth + form.goals.water;
      if (total !== 100) return 'Farm goals must total 100%.';
    }

    if (index === 6) {
      if (!form.waterSource.name.trim()) {
        return 'Enter a name or description for the nearest water source.';
      }

      if (
        !hasValidCoordinates(form.waterSource) &&
        !form.waterSource.address.trim()
      ) {
        return 'Provide water-source coordinates, a map pin, or an address.';
      }
    }

    return '';
  };

  const nextStep = () => {
    const validationError = validateStep(step);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setStep((current) => Math.min(current + 1, STEP_TITLES.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const previousStep = () => {
    setError('');
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const jumpToStep = (target) => {
    setError('');
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submitProfile = async () => {
    for (let index = 0; index < 7; index += 1) {
      const validationError = validateStep(index);
      if (validationError) {
        setStep(index);
        setError(validationError);
        return;
      }
    }

    setSubmitting(true);
    setError('');

    const previousProfile = readJson(PROFILE_KEY, {});
    const now = new Date().toISOString();

    const profile = {
      ...previousProfile,
      consent: form.consent,
      soilTest: form.soilTest,
      farmLocation: {
        lat: Number(form.farmLocation.lat),
        lon: Number(form.farmLocation.lon),
      },
      defaultSoilClass: form.defaultSoilClass,
      totalAreaHa: Number(form.totalAreaHa),
      originalArea: {
        value: Number(form.totalArea),
        unit: form.areaUnit,
      },
      sectorTemplate: form.sectorTemplate,
      sectors: form.sectors.map((sector) => ({
        ...sector,
        areaHa: Number(sector.areaHa),
      })),
      cropHistory: {
        unknown: form.historyUnknown,
        sameForAllSectors: form.sameHistoryForAll,
        shared: form.sharedHistory,
        bySector: form.sectorHistories,
      },
      goals: form.goals,
      waterSource: {
        ...form.waterSource,
        lat:
          form.waterSource.lat === '' ? null : Number(form.waterSource.lat),
        lon:
          form.waterSource.lon === '' ? null : Number(form.waterSource.lon),
      },
      onboardingCompleted: true,
      createdAt: previousProfile.createdAt || now,
      updatedAt: now,
      onboardingCompletedAt: now,
      backendSyncStatus: 'pending',
    };

    try {
      await saveProfile(profile);
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* Saving the server record does not depend on local draft storage. */ }
      if (onSaved) onSaved();
      else navigate('/', { replace: true });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    if (step === 0) {
      return (
        <>
          <StepHeader title="Share your farm location">
            Location helps calculate distances, weather context, and field-specific recommendations.
          </StepHeader>

          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  consent: event.target.checked,
                }))
              }
            />
            I agree to share my farm location
          </label>

          <div className="location-actions">
            <button
              className="primary-button"
              type="button"
              onClick={requestLocation}
            >
              Use my current location
            </button>
            {geoStatus && <span className="muted-text">{geoStatus}</span>}
          </div>

          <CoordinatesEditor
            value={form.farmLocation}
            onChange={updateLocation}
            prefix="farm"
          />

          <p className="help-text">
            You can also click anywhere on the map to place the farm pin.
          </p>

          <MapPicker
            location={form.farmLocation}
            onChange={updateLocation}
            label="Farm location"
          />
        </>
      );
    }

    if (step === 1) {
      const activeSoil = getSoilClass(form.defaultSoilClass);

      return (
        <>
          <StepHeader title="Choose the default field class">
            Select the USDA NRCS Land Capability Class that best describes most of your field.
          </StepHeader>

          <div className="soil-scale-hints" aria-hidden="true">
            <span>I–IV · Arable (cultivation)</span>
            <span>V–VIII · Non-arable (pasture / habitat)</span>
          </div>

          <div
            className="soil-class-grid"
            role="radiogroup"
            aria-label="Default field class"
          >
            {SOIL_CLASSES.map((soilClass) => {
              const isSelected = form.defaultSoilClass === soilClass.id;
              const isUnknown = soilClass.id === 'unknown';

              return (
                <label
                  className={`soil-tile ${isSelected ? 'selected' : ''}`}
                  key={soilClass.id}
                  style={{ '--soil-color': soilClass.color }}
                  title={soilClass.title}
                >
                  <input
                    className="soil-tile-input"
                    type="radio"
                    name="default-soil-class"
                    value={soilClass.id}
                    aria-label={soilClass.title}
                    checked={isSelected}
                    onChange={() =>
                      setForm((current) => ({
                        ...current,
                        defaultSoilClass: soilClass.id,
                      }))
                    }
                  />
                  <span className="soil-tile-swatch" aria-hidden="true" />
                  <span className="soil-tile-code">
                    {isUnknown ? '?' : soilClass.id}
                  </span>
                  <span className="soil-tile-sub">
                    {isUnknown ? 'Unsure' : 'Class'}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="soil-selected-bar" aria-live="polite">
            <div className="soil-selected-info">
              <span className="soil-selected-main">
                <span
                  className="status-dot"
                  style={{ background: activeSoil.color }}
                />
                <strong>{activeSoil.title}</strong>
              </span>
              <span className="soil-selected-desc">{activeSoil.description}</span>
            </div>
            {activeSoil.isArable === true && (
              <span className="arable-badge">Arable</span>
            )}
            {activeSoil.isArable === false && (
              <span className="non-arable-badge">Non-arable</span>
            )}
          </div>
          <details className="field-details"><summary>Soil test & watering method</summary><div className="field-size-grid">
            <label className="field-label">Soil pH<input className="onboarding-input" type="number" min="0" max="14" step="0.1" value={form.soilTest?.ph ?? ''} onChange={event => setForm(current => ({ ...current, soilTest: { ...current.soilTest, ph: event.target.value } }))} /></label>
            <label className="field-label">Soil texture<select className="onboarding-select" value={form.soilTest?.texture || 'unknown'} onChange={event => setForm(current => ({ ...current, soilTest: { ...current.soilTest, texture: event.target.value } }))}>{SOILS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
            <label className="field-label">Watering method<select className="onboarding-select" value={form.soilTest?.irrigation || 'unknown'} onChange={event => setForm(current => ({ ...current, soilTest: { ...current.soilTest, irrigation: event.target.value } }))}>{['unknown','rainfed','drip','sprinkler','furrow','other'].map(value => <option key={value} value={value}>{value === 'unknown' ? 'Not known' : value}</option>)}</select></label>
          </div></details>
        </>
      );
    }

    if (step === 2) {
      return (
        <>
          <StepHeader title="Enter your total field size">
            Use your preferred unit. The area will be normalized and stored in hectares.
          </StepHeader>

          <div className="field-size-grid">
            <label className="field-label">
              Total field area
              <input
                className="onboarding-input"
                type="number"
                min="0"
                step="any"
                value={form.totalArea}
                onChange={(event) => {
                  const totalArea = event.target.value;
                  setForm((current) => {
                    const totalAreaHa = toHectares(totalArea, current.areaUnit);
                    const lockedArea = makeEqualAreas(totalAreaHa, 1)[0];

                    return {
                      ...current,
                      totalArea,
                      totalAreaHa,
                      sectors:
                        current.sectorTemplate === 'Whole field'
                          ? current.sectors.map((sector) => ({
                              ...sector,
                              areaHa: lockedArea,
                            }))
                          : current.sectors,
                    };
                  });
                }}
                placeholder="Enter area"
              />
            </label>

            <label className="field-label">
              Unit
              <select
                className="onboarding-select"
                value={form.areaUnit}
                onChange={(event) => {
                  const areaUnit = event.target.value;
                  setForm((current) => {
                    const totalAreaHa = toHectares(current.totalArea, areaUnit);
                    const lockedArea = makeEqualAreas(totalAreaHa, 1)[0];

                    return {
                      ...current,
                      areaUnit,
                      totalAreaHa,
                      sectors:
                        current.sectorTemplate === 'Whole field'
                          ? current.sectors.map((sector) => ({
                              ...sector,
                              areaHa: lockedArea,
                            }))
                          : current.sectors,
                    };
                  });
                }}
              >
                {AREA_UNITS.map((unit) => (
                  <option value={unit} key={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {form.totalAreaHa > 0 && (
            <div className="success-banner">
              Normalized field size: <strong>{form.totalAreaHa.toFixed(2)} hectares</strong>
            </div>
          )}
        </>
      );
    }

    if (step === 3) {
      const isWholeField = form.sectorTemplate === 'Whole field';

      const orientationClass =
        form.sectorTemplate === 'Halves N/S'
          ? 'halves-ns'
          : form.sectorTemplate === 'Halves E/W'
            ? 'halves-ew'
            : 'quarters';

      const showOrientation = [
        'Halves N/S',
        'Halves E/W',
        'Quarters NW/NE/SW/SE',
      ].includes(form.sectorTemplate);

      return (
        <>
          <StepHeader title="Divide the field into sectors">
            Choose a template, then edit each sector’s area, direction, soil class, crop, and notes.
          </StepHeader>

          <div className="template-list">
            {[
              'Whole field',
              'Halves N/S',
              'Halves E/W',
              'Quarters NW/NE/SW/SE',
              'Custom',
            ].map((template) => (
              <button
                className={`template-button ${form.sectorTemplate === template ? 'selected' : ''}`}
                type="button"
                key={template}
                aria-pressed={form.sectorTemplate === template}
                onClick={() => applyTemplate(template)}
              >
                {template}
              </button>
            ))}
          </div>

          <div className="area-status">
            <strong>Assigned: {assignedArea.toFixed(2)} ha</strong>
            <span>Remaining: {remainingArea.toFixed(2)} ha</span>
          </div>

          <div className="area-progress" aria-label="Assigned field area">
            <div
              className={`area-progress-fill ${assignedArea > form.totalAreaHa + 0.0001 ? 'over' : ''
                }`}
              style={{
                width: `${Math.min(
                  form.totalAreaHa
                    ? (assignedArea / form.totalAreaHa) * 100
                    : 0,
                  100,
                )}%`,
              }}
            />
          </div>

          {remainingArea > 0.0001 && form.sectors.length > 0 && (
            <div className="warning-banner">
              {remainingArea.toFixed(2)} hectares remain unassigned. You may continue and assign them later.
            </div>
          )}

          {showOrientation && (
            <div className={`orientation-grid ${orientationClass}`}>
              {form.sectors.map((sector) => (
                <div
                  className="orientation-tile"
                  key={sector.id}
                  style={{
                    background: getSoilClass(sector.soilClass).color,
                  }}
                >
                  {sector.direction}
                </div>
              ))}
            </div>
          )}

          <div className="sectors-list">
            {form.sectors.map((sector) => {
              const soilClass = getSoilClass(sector.soilClass);
              const lockedWholeFieldArea = makeEqualAreas(form.totalAreaHa, 1)[0];

              return (
                <article className="sector-card" key={sector.id}>
                  <div className="sector-card-header">
                    <div>
                      <h3>{sector.name || 'Unnamed sector'}</h3>
                      {!isWholeField && (
                        <>
                          <span className="direction-badge">{sector.direction}</span>{' '}
                        </>
                      )}
                      {soilClass.isArable === false && (
                        <span className="non-arable-badge">Non-arable</span>
                      )}
                    </div>

                    {!isWholeField && (
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => deleteSector(sector.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  <div className="sector-fields">
                    <label className="field-label">
                      Sector name
                      <input
                        className="onboarding-input"
                        value={sector.name}
                        onChange={(event) =>
                          updateSector(sector.id, 'name', event.target.value)
                        }
                      />
                    </label>

                    {!isWholeField && (
                      <label className="field-label">
                        Direction
                        <select
                          className="onboarding-select"
                          value={sector.direction}
                          onChange={(event) =>
                            updateSector(sector.id, 'direction', event.target.value)
                          }
                        >
                          {DIRECTIONS.map((direction) => (
                            <option value={direction} key={direction}>
                              {direction}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    <label className="field-label">
                      Area in hectares
                      <input
                        className="onboarding-input"
                        type="number"
                        min="0"
                        step="any"
                        value={isWholeField ? lockedWholeFieldArea : sector.areaHa}
                        disabled={isWholeField}
                        readOnly={isWholeField}
                        onChange={(event) =>
                          updateSector(sector.id, 'areaHa', event.target.value)
                        }
                      />
                    </label>

                    <label className="field-label">
                      Soil class
                      <select
                        className="onboarding-select"
                        value={sector.soilClass}
                        onChange={(event) =>
                          updateSector(sector.id, 'soilClass', event.target.value)
                        }
                      >
                        {SOIL_CLASSES.map((item) => (
                          <option value={item.id} key={item.id}>
                            {item.id === 'unknown' ? "I don't know" : `Class ${item.id}`}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field-label">
                      Current crop
                      <input
                        className="onboarding-input"
                        value={sector.currentCrop}
                        onChange={(event) =>
                          updateSector(sector.id, 'currentCrop', event.target.value)
                        }
                        placeholder="Optional"
                      />
                    </label>

                    <label className="field-label wide-field">
                      Notes
                      <textarea
                        className="onboarding-textarea"
                        value={sector.notes}
                        onChange={(event) =>
                          updateSector(sector.id, 'notes', event.target.value)
                        }
                        placeholder="Drainage, slope, access, or other details"
                      />
                    </label>
                  </div>
                </article>
              );
            })}
          </div>

          {!isWholeField && (
            <div className="sector-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={addSector}
              >
                Add sector
              </button>
            </div>
          )}
        </>
      );
    }

    if (step === 4) {
      return (
        <>
          <StepHeader title="Add crop and fertilizer history">
            Three or more seasons provide better recommendations, but one season is enough to continue.
          </StepHeader>

          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={form.historyUnknown}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  historyUnknown: event.target.checked,
                }))
              }
            />
            I don&apos;t know
          </label>

          {!form.historyUnknown && (
            <>
              <label className="toggle-line">
                <input
                  type="checkbox"
                  checked={form.sameHistoryForAll}
                  onChange={(event) =>
                    setSameHistoryForAll(event.target.checked)
                  }
                />
                Same for all sectors
              </label>

              {form.sameHistoryForAll ? (
                <div className="history-panel">
                  <div className="history-heading">
                    <h3>Shared field history</h3>
                    {form.sharedHistory.length < 3 && (
                      <span className="muted-text">
                        Add {3 - form.sharedHistory.length} more season(s) for richer insights.
                      </span>
                    )}
                  </div>

                  <SeasonEditor
                    seasons={form.sharedHistory}
                    onChange={(sharedHistory) =>
                      setForm((current) => ({
                        ...current,
                        sharedHistory,
                      }))
                    }
                  />
                </div>
              ) : (
                <div className="sectors-list">
                  {form.sectors.map((sector) => {
                    const seasons =
                      form.sectorHistories[sector.id] || [newSeason()];

                    return (
                      <div className="history-panel" key={sector.id}>
                        <div className="history-heading">
                          <h3>{sector.name}</h3>
                          {seasons.length < 3 && (
                            <span className="muted-text">
                              Three or more seasons recommended.
                            </span>
                          )}
                        </div>

                        <SeasonEditor
                          seasons={seasons}
                          onChange={(nextSeasons) =>
                            setForm((current) => ({
                              ...current,
                              sectorHistories: {
                                ...current.sectorHistories,
                                [sector.id]: nextSeasons,
                              },
                            }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      );
    }

    if (step === 5) {
      const goalLabels = {
        yield: 'Maximize yield',
        soilHealth: 'Improve soil health',
        water: 'Minimize water usage',
      };

      return (
        <>
          <StepHeader title="Set your farming goals">
            Adjusting one priority automatically rebalances the other two so the total always remains 100%.
          </StepHeader>

          <div className="goal-presets">
            {['Balanced', 'Yield first', 'Sustainability first'].map(
              (preset) => (
                <button
                  className="preset-button"
                  type="button"
                  key={preset}
                  onClick={() => applyGoalPreset(preset)}
                >
                  {preset}
                </button>
              ),
            )}
          </div>

          <div className="goals-list">
            {Object.entries(form.goals).map(([key, value]) => (
              <div className="goal-row" key={key}>
                <label className="goal-label" htmlFor={`goal-${key}`}>
                  <span>{goalLabels[key]}</span>
                  <strong>{value}%</strong>
                </label>
                <input
                  id={`goal-${key}`}
                  className="range-input"
                  type="range"
                  min="0"
                  max="100"
                  value={value}
                  onChange={(event) => updateGoal(key, event.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="goal-stack" aria-label="Goal allocation">
            <span
              className="goal-yield"
              style={{ width: `${form.goals.yield}%` }}
            >
              {form.goals.yield}%
            </span>
            <span
              className="goal-soil"
              style={{ width: `${form.goals.soilHealth}%` }}
            >
              {form.goals.soilHealth}%
            </span>
            <span
              className="goal-water"
              style={{ width: `${form.goals.water}%` }}
            >
              {form.goals.water}%
            </span>
          </div>
        </>
      );
    }

    if (step === 6) {
      return (
        <>
          <StepHeader title="Describe the nearest water source">
            Add coordinates with the map or enter an address when exact coordinates are unavailable.
          </StepHeader>

          <div className="water-grid">
            <label className="field-label">
              Name or description
              <input
                className="onboarding-input"
                value={form.waterSource.name}
                onChange={(event) =>
                  updateWaterSource({ name: event.target.value })
                }
                placeholder="North well"
              />
            </label>

            <label className="field-label">
              Type
              <select
                className="onboarding-select"
                value={form.waterSource.type}
                onChange={(event) =>
                  updateWaterSource({ type: event.target.value })
                }
              >
                {[
                  'Well',
                  'River',
                  'Reservoir',
                  'Irrigation station',
                  'Other',
                ].map((type) => (
                  <option value={type} key={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-label">
              Address or location description
              <input
                className="onboarding-input"
                value={form.waterSource.address}
                onChange={(event) =>
                  updateWaterSource({ address: event.target.value })
                }
                placeholder="Optional if coordinates are supplied"
              />
            </label>

            <label className="field-label">
              Additional details
              <input
                className="onboarding-input"
                value={form.waterSource.description}
                onChange={(event) =>
                  updateWaterSource({ description: event.target.value })
                }
                placeholder="Access, capacity, seasonal availability"
              />
            </label>
          </div>

          <CoordinatesEditor
            value={form.waterSource}
            onChange={(location) => updateWaterSource(location)}
            prefix="water"
          />

          {form.waterSource.distanceKm !== null ? (
            <div className="success-banner">
              Distance from farm: <strong>{form.waterSource.distanceKm.toFixed(2)} km</strong>
            </div>
          ) : (
            <p className="help-text">
              Distance is calculated automatically when both farm and water-source coordinates are available.
            </p>
          )}

          <MapPicker
            location={form.waterSource}
            onChange={(location) => updateWaterSource(location)}
            label="Nearest water source"
          />
        </>
      );
    }

    const defaultSoil = getSoilClass(form.defaultSoilClass);

    return (
      <>
        <StepHeader title="Review your farm profile">
          Check your information before submitting. Use Edit to return to any section.
        </StepHeader>

        <div className="summary-grid">
          <section className="summary-section">
            <div className="summary-title">
              <h3>Location</h3>
              <button className="text-button" type="button" onClick={() => jumpToStep(0)}>
                Edit
              </button>
            </div>
            <p>
              {Number(form.farmLocation.lat).toFixed(6)},{' '}
              {Number(form.farmLocation.lon).toFixed(6)}
            </p>
            <p><span className="status-dot" />Location sharing accepted</p>
          </section>

          <section className="summary-section">
            <div className="summary-title">
              <h3>Default field class</h3>
              <button className="text-button" type="button" onClick={() => jumpToStep(1)}>
                Edit
              </button>
            </div>
            <p>
              <span
                className="status-dot"
                style={{ background: defaultSoil.color }}
              />
              {defaultSoil.title}
            </p>
            {defaultSoil.isArable === false && (
              <span className="non-arable-badge">Non-arable</span>
            )}
          </section>

          <section className="summary-section">
            <div className="summary-title">
              <h3>Field size</h3>
              <button className="text-button" type="button" onClick={() => jumpToStep(2)}>
                Edit
              </button>
            </div>
            <p>
              {form.totalArea} {form.areaUnit}
            </p>
            <p>{form.totalAreaHa.toFixed(2)} hectares normalized</p>
          </section>

          <section className="summary-section">
            <div className="summary-title">
              <h3>Sectors</h3>
              <button className="text-button" type="button" onClick={() => jumpToStep(3)}>
                Edit
              </button>
            </div>
            <p>{form.sectors.length} sector(s), {assignedArea.toFixed(2)} ha assigned</p>
            <ul>
              {form.sectors.map((sector) => (
                <li key={sector.id}>
                  {sector.name}: {Number(sector.areaHa).toFixed(2)} ha, Class {sector.soilClass}
                </li>
              ))}
            </ul>
          </section>

          <section className="summary-section">
            <div className="summary-title">
              <h3>Crop history</h3>
              <button className="text-button" type="button" onClick={() => jumpToStep(4)}>
                Edit
              </button>
            </div>
            <p>
              {form.historyUnknown
                ? 'History is not known.'
                : form.sameHistoryForAll
                  ? `${form.sharedHistory.length} shared season(s)`
                  : 'History entered by sector'}
            </p>
          </section>

          <section className="summary-section">
            <div className="summary-title">
              <h3>Goals</h3>
              <button className="text-button" type="button" onClick={() => jumpToStep(5)}>
                Edit
              </button>
            </div>
            <p>Maximize yield: {form.goals.yield}%</p>
            <p>Improve soil health: {form.goals.soilHealth}%</p>
            <p>Minimize water usage: {form.goals.water}%</p>
          </section>

          <section className="summary-section full-width">
            <div className="summary-title">
              <h3>Nearest water source</h3>
              <button className="text-button" type="button" onClick={() => jumpToStep(6)}>
                Edit
              </button>
            </div>
            <p>
              {form.waterSource.name} — {form.waterSource.type}
            </p>
            <p>
              {form.waterSource.distanceKm !== null
                ? `${form.waterSource.distanceKm.toFixed(2)} km from the farm`
                : form.waterSource.address}
            </p>
          </section>
        </div>

        <DecisionDisclaimer
          variant="compact"
          className="onboarding-summary-disclaimer"
          context="Your farm profile is used to generate decision-support recommendations. Automated outputs do not replace laboratory soil testing, certified agronomists, or local agricultural specialists."
        />
      </>
    );
  };

  return (
    <div className={`onboarding-page${embedded ? " onboarding-embedded" : ""}`}>
      <div className="onboarding-shell">
        <header className="onboarding-header">
          <p className="onboarding-eyebrow">Farm setup</p>
          <h1>{embedded ? "Edit field" : "Build your farm profile"}</h1>
          {!embedded && <p>Your draft is saved automatically on this device.</p>}
        </header>

        {embedded && <nav className="field-editor-tabs" aria-label="Field sections">{STEP_TITLES.map((title, index) => <button type="button" key={title} aria-pressed={step === index} onClick={() => setStep(index)}>{title}</button>)}</nav>}
        <div className="progress-header">
          <span>
            Step {step + 1} of {STEP_TITLES.length}
          </span>
          <span>{STEP_TITLES[step]}</span>
        </div>

        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin="1"
          aria-valuemax={STEP_TITLES.length}
          aria-valuenow={step + 1}
        >
          <div
            className="progress-fill"
            style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
          />
        </div>

        <section className="onboarding-step">
          {renderStep()}

          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}

          <div className="step-actions">
            <button
              className="secondary-button"
              type="button"
              onClick={previousStep}
              disabled={step === 0 || submitting}
            >
              Back
            </button>

            {embedded && step < STEP_TITLES.length - 1 && <button className="primary-button" type="button" onClick={submitProfile} disabled={submitting}>{submitting ? 'Saving…' : 'Save changes'}</button>}
            {step < STEP_TITLES.length - 1 ? (
              <button
                className="primary-button"
                type="button"
                onClick={nextStep}
              >
                Next
              </button>
            ) : (
              <button
                className="primary-button"
                type="button"
                onClick={submitProfile}
                disabled={submitting}
              >
                {submitting ? 'Saving…' : 'Save field'}
              </button>
            )}
          </div>
        </section>
        {step !== 1 && (
          <DecisionDisclaimer
            variant="compact"
            className="onboarding-footer-disclaimer"
            context="This setup feeds a decision-support tool and does not replace human agronomic or soil-science expertise."
          />
        )}
      </div>
    </div>
  );
}