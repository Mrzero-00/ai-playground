import assert from 'node:assert/strict';
import test from 'node:test';
import { capsuleState, filterCapsules } from '../src/lib/timeline';
import type { CapsuleSummary } from '../src/shared/contracts';

const now = Date.parse('2026-09-17T03:00:00Z');
const base: CapsuleSummary = {
  id: 'waiting', title: '아무 말', placeName: '벤치',
  createdAt: '2026-09-01T03:00:00Z', opensAt: '2026-10-01T03:00:00Z', openedAt: null,
  latitude: 37.5, longitude: 127, radiusMeters: 50,
  hasPhoto: false, hasAudio: false, hasVideo: false,
};
const ready = { ...base, id: 'ready', opensAt: new Date(now).toISOString() };
const opened = { ...ready, id: 'opened', openedAt: new Date(now).toISOString() };

test('timeline: a sealed capsule waits until its server-adjusted opening time', () => {
  assert.equal(capsuleState(base, now), 'waiting');
  assert.equal(capsuleState(ready, now - 1), 'waiting');
});
test('timeline: exact opening time changes the time-only category', () => {
  assert.equal(capsuleState(ready, now), 'ready');
});
test('timeline: previously opened capsules have their own category', () => {
  assert.equal(capsuleState(opened, now), 'opened');
  assert.deepEqual(filterCapsules([base, ready, opened], 'ready', now).map(c => c.id), ['ready']);
});
test('timeline: every filter selects only its category', () => {
  const capsules = [base, ready, opened];
  for (const state of ['waiting', 'ready', 'opened'] as const) {
    assert.deepEqual(filterCapsules(capsules, state, now).map(c => c.id), [state]);
  }
  assert.equal(filterCapsules(capsules, 'all', now).length, 3);
});
test('timeline: newest first without mutating the API result', () => {
  const newer = { ...ready, createdAt: new Date(now).toISOString() };
  const capsules = [base, newer];
  assert.deepEqual(filterCapsules(capsules, 'all', now).map(c => c.id), ['ready', 'waiting']);
  assert.deepEqual(capsules.map(c => c.id), ['waiting', 'ready']);
});
test('timeline: empty collection stays empty for every filter', () => {
  for (const filter of ['all', 'waiting', 'ready', 'opened'] as const) {
    assert.deepEqual(filterCapsules([], filter, now), []);
  }
});
