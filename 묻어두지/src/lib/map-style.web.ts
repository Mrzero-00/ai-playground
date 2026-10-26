import type { StyleSpecification } from 'maplibre-gl';

import { MapPalette } from '@/constants/map-style';

// OpenFreeMap serves OpenMapTiles vector tiles without a key. Required credit:
// OpenFreeMap © OpenMapTiles, data from OpenStreetMap. Custom styles must be
// self-hosted, which is what this module does.
export const WEB_TILES_URL = 'https://tiles.openfreemap.org/planet';

/** The town style: flat pastel ground, cream roads, extruded cream blocks. */
export function townStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { town: { type: 'vector', url: WEB_TILES_URL } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': MapPalette.ground } },
      {
        id: 'park', type: 'fill', source: 'town', 'source-layer': 'park',
        paint: { 'fill-color': MapPalette.park },
      },
      {
        id: 'landcover', type: 'fill', source: 'town', 'source-layer': 'landcover',
        filter: ['in', 'class', 'grass', 'wood', 'farmland', 'wetland'],
        paint: { 'fill-color': ['match', ['get', 'class'], 'wood', MapPalette.wood, MapPalette.park], 'fill-opacity': 0.9 },
      },
      {
        id: 'landuse', type: 'fill', source: 'town', 'source-layer': 'landuse',
        filter: ['in', 'class', 'cemetery', 'stadium', 'pitch', 'playground', 'garages', 'school', 'university', 'hospital'],
        paint: { 'fill-color': MapPalette.sand, 'fill-opacity': 0.7 },
      },
      { id: 'water', type: 'fill', source: 'town', 'source-layer': 'water', paint: { 'fill-color': MapPalette.water } },
      {
        id: 'waterway', type: 'line', source: 'town', 'source-layer': 'waterway',
        paint: { 'line-color': MapPalette.waterLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 17, 4] },
      },
      {
        id: 'road-edge', type: 'line', source: 'town', 'source-layer': 'transportation',
        filter: ['all', ['!in', 'class', 'rail', 'transit', 'ferry', 'path']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': MapPalette.roadEdge,
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 13, 2, 18, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 24, ['secondary', 'tertiary'], 18, 11]],
        },
      },
      {
        id: 'road', type: 'line', source: 'town', 'source-layer': 'transportation',
        filter: ['all', ['!in', 'class', 'rail', 'transit', 'ferry', 'path']],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], MapPalette.sand, ['secondary', 'tertiary'], MapPalette.road, MapPalette.roadMinor],
          'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], 13, 1, 18, ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], 20, ['secondary', 'tertiary'], 14, 8]],
        },
      },
      {
        id: 'path', type: 'line', source: 'town', 'source-layer': 'transportation', filter: ['==', 'class', 'path'], minzoom: 15,
        paint: { 'line-color': MapPalette.road, 'line-width': 2, 'line-dasharray': [2, 2] },
      },
      {
        // Blocks instead of real building shapes: a height band keeps the skyline toy-like.
        id: 'building', type: 'fill-extrusion', source: 'town', 'source-layer': 'building', minzoom: 14,
        paint: {
          'fill-extrusion-color': MapPalette.building,
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, ['min', 28, ['max', 6, ['coalesce', ['get', 'render_height'], 8]]]],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: 'place-labels', type: 'symbol', source: 'town', 'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town', 'village', 'suburb', 'neighbourhood', 'quarter'],
        layout: { 'text-field': ['coalesce', ['get', 'name:ko'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 11, 12, 16, 15] },
        paint: { 'text-color': MapPalette.label, 'text-halo-color': MapPalette.labelHalo, 'text-halo-width': 1.6 },
      },
    ],
  };
}
