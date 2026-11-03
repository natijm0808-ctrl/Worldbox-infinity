import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { environment, materials, textures, worldGroup, loadedChunks, getHeight, updateChunks, spawnWaterParticles, updateCows, spawnCow, saveWorld } from './engine.js';

const { scene, camera, renderer, boxGeo, getWaterLevel } = environment;

// ================== CONFIGURAÇÕES E SAVE INICIAL ==================
const config = JSON.parse(localStorage.getItem('worldConfig')) || {};
const isCreative = config.gamemode === 'creative';
const isSurvival = config.gamemode === 'survival';

const savedPos = config.playerPos || { x: 0, y: getHeight(0, 0) + 5, z: 0 };

const player = {
  pos: new THREE.Vector3(savedPos.x, savedPos.y, savedPos.z),
  velocity: new THREE.Vector3(),
  yaw: 0, pitch: 0,
  speed: 6, gravity: 25, jumpForce: 8,
  canJump: false, inWater: false,
  isFlying: false, health: 20, air: 10     
};

const joyLeft = { active: false, id: null, x: 0, y: 0 };
const joyRight = { active: false, id: null, x: 0, y: 0 };
const coordsText = document.getElementById('coords');
let lastCoordsUpdate = 0;

const statusBars = document.getElementById('status-bars');
const bubbleRow = document.getElementById('bubble-row');
const heartsContainer = document.getElementById('hearts');
const bubblesContainer = document.getElementById('bubbles');

if (isSurvival) {
  statusBars.style.display = 'flex';
  for (let i = 0; i < 10; i++) {
    heartsContainer.innerHTML += '❤️';
    bubblesContainer.innerHTML += '🫧';
  }
} else {
  statusBars.style.display = 'none';
}

function updateHealthUI() {
  if (!isSurvival) return;
  let hearts = '';
  for (let i = 0; i < 10; i++) hearts += (i < Math.ceil(player.health / 2)) ? '❤️' : '🖤';
  heartsContainer.innerHTML = hearts;
}

function updateAirUI() {
  if (!isSurvival) return;
  if (player.inWater) {
    bubbleRow.style.display = 'flex';
    let bubbles = '';
    for (let i = 0; i < 10; i++) bubbles += (i < Math.ceil(player.air)) ? '🫧' : '⚫';
    bubblesContainer.innerHTML = bubbles;
  } else {
    bubbleRow.style.display = 'none';
  }
}

// ================== CONTROLES MOBILE ==================
function updateStickVisual(el, x, y) {
  const maxDist = 40, dist = Math.hypot(x, y), angle = Math.atan2(y, x);
  el.style.transform = `translate(${Math.cos(angle) * Math.min(dist, maxDist)}px, ${Math.sin(angle) * Math.min(dist, maxDist)}px)`;
}

document.addEventListener('touchstart', (e) => {
  for (let touch of e.changedTouches) {
    const rectL = document.getElementById('joystick-left').getBoundingClientRect();
    const rectR = document.getElementById('joystick-right').getBoundingClientRect();
    if (touch.clientX >= rectL.left && touch.clientX <= rectL.right && touch.clientY >= rectL.top && touch.clientY <= rectL.bottom) { joyLeft.active = true; joyLeft.id = touch.identifier; }
    else if (touch.clientX >= rectR.left && touch.clientX <= rectR.right && touch.clientY >= rectR.top && touch.clientY <= rectR.bottom) { joyRight.active = true; joyRight.id = touch.identifier; }
  }
}, { passive: false });

document.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let touch of e.changedTouches) {
    if (joyLeft.active && touch.identifier === joyLeft.id) {
      const rect = document.getElementById('joystick-left').getBoundingClientRect();
      joyLeft.x = touch.clientX - (rect.left + rect.width / 2);
      joyLeft.y = touch.clientY - (rect.top + rect.height / 2);
      updateStickVisual(document.getElementById('stick-left'), joyLeft.x, joyLeft.y);
    }
    if (joyRight.active && touch.identifier === joyRight.id) {
      const rect = document.getElementById('joystick-right').getBoundingClientRect();
      joyRight.x = touch.clientX - (rect.left + rect.width / 2);
      joyRight.y = touch.clientY - (rect.top + rect.height / 2);
      updateStickVisual(document.getElementById('stick-right'), joyRight.x, joyRight.y);
    }
  }
}, { passive: false });

document.addEventListener('touchend', (e) => {
  for (let touch of e.changedTouches) {
    if (touch.identifier === joyLeft.id) { joyLeft.active = false; joyLeft.x = 0; joyLeft.y = 0; document.getElementById('stick-left').style.transform = `translate(0px, 0px)`; }
    if (touch.identifier === joyRight.id) { joyRight.active = false; joyRight.x = 0; joyRight.y = 0; document.getElementById('stick-right').style.transform = `translate(0px, 0px)`; }
  }
}, { passive: false });

const btnJump = document.getElementById('btn-jump');
btnJump.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (player.isFlying) player.velocity.y = 8; 
  else if (player.canJump) { player.velocity.y = player.jumpForce; player.canJump = false; }
});

const btnFly = document.getElementById('btn-fly');
if (isCreative) {
  btnFly.style.display = 'flex';
  btnFly.addEventListener('touchstart', (e) => {
    e.preventDefault();
    player.isFlying = !player.isFlying;
    if (player.isFlying) {
      btnFly.classList.add('active');
      btnJump.innerText = "Subir";
      player.velocity.y = 0;
    } else {
      btnFly.classList.remove('active');
      btnJump.innerText = "Pulo";
    }
  });
} else {
  btnFly.style.display = 'none';
}

// ================== SISTEMA DE SALVAR ==================
window.changesToSave = config.changes || []; 

const btnSave = document.getElementById('btn-save');
if (btnSave) {
  btnSave.addEventListener('touchstart', (e) => {
    e.preventDefault();
    saveWorld(player.pos);
  });
}

// ================== BATER E COLOCAR ==================
const hitBtn = document.getElementById('btn-hit');
const placeBtn = document.getElementById('btn-place');
const inventory = [];
const slots = document.querySelectorAll('.slot');
let selectedBlock = null; 

const raycaster = new THREE.Raycaster();
const screenCenter = new THREE.Vector2(0, 0);

if (isCreative) {
  document.addEventListener('creativeSelect', (e) => {
    const type = e.detail; 
    const slot8 = slots[7]; 

    if (type === 'cow') {
      const dist = 3;
      const dx = Math.sin(player.yaw) * dist;
      const dz = Math.cos(player.yaw) * dist;
      spawnCow(player.pos.x + dx, player.pos.z + dz);
      return;
    }

    slot8.setAttribute('data-block', type);
    if (type === 'grass') slot8.style.backgroundColor = '#5ca845';
    if (type === 'dirt') slot8.style.backgroundColor = '#7a5c3a';
    if (type === 'stone') slot8.style.backgroundColor = '#888888';
    if (type === 'water') slot8.style.backgroundColor = '#3a79bd';

    slots.forEach(s => s.classList.remove('active'));
    slot8.classList.add('active');
    selectedBlock = type;
  });
}

slots.forEach((slot) => {
  if (slot.id === 'slot-menu') return; 
  slot.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const blockName = slot.getAttribute('data-block');
    if (!blockName) { selectedBlock = null; return; }
    selectedBlock = blockName;
  });
});

hitBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  raycaster.setFromCamera(screenCenter, camera);
  
  let allBlocks = [];
  loadedChunks.forEach(chunk => allBlocks.push(...chunk.children));
  worldGroup.children.forEach(child => { if (child.isMesh) allBlocks.push(child); });

  const intersects = raycaster.intersectObjects(allBlocks, false);

  if (intersects.length > 0 && intersects[0].distance <= 6.0) {
    const block = intersects[0].object;
    const hitPoint = intersects[0].point;

    if (block.material === materials.water) {
      spawnWaterParticles(block.position.x, block.position.y, block.position.z, hitPoint.y);
      return; 
    }
    breakBlockInstantly(block);
  }
});

function breakBlockInstantly(block) {
  let type = 'stone';
  if (Array.isArray(block.material)) type = 'grass';
  else if (block.material.map === textures.wood) type = 'wood';
  else if (block.material.map === textures.dirt) type = 'dirt';
  else if (block.material.map === textures.leaves) type = 'leaves';
  else if (block.material.map === textures.sand) type = 'sand';
  else if (block.material.map === textures.water) return; 

  window.changesToSave.push({ 
    x: block.position.x, 
    y: block.position.y, 
    z: block.position.z, 
    type: 'removed' 
  });

  if (block.parent) block.parent.remove(block);
  loadedChunks.forEach(chunk => {
    const idx = chunk.children.indexOf(block);
    if (idx > -1) chunk.children.splice(idx, 1);
  });

  if (!isCreative && inventory.length < 9) {
    inventory.push(type);
    updateInventoryUI();
  }
}

// === ATUALIZAÇÃO DO INVENTÁRIO ===
function updateInventoryUI() {
  slots.forEach((slot, i) => {
    if (i === 8) return; 
    
    if (inventory[i]) {
      slot.style.backgroundColor = inventory[i] === 'grass' ? '#5ca845' : 
                                  inventory[i] === 'wood' ? '#4a3b2a' :
                                  inventory[i] === 'leaves' ? '#2d6e28' :
                                  inventory[i] === 'dirt' ? '#7a5c3a' :
                                  inventory[i] === 'sand' ? '#d9c27e' : '#888888';
      
      // AQUI ESTAVA O BUG: Não usa mais o border para não apagar a borda branca!
      // Agora ele só define a cor de fundo.
      
      slot.setAttribute('data-block', inventory[i]);
    } else {
      slot.style.backgroundColor = 'rgba(139, 139, 139, 0.5)';
      slot.setAttribute('data-block', '');
    }
  });
}

placeBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!selectedBlock) return; 

  raycaster.setFromCamera(screenCenter, camera);
  let allBlocks = [];
  worldGroup.children.forEach(child => {
    if (child.isMesh) allBlocks.push(child);
    else if (child.children) allBlocks.push(...child.children);
  });

  const intersects = raycaster.intersectObjects(allBlocks, false);

  if (intersects.length > 0 && intersects[0].distance <= 6.0) {
    const hit = intersects[0];
    if (hit.object.material === materials.water) return;

    const normal = hit.face.normal;
    const blockPos = hit.object.position;
    const newPos = blockPos.clone().add(normal);

    if (camera.position.distanceTo(newPos) < 1.2) return;

    if (selectedBlock === 'water') {
      const waterBlock = new THREE.Mesh(boxGeo, materials.water);
      waterBlock.position.copy(newPos);
      worldGroup.add(waterBlock);
    } else {
      const newBlock = new THREE.Mesh(boxGeo, materials[selectedBlock]);
      newBlock.position.copy(newPos);
      worldGroup.add(newBlock);
    }

    window.changesToSave.push({ 
      x: newPos.x, 
      y: newPos.y, 
      z: newPos.z, 
      type: 'added', 
      blockType: selectedBlock 
    });
  }
});

// ================== LOOP DE ATUALIZAÇÃO ==================
let lastTime = performance.now();
let lastAirUpdate = 0;

function updatePlayer() {
  requestAnimationFrame(updatePlayer);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (joyRight.active) {
    player.yaw -= joyRight.x * 0.003; 
    player.pitch -= joyRight.y * 0.003;
    player.pitch = Math.max(-Math.PI/2 + 0.1, Math.min(Math.PI/2 - 0.1, player.pitch));
  }

  const checkWaterY = getWaterLevel(Math.round(player.pos.x), Math.round(player.pos.z), getHeight(Math.round(player.pos.x), Math.round(player.pos.z)));
  player.inWater = (checkWaterY !== -1 && player.pos.y <= checkWaterY + 2 && !player.isFlying);

  if (player.isFlying) {
    player.velocity.y *= 0.85;
    if (player.pos.y > 20) { player.pos.y = 20; player.velocity.y = 0; }
  } else {
    player.velocity.y -= player.gravity * dt;
    if (player.inWater) {
      player.velocity.y *= 0.9; 
      if (player.velocity.y < -3) player.velocity.y = -3; 
      if (player.velocity.y < 2 && btnJump.matches(':active')) player.velocity.y = 4;
    }
  }

  if (isSurvival && !player.isFlying) {
    if (player.inWater) {
      if (now - lastAirUpdate > 1000) {
        player.air = Math.max(0, player.air - 1);
        updateAirUI();
        lastAirUpdate = now;
      }
      if (player.air <= 0) {
        if (now - lastAirUpdate > 1000) {
          player.health = Math.max(0, player.health - 1);
          updateHealthUI();
        }
      }
    } else {
      if (player.air < 10 && now - lastAirUpdate > 300) {
        player.air = Math.min(10, player.air + 1);
        updateAirUI();
        lastAirUpdate = now;
      }
    }
  } else {
    player.air = 10;
  }

  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.sin(player.yaw - Math.PI/2), 0, Math.cos(player.yaw - Math.PI/2));
  const moveDir = new THREE.Vector3();
  
  if (joyLeft.active) {
    moveDir.add(forward.clone().multiplyScalar(-joyLeft.y / 40));
    moveDir.add(right.clone().multiplyScalar(joyLeft.x / 40)); 
  }
  if (moveDir.length() > 1) moveDir.normalize();
  
  const currentSpeed = player.isFlying ? player.speed * 1.5 : (player.inWater ? player.speed * 0.6 : player.speed);

  player.pos.x += moveDir.x * currentSpeed * dt;
  player.pos.z += moveDir.z * currentSpeed * dt;
  player.pos.y += player.velocity.y * dt;

  if (!player.isFlying) {
    const groundY = getHeight(Math.round(player.pos.x), Math.round(player.pos.z)) + 2;
    if (player.pos.y < groundY) {
      player.pos.y = groundY;
      player.velocity.y = 0;
      player.canJump = true;
    }
  }

  updateChunks(player.pos.x, player.pos.z);
  updateCows(dt, player.pos);

  camera.position.copy(player.pos);
  const lookTarget = new THREE.Vector3(
    Math.sin(player.yaw) * Math.cos(player.pitch),
    Math.sin(player.pitch),
    Math.cos(player.yaw) * Math.cos(player.pitch)
  ).add(player.pos);
  camera.lookAt(lookTarget);

  if (now - lastCoordsUpdate > 200) {
    coordsText.innerHTML = `X: ${Math.round(player.pos.x)}<br>Y: ${Math.round(player.pos.y)}<br>Z: ${Math.round(player.pos.z)}`;
    lastCoordsUpdate = now;
  }
}

updatePlayer();