import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyRevealRadius, distanceInMeters, isWithinRevealRadius } from '../src/domain/pit.ts';

const origin = { latitude: 37.5556, longitude: 126.8998 };

test('같은 좌표의 거리는 0m다', () => {
  assert.equal(distanceInMeters(origin, origin), 0);
});

test('약 100m 떨어진 좌표는 기본 공개 반경 안이다', () => {
  const about100MetersNorth = { latitude: origin.latitude + 0.0009, longitude: origin.longitude };
  const distance = distanceInMeters(origin, about100MetersNorth);

  assert.ok(distance > 95 && distance < 105);
  assert.equal(isWithinRevealRadius(origin, about100MetersNorth), true);
});

test('약 200m 떨어진 좌표는 기본 공개 반경 밖이다', () => {
  const about200MetersNorth = { latitude: origin.latitude + 0.0018, longitude: origin.longitude };

  assert.equal(isWithinRevealRadius(origin, about200MetersNorth), false);
});

test('사용자 지정 반경을 적용한다', () => {
  const about100MetersNorth = { latitude: origin.latitude + 0.0009, longitude: origin.longitude };

  assert.equal(isWithinRevealRadius(origin, about100MetersNorth, 80), false);
});

test('GPS 오차 범위 전체가 반경 안이면 inside다', () => {
  assert.equal(classifyRevealRadius(100, 20), 'inside');
});

test('GPS 오차 범위 전체가 반경 밖이면 outside다', () => {
  assert.equal(classifyRevealRadius(200, 20), 'outside');
});

test('GPS 오차 범위가 공개 경계와 겹치면 uncertain이다', () => {
  assert.equal(classifyRevealRadius(145, 10), 'uncertain');
});

test('정확도를 알 수 없거나 오차가 크면 uncertain이다', () => {
  assert.equal(classifyRevealRadius(10, null), 'uncertain');
  assert.equal(classifyRevealRadius(10, 81), 'uncertain');
});
