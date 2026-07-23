import * as THREE from "three";

const material = (color, roughness = 0.82, metalness = 0.04) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

function shadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function box(root, size, position, color, rotationY = 0) {
  const mesh = shadow(new THREE.Mesh(new THREE.BoxGeometry(...size), material(color)));
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  root.add(mesh);
  return mesh;
}

function cylinder(root, radiusTop, radiusBottom, height, position, color, sides = 12) {
  const mesh = shadow(
    new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides), material(color)),
  );
  mesh.position.set(...position);
  root.add(mesh);
  return mesh;
}

function obstacle(x, z, halfX, halfZ, height, vaultable = false) {
  return {
    minX: x - halfX,
    maxX: x + halfX,
    minZ: z - halfZ,
    maxZ: z + halfZ,
    height,
    vaultable,
  };
}

function createPine(root, x, z, scale = 1) {
  cylinder(root, 0.17 * scale, 0.26 * scale, 2.8 * scale, [x, 1.4 * scale, z], 0x604a32, 8);
  const needles = material(0x25483c, 1);
  for (let index = 0; index < 3; index += 1) {
    const crown = shadow(
      new THREE.Mesh(
        new THREE.ConeGeometry((1.2 - index * 0.18) * scale, 2.4 * scale, 10),
        needles,
      ),
    );
    crown.position.set(x, (2.5 + index * 0.85) * scale, z);
    root.add(crown);
  }
}

function createRock(root, x, z, scale = 1, color = 0x75817a) {
  const mesh = shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), material(color, 1)));
  mesh.position.set(x, scale * 0.62, z);
  mesh.scale.y = 0.68;
  mesh.rotation.set(0.2, x * 0.17, 0.1);
  root.add(mesh);
  return mesh;
}

export function createAlly(name, color, position) {
  const group = new THREE.Group();
  group.position.copy(position);

  const body = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 6, 10), material(color)));
  body.position.y = 1.1;
  group.add(body);

  const head = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), material(0xd7b596)));
  head.position.y = 2.02;
  group.add(head);

  const weapon = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.35), material(0x5d4a2d)));
  weapon.position.set(0.55, 1.2, 0.1);
  weapon.rotation.x = Math.PI * 0.5;
  group.add(weapon);

  group.traverse((child) => {
    if (child.isMesh) child.userData.ally = name;
  });

  return { name, group, health: 100, maxHealth: 100, protectedTimer: 0 };
}

export function createHubWorld() {
  const root = new THREE.Group();
  root.name = "MercenaryOffice";
  const obstacles = [];

  box(root, [18, 0.45, 15], [0, -0.23, 0], 0x5b4630);
  box(root, [18, 0.65, 0.6], [0, 0.32, -7.2], 0x62645e);
  box(root, [0.6, 0.65, 15], [-8.7, 0.32, 0], 0x62645e);
  box(root, [0.6, 0.65, 15], [8.7, 0.32, 0], 0x62645e);

  const wallMaterial = material(0x292f2b, 0.96);
  const backWall = shadow(new THREE.Mesh(new THREE.BoxGeometry(18, 4.5, 0.32), wallMaterial));
  backWall.position.set(0, 2.7, -7.35);
  root.add(backWall);

  for (const x of [-8, -4, 0, 4, 8]) {
    box(root, [0.34, 5.6, 0.34], [x, 2.8, -7.05], 0x493521);
  }

  for (const [x, z] of [[-8, -6], [8, -6], [-8, 6], [8, 6]]) {
    box(root, [0.45, 5.7, 0.45], [x, 2.85, z], 0x493521);
  }

  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 8),
    new THREE.MeshStandardMaterial({ color: 0x592e2e, roughness: 1 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.012;
  root.add(rug);

  const board = box(root, [5.6, 3.1, 0.28], [0, 2.0, -6.75], 0x654626);
  board.userData.contractBoard = true;
  for (let x = -2; x <= 2; x += 1) {
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 0.85), material(x === 0 ? 0xd9c394 : 0xb8aa89));
    note.position.set(x * 0.9, 2.05 + (Math.abs(x) % 2) * 0.2, -6.59);
    root.add(note);
  }
  const crest = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 3), material(0xb7964d, 0.45, 0.35)));
  crest.position.set(0, 4.05, -6.72);
  root.add(crest);

  box(root, [3.8, 0.25, 2.2], [-4.8, 1.15, -1.5], 0x654626);
  box(root, [0.25, 1.1, 0.25], [-6.35, 0.55, -2.25], 0x493521);
  box(root, [0.25, 1.1, 0.25], [-3.25, 0.55, -2.25], 0x493521);
  obstacles.push(obstacle(-4.8, -1.5, 2.15, 1.3, 1.35));

  box(root, [3.7, 0.3, 1.5], [5.2, 0.85, -2.3], 0x51402d);
  obstacles.push(obstacle(5.2, -2.3, 2.0, 0.95, 1.05));

  const fire = new THREE.PointLight(0xffa85c, 34, 13, 2);
  fire.position.set(5.8, 2.3, 3.2);
  root.add(fire);
  cylinder(root, 0.6, 0.75, 0.25, [5.8, 0.12, 3.2], 0x353733, 12);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 1.1, 10),
    new THREE.MeshBasicMaterial({ color: 0xff873c, transparent: true, opacity: 0.8 }),
  );
  flame.position.set(5.8, 0.75, 3.2);
  root.add(flame);

  return {
    root,
    obstacles,
    boardPosition: new THREE.Vector3(0, 0, -5.5),
    spawn: new THREE.Vector3(0, 0, 3.8),
    allies: [],
  };
}

export function createMissionWorld() {
  const root = new THREE.Group();
  root.name = "FrostMonasteryPass";
  const obstacles = [];

  const ground = shadow(new THREE.Mesh(new THREE.PlaneGeometry(70, 70), material(0x506f54, 1)));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  root.add(ground);

  const path = new THREE.Mesh(new THREE.PlaneGeometry(10, 38), material(0x7f8071, 1));
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.006, -4);
  root.add(path);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 55),
    new THREE.MeshPhysicalMaterial({ color: 0x3e8d87, roughness: 0.22, transmission: 0.08, transparent: true, opacity: 0.78 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(20, -0.18, 0);
  root.add(water);

  const treePositions = [
    [-11, -18, 1.2], [-14, -10, 1.4], [-10, 2, 1], [-14, 10, 1.35], [-8, 17, 1.15],
    [10, -20, 1.3], [13, -13, 1.15], [11, 5, 1.4], [14, 13, 1.2], [9, 20, 1.05],
  ];
  treePositions.forEach(([x, z, scale]) => createPine(root, x, z, scale));

  for (const [x, z, scale] of [[-6, -13, 1.1], [7, -8, 0.8], [-7, 8, 1.3], [6, 13, 1], [9, -22, 1.5]]) {
    createRock(root, x, z, scale);
  }

  const log = cylinder(root, 0.55, 0.62, 4.7, [4.5, 0.56, 3.2], 0x5a4027, 9);
  log.rotation.z = Math.PI / 2;
  log.rotation.y = 0.12;
  obstacles.push(obstacle(4.5, 3.2, 2.65, 0.72, 1.15, true));

  box(root, [3.2, 1.2, 0.8], [-4.8, 0.6, -1.5], 0x858b84, 0.08);
  obstacles.push(obstacle(-4.8, -1.5, 1.8, 0.7, 1.25, true));

  for (const x of [-4.8, 4.8]) {
    box(root, [1.1, 5.5, 1.1], [x, 2.75, -24], 0x6b706e);
  }
  box(root, [11, 1.1, 1.2], [0, 4.6, -24], 0x606561);

  const snowMaterial = material(0xdbe4df, 1);
  for (const [x, z, scale] of [[-24, -28, 8], [-13, -34, 11], [4, -38, 13], [23, -31, 9], [31, -18, 7]]) {
    const mountain = shadow(new THREE.Mesh(new THREE.ConeGeometry(scale, scale * 1.45, 7), snowMaterial));
    mountain.position.set(x, scale * 0.65 - 0.2, z);
    root.add(mountain);
  }

  const allies = [
    createAlly("정찰병 리아", 0x496f74, new THREE.Vector3(-1.4, 0, 4.4)),
    createAlly("의무관 테오", 0x75644c, new THREE.Vector3(1.5, 0, 5.2)),
  ];
  allies.forEach((ally) => root.add(ally.group));

  return {
    root,
    obstacles,
    boardPosition: null,
    spawn: new THREE.Vector3(0, 0, 1.2),
    bossSpawn: new THREE.Vector3(0, 0, -11.5),
    allies,
  };
}
