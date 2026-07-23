import * as THREE from "three";
import { Input } from "./Input.js";
import { Player } from "./Player.js";
import { Frosthorn } from "./Frosthorn.js";
import { createHubWorld, createMissionWorld } from "./WorldFactory.js";
import { Hud } from "../ui/Hud.js";

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tempTarget = new THREE.Vector3();

export class Game {
  constructor(root, hudRoot) {
    this.root = root;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fc3c3);
    this.scene.fog = new THREE.FogExp2(0x9fc3c3, 0.014);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    root.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 160);
    this.camera.position.set(14, 17, 16);
    this.cameraMode = "thirdPerson";
    this.cameraYaw = Math.PI;
    this.cameraPitch = -0.06;
    this.aimPointer = new THREE.Vector2();

    this.input = new Input(this.renderer.domElement);
    this.hud = new Hud(hudRoot);
    this.raycaster = new THREE.Raycaster();
    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.time = 0;
    this.mode = "hub";
    this.world = null;
    this.player = null;
    this.boss = null;
    this.effects = [];
    this.missionComplete = false;
    this.encounterStarted = false;
    this.allyAttackTimer = 1.3;

    const hemisphere = new THREE.HemisphereLight(0xd9eff1, 0x25362f, 2.25);
    this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xfff2d4, 4.2);
    sun.position.set(-12, 22, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    this.scene.add(sun);

    window.addEventListener("resize", () => this.resize());
    if (new URLSearchParams(window.location.search).get("scene") === "mission") this.loadMission();
    else this.loadHub();
  }

  start() {
    if (this.mode === "hub") this.hud.showToast("의뢰판으로 이동해 [E]를 누르십시오.", 4);
    else this.hud.showToast("전투 검증 장면 · 준비가 끝나면 [E]로 전투를 시작하십시오.", 5);
    this.animate();
  }

  clearWorld() {
    if (!this.world) return;
    this.scene.remove(this.world.root);
    this.world.root.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((entry) => entry.dispose());
      }
    });
    this.effects.length = 0;
  }

  loadHub() {
    this.clearWorld();
    this.mode = "hub";
    this.missionComplete = false;
    this.encounterStarted = false;
    this.boss = null;
    this.world = createHubWorld();
    this.player = new Player(this.world.spawn);
    this.world.root.add(this.player.group);
    this.scene.add(this.world.root);
    this.scene.background.set(0x607c7a);
    this.scene.fog.color.set(0x607c7a);
    this.scene.fog.density = 0.021;
    this.hud.setScene("hub");
    this.hud.setWeapon(this.player.weapon);
    this.hud.setCameraMode(this.cameraMode);
    this.hud.setPrompt("");
    this.snapCamera();
  }

  loadMission() {
    this.clearWorld();
    this.mode = "mission";
    this.missionComplete = false;
    this.encounterStarted = false;
    this.world = createMissionWorld();
    this.player = new Player(this.world.spawn);
    this.world.root.add(this.player.group);
    this.boss = new Frosthorn(this.world.bossSpawn, {
      message: (message) => this.hud.showToast(message, 2.1),
      playerHit: (kind, position) => this.onPlayerHit(kind, position),
      allyHit: (position) => this.spawnPulse(position, 0xd04a42),
      protected: (position, name) => {
        this.spawnPulse(position, 0x67e0d2);
        this.hud.showToast(`${name} 보호 성공`, 1.1);
      },
      deflect: (position) => {
        this.spawnPulse(position, 0xf5d58a, 2.4);
        this.hud.showToast("완벽 쳐내기 — 공격 궤도 변경!", 1.7);
      },
      evaded: (position) => {
        this.spawnPulse(position, 0xc8d6d0, 1.5);
        this.hud.showToast("앉기로 높은 공격 회피", 1.2);
      },
      complete: () => {
        this.missionComplete = true;
        this.hud.showToast("의뢰 완료 · [H] 용병 사무실 복귀", 8);
      },
    });
    this.world.root.add(this.boss.group);
    this.scene.add(this.world.root);
    this.scene.background.set(0xa9ced0);
    this.scene.fog.color.set(0xa9ced0);
    this.scene.fog.density = 0.013;
    this.hud.setScene("mission");
    this.hud.setWeapon(this.player.weapon);
    this.hud.setCameraMode(this.cameraMode);
    this.hud.setPrompt("");
    this.allyAttackTimer = 1.2;
    this.snapCamera();
  }

  animate = (timestamp) => {
    requestAnimationFrame(this.animate);
    this.timer.update(timestamp);
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.time += dt;
    this.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  };

  update(dt) {
    if (this.input.wasPressed("KeyV")) this.toggleCameraMode();
    this.updateCameraLook();
    this.updateAimTarget();
    const previousWeapon = this.player.weapon;
    this.player.update(dt, this.time, this.input, this.camera, tempTarget, this.world.obstacles);
    if (previousWeapon !== this.player.weapon) {
      this.hud.setWeapon(this.player.weapon);
      this.hud.showToast(this.player.weapon === "bow" ? "장궁 장착 · 우클릭 정밀 조준" : "검과 방패 장착 · 우클릭 방향 방어", 1.8);
    }

    if (this.player.attackRequested) this.handlePlayerAttack();
    this.clampPlayer();

    if (this.mode === "hub") this.updateHub();
    else this.updateMission(dt);

    this.updateEffects(dt);
    this.updateCamera(dt);
    this.hud.setAimPointer(this.cameraMode === "thirdPerson" ? 0 : this.input.pointer.x, this.cameraMode === "thirdPerson" ? 0 : this.input.pointer.y);
    this.hud.update(
      dt,
      this.player,
      this.boss,
      this.world.allies,
      this.boss ? (this.encounterStarted ? this.boss.getStateLabel() : "교전 대기 · [E] 시작") : "",
    );
  }

  updateAimTarget() {
    if (this.cameraMode === "thirdPerson") {
      tempTarget.set(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw)).multiplyScalar(30).add(this.player.group.position);
      return;
    }

    this.raycaster.setFromCamera(this.input.pointer, this.camera);
    if (!this.raycaster.ray.intersectPlane(groundPlane, tempTarget)) {
      tempTarget.copy(this.player.group.position).add(this.player.forward);
    }
  }

  updateCameraLook() {
    if (this.cameraMode !== "thirdPerson") return;
    this.cameraYaw -= this.input.lookDelta.x * 0.0024;
    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch - this.input.lookDelta.y * 0.0018, -0.42, 0.34);
  }

  toggleCameraMode() {
    this.cameraMode = this.cameraMode === "thirdPerson" ? "quarter" : "thirdPerson";
    this.hud.setCameraMode(this.cameraMode);
    this.hud.showToast(this.cameraMode === "thirdPerson" ? "3인칭 숄더뷰" : "쿼터뷰 비교 모드", 1.5);
    this.snapCamera();
  }

  updateHub() {
    const distance = this.player.group.position.distanceTo(this.world.boardPosition);
    if (distance < 2.65) {
      this.hud.setPrompt("[E] 의뢰 수락 · 서리 수도원의 포식자");
      if (this.input.wasPressed("KeyE")) this.loadMission();
    } else {
      this.hud.setPrompt("");
    }
  }

  updateMission(dt) {
    if (this.input.wasPressed("KeyH")) {
      this.loadHub();
      this.hud.showToast("용병 사무실로 복귀했습니다.", 2);
      return;
    }

    if (this.player.dead) {
      this.hud.setPrompt("쓰러졌습니다 · [R] 의뢰 다시 시작");
      if (this.input.wasPressed("KeyR")) this.loadMission();
    } else if (this.missionComplete) {
      this.hud.setPrompt("의뢰 완료 · [H] 용병 사무실로 복귀");
    } else if (!this.encounterStarted) {
      this.hud.setPrompt("전투 준비 상태 · [E] 전투 시작");
      if (this.input.wasPressed("KeyE")) this.startEncounter();
    } else {
      this.hud.setPrompt(this.player.guarding ? "방패 방향으로 동료를 보호하는 중 · [F] 완벽 쳐내기" : "[1] 검방 · [2] 활 · [H] 사무실 복귀");
    }

    if (this.encounterStarted && this.boss && !this.boss.dead) {
      this.boss.update(dt, this.time, this.player, this.world.allies);
      this.allyAttackTimer -= dt;
      if (this.allyAttackTimer <= 0) {
        this.allyAttackTimer = 1.45;
        const living = this.world.allies.filter((ally) => ally.health > 0);
        if (living.length) {
          this.boss.takeDamage(living.length * 2.5, "body");
          this.spawnTracer(living[0].group.position.clone().add(new THREE.Vector3(0, 1.5, 0)), this.boss.weakPoint.getWorldPosition(new THREE.Vector3()), 0xa7d6c8);
        }
      }
    } else if (this.encounterStarted && this.boss) {
      this.boss.update(dt, this.time, this.player, this.world.allies);
    }

    this.world.allies.forEach((ally) => {
      ally.protectedTimer = Math.max(0, ally.protectedTimer - dt);
      ally.group.rotation.z = THREE.MathUtils.lerp(ally.group.rotation.z, ally.health <= 0 ? Math.PI * 0.47 : 0, dt * 4);
    });
  }

  handlePlayerAttack() {
    if (this.mode !== "mission" || !this.boss || this.boss.dead) {
      this.spawnPulse(this.player.group.position, 0xc8b47b, 0.7);
      return;
    }

    if (!this.encounterStarted) this.startEncounter();

    if (this.player.weapon === "shield") {
      const distance = this.boss.horizontalDistance(this.player.group.position);
      if (distance <= 3.7 && this.player.isFacing(this.boss.group.position, 0.25)) {
        this.boss.takeDamage(23, "body");
        const hitPoint = this.boss.body.getWorldPosition(new THREE.Vector3());
        this.spawnTracer(this.player.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)), hitPoint, 0xf0d49a, 0.16);
      }
      return;
    }

    this.aimPointer.set(
      this.cameraMode === "thirdPerson" ? 0 : this.input.pointer.x,
      this.cameraMode === "thirdPerson" ? 0 : this.input.pointer.y,
    );
    this.raycaster.setFromCamera(this.aimPointer, this.camera);
    let targetPoint = this.boss.body.getWorldPosition(new THREE.Vector3());
    let hitPart = "body";
    let damage = 12;

    if (this.player.aiming) {
      const hits = this.raycaster.intersectObjects([this.boss.weakPoint, ...this.boss.bodyMeshes], false);
      if (hits.length) {
        targetPoint = hits[0].point;
        hitPart = hits[0].object.userData.hitPart || "body";
        damage = hitPart === "frostCore" ? 28 : 14;
      } else {
        targetPoint = tempTarget.clone().add(new THREE.Vector3(0, 0.2, 0));
        damage = 0;
      }
    }

    const origin = this.player.group.position.clone().add(new THREE.Vector3(0, 1.55, 0));
    this.spawnTracer(origin, targetPoint, hitPart === "frostCore" ? 0x8ff5f2 : 0xe9d4a3, 0.25);
    if (damage > 0 && this.boss.horizontalDistance(this.player.group.position) <= 28) {
      this.boss.takeDamage(damage, hitPart);
      if (hitPart === "frostCore") this.hud.showToast("냉기 기관 정밀 명중!", 1.15);
    }
  }

  startEncounter() {
    if (this.mode !== "mission" || this.encounterStarted || this.missionComplete) return;
    this.encounterStarted = true;
    this.allyAttackTimer = 1.2;
    this.hud.showToast("교전 시작 · 서리뿔 와이번", 2.2);
  }

  onPlayerHit(kind, position) {
    const color = kind === "guard" ? 0x7bd7ce : 0xd74f47;
    this.spawnPulse(position, color, kind === "guard" ? 1.35 : 1.8);
    if (this.player.dead) this.hud.showToast("용병이 쓰러졌습니다.", 4);
  }

  spawnPulse(position, color, maxScale = 1.8) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.52, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(position);
    mesh.position.y = 0.08;
    this.world.root.add(mesh);
    this.effects.push({ mesh, ttl: 0.48, total: 0.48, maxScale });
  }

  spawnTracer(start, end, color, duration = 0.28) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1 }));
    this.world.root.add(line);
    this.effects.push({ mesh: line, ttl: duration, total: duration, maxScale: 1 });
  }

  updateEffects(dt) {
    for (let index = this.effects.length - 1; index >= 0; index -= 1) {
      const effect = this.effects[index];
      effect.ttl -= dt;
      const progress = 1 - Math.max(0, effect.ttl) / effect.total;
      effect.mesh.material.opacity = 1 - progress;
      if (effect.mesh.geometry?.type === "RingGeometry") {
        const scale = 1 + progress * effect.maxScale;
        effect.mesh.scale.setScalar(scale);
      }
      if (effect.ttl <= 0) {
        this.world.root.remove(effect.mesh);
        effect.mesh.geometry?.dispose();
        effect.mesh.material?.dispose();
        this.effects.splice(index, 1);
      }
    }
  }

  updateCamera(dt) {
    const target = this.player.group.position;
    if (this.cameraMode === "thirdPerson") {
      const forward = new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      const head = target.clone().add(new THREE.Vector3(0, 1.5, 0));
      const desired = head.clone().addScaledVector(forward, -6.4).addScaledVector(right, 0.75).add(new THREE.Vector3(0, 2.55, 0));
      const lookAt = head.clone().addScaledVector(forward, 5.2).add(new THREE.Vector3(0, this.cameraPitch * 5.2, 0));
      this.camera.position.lerp(desired, 1 - Math.exp(-dt * 8.5));
      this.camera.lookAt(lookAt);
      return;
    }

    const desired = target.clone().add(new THREE.Vector3(13.5, 16.5, 15.5));
    this.camera.position.lerp(desired, 1 - Math.exp(-dt * 4.2));
    this.camera.lookAt(target.clone().add(new THREE.Vector3(0, 1.1, 0)));
  }

  snapCamera() {
    if (this.cameraMode === "thirdPerson") {
      const forward = new THREE.Vector3(Math.sin(this.cameraYaw), 0, Math.cos(this.cameraYaw));
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      const head = this.player.group.position.clone().add(new THREE.Vector3(0, 1.5, 0));
      this.camera.position.copy(head).addScaledVector(forward, -6.4).addScaledVector(right, 0.75).add(new THREE.Vector3(0, 2.55, 0));
      this.camera.lookAt(head.clone().addScaledVector(forward, 5.2).add(new THREE.Vector3(0, this.cameraPitch * 5.2, 0)));
      return;
    }

    this.camera.position.copy(this.player.group.position).add(new THREE.Vector3(13.5, 16.5, 15.5));
    this.camera.lookAt(this.player.group.position.clone().add(new THREE.Vector3(0, 1.1, 0)));
  }

  clampPlayer() {
    const limit = this.mode === "hub" ? 7.8 : 22;
    this.player.group.position.x = THREE.MathUtils.clamp(this.player.group.position.x, -limit, limit);
    this.player.group.position.z = THREE.MathUtils.clamp(this.player.group.position.z, this.mode === "hub" ? -6.2 : -23, this.mode === "hub" ? 6.5 : 22);
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
