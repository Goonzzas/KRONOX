import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  buildCurvedGrabRail,
  buildCableConduit,
  buildPressurizedBulkheadDoor,
  buildSectorPlacard,
} from './architecturalKit.js';

/**
 * ETAPA C — ESPINA DORSAL CENTRAL Y MAMPAROS PRESURIZADOS (Z: -42.0m .. +12.4m).
 * Túnel estructural segmentado con costillas octogonales, difusores indirectos, conducciones
 * técnicas empotradas bajo rejilla, compuertas iris y señalética dieléctrica por cubierta.
 */
export function buildCentralSpineCorridor3D(root, mats, doorsList) {
  const g = new THREE.Group();
  g.name = 'Sector_CentralSpine';
  const spineLen = 54.4; // Z: -42.0 .. +12.4
  const spineCenterZ = -14.8;

  // 1. Primary octagonal composite hull liner
  const tunnelGeo = new THREE.CylinderGeometry(1.82, 1.82, spineLen, 8, 1, true);
  tunnelGeo.rotateX(Math.PI / 2);
  tunnelGeo.rotateZ(Math.PI / 8);
  const tunnelShell = new THREE.Mesh(tunnelGeo, mats.thermalQuilt);
  tunnelShell.position.set(0, 0.0, spineCenterZ);
  g.add(tunnelShell);

  const frameMat = mats.anodizedGunmetal || mats.darkFrame;

  // Mid-height zone-differentiated wall wainscoting strips along straight corridor spans
  const spanSegments = [
    { zA: -41.8, zB: -30.5, wallMat: mats.labCeramic || mats.bulkhead, upperMat: mats.workSurface },
    { zA: -27.5, zB: -21.2, wallMat: mats.labCeramic || mats.bulkhead, upperMat: mats.workSurface },
    { zA: -20.8, zB: -7.8, wallMat: mats.habSandstone || mats.bulkhead, upperMat: mats.habWoodTrim || mats.workSurface },
    { zA: -4.2, zB: 0.9, wallMat: mats.habSandstone || mats.bulkhead, upperMat: mats.habWoodTrim || mats.workSurface },
    { zA: 4.1, zB: 10.6, wallMat: mats.engShield || mats.bulkhead, upperMat: frameMat },
  ];
  spanSegments.forEach(({ zA, zB, wallMat, upperMat }, idx) => {
    const len = zB - zA;
    const zMid = (zA + zB) * 0.5;
    [-1, 1].forEach((side) => {
      const liner = new THREE.Mesh(
        new RoundedBoxGeometry(0.1, 1.38, len, 2, 0.015),
        wallMat,
      );
      liner.position.set(side * 1.56, -0.45, zMid);
      liner.name = `SpineWainscot_${idx}_${side > 0 ? 'S' : 'P'}`;
      g.add(liner);

      const upperPanel = new THREE.Mesh(
        new RoundedBoxGeometry(0.08, 0.85, len, 2, 0.012),
        upperMat,
      );
      upperPanel.position.set(side * 1.44, 0.88, zMid);
      upperPanel.rotation.z = side * 0.35;
      g.add(upperPanel);
    });
  });

  // 2. Non-slip slotted grating walkway decks (open cleanly above Ventral EVA shaft Z -7.5..-4.5)
  const spineFloorA = new THREE.Mesh(new RoundedBoxGeometry(2.55, 0.14, 34.4, 2, 0.015), mats.floorDeck);
  spineFloorA.position.set(0, -1.52, -24.8); // Z: -42.0 .. -7.6
  const spineFloorB = new THREE.Mesh(new RoundedBoxGeometry(2.55, 0.14, 14.3, 2, 0.015), mats.floorDeck);
  spineFloorB.position.set(0, -1.52, 2.75); // Z: -4.4 .. +9.9

  // Sloped diamond-tread ramp ascending into Engineering Deck 04 (Z: 9.8..12.6)
  const spineEngRamp = new THREE.Mesh(new RoundedBoxGeometry(2.55, 0.14, 3.25, 2, 0.015), mats.floorDeck);
  spineEngRamp.position.set(0, -0.9, 11.2);
  spineEngRamp.rotation.x = 0.42;
  g.add(spineFloorA, spineFloorB, spineEngRamp);

  // Protective hazard rim framing Ventral EVA Hatch Opening (Z: -7.5..-4.5)
  [
    { pos: [0, -1.43, -7.55], size: [2.5, 0.06, 0.18] },
    { pos: [0, -1.43, -4.45], size: [2.5, 0.06, 0.18] },
  ].forEach(({ pos, size }) => {
    const rim = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 2, 0.01), mats.hazardTrim);
    rim.position.set(...pos);
    g.add(rim);
  });

  // Exposed color-coded sub-edge cryogenic coolant & power feeder pipes with clamp collars
  [-1.08, 1.08].forEach((px, sideIdx) => {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, spineLen, 12),
      sideIdx === 0 ? mats.chromePipe : mats.copperPipe,
    );
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(px, -1.34, spineCenterZ);
    const guardStrip = new THREE.Mesh(
      new RoundedBoxGeometry(0.18, 0.035, spineLen - 0.6, 2, 0.008),
      frameMat,
    );
    guardStrip.position.set(px, -1.43, spineCenterZ);
    g.add(pipe, guardStrip);
  });

  // 3. Structural octagonal ring ribs & integrated indirect ceiling cove lighting every 3.6 m
  for (let z = -40.2; z <= 9.6; z += 3.6) {
    const isJunction = Math.abs(z - -29) < 2.1 || Math.abs(z - -6) < 2.1 || Math.abs(z - 2.5) < 2.0;
    if (isJunction) continue;

    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.66, 0.09, 8, 8), frameMat);
    ring.position.set(0, 0, z);
    ring.rotation.z = Math.PI / 8;
    g.add(ring);

    const diffuser = new THREE.Mesh(
      new RoundedBoxGeometry(0.92, 0.045, 0.22, 2, 0.01),
      z > -18 && z < 5 ? mats.warmDiffuser : z >= 5 ? mats.amberServiceDiffuser : mats.coolDiffuser,
    );
    diffuser.position.set(0, 1.56, z);
    g.add(diffuser);
  }

  // 4. Curved Micro-G Handrails anchored cleanly along corridor walls
  const railSpans = [
    [-41.2, -30.7],
    [-27.3, -7.9],
    [-4.1, 0.8],
    [4.2, 11.4],
  ];
  railSpans.forEach(([z0, z1], idx) => {
    [-1, 1].forEach((side) => {
      g.add(
        buildCurvedGrabRail({
          start: [side * 1.4, -0.05, z0],
          end: [side * 1.4, -0.05, z1],
          standoffDir: [-side * 0.08, 0, 0],
          radius: 0.024,
          mat: mats.grabRail,
          mountMat: frameMat,
          name: `Spine_GrabRail_${idx}_${side > 0 ? 'S' : 'P'}`,
        }),
      );
    });
  });

  // Illuminated Spine Transit Hand-Track Rail Guides along Upper Ceiling Cove
  [-0.58, 0.58].forEach((tx, idx) => {
    const transitTrack = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.045, 52.0, 2, 0.008), frameMat);
    transitTrack.position.set(tx, 1.38, spineCenterZ);
    const shuttleGrip = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.09, 0.24, 2, 0.012), mats.grabRail);
    shuttleGrip.position.set(tx, 1.34, -22.0 + idx * 24.0);
    g.add(transitTrack, shuttleGrip);
  });

  // Curved umbilical telemetry conduit running along upper port ceiling cove
  g.add(
    buildCableConduit(
      [
        [-0.78, 1.38, -41.5],
        [-0.86, 1.42, -26.0],
        [-0.82, 1.4, -6.0],
        [-0.76, 1.44, 11.5],
      ],
      0.032,
      mats.carbonFiber,
      'SpineCeilingDataTrunk',
    ),
  );

  // 5. Heavy Pressurized Iris Bulkhead Doors at transition thresholds + Diegetic Sector Placards
  [
    { az: -42.0, y: -0.15, hex: 0x38bdf8, code: 'C01', title: 'PUENTE DE MANDO' },
    { az: -34.0, y: -0.15, hex: 0x34d399, code: 'C02', title: 'CORREDOR CIENTÍFICO' },
    { az: -21.0, y: -0.15, hex: 0xf59e0b, code: 'C03', title: 'MÓDULO HABITACIONAL' },
    { az: 12.3, y: 0.92, hex: 0xfb7185, code: 'C04', title: 'INGENIERÍA Y REACTOR' },
  ].forEach(({ az, y, hex, code, title }) => {
    const bh = buildPressurizedBulkheadDoor({
      zPos: az,
      width: 2.25,
      height: 2.55,
      labelHex: hex,
      mats,
      doorsList,
      name: `SpineBulkhead_${code}`,
    });
    bh.position.y = y;
    g.add(bh);

    const accentStr = `#${hex.toString(16).padStart(6, '0')}`;
    const placard = buildSectorPlacard({
      code,
      title,
      accentHex: accentStr,
      width: 1.5,
      height: 0.3,
      mats,
      name: `Placard_${code}`,
    });
    placard.position.set(0, y + 1.52, az + 0.23);
    g.add(placard);

    const placardBack = placard.clone();
    placardBack.position.set(0, y + 1.52, az - 0.23);
    placardBack.rotation.y = Math.PI;
    g.add(placardBack);
  });

  // 6. Flanged Lateral Transfer Collars linking Spine to Science Pods & Habitat Drums
  [
    { z: -29.0, halfSpan: 3.85, floorY: -1.55, hex: 0x34d399, label: 'C02 · LAB SPHEREx / ÓPTICA' },
    { z: -6.0, halfSpan: 3.45, floorY: -1.7, hex: 0xf59e0b, label: 'C03 · HABITABILIDAD / EVA' },
    { z: 2.5, halfSpan: 3.45, floorY: -1.7, hex: 0xf59e0b, label: 'C03 · LITERAS / BOTÁNICA' },
  ].forEach(({ z, halfSpan, floorY, hex, label }, idx) => {
    const collarFloor = new THREE.Mesh(
      new RoundedBoxGeometry(halfSpan * 2, 0.14, 2.45, 2, 0.015),
      mats.floorDeck,
    );
    collarFloor.position.set(0, floorY, z);
    const collarRoof = new THREE.Mesh(
      new RoundedBoxGeometry(halfSpan * 2, 0.16, 2.52, 2, 0.02),
      mats.bulkhead,
    );
    collarRoof.position.set(0, 1.38, z);

    // Side structural collar cheek arches sealing corridor openings
    [-1, 1].forEach((wallZ) => {
      [-halfSpan * 0.52, halfSpan * 0.52].forEach((rx) => {
        const ribCol = new THREE.Mesh(
          new RoundedBoxGeometry(0.16, 2.95, 0.18, 2, 0.015),
          frameMat,
        );
        ribCol.position.set(rx, -0.08, z + wallZ * 1.18);
        g.add(ribCol);
      });
    });

    const ringMat = new THREE.MeshStandardMaterial({
      color: hex,
      emissive: hex,
      emissiveIntensity: 0.45,
      roughness: 0.3,
    });
    const collarBand = new THREE.Mesh(
      new RoundedBoxGeometry(halfSpan * 1.9, 0.045, 0.07, 2, 0.01),
      ringMat,
    );
    collarBand.position.set(0, 1.24, z - 1.18);

    const accentStr = `#${hex.toString(16).padStart(6, '0')}`;
    const junctionSign = buildSectorPlacard({
      code: idx === 0 ? 'LAB' : 'HAB',
      title: label,
      accentHex: accentStr,
      width: 1.55,
      height: 0.28,
      mats,
      name: `CollarPlacard_${idx}`,
    });
    junctionSign.position.set(0, 1.14, z - 1.22);
    g.add(collarFloor, collarRoof, collarBand, junctionSign);
  });

  // 7. Calibrated corridor key lighting pools (2 focused Z lights + overhead diffuser strips for lean WebGL uniform budget)
  [
    { lz: -24.5, color: 0xd8ecff },
    { lz: -1.5, color: 0xfbe5c5 },
  ].forEach(({ lz, color }) => {
    const pl = new THREE.PointLight(color, 1.2, 22.0, 1.5);
    pl.position.set(0, 1.28, lz);
    g.add(pl);
  });

  root.add(g);
}

