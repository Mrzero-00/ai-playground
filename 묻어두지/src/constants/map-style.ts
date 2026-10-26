// One palette for both map engines so the town looks the same on a phone and on
// the web: flat pastel ground, cream roads, soft water, no points of interest.
// Labels stay off except district names; the capsules are the only decorations.
export const MapPalette = {
  ground: '#D9E7C8',
  park: '#BFD9A6',
  wood: '#A9CB8F',
  sand: '#EFE3C4',
  water: '#A8D4E6',
  waterLine: '#8FC2DA',
  road: '#FFF9EC',
  roadMinor: '#F6EEDD',
  roadEdge: '#E4D7BF',
  building: '#EEE4D2',
  buildingTop: '#F7F0E2',
  buildingEdge: '#D8C9AE',
  label: '#6B5A48',
  labelHalo: '#F6F0E3',
} as const;

/** Google Maps JSON style for react-native-maps `customMapStyle` (Google provider). */
export const googleMapStyle = [
  { elementType: 'geometry', stylers: [{ color: MapPalette.ground }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: MapPalette.label }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: MapPalette.labelHalo }, { weight: 3 }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels', stylers: [{ visibility: 'on' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels', stylers: [{ visibility: 'on' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.fill', stylers: [{ color: MapPalette.building }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: MapPalette.buildingEdge }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: MapPalette.park }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: MapPalette.park }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: MapPalette.road }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: MapPalette.roadEdge }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ color: MapPalette.roadMinor }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: MapPalette.sand }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: MapPalette.water }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];
