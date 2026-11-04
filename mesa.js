// mesa.js - Bioma de Mesa (Badlands)
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

// Cores base do bioma
export const mesaColors = {
  grassTop: '#d97a48', // Terracota laranja
  grassSide: '#8c4a2b', // Terra avermelhada
  leaves: '#8c6a2b'     // Arbustos secos
};

// Função para criar as texturas procedurais da Mesa
export function getMesaTextures(createTexture) {
  return {
    grass_top: createTexture(mesaColors.grassTop, '#b85e32', 'mesa_top'),
    grass_side: createTexture(mesaColors.grassSide, mesaColors.grassTop, 'mesa_side'),
    dirt: createTexture('#8c4a2b', '#6b3720', 'dirt'),
    // Aqui a gente pode adicionar a textura da terracota depois
  };
}

// Lógica de geração do terreno da Mesa (Platôs e camadas)
export function generateMesaHeight(x, z, seedValue) {
  const nx = (x * 0.03) + (seedValue % 1000);
  const nz = (z * 0.03) + (seedValue % 1000);
  
  // A matemática da mesa é diferente. Ela cria "platôs" achatados.
  let h = Math.sin(nx) * 1.5 + Math.cos(nz) * 1.5;
  
  // Arredonda para criar os degraus (igual a Mesa do Minecraft)
  h = Math.floor(h * 2) * 1.5; 
  h = Math.floor(6 + h);
  
  return Math.max(2, Math.min(15, h)); // Mesa pode ser mais alta
}

// Árvores da Mesa (Arbustos secos / Cactos)
export function generateMesaTree(worldX, worldY, worldZ, materials, boxGeo, worldGroup) {
  // Na mesa quase não tem árvore, mas se tiver, é um arbusto morto
  if (Math.random() > 0.8) {
    for (let y = 0; y < 2; y++) {
      const bush = new THREE.Mesh(boxGeo, materials.wood);
      bush.position.set(worldX, worldY + y, worldZ);
      worldGroup.add(bush);
    }
  }
}