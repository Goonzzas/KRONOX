import * as THREE from 'three';
import { getGalaxyPhotographicVolumeTexture, GALAXY_MORPHOLOGY_METADATA } from './astronomicalUniverse.js';

/**
 * Astronomical Hologram System (Bridge Science Console).
 *
 * Appears exclusively on the left science / exploration console inside the 1:1 human cabin
 * after a completed spaceflight ("VIAJE REALIZADO").
 * Never appears on remote map clicks or inspection-only actions.
 */
export function createAstronomicalHologramSystem({ cabinRoot }) {
  const root = new THREE.Group();
  root.name = 'ScienceConsoleAstronomicalHologram';
  root.visible = false;

  // Position on the left science console desk:
  // Console is at (-5.55, 0.98, -2.2). The desk workspace extends forward to X ~ -5.10.
  // We place the emitter securely on top of the left desk surface.
  root.position.set(-5.15, 0.99, -2.2);

  // 1. Physical Emitter Base (Sci-Fi Projector Ring on Desk)
  const baseGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.035, 32);
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.85,
    roughness: 0.25,
  });
  const emitterBase = new THREE.Mesh(baseGeo, baseMat);
  emitterBase.position.y = 0.018;
  root.add(emitterBase);

  // Luminous Projector Ring
  const emitterRingGeo = new THREE.RingGeometry(0.12, 0.20, 32);
  const emitterRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
  });
  const emitterRing = new THREE.Mesh(emitterRingGeo, emitterRingMat);
  emitterRing.rotation.x = -Math.PI / 2;
  emitterRing.position.y = 0.036;
  root.add(emitterRing);

  // Vertical light cone beam
  const coneGeo = new THREE.CylinderGeometry(0.24, 0.12, 0.32, 24, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0x0ea5e9,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const beamCone = new THREE.Mesh(coneGeo, coneMat);
  beamCone.position.y = 0.19;
  root.add(beamCone);

  // 2. Hologram Floating Content Group (Hovering at Y = 0.42m above desk)
  const displayGroup = new THREE.Group();
  displayGroup.position.set(0, 0.42, 0);
  root.add(displayGroup);

  // Attached to cabinRoot so it transforms perfectly with the ship
  if (cabinRoot) {
    cabinRoot.add(root);
  }

  let activeTarget = null;
  let currentModelGroup = null;
  let labelSprite = null;
  let targetOpacity = 0;
  let currentOpacity = 0;
  let disposed = false;

  const geometriesToDispose = [baseGeo, emitterRingGeo, coneGeo];
  const materialsToDispose = [baseMat, emitterRingMat, coneMat];

  /**
   * Generates canvas-based holographic telemetry badge.
   */
  function createHologramLabel(target) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, 512, 256);

    // Holographic background box
    ctx.fillStyle = 'rgba(7, 24, 46, 0.72)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(16, 16, 480, 224, 14);
    ctx.fill();
    ctx.stroke();

    // Top Header
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.letterSpacing = '2px';
    ctx.fillText('✦ HOLOGRAMA DE LLEGADA · TELEMETRÍA', 36, 52);

    // Title / Object Name
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = '#ffffff';
    const name = target.name?.es || target.name || target.key || 'Objetivo desconocido';
    ctx.fillText(String(name).slice(0, 28), 36, 102);

    // Subtitle / Classification
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#94a3b8';
    const classification =
      target.type === 'galaxia'
        ? `Galaxia · ${target.morphology || 'Espiral'}`
        : target.type === 'estrella' || target.mission
          ? `Estrella · ${target.spectralType || target.scientificStatus || 'Misión SPHEREx'}`
          : 'Cuerpo celeste verificado';
    ctx.fillText(classification, 36, 142);

    // Distance / Coordinates
    ctx.font = '18px monospace';
    ctx.fillStyle = '#34d399';
    const distText = target.distanceLabel || (target.distanceLy ? `${target.distanceLy} al` : 'Sector investigado');
    ctx.fillText(`Distancia: ${distText}`, 36, 178);

    // Interaction hint
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('Pulsa [E] en la consola para abrir SPHEREx', 36, 215);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.64, 0.32, 1);
    sprite.position.set(0, 0.36, 0);

    geometriesToDispose.push(sprite.geometry);
    materialsToDispose.push(spriteMat);
    return sprite;
  }

  /**
   * Builds the 3D miniature holographic visualization of the destination.
   */
  function buildHologramModel(target) {
    const group = new THREE.Group();
    const isGalaxy = target.type === 'galaxia' || target.morphology;

    if (isGalaxy) {
      // 1. Reconstrucción holográfica 3D fiel a la morfología e imágenes de cada galaxia
      const galaxyKeyAliases = {
        'triangulum': 'm33',
        'triangulum-galaxy': 'm33',
        'sculptor': 'ngc-253',
        'sculptor-galaxy': 'ngc-253',
        'andromeda': 'm31',
        'cigar': 'm82',
        'cigar-galaxy': 'm82',
        'pinwheel': 'm101',
        'pinwheel-galaxy': 'm101',
      };
      const gKey = galaxyKeyAliases[target.key] || (GALAXY_MORPHOLOGY_METADATA[target.key] ? target.key : 'm31');
      const meta = GALAXY_MORPHOLOGY_METADATA[gKey] || GALAXY_MORPHOLOGY_METADATA.m31;
      const volTex = getGalaxyPhotographicVolumeTexture(gKey);

      // Reconstrucción multicapa con volumen y espesor tangible en 3D
      const holoDiameter = 0.38;
      const holoPlaneGeo = new THREE.PlaneGeometry(holoDiameter, holoDiameter);
      geometriesToDispose.push(holoPlaneGeo);

      const offsets = [-0.024, -0.012, 0, 0.012, 0.024];
      offsets.forEach((yOff, idx) => {
        const isCenter = idx === 2;
        const planeMat = new THREE.MeshBasicMaterial({
          map: volTex,
          transparent: true,
          opacity: isCenter ? 0.92 : 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        planeMat.userData = { baseOpacity: planeMat.opacity };
        materialsToDispose.push(planeMat);
        const mesh = new THREE.Mesh(holoPlaneGeo, planeMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = yOff;
        mesh.scale.setScalar(isCenter ? 1.0 : 0.95 - Math.abs(yOff) * 1.2);
        group.add(mesh);
      });

      // Rasgos morfológicos diagnósticos de cada objeto
      if (gKey === 'm82') {
        // Galaxia del Cigarro: superviento bipolar H-alfa perpendicular al plano (conos rojo/naranja)
        const coneGeo = new THREE.ConeGeometry(0.045, 0.16, 16, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.65,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        geometriesToDispose.push(coneGeo);
        materialsToDispose.push(coneMat);
        const northJet = new THREE.Mesh(coneGeo, coneMat);
        northJet.position.y = 0.08;
        const southJet = new THREE.Mesh(coneGeo, coneMat);
        southJet.position.y = -0.08;
        southJet.rotation.x = Math.PI;
        group.add(northJet, southJet);
        group.rotation.x = -Math.PI * 0.42;
      } else if (gKey === 'sagittarius-dwarf') {
        // Enana de Sagitario: corriente elongada sin disco
        group.rotation.x = -Math.PI * 0.28;
        group.rotation.z = Math.PI * 0.18;
      } else if (gKey === 'm31') {
        // Andrómeda: inclinada a ~65°
        group.rotation.x = -Math.PI * 0.35;
      } else if (gKey === 'ngc-253') {
        // Galaxia del Escultor: inclinada a ~76°
        group.rotation.x = -Math.PI * 0.40;
      } else if (gKey === 'm33') {
        // Galaxia del Triángulo: espiral abierta floculenta a ~54°
        group.rotation.x = -Math.PI * 0.30;
      } else {
        group.rotation.x = -Math.PI * 0.30;
      }

      // Núcleo central luminoso difuso circular (únicamente para galaxias con bulbo real; cero planos cuadrados)
      if (meta.bulgeRatio > 0.16) {
        const coreCircleGeo = new THREE.CircleGeometry(0.022 * (meta.bulgeRatio / 0.22), 24);
        const coreMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(meta.palette?.core || '#fff5d6'),
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const coreMesh1 = new THREE.Mesh(coreCircleGeo, coreMat);
        coreMesh1.rotation.x = -Math.PI / 2;
        coreMesh1.position.y = 0.001;
        group.add(coreMesh1);
        geometriesToDispose.push(coreCircleGeo);
        materialsToDispose.push(coreMat);
      }

      // Anillo de compás holográfico sobre la plataforma emisora
      const compassGeo = new THREE.RingGeometry(0.18, 0.19, 48);
      const compassMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const compassMesh = new THREE.Mesh(compassGeo, compassMat);
      compassMesh.rotation.x = -Math.PI / 2;
      compassMesh.position.y = -0.032;
      group.add(compassMesh);
      geometriesToDispose.push(compassGeo);
      materialsToDispose.push(compassMat);
    } else {
      // 2. Holographic Star: pulsating corona, wireframe latitude rings con colores espectrales físicos
      const starGeo = new THREE.SphereGeometry(0.09, 24, 20);
      const starColor =
        target.key === 'r-draconis'
          ? 0xef4444 // Gigante roja variable Mira (Tipo espectral M)
          : target.key === 'barnard'
            ? 0xea580c // Enana roja (Tipo espectral M4V)
            : target.key === 'rw-aurigae'
              ? 0xf97316 // Estrella T Tauri naranja/ámbar cálido (Tipo espectral K)
              : target.key === 'wise-0855'
                ? 0x9a3412 // Enana marrón ultrafría infrarroja profunda (Clase Y)
                : target.key === 'epsilon-indi'
                  ? 0xf59e0b // Enana naranja (Clase K5V)
                  : 0x38bdf8;

      const starMat = new THREE.MeshBasicMaterial({
        color: starColor,
        transparent: true,
        opacity: 0.78,
        wireframe: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const starMesh = new THREE.Mesh(starGeo, starMat);
      group.add(starMesh);

      // Disco protoplanetario circunestelar auténtico para el sistema joven RW Aurigae
      if (target.key === 'rw-aurigae') {
        const diskGeo = new THREE.RingGeometry(0.11, 0.22, 48);
        const diskMat = new THREE.MeshBasicMaterial({
          color: 0xd97706,
          transparent: true,
          opacity: 0.48,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const diskMesh = new THREE.Mesh(diskGeo, diskMat);
        diskMesh.rotation.x = -Math.PI * 0.36;
        group.add(diskMesh);
        geometriesToDispose.push(diskGeo);
        materialsToDispose.push(diskMat);
      }

      // Magnetic coronal loops (solo para estrellas activas; las enanas marrones no tienen corona óptica)
      if (target.key !== 'wise-0855') {
        const ringGeo = new THREE.TorusGeometry(0.12, 0.006, 8, 36);
        const ringMat = new THREE.MeshBasicMaterial({
          color: starColor,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
        });
        const r1 = new THREE.Mesh(ringGeo, ringMat);
        const r2 = new THREE.Mesh(ringGeo, ringMat);
        r2.rotation.x = Math.PI / 3;
        group.add(r1, r2);
        geometriesToDispose.push(ringGeo);
        materialsToDispose.push(ringMat);
      }

      geometriesToDispose.push(starGeo);
      materialsToDispose.push(starMat);
    }

    return group;
  }

  function setArrivedTarget(target) {
    if (!target) return;
    activeTarget = target;
    root.visible = true;
    targetOpacity = 1;

    // Remove old content
    if (currentModelGroup) {
      displayGroup.remove(currentModelGroup);
      currentModelGroup = null;
    }
    if (labelSprite) {
      displayGroup.remove(labelSprite);
      labelSprite = null;
    }

    // Build new hologram
    currentModelGroup = buildHologramModel(target);
    displayGroup.add(currentModelGroup);

    labelSprite = createHologramLabel(target);
    if (labelSprite) {
      displayGroup.add(labelSprite);
    }
  }

  function clearHologram() {
    targetOpacity = 0;
  }

  function update(dt, elapsedTime, isCabinVisible) {
    if (disposed) return;
    if (!isCabinVisible) {
      root.visible = false;
      return;
    }

    // Smooth opacity fade in/out
    if (Math.abs(currentOpacity - targetOpacity) > 0.01) {
      currentOpacity += (targetOpacity - currentOpacity) * Math.min(1, dt * 4.5);
    } else {
      currentOpacity = targetOpacity;
    }

    if (currentOpacity <= 0.01) {
      root.visible = false;
      return;
    }
    root.visible = true;

    // Holographic scanline flicker
    const flicker = 0.94 + Math.sin(elapsedTime * 9.5) * 0.06;
    emitterRingMat.opacity = currentOpacity * 0.65 * flicker;
    coneMat.opacity = currentOpacity * 0.12 * flicker;

    // Slow, serene rotation of the astronomical hologram
    if (currentModelGroup) {
      currentModelGroup.rotation.y += dt * 0.38;
      currentModelGroup.traverse((child) => {
        if (child.material) {
          const base = child.material.userData?.baseOpacity ?? 0.75;
          child.material.opacity = base * currentOpacity * flicker;
        }
      });
    }
    if (labelSprite && labelSprite.material) {
      labelSprite.material.opacity = currentOpacity * 0.92 * flicker;
    }
  }

  function dispose() {
    disposed = true;
    if (cabinRoot && root.parent === cabinRoot) {
      cabinRoot.remove(root);
    }
    geometriesToDispose.forEach((g) => g?.dispose?.());
    materialsToDispose.forEach((m) => m?.dispose?.());
  }

  return {
    root,
    setArrivedTarget,
    clearHologram,
    getActiveTarget: () => activeTarget,
    update,
    dispose,
  };
}
