import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_MAP_CENTER, drawerHeights, mapCenter, snapDrawer } from '../src/lib/mapHome';
import type { CapsuleSummary } from '../src/shared/contracts';

const capsule = { id: 'one', latitude: 35.1, longitude: 129.1 } as CapsuleSummary;
test('map framing uses a labelled default without inventing user GPS', () => {
  assert.deepEqual(mapCenter([], null), DEFAULT_MAP_CENTER);
});
test('saved capsule frames the map when GPS has not been requested', () => {
  assert.deepEqual(mapCenter([capsule], null), { latitude: 35.1, longitude: 129.1 });
});
test('explicit location result takes priority without mutating capsule coordinates', () => {
  const fix = { latitude: 37, longitude: 127, accuracy: 9, timestamp: 1 };
  assert.deepEqual(mapCenter([capsule], fix), { latitude: 37, longitude: 127 });
  assert.equal(capsule.latitude, 35.1);
});
test('drawer snap heights fit portrait and short landscape viewports', () => {
  for (const height of [320, 390, 740, 852, 1000]) {
    const stops = drawerHeights(height);
    assert.ok(stops.collapsed > 70 && stops.expanded > stops.collapsed);
    assert.ok(stops.expanded <= height - 100);
  }
});
test('dragged drawer snaps to the nearer end when moving slowly', () => {
  const stops = drawerHeights(852);
  assert.equal(snapDrawer(stops.collapsed + 5, 0, stops), false);
  assert.equal(snapDrawer(stops.expanded - 5, 0, stops), true);
});
test('intentional swipe direction takes priority over midpoint', () => {
  const stops = drawerHeights(852);
  assert.equal(snapDrawer(stops.collapsed + 5, -.8, stops), true);
  assert.equal(snapDrawer(stops.expanded - 5, .8, stops), false);
});
