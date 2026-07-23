import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);
const tempForward = new THREE.Vector3();
const tempRight = new THREE.Vector3();
const tempMove = new THREE.Vector3();

function material(color, roughness = 0.7, metalness = 0.1) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function setShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export class Player {
  constructor(position) {
    this.group = new THREE.Group();
    this.group.position.copy(position);
    this.group.name = "Player";
    this.maxHealth = 100;
    this.health = 100;
    this.maxStamina = 100;
    this.stamina = 100;
    this.weapon = "shield";
    this.aiming = false;
    this.guarding = false;
    this.crouching = false;
    this.grounded = true;
    this.heightOffset = 0;
    this.verticalVelocity = 0;
    this.forward = new THREE.Vector3(0, 0, -1);
    this.attackCooldown = 0;
    this.attackRequested = false;
    this.parryUntil = 0;
    this.parkour = null;
    this.dead = false;

    this.visual = new THREE.Group();
    this.group.add(this.visual);

    const legs = setShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.72, 5, 10), material(0x252c2b)));
    legs.position.y = 0.74;
    this.visual.add(legs);

    const torso = setShadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.82, 6, 12), material(0x344c48, 0.78, 0.18)));
    torso.position.y = 1.47;
    this.visual.add(torso);

    const armor = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.56, 0.5), material(0x61736d, 0.4, 0.5)));
    armor.position.set(0, 1.55, 0.06);
    this.visual.add(armor);

    const head = setShadow(new THREE.Mesh(new THREE.SphereGeometry(0.31, 18, 12), material(0xd2aa8c)));
    head.position.y = 2.25;
    this.visual.add(head);

    const hair = setShadow(new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 9, 0, Math.PI * 2, 0, Math.PI * 0.52), material(0x2b211b)));
    hair.position.y = 2.31;
    this.visual.add(hair);

    this.shield = setShadow(new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.65, 0.16), material(0x465c60, 0.35, 0.65)));
    this.shield.position.set(-0.18, 1.25, 0.83);
    this.shield.rotation.x = -0.08;
    this.visual.add(this.shield);

    const rim = new THREE.LineSegments(
      new THREE.EdgesGeometry(this.shield.geometry),
      new THREE.LineBasicMaterial({ color: 0xd0b46d }),
    );
    this.shield.add(rim);

    this.sword = setShadow(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 1.5), material(0xc1c7c4, 0.23, 0.78)));
    this.sword.position.set(0.62, 1.2, 0.58);
    this.sword.rotation.x = -0.22;
    this.visual.add(this.sword);

    this.bow = new THREE.Group();
    const bowArc = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.045, 7, 24, Math.PI),
      material(0x6f4325, 0.82),
    );
    bowArc.rotation.set(0, Math.PI / 2, Math.PI / 2);
    this.bow.add(bowArc);
    const string = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.72, 0), new THREE.Vector3(0, 0.72, 0)]),
      new THREE.LineBasicMaterial({ color: 0xd7d2bb }),
    );
    this.bow.add(string);
    this.bow.position.set(0.55, 1.25, 0.42);
    this.bow.visible = false;
    this.visual.add(this.bow);

    this.guardAura = new THREE.Mesh(
      new THREE.CircleGeometry(3.8, 28, Math.PI * 0.32, Math.PI * 0.36),
      new THREE.MeshBasicMaterial({ color: 0x70c8c2, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.guardAura.rotation.x = -Math.PI / 2;
    this.guardAura.rotation.z = Math.PI * 0.66;
    this.guardAura.position.set(0, 0.025, -0.25);
    this.guardAura.visible = false;
    this.group.add(this.guardAura);
  }

  setWeapon(weapon) {
    if (this.weapon === weapon) return false;
    this.weapon = weapon;
    const shield = weapon === "shield";
    this.shield.visible = shield;
    this.sword.visible = shield;
    this.bow.visible = !shield;
    this.guarding = false;
    this.aiming = false;
    return true;
  }

  update(dt, now, input, camera, mouseTarget, obstacles) {
    this.attackRequested = false;
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    if (input.wasPressed("Digit1")) this.setWeapon("shield");
    if (input.wasPressed("Digit2")) this.setWeapon("bow");

    this.guarding = !this.dead && this.weapon === "shield" && input.mouse.right;
    this.aiming = !this.dead && this.weapon === "bow" && input.mouse.right;
    this.guardAura.visible = this.guarding;
    this.shield.position.z = this.guarding ? 1.02 : 0.83;

    if (this.guarding && input.wasPressed("KeyF")) {
      this.parryUntil = now + 0.42;
    }

    if (!this.dead && input.mouse.leftPressed && this.attackCooldown <= 0) {
      this.attackRequested = true;
      this.attackCooldown = this.weapon === "bow" ? 0.58 : 0.46;
    }

    if (mouseTarget) {
      tempForward.subVectors(mouseTarget, this.group.position).setY(0);
      if (tempForward.lengthSq() > 0.05) {
        this.forward.copy(tempForward.normalize());
        this.group.rotation.y = Math.atan2(this.forward.x, this.forward.z);
      }
    }

    if (this.dead) {
      this.visual.rotation.z = THREE.MathUtils.lerp(this.visual.rotation.z, Math.PI * 0.48, dt * 5);
      return;
    }

    this.crouching = input.isDown("ControlLeft") || input.isDown("ControlRight");
    const targetScale = this.crouching ? 0.68 : 1;
    this.visual.scale.y = THREE.MathUtils.lerp(this.visual.scale.y, targetScale, dt * 12);

    if (this.parkour) {
      this.updateParkour(dt);
      return;
    }

    camera.getWorldDirection(tempForward).setY(0).normalize();
    tempRight.crossVectors(tempForward, UP).normalize();
    tempMove.set(0, 0, 0);
    if (input.isDown("KeyW")) tempMove.add(tempForward);
    if (input.isDown("KeyS")) tempMove.sub(tempForward);
    if (input.isDown("KeyD")) tempMove.add(tempRight);
    if (input.isDown("KeyA")) tempMove.sub(tempRight);
    if (tempMove.lengthSq() > 0) tempMove.normalize();

    if (input.wasPressed("Space") && this.grounded) {
      if (!this.tryVault(tempMove, obstacles)) {
        this.verticalVelocity = 7.1;
        this.grounded = false;
      }
    }

    const sprinting = input.isDown("ShiftLeft") && tempMove.lengthSq() > 0 && !this.crouching && this.stamina > 1;
    let speed = this.crouching ? 2.35 : sprinting ? 7.6 : 4.35;
    if (this.guarding) speed *= 0.42;
    if (this.aiming) speed *= 0.58;

    if (sprinting) this.stamina = Math.max(0, this.stamina - dt * 22);
    else this.stamina = Math.min(this.maxStamina, this.stamina + dt * 15);

    const next = this.group.position.clone().addScaledVector(tempMove, speed * dt);
    if (this.heightOffset > 1.2 || this.canOccupy(next, obstacles)) {
      this.group.position.x = next.x;
      this.group.position.z = next.z;
    }

    if (!this.grounded) {
      this.verticalVelocity -= 18.5 * dt;
      this.heightOffset += this.verticalVelocity * dt;
      if (this.heightOffset <= 0) {
        this.heightOffset = 0;
        this.verticalVelocity = 0;
        this.grounded = true;
      }
    }
    this.group.position.y = this.heightOffset;
  }

  tryVault(direction, obstacles) {
    if (direction.lengthSq() < 0.1) return false;
    const probe = this.group.position.clone().addScaledVector(direction, 1.25);
    const target = obstacles.find(
      (item) => item.vaultable && probe.x >= item.minX && probe.x <= item.maxX && probe.z >= item.minZ && probe.z <= item.maxZ,
    );
    if (!target) return false;

    this.parkour = {
      elapsed: 0,
      duration: 0.62,
      start: this.group.position.clone(),
      end: this.group.position.clone().addScaledVector(direction, 3.4),
      height: target.height + 0.8,
    };
    return true;
  }

  updateParkour(dt) {
    this.parkour.elapsed += dt;
    const t = Math.min(1, this.parkour.elapsed / this.parkour.duration);
    this.group.position.lerpVectors(this.parkour.start, this.parkour.end, t);
    this.group.position.y = Math.sin(t * Math.PI) * this.parkour.height;
    if (t >= 1) {
      this.group.position.y = 0;
      this.heightOffset = 0;
      this.grounded = true;
      this.parkour = null;
    }
  }

  canOccupy(position, obstacles) {
    const radius = 0.48;
    return !obstacles.some(
      (item) =>
        position.x + radius > item.minX &&
        position.x - radius < item.maxX &&
        position.z + radius > item.minZ &&
        position.z - radius < item.maxZ &&
        item.height > this.heightOffset,
    );
  }

  isFacing(point, cosine = 0.48) {
    tempForward.subVectors(point, this.group.position).setY(0).normalize();
    return this.forward.dot(tempForward) >= cosine;
  }

  isGuardingAgainst(source) {
    return this.guarding && this.isFacing(source, 0.42);
  }

  isPerfectParry(now, source) {
    return this.isGuardingAgainst(source) && now <= this.parryUntil;
  }

  protectsPoint(point, source, requirePerfect = false, now = 0) {
    if (!this.isGuardingAgainst(source)) return false;
    if (requirePerfect && !this.isPerfectParry(now, source)) return false;

    const source2 = new THREE.Vector2(source.x, source.z);
    const target2 = new THREE.Vector2(point.x, point.z);
    const shield2 = new THREE.Vector2(this.group.position.x, this.group.position.z);
    const segment = target2.clone().sub(source2);
    const lengthSq = segment.lengthSq();
    if (lengthSq < 0.01) return false;
    const t = shield2.clone().sub(source2).dot(segment) / lengthSq;
    if (t <= 0.08 || t >= 0.94) return false;
    const closest = source2.add(segment.multiplyScalar(t));
    return closest.distanceTo(shield2) <= 1.35;
  }

  takeDamage(amount, source) {
    if (this.dead) return false;
    const blocked = source && this.isGuardingAgainst(source);
    const finalDamage = blocked ? amount * 0.08 : amount;
    if (blocked) this.stamina = Math.max(0, this.stamina - amount * 0.7);
    this.health = Math.max(0, this.health - finalDamage);
    if (this.health <= 0) this.dead = true;
    return blocked;
  }

  reset(position) {
    this.group.position.copy(position);
    this.health = this.maxHealth;
    this.stamina = this.maxStamina;
    this.heightOffset = 0;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.dead = false;
    this.visual.rotation.z = 0;
  }
}
