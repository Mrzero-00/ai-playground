import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capsuleCountdown } from '../src/lib/capsuleCountdown';

const deadline = Date.parse('2026-12-25T00:00:00Z');
const capsule = { opensAt: new Date(deadline).toISOString(), openedAt: null };
const at = (millisecondsLeft: number) => capsuleCountdown(capsule, deadline - millisecondsLeft);

test('map countdown always displays all four units with padded hours, minutes and seconds', () => {
  assert.deepEqual(at((12 * 86400 + 3 * 3600 + 24 * 60 + 8) * 1000), {
    state: 'waiting', text: '12일 03시간 24분 08초', totalSeconds: 1049048,
  });
  assert.equal(at(1000).text, '0일 00시간 00분 01초');
});
test('countdown rolls days, hours and minutes over without a 24-hour field', () => {
  assert.equal(at(86400000).text, '1일 00시간 00분 00초');
  assert.equal(at(86399000).text, '0일 23시간 59분 59초');
  assert.equal(at(3600000).text, '0일 01시간 00분 00초');
  assert.equal(at(3599000).text, '0일 00시간 59분 59초');
  assert.equal(at(60000).text, '0일 00시간 01분 00초');
  assert.equal(at(59000).text, '0일 00시간 00분 59초');
});
test('a fraction of a second never marks a capsule ready prematurely', () => {
  assert.equal(at(1).state, 'waiting');
  assert.equal(at(1).text, '0일 00시간 00분 01초');
});
test('deadline and past deadlines display a time-only ready state without negative values', () => {
  assert.deepEqual(at(0), { state: 'ready', text: '열어볼 시간!', totalSeconds: 0 });
  assert.deepEqual(at(-99999), at(0));
});
test('already opened capsules are distinct from unopened capsules whose time has arrived', () => {
  assert.deepEqual(capsuleCountdown({ ...capsule, openedAt: new Date(deadline).toISOString() }, deadline + 5000), {
    state: 'opened', text: '열어본 캡슐', totalSeconds: 0,
  });
});
test('unknown time is not treated as ready', () => {
  for (const value of [capsuleCountdown({ opensAt: 'invalid', openedAt: null }, deadline), capsuleCountdown(capsule, NaN), capsuleCountdown(capsule, Infinity)]) {
    assert.deepEqual(value, { state: 'unknown', text: '시간 확인 중', totalSeconds: null });
  }
});
test('long waits do not truncate days', () => {
  assert.equal(at(3653 * 86400000).text, '3653일 00시간 00분 00초');
});
test('countdown follows the supplied server-adjusted clock, including resume jumps', () => {
  assert.equal(at(125000).text, '0일 00시간 02분 05초');
  assert.equal(at(5000).text, '0일 00시간 00분 05초');
  assert.equal(at(-5000).state, 'ready');
});
