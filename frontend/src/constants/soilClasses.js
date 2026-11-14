export const SOIL_CLASSES = [
    {
      id: 'I',
      title: 'Class I — Very few limitations',
      description:
        'Deep, productive soils that are nearly level and easy to cultivate.',
      suitableUses: 'Most crops, pasture, grazing, forestry, and wildlife.',
      isArable: true,
      color: '#4F7D55',
    },
    {
      id: 'II',
      title: 'Class II — Moderate limitations',
      description:
        'Productive soils with moderate erosion, drainage, or management limitations.',
      suitableUses: 'Cultivated crops with conservation practices.',
      isArable: true,
      color: '#71966F',
    },
    {
      id: 'III',
      title: 'Class III — Severe limitations',
      description:
        'Soils requiring careful conservation and more restricted crop selection.',
      suitableUses: 'Selected crops, pasture, grazing, forestry, and wildlife.',
      isArable: true,
      color: '#9AAF7E',
    },
    {
      id: 'IV',
      title: 'Class IV — Very severe limitations',
      description:
        'Soils with major limitations that substantially restrict cultivation.',
      suitableUses: 'Occasional crops with intensive conservation management.',
      isArable: true,
      color: '#C3C98C',
    },
    {
      id: 'V',
      title: 'Class V — Little erosion risk',
      description:
        'Nearly level soils with limitations such as wetness, stones, or flooding.',
      suitableUses: 'Pasture, grazing, forestry, and wildlife habitat.',
      isArable: false,
      color: '#D7B979',
    },
    {
      id: 'VI',
      title: 'Class VI — Severe non-cropland limitations',
      description:
        'Soils generally unsuited to cultivation because of slope or shallow depth.',
      suitableUses: 'Grazing, forestry, recreation, and wildlife.',
      isArable: false,
      color: '#C99A68',
    },
    {
      id: 'VII',
      title: 'Class VII — Very severe limitations',
      description:
        'Land with severe restrictions that require very careful management.',
      suitableUses: 'Limited grazing, forestry, recreation, and wildlife.',
      isArable: false,
      color: '#AD7662',
    },
    {
      id: 'VIII',
      title: 'Class VIII — Restricted use',
      description:
        'Land unsuitable for commercial plant production due to extreme limitations.',
      suitableUses: 'Recreation, wildlife habitat, watershed, or aesthetic use.',
      isArable: false,
      color: '#865A55',
    },
    {
      id: 'unknown',
      title: "I don't know",
      description:
        'Choose this option if your USDA Land Capability Class is not known.',
      suitableUses: 'You can update this information later.',
      isArable: null,
      color: '#9CA19A',
    },
  ];
  
  export const SOIL_CLASS_MAP = Object.fromEntries(
    SOIL_CLASSES.map((soilClass) => [soilClass.id, soilClass]),
  );
  
  export function getSoilClass(id) {
    return SOIL_CLASS_MAP[id] || SOIL_CLASS_MAP.unknown;
  }