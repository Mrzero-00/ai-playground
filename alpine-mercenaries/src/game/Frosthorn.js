import * as THREE from "three";

const tempDirection = new THREE.Vector3();

function material(color, roughness = 0.76, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}
function shadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function sectorGeometry(radius, halfAngle, segments = 28, innerRadius = 0) {
  const positions = [];
  for (let index = 0; index < segments; index += 1) {
    const a0 = -halfAngle + (index / segments) * halfAngle * 2;
    const a1 = -halfAngle + ((index + 1) / segments) * halfAngle * 2;
    const outer0 = [Math.sin(a0) * radius, 0, Math.cos(a0) * radius];
    const outer1 = [Math.sin(a1) * radius, 0, Math.cos(a1) * radius];
    const inner0 = [Math.sin(a0) * innerRadius, 0, Math.cos(a0) * innerRadius];
    const inner1 = [Math.sin(a1) * innerRadius, 0, Math.cos(a1) * innerRadius];
    positions.push(...inner0, ...outer0, ...outer1, ...inner0, ...outer1, ...inner1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export class Frosthorn {
  constructor(position, events) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.name = "FrosthornWyvern";
    this.events = events;
    this.maxHealth = 620;
    this.health = this.maxHealth;
    this.forward = new THREE.Vector3(0, 0, 1);
    this.state = "idle";
    this.stateTimer = 2.4;
    this.attackIndex = 0;
    this.damageTick = 0;
    this.dead = false;
    this.completed = false;
    this.bodyMeshes = [];
    this.animationTime = 0;

    const bodyMaterial = material(0x617b80, 0.88);
    const scaleMaterial = material(0x334d55, 0.62, 0.16);

    this.body = shadow(new THREE.Mesh(new THREE.SphereGeometry(1.75, 22, 14), bodyMaterial));
    this.body.scale.set(1.05, 0.82, 1.45);
    this.body.position.y = 1.85;
    this.body.userData.hitPart = "body";
    this.group.add(this.body);
    this.bodyMeshes.push(this.body);

    this.neck = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.55, 7, 12), bodyMaterial));
    this.neck.position.set(0, 2.35, 1.45);
    this.neck.rotation.x = Math.PI * 0.34;
    this.neck.userData.hitPart = "body";
    this.group.add(this.neck);
    this.bodyMeshes.push(this.neck);

    this.head = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.95, 1.75), bodyMaterial));
    this.head.position.set(0, 3.05, 2.45);
    this.head.userData.hitPart = "head";
    this.group.add(this.head);
    this.bodyMeshes.push(this.head);

    this.weakPoint = shadow(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.37, 18, 12),
        new THREE.MeshStandardMaterial({ color: 0x89e9ef, emissive: 0x2a8999, emissiveIntensity: 1.3, roughness: 0.25 }),
      ),
    );
    this.weakPoint.position.set(0, 2.75, 3.02);
    this.weakPoint.userData.hitPart = "frostCore";
    this.group.add(this.weakPoint);

    for (const x of [-0.42, 0.42]) {
      const horn = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.25, 10), material(0xe2dfce, 0.58)));
      horn.position.set(x, 3.82, 2.2);
      horn.rotation.x = -0.25;
      horn.rotation.z = x < 0 ? 0.2 : -0.2;
      this.group.add(horn);
    }

    this.wings = [];
    for (const side of [-1, 1]) {
      const wing = shadow(
        new THREE.Mesh(
          new THREE.ConeGeometry(1.65, 4.1, 3),
          new THREE.MeshStandardMaterial({ color: 0x435d65, side: THREE.DoubleSide, roughness: 0.8 }),
        ),
      );
      wing.position.set(side * 2.15, 2.55, 0.15);
      wing.rotation.set(Math.PI / 2, 0, side * -0.55);
      wing.scale.x = 0.55;
      wing.userData.hitPart = side < 0 ? "leftWing" : "rightWing";
      this.group.add(wing);
      this.bodyMeshes.push(wing);
      this.wings.push(wing);
    }

    for (const x of [-0.78, 0.78]) {
      const leg = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.18, 5, 9), scaleMaterial));
      leg.position.set(x, 0.74, 0.55);
      leg.userData.hitPart = "leg";
      this.group.add(leg);
      this.bodyMeshes.push(leg);
    }

    this.tail = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.55, 4.4, 10), scaleMaterial));
    this.tail.position.set(0, 1.6, -2.85);
    this.tail.rotation.x = -Math.PI / 2;
    this.tail.userData.hitPart = "tail";
    this.group.add(this.tail);
    this.bodyMeshes.push(this.tail);

    this.breathZone = new THREE.Mesh(
      sectorGeometry(13, 0.42, 36, 1.5),
      new THREE.MeshBasicMaterial({ color: 0x67d9ea, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.breathZone.position.y = 0.04;
    this.breathZone.visible = false;
    this.group.add(this.breathZone);

    this.sweepZone = new THREE.Mesh(
      sectorGeometry(6.6, Math.PI, 56, 1.3),
      new THREE.MeshBasicMaterial({ color: 0xc8473f, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.sweepZone.position.y = 0.05;
    this.sweepZone.visible = false;
    this.group.add(this.sweepZone);
  }

  update(dt, now, player, allies) {
    this.animationTime += dt;
    this.wings.forEach((wing, index) => {
      wing.rotation.z += Math.sin(this.animationTime * 1.8 + index) * dt * 0.025;
    });

    if (this.dead) {
      this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, Math.PI * 0.5, dt * 2.2);
      this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, -0.55, dt * 1.8);
      return;
    }

    if (this.state === "idle") {
      this.facePlayer(player.group.position, dt * 2.6);
      const distance = this.horizontalDistance(player.group.position);
      if (distance > 8.4) {
        this.group.position.addScaledVector(this.forward, dt * 1.35);
      }
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.beginNextAttack(player);
      return;
    }

    this.stateTimer -= dt;
    if (this.state === "breathTelegraph") {
      this.breathZone.material.opacity = 0.14 + Math.sin(this.animationTime * 13) * 0.04;
      if (this.stateTimer <= 0) {
        this.state = "breathActive";
        this.stateTimer = 2.25;
        this.damageTick = 0;
        this.breathZone.material.opacity = 0.42;
        this.events.message("브레스! 방패 뒤로 집결하십시오.");
      }
      return;
    }

    if (this.state === "breathActive") {
      this.damageTick -= dt;
      this.weakPoint.material.emissiveIntensity = 2 + Math.sin(this.animationTime * 18) * 0.8;
      if (this.damageTick <= 0) {
        this.damageTick = 0.28;
        this.resolveBreath(player, allies);
      }
      if (this.stateTimer <= 0) {
        this.weakPoint.material.emissiveIntensity = 1.3;
        this.endAttack(2.6);
      }
      return;
    }

    if (this.state === "sweepTelegraph" && this.stateTimer <= 0) {
      this.resolveSweep(now, player, allies);
      this.endAttack(3.1);
    }
  }

  beginNextAttack(player) {
    this.lockDirection(player.group.position);
    if (this.attackIndex % 2 === 0) {
      this.state = "breathTelegraph";
      this.stateTimer = 1.7;
      this.breathZone.visible = true;
      this.events.message("냉기 기관이 빛납니다 — 방패 방향을 맞추십시오.");
    } else {
      this.state = "sweepTelegraph";
      this.stateTimer = 1.35;
      this.sweepZone.visible = true;
      this.events.message("높은 횡베기 — 앉거나 완벽 쳐내기 [F]");
    }
    this.attackIndex += 1;
  }

  endAttack(cooldown) {
    this.state = "idle";
    this.stateTimer = cooldown;
    this.breathZone.visible = false;
    this.sweepZone.visible = false;
  }

  lockDirection(target) {
    tempDirection.subVectors(target, this.group.position).setY(0);
    if (tempDirection.lengthSq() > 0.01) this.forward.copy(tempDirection.normalize());
    this.group.rotation.y = Math.atan2(this.forward.x, this.forward.z);
  }

  facePlayer(target, amount) {
    tempDirection.subVectors(target, this.group.position).setY(0);
    if (tempDirection.lengthSq() < 0.01) return;
    tempDirection.normalize();
    this.forward.lerp(tempDirection, Math.min(1, amount)).normalize();
    this.group.rotation.y = Math.atan2(this.forward.x, this.forward.z);
  }

  resolveBreath(player, allies) {
    const source = this.group.position;
    if (this.isInsideCone(player.group.position, 13, 0.42)) {
      const blocked = player.takeDamage(8, source);
      this.events.playerHit(blocked ? "guard" : "breath", player.group.position);
    }

    allies.forEach((ally) => {
      if (ally.health <= 0 || !this.isInsideCone(ally.group.position, 13, 0.42)) return;
      if (player.protectsPoint(ally.group.position, source)) {
        ally.protectedTimer = 0.5;
        this.events.protected(ally.group.position, ally.name);
      } else {
        ally.health = Math.max(0, ally.health - 9);
        this.events.allyHit(ally.group.position);
      }
    });
  }

  resolveSweep(now, player, allies) {
    const source = this.group.position;
    const perfect = player.isPerfectParry(now, source) && this.horizontalDistance(player.group.position) <= 6.6;

    if (perfect) {
      this.takeDamage(44, "parry");
      this.events.deflect(player.group.position);
      this.stateTimer += 0.6;
    } else if (this.horizontalDistance(player.group.position) <= 6.6 && !player.crouching) {
      const blocked = player.takeDamage(28, source);
      this.events.playerHit(blocked ? "guard" : "sweep", player.group.position);
    } else if (player.crouching && this.horizontalDistance(player.group.position) <= 6.6) {
      this.events.evaded(player.group.position);
    }

    allies.forEach((ally) => {
      if (ally.health <= 0 || this.horizontalDistance(ally.group.position) > 6.6) return;
      const protectedByDeflect = perfect && player.protectsPoint(ally.group.position, source, true, now);
      if (protectedByDeflect) {
        this.events.protected(ally.group.position, ally.name);
      } else {
        ally.health = Math.max(0, ally.health - 24);
        this.events.allyHit(ally.group.position);
      }
    });
  }

  isInsideCone(position, range, halfAngle) {
    tempDirection.subVectors(position, this.group.position).setY(0);
    const distance = tempDirection.length();
    if (distance < 1.2 || distance > range) return false;
    tempDirection.normalize();
    return this.forward.dot(tempDirection) >= Math.cos(halfAngle);
  }

  horizontalDistance(position) {
    const dx = position.x - this.group.position.x;
    const dz = position.z - this.group.position.z;
    return Math.hypot(dx, dz);
  }

  takeDamage(amount, part = "body") {
    if (this.dead) return false;
    const multiplier = part === "frostCore" ? 1.85 : part === "head" ? 1.25 : 1;
    this.health = Math.max(0, this.health - amount * multiplier);
    if (part === "frostCore") {
      this.weakPoint.scale.setScalar(1.28);
      setTimeout(() => this.weakPoint?.scale.setScalar(1), 110);
    }
    if (this.health <= 0) {
      this.dead = true;
      this.breathZone.visible = false;
      this.sweepZone.visible = false;
      if (!this.completed) {
        this.completed = true;
        this.events.complete();
      }
    }
    return true;
  }

  getStateLabel() {
    if (this.dead) return "토벌 완료";
    if (this.state === "breathTelegraph") return "냉기 브레스 준비";
    if (this.state === "breathActive") return "냉기 브레스 방출";
    if (this.state === "sweepTelegraph") return "높은 횡베기 준비";
    return "다음 공격 탐색 중";
  }
}
