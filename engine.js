import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// ================== CONFIGURAÇÕES ==================
const CHUNK_SIZE = 16;
const RENDER_DISTANCE = 2;

// ================== SETUP ==================
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 40, 80);
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(50, 100, 50);
scene.add(dirLight);

// ================== TEXTURAS ==================
function createTexture(baseColor, noiseColor, type) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const ctx = c.getContext('2d');
  
  ctx.fillStyle = baseColor; 
  ctx.fillRect(0, 0, 16, 16);

  ctx.fillStyle = noiseColor;
  for (let i = 0; i < 60; i++) {
    ctx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
  }

  if (type === 'wood') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(3, 0, 2, 16);
    ctx.fillRect(10, 0, 2, 16);
    ctx.fillStyle = '#2b1d14';
    ctx.fillRect(5, 8, 3, 2);
    ctx.fillRect(12, 3, 2, 2);
  } 
  else if (type === 'leaves') {
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.2)';
      ctx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
    }
  }
  else if (type === 'stone') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(2, 4, 4, 1);
    ctx.fillRect(8, 12, 5, 1);
    ctx.fillRect(5, 6, 1, 5);
  }
  else if (type === 'cactus') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(4, 0, 1, 16);
    ctx.fillRect(11, 0, 1, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(2, 3, 1, 1);
    ctx.fillRect(13, 7, 1, 1);
    ctx.fillRect(5, 12, 1, 1);
    ctx.fillRect(9, 5, 1, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; 
  return tex;
}

// Lê o bioma escolhido
const worldConfig = JSON.parse(localStorage.getItem('worldConfig')) || {};
const CURRENT_BIOME = worldConfig.biome || 'plains';

// Define as cores da grama baseado no bioma
let grassTopColor = '#5ca845';
let grassSideNoise = '#4a8c38'; 
if (CURRENT_BIOME === 'snow') { grassTopColor = '#e8f4f8'; grassSideNoise = '#c0d0d8'; }
if (CURRENT_BIOME === 'desert') { grassTopColor = '#d9c27e'; grassSideNoise = '#c2ab66'; }
if (CURRENT_BIOME === 'savanna') { grassTopColor = '#b8c25a'; grassSideNoise = '#98a23a'; }

export const textures = {
  grass_top: createTexture(grassTopColor, grassSideNoise, 'grass_top'),
  grass_side: createTexture(grassTopColor, grassSideNoise, 'grass_side'),
  dirt: createTexture('#7a5c3a', '#5e4429', 'dirt'),
  stone: createTexture('#888888', '#666666', 'stone'),
  wood: createTexture('#4a3b2a', '#362a1d', 'wood'), 
  leaves: createTexture('#2d6e28', '#1f4f1b', 'leaves'), 
  sand: createTexture('#d9c27e', '#c2ab66', 'sand'), 
  water: createTexture('#3a79bd', '#2a5c96', 'water'),
  cactus: createTexture('#2d6e28', '#1f4f1b', 'cactus')
};

export const materials = {
  grass: [
    new THREE.MeshLambertMaterial({ map: textures.grass_side }),
    new THREE.MeshLambertMaterial({ map: textures.grass_side }),
    new THREE.MeshLambertMaterial({ map: textures.grass_top }),
    new THREE.MeshLambertMaterial({ map: textures.dirt }),
    new THREE.MeshLambertMaterial({ map: textures.grass_side }),
    new THREE.MeshLambertMaterial({ map: textures.grass_side }),
  ],
  dirt: new THREE.MeshLambertMaterial({ map: textures.dirt }),
  stone: new THREE.MeshLambertMaterial({ map: textures.stone }),
  wood: new THREE.MeshLambertMaterial({ map: textures.wood }),
  leaves: new THREE.MeshLambertMaterial({ map: textures.leaves }),
  sand: new THREE.MeshLambertMaterial({ map: textures.sand }),
  water: new THREE.MeshLambertMaterial({ map: textures.water, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
  snowBlock: new THREE.MeshLambertMaterial({ map: createTexture('#f0f0f0', '#d0d0d0', 'snow') }),
  cactus: new THREE.MeshLambertMaterial({ map: textures.cactus })
};

// ================== SISTEMA DE SAVE/LOAD ==================
export const changesToSave = []; 
const loadTarget = localStorage.getItem('loadTarget');
let finalConfig = worldConfig;

if (loadTarget) {
  const savedData = localStorage.getItem(`world_${loadTarget}`);
  if (savedData) {
    const parsed = JSON.parse(savedData);
    finalConfig = parsed.config;
    finalConfig.changes = parsed.changes; 
    finalConfig.playerPos = parsed.playerPos;
    localStorage.setItem('worldConfig', JSON.stringify(finalConfig));
    localStorage.removeItem('loadTarget'); 
  } else {
    alert("Mundo não encontrado! Um novo mundo será criado.");
    localStorage.removeItem('loadTarget');
  }
}

const SEED_VALUE = hashSeed(finalConfig.seed || '0');

function hashSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = (hash << 5) - hash + str.charCodeAt(i); hash |= 0; }
  return Math.abs(hash);
}

// ================== MUNDO ==================
export const worldGroup = new THREE.Group();
scene.add(worldGroup);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
export const loadedChunks = new Map();

export function getHeight(x, z) {
  let flatness = 1; 
  if (CURRENT_BIOME === 'desert') flatness = 0.5;
  if (CURRENT_BIOME === 'savanna') flatness = 0.6;

  const nx = (x * 0.05) + (SEED_VALUE % 1000); 
  const nz = (z * 0.05) + (SEED_VALUE % 1000);
  let h = (Math.sin(nx) * 2 + Math.cos(nz) * 2 + Math.sin((nx + nz) * 1.5) * 1.5) * flatness;
  h = Math.floor(4 + h);
  return Math.max(1, Math.min(12, h));
}

function getWaterLevel(x, z, currentHeight) {
  if (CURRENT_BIOME === 'desert' || CURRENT_BIOME === 'snow' || CURRENT_BIOME === 'savanna') return -1;
  if (currentHeight > 4) return -1;

  const nx = (x * 0.03) + (SEED_VALUE % 500); 
  const nz = (z * 0.03) + (SEED_VALUE % 500);
  const riverNoise = Math.sin(nx) + Math.cos(nz);
  if (riverNoise > -0.1 && riverNoise < 0.1) {
    const waterLevel = 4; 
    if (currentHeight < waterLevel) return waterLevel;
  }
  return -1; 
}

export function generateTree(worldX, worldY, worldZ) {
  if (CURRENT_BIOME === 'desert') {
    const cactusHeight = 3 + Math.floor(Math.random() * 2);
    for (let y = 0; y < cactusHeight; y++) {
      const cactus = new THREE.Mesh(boxGeo, materials.cactus);
      cactus.position.set(worldX, worldY + y, worldZ);
      worldGroup.add(cactus);
    }
  } else {
    let trunkHeight = 4 + Math.floor(Math.random() * 3);
    if (CURRENT_BIOME === 'savanna') trunkHeight = 5 + Math.floor(Math.random() * 3);

    for (let y = 0; y < trunkHeight; y++) {
      const wood = new THREE.Mesh(boxGeo, materials.wood);
      wood.position.set(worldX, worldY + y, worldZ);
      worldGroup.add(wood);
    }
    const leafStartY = worldY + trunkHeight - 1;
    const leafMat = CURRENT_BIOME === 'snow' ? materials.snowBlock : materials.leaves;

    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        for (let y = 0; y <= 2; y++) {
          const dist = Math.sqrt(x*x + z*z);
          if (CURRENT_BIOME === 'savanna' && y === 2) continue;
          if (dist > 2 || (dist === 2 && Math.random() > 0.6) || (y === 2 && (x !== 0 || z !== 0)) || (x === 0 && z === 0 && y < 2)) continue;
          const leaf = new THREE.Mesh(boxGeo, leafMat);
          leaf.position.set(worldX + x, leafStartY + y, worldZ + z);
          worldGroup.add(leaf);
        }
      }
    }
  }
}

function generateChunk(cx, cz) {
  const key = `${cx},${cz}`;
  if (loadedChunks.has(key)) return;
  const chunkGroup = new THREE.Group();

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const wx = cx * CHUNK_SIZE + x;
      const wz = cz * CHUNK_SIZE + z;
      let h = getHeight(wx, wz);
      
      const savedChange = finalConfig.changes?.find(c => c.x === wx && c.z === wz);

      if (savedChange && savedChange.type === 'removed') {
        // Bloco quebrado
      } else {
        const waterY = getWaterLevel(wx, wz, h);
        const isRiver = waterY !== -1;

        if (isRiver) {
          const sandBlock = new THREE.Mesh(boxGeo, materials.sand);
          sandBlock.position.set(wx, h, wz);
          chunkGroup.add(sandBlock);
          const waterBlock = new THREE.Mesh(boxGeo, materials.water);
          waterBlock.position.set(wx, waterY, wz); 
          waterBlock.scale.y = (waterY - h) + 1; 
          chunkGroup.add(waterBlock);
          h = waterY; 
        } else {
          let topMat = materials.grass;
          if (CURRENT_BIOME === 'desert') topMat = materials.sand;
          if (CURRENT_BIOME === 'snow') topMat = materials.snowBlock;

          const top = new THREE.Mesh(boxGeo, topMat);
          top.position.set(wx, h, wz);
          chunkGroup.add(top);
        }

        for (let y = h - 1; y >= h - 2; y--) {
          const b = new THREE.Mesh(boxGeo, materials.dirt);
          b.position.set(wx, y, wz);
          chunkGroup.add(b);
        }

        const hR = getHeight(wx + 1, wz), hL = getHeight(wx - 1, wz), hF = getHeight(wx, wz + 1), hB = getHeight(wx, wz - 1);
        const isExposed = (h > hR || h > hL || h > hF || h > hB);

        if (isExposed) {
          for (let y = h - 3; y >= h - 15; y--) {
            const b = new THREE.Mesh(boxGeo, materials.stone);
            b.position.set(wx, y, wz);
            chunkGroup.add(b);
          }
        }

        if (!isRiver) {
          const treeSeed = Math.sin(wx * 12.9898 + wz * 78.233) * 43758.5453;
          let treeChance = 0.04;
          if (CURRENT_BIOME === 'desert') treeChance = 0.01; 
          if (CURRENT_BIOME === 'snow') treeChance = 0.02;
          if (CURRENT_BIOME === 'savanna') treeChance = 0.015;

          if (treeSeed - Math.floor(treeSeed) < treeChance) {
            if (Math.abs(h - hR) <= 1 && Math.abs(h - hL) <= 1 && Math.abs(h - hF) <= 1 && Math.abs(h - hB) <= 1) {
              generateTree(wx, h + 1, wz);
            }
          }
        }
      }

      if (savedChange && savedChange.type === 'added') {
        const newBlock = new THREE.Mesh(boxGeo, materials[savedChange.blockType]);
        newBlock.position.set(savedChange.x, savedChange.y, savedChange.z);
        chunkGroup.add(newBlock);
      }
    }
  }
  worldGroup.add(chunkGroup);
  loadedChunks.set(key, chunkGroup);
}

export function updateChunks(px, pz) {
  const cx = Math.floor(px / CHUNK_SIZE);
  const cz = Math.floor(pz / CHUNK_SIZE);
  for (let i = -RENDER_DISTANCE; i <= RENDER_DISTANCE; i++)
    for (let j = -RENDER_DISTANCE; j <= RENDER_DISTANCE; j++)
      generateChunk(cx + i, cz + j);

  loadedChunks.forEach((chunk, key) => {
    const [ccx, ccz] = key.split(',').map(Number);
    if (Math.abs(ccx - cx) > RENDER_DISTANCE + 1 || Math.abs(ccz - cz) > RENDER_DISTANCE + 1) {
      worldGroup.remove(chunk);
      loadedChunks.delete(key);
    }
  });
}

// ================== PARTÍCULAS ==================
const activeParticles = [];
const particleGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);

export function spawnWaterParticles(x, y, z, surfaceY) {
  const particleMat = new THREE.MeshLambertMaterial({ color: 0x87CEEB, transparent: true }); 
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(particleGeo, particleMat.clone()); 
    p.position.set(x + (Math.random() - 0.5) * 0.8, surfaceY + 0.2, z + (Math.random() - 0.5) * 0.8);
    p.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 3, (Math.random() - 0.5) * 4);
    scene.add(p);
    activeParticles.push(p);
  }
}

function updateParticles(dt) {
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const p = activeParticles[i];
    p.userData.velocity.y -= 20 * dt; 
    p.position.addScaledVector(p.userData.velocity, dt);
    p.material.opacity -= dt * 1.5;
    if (p.material.opacity <= 0) { scene.remove(p); activeParticles.splice(i, 1); }
  }
}

// ================== VACAS ==================
const allCows = [];

export function spawnCow(x, z) {
  const cowGroup = new THREE.Group();
  const matBrown = new THREE.MeshLambertMaterial({ color: 0x3b2b20 });
  const matWhite = new THREE.MeshLambertMaterial({ color: 0xa8a8a8 });
  const matPink = new THREE.MeshLambertMaterial({ color: 0xd18b8b });
  const matBlack = new THREE.MeshLambertMaterial({ color: 0x111111 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 1.8), matBrown);
  body.position.set(0, 1.2, 0); cowGroup.add(body);

  const spot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.4), matWhite);
  spot.position.set(0, 1.3, 0.5); cowGroup.add(spot);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), matBrown);
  head.position.set(0, 1.5, -1.2); cowGroup.add(head);

  const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), matBlack);
  eyeL.position.set(-0.25, 1.65, -1.65); cowGroup.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.1), matBlack);
  eyeR.position.set(0.25, 1.65, -1.65); cowGroup.add(eyeR);

  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.2), matPink);
  snout.position.set(0, 1.3, -1.6); cowGroup.add(snout);

  const hornL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), matWhite);
  hornL.position.set(-0.4, 1.9, -1.2); cowGroup.add(hornL);
  const hornR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), matWhite);
  hornR.position.set(0.4, 1.9, -1.2); cowGroup.add(hornR);

  const legGeo = new THREE.BoxGeometry(0.3, 1, 0.3);
  const legPositions = [[-0.4, 0.5, -0.6], [0.4, 0.5, -0.6], [-0.4, 0.5, 0.6],  [0.4, 0.5, 0.6]];
  const legs = [];
  legPositions.forEach(pos => { const leg = new THREE.Mesh(legGeo, matBrown); leg.position.set(...pos); cowGroup.add(leg); legs.push(leg); });

  cowGroup.position.set(x, getHeight(Math.round(x), Math.round(z)), z);
  cowGroup.rotation.y = Math.random() * Math.PI * 2;
  scene.add(cowGroup);
  
  return { mesh: cowGroup, legs: legs, walkTimer: 0, idleTimer: Math.random() * 3, isWalking: false, walkDir: new THREE.Vector3(), legSwing: 0 };
}

export function populateWorldWithCows(playerX, playerZ) {
  let cowCount = 5;
  if (CURRENT_BIOME === 'desert') cowCount = 2;
  if (CURRENT_BIOME === 'savanna') cowCount = 8;

  for (let i = 0; i < cowCount; i++) {
    const offsetX = (Math.random() - 0.5) * 30;
    const offsetZ = (Math.random() - 0.5) * 30;
    allCows.push(spawnCow(playerX + offsetX, playerZ + offsetZ));
  }
}

export function updateCows(dt, playerPos) {
  allCows.forEach(cow => {
    const dist = cow.mesh.position.distanceTo(playerPos);
    if (dist < 4.0) {
      cow.isWalking = false; cow.legSwing = 0;
      const angle = Math.atan2(playerPos.x - cow.mesh.position.x, playerPos.z - cow.mesh.position.z);
      let diff = angle - cow.mesh.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      cow.mesh.rotation.y += diff * 5 * dt;
    } else {
      if (cow.isWalking) {
        cow.walkTimer -= dt;
        cow.mesh.position.x -= cow.walkDir.x * 1.5 * dt;
        cow.mesh.position.z -= cow.walkDir.z * 1.5 * dt;
        cow.mesh.position.y = getHeight(Math.round(cow.mesh.position.x), Math.round(cow.mesh.position.z));
        cow.legSwing += 1.5 * dt * 4;
        cow.legs[0].rotation.x = Math.sin(cow.legSwing) * 0.5;
        cow.legs[1].rotation.x = -Math.sin(cow.legSwing) * 0.5;
        cow.legs[2].rotation.x = -Math.sin(cow.legSwing) * 0.5;
        cow.legs[3].rotation.x = Math.sin(cow.legSwing) * 0.5;
        if (cow.walkTimer <= 0) { cow.isWalking = false; cow.idleTimer = Math.random() * 3 + 1; cow.legs.forEach(l => l.rotation.x = 0); }
      } else {
        cow.idleTimer -= dt;
        if (cow.idleTimer <= 0) {
          cow.isWalking = true; cow.walkTimer = Math.random() * 2 + 1; 
          const angle = Math.random() * Math.PI * 2;
          cow.walkDir.set(Math.sin(angle), 0, Math.cos(angle));
          cow.mesh.rotation.y = angle + Math.PI; 
        }
      }
    }
  });
}

// ================== SALVAR O JOGO ==================
export function saveWorld(playerPos) {
  const name = finalConfig.name;
  const saveData = {
    config: {
      name: finalConfig.name,
      seed: finalConfig.seed,
      gamemode: finalConfig.gamemode,
      difficulty: finalConfig.difficulty,
      cheats: finalConfig.cheats,
      biome: finalConfig.biome 
    },
    changes: window.changesToSave || [], 
    playerPos: { x: playerPos.x, y: playerPos.y, z: playerPos.z }
  };

  localStorage.setItem(`world_${name}`, JSON.stringify(saveData));
  alert(`Mundo "${name}" salvo com sucesso!`);
}

export const environment = { scene, camera, renderer, boxGeo, getWaterLevel };

// ================== INICIALIZAÇÃO ==================
updateChunks(0, 0);
populateWorldWithCows(0, 0);

let lastRenderTime = performance.now();
function render() {
  requestAnimationFrame(render);
  const now = performance.now();
  const dt = Math.min((now - lastRenderTime) / 1000, 0.1);
  lastRenderTime = now;
  updateParticles(dt); 
  renderer.render(scene, camera);
}
render();

setTimeout(() => { document.dispatchEvent(new Event('engineReady')); }, 500); 

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});