import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Player } from "../src/game/Player.js";

test("방패는 공격원과 일직선인 뒤쪽 아군을 보호한다", () => {
  const player = new Player(new THREE.Vector3(0, 0, 0));
  player.guarding = true;
  player.forward.set(0, 0, -1);

  const source = new THREE.Vector3(0, 0, -10);
  const ally = new THREE.Vector3(0, 0, 4);

  assert.equal(player.protectsPoint(ally, source), true);
});
test("보호 폭을 벗어난 아군은 방패 뒤라도 보호되지 않는다", () => {
  const player = new Player(new THREE.Vector3(0, 0, 0));
  player.guarding = true;
  player.forward.set(0, 0, -1);

  const source = new THREE.Vector3(0, 0, -10);
  const ally = new THREE.Vector3(4, 0, 4);

  assert.equal(player.protectsPoint(ally, source), false);
});

test("방패 방향이 공격원 반대쪽이면 아군을 보호하지 못한다", () => {
  const player = new Player(new THREE.Vector3(0, 0, 0));
  player.guarding = true;
  player.forward.set(0, 0, 1);

  const source = new THREE.Vector3(0, 0, -10);
  const ally = new THREE.Vector3(0, 0, 4);

  assert.equal(player.protectsPoint(ally, source), false);
});

test("완벽 쳐내기는 방어 방향과 입력 유예를 모두 요구한다", () => {
  const player = new Player(new THREE.Vector3(0, 0, 0));
  player.guarding = true;
  player.forward.set(0, 0, -1);
  player.parryUntil = 10.4;

  const source = new THREE.Vector3(0, 0, -10);

  assert.equal(player.isPerfectParry(10.2, source), true);
  assert.equal(player.isPerfectParry(10.5, source), false);
});
