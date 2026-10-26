import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accuracyFootprint, mapOrientation } from '../src/lib/mapPresentation';

test('quarter-view camera has real pitch and a diagonal heading', () => {
  assert.deepEqual(mapOrientation('quarter'), { pitch: 55, bearing: -28 });
});
test('flat camera resets both pitch and heading without changing coordinates', () => {
  assert.deepEqual(mapOrientation('flat'), { pitch: 0, bearing: 0 });
});
const fix = { latitude: 37.5665, longitude: 126.978, accuracy: 20, timestamp: 1 };
test('accuracy overlay is a closed 64-sided geographic polygon', () => {
  const feature = accuracyFootprint(fix);
  assert.equal(feature.geometry.type, 'Polygon');
  assert.equal(feature.geometry.coordinates[0].length, 65);
  assert.deepEqual(feature.geometry.coordinates[0][0], feature.geometry.coordinates[0][64]);
  assert.equal(fix.latitude, 37.5665);
  assert.equal(fix.longitude, 126.978);
});
test('accuracy radius uses meters, not distorted screen pixels', () => {
  const [lng, lat] = accuracyFootprint(fix).geometry.coordinates[0][0];
  const distance = (lat - fix.latitude) * Math.PI / 180 * 6371008.8;
  assert.ok(Math.abs(distance - 20) < .001);
  assert.ok(Math.abs(lng - fix.longitude) < .00000001);
});
test('visual accuracy range is capped at 500 meters without mutating the GPS fix', () => {
  const wide = { ...fix, accuracy: 9999 };
  assert.deepEqual(accuracyFootprint(wide), accuracyFootprint({ ...fix, accuracy: 500 }));
  assert.equal(wide.accuracy, 9999);
});
test('zero accuracy remains finite and centered', () => {
  for (const [lng, lat] of accuracyFootprint({ ...fix, accuracy: 0 }).geometry.coordinates[0]) {
    assert.ok(Number.isFinite(lng) && Number.isFinite(lat));
    assert.ok(Math.abs(lat - fix.latitude) < 1e-9 && Math.abs(lng - fix.longitude) < 1e-9);
  }
});
