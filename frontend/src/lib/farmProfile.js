export function readLegacyProfile() {
  try { const value = JSON.parse(localStorage.getItem('farmProfile')); return value?.onboardingCompleted ? value : null } catch { return null }
}
export function profileForm(field) {
  const profile = field?.farm_profile
  if (!profile) return null
  const season = row => ({ ...row, year: row.year ?? '', amountKgHa: row.amountKgHa ?? '', yield: row.yield ?? '' })
  return {
    ...profile,
    goals: { profit: 0, ...profile.goals },
    soilTest: { ph: field.soil_ph ?? '', texture: field.soil_texture, irrigation: field.irrigation },
    totalArea: profile.originalArea.value,
    areaUnit: profile.originalArea.unit,
    historyUnknown: profile.cropHistory.unknown,
    sameHistoryForAll: profile.cropHistory.sameForAllSectors,
    sharedHistory: profile.cropHistory.shared.map(season),
    sectorHistories: Object.fromEntries(Object.entries(profile.cropHistory.bySector).map(([id, rows]) => [id, rows.map(season)])),
    waterSource: { ...profile.waterSource, lat: profile.waterSource.lat ?? '', lon: profile.waterSource.lon ?? '', distanceKm: null },
  }
}
export function legacyFieldForm(field) {
  if (!field?.area_ha) return null
  const seasons = rows => rows.map(row => ({ id: row.id, year: row.year, crop: 'Other', otherCrop: row.crop_name, fertilizers: [], amountKgHa: '', yield: '' }))
  return {
    consent: field.latitude != null,
    soilTest: { ph: field.soil_ph ?? '', texture: field.soil_texture, irrigation: field.irrigation },
    farmLocation: { lat: field.latitude ?? '', lon: field.longitude ?? '' },
    defaultSoilClass: field.soil_class,
    totalArea: field.area_ha, areaUnit: 'hectares', totalAreaHa: field.area_ha,
    sectorTemplate: 'custom',
    sectors: field.sectors.map(row => ({ id: row.id, name: row.name, direction: 'Other', areaHa: row.area_ha, soilClass: field.soil_class })),
    historyUnknown: !field.crop_history.length,
    sameHistoryForAll: !field.crop_history.some(row => row.sector_id),
    sharedHistory: seasons(field.crop_history.filter(row => !row.sector_id)),
    sectorHistories: Object.fromEntries(field.sectors.map(sector => [sector.id, seasons(field.crop_history.filter(row => row.sector_id === sector.id || !row.sector_id))])),
    goals: field.goal === 'water' ? { yield: 20, soilHealth: 20, water: 60 } : field.goal === 'harvest' ? { yield: 60, soilHealth: 20, water: 20 } : { yield: 20, soilHealth: 60, water: 20 },
  }
}
