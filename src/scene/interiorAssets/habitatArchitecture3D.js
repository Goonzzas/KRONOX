import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { SHIP_INTERIOR_STATIONS } from '../kronoxInteriorSpatialModel.js';
import {
  buildCurvedGrabRail,
  buildCableConduit,
  buildCylindricalPortalRib,
  buildFootRestraintPlate,
  buildModularRackBay,
  buildSculptedStationConsole,
  buildSectorPlacard,
} from './architecturalKit.js';

/**
 * Semi-enclosed Warm Micro-G Crew Sleep Alcove with sandstone shell, phenolic wood framing,
 * sage/terracotta woven acoustic upholstery, personal reading lamp, and tether straps.
 * Kept low against drum side (top Y <= -0.15m) so outer Y=+0.8m porthole views stay 100% open.
 */
function buildMicroGSleepBerth(mats, name, warmLampMat, textileMat) {
  const berth = new THREE.Group();
  berth.name = name;

  const shellMat = mats.habSandstone || mats.bulkhead;
  const trimMat = mats.habWoodTrim || mats.workSurface;
  const frameMat = mats.anodizedGunmetal || mats.darkFrame;

  const shell = new THREE.Mesh(
    new RoundedBoxGeometry(1.18, 1.38, 2.24, 3, 0.045),
    shellMat,
  );
  shell.position.y = 0.69;
  berth.add(shell);

  // Phenolic timber trim cornice around berth opening
  const cornice = new THREE.Mesh(new RoundedBoxGeometry(0.1, 1.38, 2.24, 2, 0.02), trimMat);
  cornice.position.set(0.56, 0.69, 0);
  berth.add(cornice);

  // Recessed interior sleeping cocoon niche with woven acoustic cushion pad
  const innerNiche = new THREE.Mesh(
    new RoundedBoxGeometry(0.92, 1.06, 2.02, 2, 0.03),
    textileMat || mats.habTextileWarm || mats.thermalQuilt,
  );
  innerNiche.position.set(0.14, 0.69, 0);

  const sleepSack = new THREE.Mesh(
    new RoundedBoxGeometry(0.76, 0.16, 1.78, 3, 0.045),
    mats.habTextileSage || mats.workSurface,
  );
  sleepSack.position.set(0.14, 0.25, 0);

  // Pillow bolster & dual cross-body sleep restraint belts
  const pillow = new THREE.Mesh(
    new RoundedBoxGeometry(0.56, 0.11, 0.34, 3, 0.03),
    mats.habSandstone || mats.workSurface,
  );
  pillow.position.set(0.14, 0.36, -0.68);
  const restraintStrapA = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.035, 0.12, 2, 0.01), mats.grabRail);
  restraintStrapA.position.set(0.14, 0.34, -0.25);
  const restraintStrapB = restraintStrapA.clone();
  restraintStrapB.position.z = 0.38;
  berth.add(innerNiche, sleepSack, pillow, restraintStrapA, restraintStrapB);

  // Sliding wood-grain privacy screen + warm gooseneck-style reading light bar
  const hatch = new THREE.Mesh(
    new RoundedBoxGeometry(0.05, 1.08, 0.88, 2, 0.015),
    trimMat,
  );
  hatch.position.set(0.59, 0.69, -0.62);
  const lampBar = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.045, 0.56, 2, 0.01), warmLampMat);
  lampBar.position.set(0.42, 1.18, 0);
  berth.add(hatch, lampBar);

  berth.add(
    buildCurvedGrabRail({
      start: [0.64, 0.92, -0.18],
      end: [0.64, 0.92, 0.82],
      standoffDir: [0.06, 0, 0],
      radius: 0.016,
      mat: mats.grabRail,
      mountMat: frameMat,
      name: `${name}_Grab`,
    }),
  );

  return berth;
}

/**
 * Compact Privacy Hygiene & Suction Wash Alcove on Deck 03.
 */
function buildHygienePrivacyPod(mats) {
  const pod = new THREE.Group();
  pod.name = 'Habitat_HygienePrivacyPod';
  const wallMat = mats.habSandstone || mats.bulkhead;
  const trimMat = mats.habWoodTrim || mats.workSurface;
  const frameMat = mats.anodizedGunmetal || mats.darkFrame;

  // Chamfered architectural outer shell with open inboard (-X) recessed doorway & louvered teak screen
  const backPanel = new THREE.Mesh(new RoundedBoxGeometry(0.14, 2.28, 1.82, 2, 0.02), frameMat);
  backPanel.position.set(0.46, 1.14, 0);
  const topHeader = new THREE.Mesh(new RoundedBoxGeometry(1.06, 0.16, 1.84, 2, 0.02), trimMat);
  topHeader.position.set(0.0, 2.22, 0);
  const basePlinth = new THREE.Mesh(new RoundedBoxGeometry(1.04, 0.12, 1.82, 2, 0.02), frameMat);
  basePlinth.position.set(0.0, 0.06, 0);

  // Sculpted bow/aft side cheeks clad cleanly in warm sandstone + timber trim stile (visible from Bow Wardroom!)
  [-0.86, 0.86].forEach((sz) => {
    const sideWall = new THREE.Mesh(new RoundedBoxGeometry(0.98, 2.22, 0.1, 2, 0.02), wallMat);
    sideWall.position.set(0.02, 1.12, sz);
    const pilaster = new THREE.Mesh(new RoundedBoxGeometry(0.14, 2.24, 0.14, 2, 0.015), trimMat);
    pilaster.position.set(-0.46, 1.12, sz);
    pod.add(sideWall, pilaster);
  });

  // Half-retracted slatted pocket screen leaving vanity & mirror visible from cabin
  const pocketDoor = new THREE.Mesh(new RoundedBoxGeometry(0.05, 2.08, 0.72, 2, 0.015), trimMat);
  pocketDoor.position.set(-0.44, 1.12, 0.48);

  const occupancyLed = new THREE.Mesh(
    new RoundedBoxGeometry(0.05, 0.04, 0.22, 1, 0.006),
    mats.accentEmerald,
  );
  occupancyLed.position.set(-0.5, 2.22, 0);

  // Recessed suction vanity & illuminated hygiene mirror
  const counter = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.08, 1.12, 2, 0.02), mats.workSurface);
  counter.position.set(0.14, 0.92, -0.05);
  const suctionBasin = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.14, 0.14, 18), mats.chromePipe);
  suctionBasin.position.set(0.12, 0.97, -0.05);
  const faucetSpout = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.22, 10), mats.chromePipe);
  faucetSpout.position.set(0.28, 1.12, -0.05);
  faucetSpout.rotation.z = 0.45;
  const mirrorFrame = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.68, 0.64, 2, 0.012), mats.warmDiffuser);
  mirrorFrame.position.set(0.36, 1.5, -0.05);
  const mirror = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.58, 0.54, 2, 0.01), mats.chromePipe);
  mirror.position.set(0.355, 1.5, -0.05);

  pod.add(
    backPanel,
    topHeader,
    basePlinth,
    pocketDoor,
    occupancyLed,
    counter,
    suctionBasin,
    faucetSpout,
    mirrorFrame,
    mirror,
  );
  return pod;
}

/**
 * ECLSS Botanical Growth Chamber with multi-tier greenery, full-spectrum grow LEDs & copper piping.
 */
function buildBotanicalGrowthChamber(mats) {
  const cabinet = new THREE.Group();
  cabinet.name = 'Habitat_BotanicalGrowthCabinet';
  const frameMat = mats.anodizedGunmetal || mats.darkFrame;
  const woodMat = mats.habWoodTrim || mats.workSurface;

  const cabBack = new THREE.Mesh(
    new RoundedBoxGeometry(0.12, 2.35, 1.95, 2, 0.02),
    mats.habSandstone || frameMat,
  );
  cabBack.position.set(0.46, 1.175, 0);
  const cabTop = new THREE.Mesh(
    new RoundedBoxGeometry(1.06, 0.14, 1.98, 2, 0.02),
    mats.habSandstone || frameMat,
  );
  cabTop.position.set(0.0, 2.28, 0);
  const cabBot = new THREE.Mesh(
    new RoundedBoxGeometry(1.06, 0.16, 1.98, 2, 0.02),
    frameMat,
  );
  cabBot.position.set(0.0, 0.08, 0);
  [-0.92, 0.92].forEach((cz) => {
    const gable = new THREE.Mesh(
      new RoundedBoxGeometry(1.04, 2.35, 0.11, 2, 0.02),
      mats.habSandstone || frameMat,
    );
    gable.position.set(0.0, 1.175, cz);
    const stile = new THREE.Mesh(
      new RoundedBoxGeometry(0.12, 2.34, 0.12, 2, 0.015),
      woodMat,
    );
    stile.position.set(-0.48, 1.17, cz);
    cabinet.add(gable, stile);
  });
  const woodBorder = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.08, 2.0, 2, 0.015), woodMat);
  woodBorder.position.set(0.0, 2.36, 0);
  cabinet.add(cabBack, cabTop, cabBot, woodBorder);

  const phytotronGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd1fae5,
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: 0.22,
    transmission: 0.55,
  });
  const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(1.74, 1.98), phytotronGlassMat);
  glassPane.rotation.y = -Math.PI / 2;
  glassPane.position.set(-0.46, 1.2, 0);
  cabinet.add(glassPane);

  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x2ea852,
    roughness: 0.72,
    metalness: 0.04,
  });
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x1a7f38,
    roughness: 0.65,
  });
  const growBarMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf9a8d4,
    emissiveIntensity: 0.75,
    roughness: 0.3,
  });

  [0.52, 1.14, 1.76].forEach((ty, tierIdx) => {
    const tray = new THREE.Mesh(
      new RoundedBoxGeometry(0.84, 0.08, 1.72, 2, 0.015),
      frameMat,
    );
    tray.position.set(-0.08, ty, 0);
    const ledBar = new THREE.Mesh(
      new RoundedBoxGeometry(0.18, 0.03, 1.62, 2, 0.008),
      growBarMat,
    );
    ledBar.position.set(-0.08, ty + 0.44, 0);
    cabinet.add(tray, ledBar);

    for (let pz = -0.6; pz <= 0.6; pz += 0.3) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.08, 10), mats.carbonFiber);
      pot.position.set(-0.12, ty + 0.07, pz);
      const canopyA = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.115 + ((tierIdx + Math.abs(pz)) % 2) * 0.02, 1),
        leafMat,
      );
      canopyA.scale.set(1.15, 0.8, 1.1);
      canopyA.position.set(-0.12, ty + 0.17, pz);
      const canopyB = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 1), stemMat);
      canopyB.position.set(-0.06, ty + 0.22, pz + 0.04);
      cabinet.add(pot, canopyA, canopyB);
    }
  });

  cabinet.add(
    buildCableConduit(
      [
        [0.42, 0.25, -0.88],
        [-0.36, 0.6, -0.94],
        [-0.36, 1.8, -0.94],
      ],
      0.024,
      mats.copperPipe,
      'BotanicalIrrigationPipe',
    ),
  );

  return cabinet;
}

/**
 * CUBIERTA 03: HABITABILIDAD CALIDA, LITERAS ZERO-G, COCINA SOCIAL, HIGIENE, BOTÁNICA Y ESCLUSA EVA.
 * Preserva las 6 aperturas circulares de ojos de buey en babor y estribor (Y=+0.8m).
 */
export function buildHabitatDrums3D(root, mats, registerConsole) {
  const g = new THREE.Group();
  g.name = 'Sector_HabitatDrums_Deck03';
  const drumLen = 20.4; // Z: -13.2 .. +7.2
  const drumZ = -3.0;
  const portholeZ = [-10.0, -7.2, -4.4, -1.6, 1.2, 4.0];

  const wallMat = mats.habSandstone || mats.bulkhead;
  const ceilMat = mats.habAcoustic || mats.thermalQuilt;
  const floorMat = mats.habFloor || mats.floorDeck;
  const woodMat = mats.habWoodTrim || mats.workSurface;
  const frameMat = mats.anodizedGunmetal || mats.darkFrame;

  [-1, 1].forEach((side) => {
    const cx = side * 6.2;
    const portholeGapRad = 0.31;
    const outerPortholeTheta = side > 0 ? 1.78 : Math.PI * 2 - 1.78;
    const roofGeo = new THREE.CylinderGeometry(
      3.78,
      3.78,
      drumLen,
      26,
      1,
      true,
      outerPortholeTheta + portholeGapRad * 0.5,
      Math.PI * 2 - portholeGapRad,
    );
    roofGeo.rotateX(Math.PI / 2);
    const roofArc = new THREE.Mesh(roofGeo, ceilMat);
    roofArc.position.set(cx, 0, drumZ);
    g.add(roofArc);

    const floor = new THREE.Mesh(
      new RoundedBoxGeometry(6.35, 0.16, drumLen, 2, 0.02),
      floorMat,
    );
    floor.position.set(cx, -1.83, drumZ);
    g.add(floor);

    const bulkheadBow = new THREE.Mesh(new THREE.CircleGeometry(3.78, 26), wallMat);
    bulkheadBow.position.set(cx, 0, drumZ - drumLen * 0.5);
    const bulkheadAft = bulkheadBow.clone();
    bulkheadAft.position.z = drumZ + drumLen * 0.5;
    g.add(bulkheadBow, bulkheadAft);

    // Grounded Faceted Structural Portal Frames (replaces floating wood sticks/torus hoops!)
    for (const rz of [-11.6, -8.6, -5.8, -3.0, -0.2, 2.6, 5.6]) {
      const clearDoorway = Math.abs(rz + 5.8) < 1.8 || Math.abs(rz - 2.6) < 1.8;
      const rib = buildCylindricalPortalRib({
        radius: 3.66,
        floorLocalY: -1.75,
        beamWidth: 0.17,
        beamDepth: 0.2,
        segments: 16,
        mats,
        frameMat,
        lightMat: mats.warmDiffuser,
        lightWidth: 1.45,
        skipSideFloorDrop: clearDoorway ? (side < 0 ? 'stbd' : 'port') : null,
        name: `HabPortalRib_${side > 0 ? 'S' : 'P'}_${rz.toFixed(1)}`,
      });
      rib.position.set(cx, 0, rz);
      g.add(rib);

      // Warm phenolic architectural trim beam inset inside upper rib crown
      const trimBeam = new THREE.Mesh(
        new RoundedBoxGeometry(1.75, 0.055, 0.22, 2, 0.01),
        woodMat,
      );
      trimBeam.position.set(cx, 3.52, rz);
      g.add(trimBeam);
    }

    // Overhead longitudinal architectural duct & warm sconce trunk running along Z axis
    const ceilingTrunk = new THREE.Mesh(
      new RoundedBoxGeometry(1.15, 0.14, drumLen - 0.8, 2, 0.02),
      frameMat,
    );
    ceilingTrunk.position.set(cx, 3.6, drumZ);
    const outerSkirt = new THREE.Mesh(
      new RoundedBoxGeometry(0.24, 0.44, drumLen - 0.6, 2, 0.02),
      frameMat,
    );
    outerSkirt.position.set(cx + side * 3.18, -1.55, drumZ);
    g.add(ceilingTrunk, outerSkirt);

    // Continuous extruded warm lunar-taupe wall band recessed cleanly BEHIND portal ribs (outerX 3.74, inner face 3.67 > rib innerR 3.49)
    const outerX = cx + side * 3.74;
    const halfLen = drumLen * 0.5 + 0.08;
    const halfBandH = 0.92;
    const bandShape = new THREE.Shape();
    bandShape.moveTo(-halfLen, -halfBandH);
    bandShape.lineTo(halfLen, -halfBandH);
    bandShape.lineTo(halfLen, halfBandH);
    bandShape.lineTo(-halfLen, halfBandH);
    bandShape.closePath();
    portholeZ.forEach((pz) => {
      const hole = new THREE.Path();
      hole.absarc(drumZ - pz, 0, 0.435, 0, Math.PI * 2, true);
      bandShape.holes.push(hole);
    });
    const bandGeo = new THREE.ExtrudeGeometry(bandShape, {
      depth: 0.14,
      bevelEnabled: false,
      curveSegments: 24,
    });
    bandGeo.translate(0, 0, -0.07);
    const portholeBand = new THREE.Mesh(bandGeo, wallMat);
    portholeBand.rotation.y = Math.PI / 2;
    portholeBand.position.set(outerX, 0.8, drumZ);
    g.add(portholeBand);

    portholeZ.forEach((pz) => {
      const outerBezel = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.072, 14, 28), frameMat);
      outerBezel.rotation.y = Math.PI / 2;
      outerBezel.position.set(outerX - side * 0.02, 0.8, pz);
      const woodTrim = new THREE.Mesh(new THREE.TorusGeometry(0.425, 0.024, 10, 24), woodMat);
      woodTrim.rotation.y = Math.PI / 2;
      woodTrim.position.set(outerX - side * 0.06, 0.8, pz);
      const pane = new THREE.Mesh(new THREE.CircleGeometry(0.42, 22), mats.viewportGlass);
      pane.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      pane.position.set(outerX, 0.8, pz);
      g.add(outerBezel, woodTrim, pane);
    });

    // Warm 3000K human-centric indirect living lighting (1 balanced pool per drum)
    const habWarmPool = new THREE.PointLight(0xffdfb4, 1.55, 22.0, 1.45);
    habWarmPool.position.set(cx, 2.05, -2.5);
    g.add(habWarmPool);
  });

  // 1. PORT WING (X = -6.2): Crew Sleep Alcoves + Wall-Integrated Galley Hydration Unit + Crew Lockers
  [-10.4, -0.8, 3.8].forEach((bz, idx) => {
    const berth = buildMicroGSleepBerth(
      mats,
      `PortCrewBerth_${idx}`,
      mats.warmDiffuser,
      idx % 2 === 0 ? mats.habTextileWarm : mats.habTextileSage,
    );
    berth.position.set(-8.35, -1.75, bz);
    g.add(berth);
  });

  // Inboard Crew Kit Lockers & Micro-G Stowage Wall framing Bow Port Zone cleanly
  const portLockerBay = buildModularRackBay({
    width: 1.95,
    height: 2.05,
    depth: 0.44,
    label: 'ALMACÉN VIVERES Y KIT EVA',
    accentHex: '#f59e0b',
    mats,
    frameMat,
    name: 'Port_CrewStowageRackBow',
  });
  portLockerBay.position.set(-6.2, -1.75, -12.6);
  g.add(portLockerBay);

  const portErgometer = new THREE.Group();
  portErgometer.name = 'Port_MicroGFitnessRack';
  portErgometer.position.set(-4.35, -1.75, -10.0);
  const ergoDeck = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.14, 1.45, 2, 0.02), frameMat);
  ergoDeck.position.y = 0.07;
  const ergoArm = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.92, 0.24, 2, 0.02), mats.habWoodTrim);
  ergoArm.position.set(0, 0.56, -0.45);
  const harnessPad = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.1, 0.62, 3, 0.03), mats.habTextileSage);
  harnessPad.position.set(0, 0.35, 0.15);
  portErgometer.add(ergoDeck, ergoArm, harnessPad);
  g.add(portErgometer);

  const galleyDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'galley');
  const galleyConsole = buildSculptedStationConsole(galleyDef, mats, {
    width: 1.42,
    accentHex: '#f59e0b',
    waveformMode: 'orbit',
    style: 'lectern',
    withBeacon: false,
    frameMat,
    topMat: woodMat,
    extraLines: [
      'RESERVA H2O POTABLE: 98.4% · 21°C/68°C',
      'CICLO ECLSS CO2: 0.34 kPa NOMINAL',
      'PULSA [E] PARA GESTIÓN HABITACIONAL',
    ],
  });
  registerConsole(galleyConsole);
  g.add(galleyConsole.group);

  // Recessed Integrated Galley & Nutrition Wall Counter (flushed against port outer wall at Z = -5.8)
  const hydrationUnit = new THREE.Group();
  hydrationUnit.position.set(-8.35, -1.75, -5.8);
  const galleyBaseCab = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.92, 2.35, 3, 0.025), frameMat);
  galleyBaseCab.position.y = 0.46;
  const counterTop = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.075, 2.42, 2, 0.02), woodMat);
  counterTop.position.set(0.05, 0.95, 0);
  const backSplash = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.95, 2.32, 2, 0.02), wallMat);
  backSplash.position.set(-0.22, 1.46, 0);
  const upperHood = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.22, 2.35, 2, 0.02), woodMat);
  upperHood.position.set(-0.08, 2.02, 0);
  const galleyLightStrip = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.03, 2.15, 1, 0.008), mats.warmDiffuser);
  galleyLightStrip.position.set(0.08, 1.9, 0);
  [-0.55, 0.0, 0.55].forEach((nz, fIdx) => {
    const nozzleHousing = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.16, 0.12, 2, 0.01), frameMat);
    nozzleHousing.position.set(0.02, 1.32, nz);
    const spigot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.016, 0.16, 10), mats.chromePipe);
    spigot.rotation.z = -Math.PI / 2;
    spigot.position.set(0.12, 1.28, nz);
    const flask = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.16, 12),
      fIdx === 1 ? mats.accentAmber : mats.chromePipe,
    );
    flask.position.set(0.24, 1.06, nz + 0.12);
    hydrationUnit.add(nozzleHousing, spigot, flask);
  });
  hydrationUnit.add(galleyBaseCab, counterTop, backSplash, upperHood, galleyLightStrip);
  g.add(hydrationUnit);

  const portHabSign = buildSectorPlacard({
    code: 'C03-B',
    title: 'HABITABILIDAD · LITERAS Y COCINA SOCIAL',
    accentHex: '#f59e0b',
    width: 1.9,
    height: 0.3,
    mats,
    name: 'Placard_HabitatPort',
  });
  portHabSign.position.set(-6.2, 2.05, -12.8);
  g.add(portHabSign);

  // 2. STARBOARD WING (X = +6.2): Zoned Commons, Wardroom Booth, Credenza Divider, Botanical & Hygiene Bay
  const eclssRack = buildModularRackBay({
    width: 1.95,
    height: 2.15,
    depth: 0.5,
    label: 'ECLSS · RECICLADO O2 / H2O',
    accentHex: '#38bdf8',
    mats,
    frameMat,
    name: 'Starboard_EclssWallBay',
  });
  eclssRack.position.set(6.2, -1.75, -12.4);
  g.add(eclssRack);

  [7.8, 8.65].forEach((ox, i) => {
    const sphereTank = new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 16), mats.chromePipe);
    sphereTank.position.set(ox, -0.75, -10.8);
    const saddle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 0.64, 14), frameMat);
    saddle.position.set(ox, -1.42, -10.8);
    g.add(sphereTank, saddle);
    if (i === 0) {
      g.add(
        buildCableConduit(
          [
            [ox, -0.38, -10.8],
            [ox, 0.22, -11.4],
            [6.9, 0.22, -12.15],
          ],
          0.025,
          mats.copperPipe,
          'EclssOxygenHeader',
        ),
      );
    }
  });

  // Low Architectural Acoustic Partition Credenza dividing ECLSS/MedBay from Wardroom (clean sightline)
  const midPartition = new THREE.Group();
  midPartition.name = 'Starboard_ZoneCredenza';
  midPartition.position.set(6.85, -1.75, -6.8);
  const credBody = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.88, 0.34, 3, 0.025), wallMat);
  credBody.position.y = 0.44;
  const credCap = new THREE.Mesh(new RoundedBoxGeometry(2.18, 0.075, 0.42, 2, 0.02), woodMat);
  credCap.position.y = 0.91;
  midPartition.add(credBody, credCap);
  g.add(midPartition);

  // Biomedical / Infirmary Micro-G Restraint Couch (sage textile cushions + articulated scanner arm)
  const medBay = new THREE.Group();
  medBay.name = 'Starboard_InfirmaryBay';
  medBay.position.set(8.2, -1.75, -5.6);
  const examPed = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.72, 1.75, 2, 0.025), frameMat);
  examPed.position.y = 0.36;
  const examMattress = new THREE.Mesh(new RoundedBoxGeometry(0.88, 0.12, 2.05, 3, 0.04), mats.habTextileSage || mats.darkSeat);
  examMattress.position.y = 0.78;
  const thighBrace = buildCurvedGrabRail({
    start: [-0.46, 0.85, 0.35],
    end: [-0.46, 0.85, -0.45],
    standoffDir: [-0.05, 0.04, 0],
    radius: 0.015,
    mat: mats.grabRail,
    mountMat: frameMat,
    name: 'InfirmaryRestraintBar',
  });
  const scanBoomCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.32, 0.78, -0.82),
    new THREE.Vector3(0.28, 1.52, -0.68),
    new THREE.Vector3(-0.08, 1.48, -0.2),
  ]);
  const scanArm = new THREE.Mesh(new THREE.TubeGeometry(scanBoomCurve, 14, 0.026, 8, false), mats.chromePipe);
  const scanHead = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.08, 0.34, 2, 0.015), mats.accentEmerald);
  scanHead.position.set(-0.08, 1.44, -0.15);
  medBay.add(examPed, examMattress, thighBrace, scanArm, scanHead);
  g.add(medBay);

  const botanical = buildBotanicalGrowthChamber(mats);
  botanical.position.set(8.2, -1.75, 1.6);
  g.add(botanical);

  const hygienePod = buildHygienePrivacyPod(mats);
  hygienePod.position.set(8.25, -1.75, 5.1);
  g.add(hygienePod);

  // Crew Wardroom Booth & Social Table with anchored Perch Stools, Suspended Pendant Halo & Table Hardware (fixes f06 void!)
  const loungeHub = new THREE.Group();
  loungeHub.name = 'Starboard_MicroGLoungeTable';
  loungeHub.position.set(5.45, -1.75, -1.6);
  const pedestal = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.86, 0.56, 3, 0.03), frameMat);
  pedestal.position.y = 0.43;
  const tableTop = new THREE.Mesh(new RoundedBoxGeometry(1.42, 0.075, 1.92, 4, 0.028), woodMat);
  tableTop.position.y = 0.9;
  const tableInset = new THREE.Mesh(new RoundedBoxGeometry(0.82, 0.016, 1.24, 2, 0.008), frameMat);
  tableInset.position.y = 0.942;
  const tetherRing = new THREE.Mesh(new RoundedBoxGeometry(1.48, 0.022, 1.98, 2, 0.008), mats.grabRail);
  tetherRing.position.y = 0.89;
  // Detailed Crew Mess Props: Illuminated Map Pad, Tray, Twin Thermal Tumblers
  const tablet = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.018, 0.28, 2, 0.004), mats.accentAmber);
  tablet.position.set(0, 0.955, 0);
  const mealTray = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.02, 0.24, 2, 0.006), mats.chromePipe);
  mealTray.position.set(-0.34, 0.955, -0.42);
  const mugA = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.12, 12), mats.habTextileWarm);
  mugA.position.set(0.35, 1.0, 0.36);
  const mugB = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.12, 12), mats.chromePipe);
  mugB.position.set(-0.32, 1.0, 0.48);

  // Suspended Overhead Architectural Wardroom Light Canopy Soffit tied down to back stanchions
  const overheadHalo = new THREE.Mesh(new RoundedBoxGeometry(1.25, 0.07, 1.75, 3, 0.02), frameMat);
  overheadHalo.position.set(0, 2.75, 0);
  const overheadGlow = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.028, 1.48, 2, 0.008), mats.warmDiffuser);
  overheadGlow.position.set(0, 2.71, 0);
  loungeHub.add(pedestal, tableTop, tableInset, tetherRing, tablet, mealTray, mugA, mugB, overheadHalo, overheadGlow);

  // Sculpted Cantilevered Crew Perch Stools & Micro-G Foot Restraints on Port, Bow, Aft sides of table
  [
    { x: -1.06, z: -0.38, rotY: Math.PI / 2, tex: mats.habTextileWarm },
    { x: -1.06, z: 0.38, rotY: Math.PI / 2, tex: mats.habTextileSage },
    { x: 1.06, z: 0.0, rotY: -Math.PI / 2, tex: mats.habTextileWarm },
    { x: 0.0, z: -1.32, rotY: 0, tex: mats.habTextileSage },
  ].forEach((seatSpec, idx) => {
    const stool = new THREE.Group();
    stool.name = `WardroomPerch_${idx}`;
    stool.position.set(seatSpec.x, 0, seatSpec.z);
    stool.rotation.y = seatSpec.rotY;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 0.56, 12), frameMat);
    stem.position.y = 0.28;
    const baseFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 16), frameMat);
    baseFoot.position.y = 0.02;
    const cushion = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.09, 0.36, 3, 0.03), seatSpec.tex);
    cushion.position.y = 0.58;
    const thighBar = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.03, 0.04, 1, 0.008), mats.grabRail);
    thighBar.position.set(0, 0.45, 0.16);
    stool.add(stem, baseFoot, cushion, thighBar);
    loungeHub.add(stool);
  });
  g.add(loungeHub);

  // Partition Planter / Botanical Lockers defining Aft Starboard Bay cleanly against Spine boundary
  const aftDisplayCredenza = buildModularRackBay({
    width: 1.65,
    height: 1.48,
    depth: 0.44,
    label: 'BIO-SOPORTE Y NUTRICIÓN',
    accentHex: '#34d399',
    mats,
    frameMat,
    name: 'Starboard_BioCredenza',
  });
  aftDisplayCredenza.position.set(5.45, -1.75, 5.2);
  aftDisplayCredenza.rotation.y = Math.PI;
  g.add(aftDisplayCredenza);

  // 3. VENTRAL EVA AIRLOCK & SUIT DONNING BAY ('airlock', Y:-4.25..-1.5, Z:-6.0)
  const alWallF = new THREE.Mesh(new RoundedBoxGeometry(2.74, 2.8, 0.16, 2, 0.02), frameMat);
  alWallF.position.set(0, -2.9, -7.55);
  const alWallA = alWallF.clone();
  alWallA.position.z = -4.45;
  const alWallL = new THREE.Mesh(new RoundedBoxGeometry(0.16, 2.8, 3.12, 2, 0.02), mats.bulkhead);
  alWallL.position.set(-1.35, -2.9, -6.0);
  const alWallR = alWallL.clone();
  alWallR.position.x = 1.35;

  const airlockFloor = new THREE.Mesh(new RoundedBoxGeometry(2.62, 0.14, 3.08, 2, 0.02), mats.floorDeck);
  airlockFloor.position.set(0, -4.26, -6.0);

  // Structural corner pilasters & recessed status strip ribbing along Ventral Airlock shaft walls
  [-1.24, 1.24].forEach((px) => {
    [-7.38, -4.62].forEach((pz) => {
      const pilaster = new THREE.Mesh(new RoundedBoxGeometry(0.18, 2.75, 0.18, 2, 0.02), frameMat);
      pilaster.position.set(px, -2.9, pz);
      g.add(pilaster);
    });
    const statusBar = new THREE.Mesh(
      new RoundedBoxGeometry(0.04, 0.045, 2.1, 1, 0.008),
      mats.accentAmber,
    );
    statusBar.position.set(px - Math.sign(px) * 0.02, -3.55, -6.0);
    g.add(statusBar);
  });

  const airlockPlacard = buildSectorPlacard({
    code: 'C03-V',
    title: 'ESCLUSA EVA VENTRAL · ECUALIZACIÓN',
    accentHex: '#ef4444',
    width: 1.85,
    height: 0.28,
    mats,
    name: 'Placard_VentralAirlock',
  });
  airlockPlacard.position.set(0, -1.94, -7.45);
  g.add(airlockPlacard);

  // High-Detail Ventral Circular Airlock Floor Iris Hatch + Locking Dog Arms & Observation Port
  const hatchZ = -6.12;
  const hatchFrame = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.085, 14, 32), mats.hazardTrim);
  hatchFrame.rotation.x = Math.PI / 2;
  hatchFrame.position.set(0, -4.18, hatchZ);
  const hatchRing = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.04, 10, 28), frameMat);
  hatchRing.rotation.x = Math.PI / 2;
  hatchRing.position.set(0, -4.16, hatchZ);
  const hatchLid = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.78, 0.06, 28), mats.workSurface);
  hatchLid.position.set(0, -4.17, hatchZ);
  const hatchViewport = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.075, 20), mats.viewportGlass);
  hatchViewport.position.set(0, -4.16, hatchZ);
  const dogWheel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.022, 10, 24), mats.grabRail);
  dogWheel.rotation.x = Math.PI / 2;
  dogWheel.position.set(0, -4.11, hatchZ);
  [0, Math.PI / 3, (Math.PI * 2) / 3].forEach((ang) => {
    const spoke = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.025, 0.03, 1, 0.006), mats.chromePipe);
    spoke.rotation.y = ang;
    spoke.position.set(0, -4.11, hatchZ);
    g.add(spoke);
  });
  g.add(alWallF, alWallA, alWallL, alWallR, airlockFloor, hatchFrame, hatchRing, hatchLid, hatchViewport, dogWheel);

  // Port & Starboard Pressurized EMU EVA Suit-Port Donning Frames
  [-1.12, 1.12].forEach((sx, idx) => {
    const suitRack = new THREE.Group();
    suitRack.name = `Airlock_SuitBay_${idx}`;
    suitRack.position.set(sx, -3.55, -5.7);
    const dir = -Math.sign(sx);
    const backPlinth = new THREE.Mesh(new RoundedBoxGeometry(0.14, 1.62, 0.96, 2, 0.02), frameMat);
    backPlinth.position.y = 0.78;
    const torsoShell = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.56, 0.42, 3, 0.06), mats.labCeramic || mats.workSurface);
    torsoShell.position.set(dir * 0.14, 0.74, 0);
    const chestPack = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.18, 0.2, 2, 0.015), mats.accentCyan);
    chestPack.position.set(dir * 0.28, 0.78, 0);
    const helmetRing = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.02, 10, 20), mats.chromePipe);
    helmetRing.rotation.x = Math.PI / 2;
    helmetRing.position.set(dir * 0.15, 1.04, 0);
    const domeCover = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12), mats.viewportGlass);
    domeCover.position.set(dir * 0.15, 1.16, 0);
    suitRack.add(backPlinth, torsoShell, chestPack, helmetRing, domeCover);
    g.add(suitRack);
  });

  g.add(
    buildCurvedGrabRail({
      start: [1.05, -3.9, -5.0],
      end: [1.05, -1.35, -5.0],
      standoffDir: [-0.08, 0, 0],
      radius: 0.024,
      mat: mats.grabRail,
      mountMat: frameMat,
      name: 'VentralShaftClimbRail',
    }),
  );

  // Flush Wall-Mounted Airlock Control Panel against Bow Wall (eliminates free-standing office desk!)
  const airlockDef = SHIP_INTERIOR_STATIONS.find((s) => s.id === 'airlock');
  const airlockConsole = buildSculptedStationConsole(airlockDef, mats, {
    width: 1.28,
    accentHex: '#ef4444',
    waveformMode: 'orbit',
    style: 'wallPanel',
    withBeacon: false,
    frameMat,
    topMat: mats.workSurface,
  });
  airlockConsole.group.position.set(0, -4.2, -7.42);
  airlockConsole.group.rotation.y = 0;
  registerConsole(airlockConsole);
  g.add(airlockConsole.group);

  const airlockLight = new THREE.PointLight(0xffb4a2, 1.05, 8.5, 1.6);
  airlockLight.position.set(0, -2.05, -6.0);
  g.add(airlockLight);

  root.add(g);
}
