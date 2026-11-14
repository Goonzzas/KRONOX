import * as THREE from 'three';

function drawRoundedRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/** Canvas labels use a bounded pixel footprint, independent of map units. */
export function createSceneLabel(
  text,
  _legacyScale = 0.4,
  fontSize = 30,
  documentRef = document,
  options = null
) {
  const isBadge = Boolean(options?.badge);
  const isPlanetTag = Boolean(options?.planetTag);
  const accentColor = options?.accentColor || '#6be2ff';
  const canvas = documentRef.createElement('canvas');
  canvas.width = 512;
  canvas.height = isBadge ? 84 : 64;
  const ctx = canvas.getContext('2d');
  let pixelWidth = 220;
  let pixelHeight = isBadge ? 30 : 28;
  let pillHalfRatioX = 0.5;

  if (ctx && (isBadge || isPlanetTag)) {
    const pxFont = isPlanetTag ? 24 : Math.min(30, Math.max(24, fontSize));
    const font = `600 ${pxFont}px "Segoe UI", system-ui, sans-serif`;
    ctx.font = font;
    const textWidth = Math.min(340, Math.ceil(ctx.measureText?.(text)?.width || text.length * 14));
    const dotSpace = isPlanetTag ? 18 : 24;
    const padX = isPlanetTag ? 10 : 22;
    const pillW = isPlanetTag
      ? Math.min(400, Math.max(52, textWidth + dotSpace + padX * 2))
      : Math.min(496, Math.max(148, textWidth + dotSpace + padX * 2));
    const pillH = isPlanetTag ? 40 : 54;

    canvas.width = Math.max(68, Math.ceil(pillW + 8));
    canvas.height = isPlanetTag ? 46 : 72;
    const badgeCtx = canvas.getContext('2d');
    if (badgeCtx) {
      const pillX = (canvas.width - pillW) * 0.5;
      const pillY = (canvas.height - pillH) * 0.5;
      if (!isPlanetTag) {
        badgeCtx.fillStyle = 'rgba(7, 15, 29, 0.82)';
        drawRoundedRectPath(badgeCtx, pillX, pillY, pillW, pillH, 24);
        badgeCtx.fill();
        badgeCtx.lineWidth = 2.4;
        badgeCtx.strokeStyle = options?.borderColor || 'rgba(126, 218, 255, 0.64)';
        drawRoundedRectPath(badgeCtx, pillX + 1.2, pillY + 1.2, pillW - 2.4, pillH - 2.4, 23);
        badgeCtx.stroke();
      }
      badgeCtx.beginPath();
      badgeCtx.arc(pillX + padX + (isPlanetTag ? 3.5 : 4), canvas.height * 0.5, isPlanetTag ? 3.5 : 5.5, 0, Math.PI * 2);
      badgeCtx.fillStyle = accentColor;
      badgeCtx.fill();
      badgeCtx.font = font;
      badgeCtx.textAlign = 'left';
      badgeCtx.textBaseline = 'middle';
      if (isPlanetTag) {
        badgeCtx.lineJoin = 'round';
        badgeCtx.lineWidth = 4.5;
        badgeCtx.strokeStyle = 'rgba(2, 6, 18, 0.92)';
        badgeCtx.strokeText(text, pillX + padX + dotSpace, canvas.height * 0.5 + 1);
      }
      badgeCtx.fillStyle = '#eaf6ff';
      badgeCtx.shadowColor = 'rgba(0, 0, 0, 0.92)';
      badgeCtx.shadowBlur = isPlanetTag ? 5 : 4;
      badgeCtx.fillText(text, pillX + padX + dotSpace, canvas.height * 0.5 + 1);
    }
    pixelWidth = isPlanetTag
      ? Math.max(42, Math.round(pillW * 0.54))
      : Math.max(76, Math.round(pillW * 0.52));
    pixelHeight = isPlanetTag ? 20 : 29;
    pillHalfRatioX = 0.5;
    const badgeMap = new THREE.CanvasTexture(canvas);
    badgeMap.needsUpdate = true;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: badgeMap,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        sizeAttenuation: false,
      })
    );
    sprite.scale.set(0.24, 0.03, 1);
    sprite.center.set(0.5, 0.5);
    sprite.renderOrder = 10;
    sprite.userData.labelText = text;
    sprite.userData.pixelWidth = pixelWidth;
    sprite.userData.pixelHeight = pixelHeight;
    sprite.userData.hitHalfRatioX = pillHalfRatioX;
    const scale = new THREE.Vector3();
    sprite.onBeforeRender = (renderer, _scene, camera) => {
      const height = renderer.domElement?.clientHeight || globalThis.innerHeight || 800,
        focal = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov || 55) / 2));
      sprite.parent?.getWorldScale(scale);
      if (!sprite.parent) scale.set(1, 1, 1);
      sprite.scale.set(
        sprite.userData.pixelWidth / focal / Math.max(0.0001, Math.abs(scale.x)),
        sprite.userData.pixelHeight / focal / Math.max(0.0001, Math.abs(scale.y)),
        1
      );
    };
    return sprite;
  }

  let font = Math.min(32, Math.max(25, fontSize));
  if (ctx) {
    ctx.font = `${font}px Segoe UI, sans-serif`;
    const measured = ctx.measureText?.(text)?.width;
    if (measured > 480) {
      font *= 480 / measured;
      ctx.font = `${font}px Segoe UI, sans-serif`;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eaf6ff';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 5;
    ctx.fillText(text, 256, 42);
  }
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      depthTest: false,
      depthWrite: false,
      transparent: true,
      sizeAttenuation: false,
    }),
  );
  sprite.scale.set(0.24, 0.03, 1);
  sprite.center.set(0.5, 0.5);
  sprite.renderOrder = 9;
  sprite.userData.labelText = text;
  sprite.userData.pixelWidth = pixelWidth;
  sprite.userData.pixelHeight = pixelHeight;
  const scale = new THREE.Vector3();
  sprite.onBeforeRender = (renderer, _scene, camera) => {
    const height = renderer.domElement?.clientHeight || globalThis.innerHeight || 800,
      focal = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov || 55) / 2));
    sprite.parent?.getWorldScale(scale);
    if (!sprite.parent) scale.set(1, 1, 1);
    sprite.scale.set(
      sprite.userData.pixelWidth / focal / Math.max(0.0001, Math.abs(scale.x)),
      sprite.userData.pixelHeight / focal / Math.max(0.0001, Math.abs(scale.y)),
      1,
    );
  };
  return sprite;
}

const _planetWorldPos = new THREE.Vector3();
const _planetCamPos = new THREE.Vector3();
const _planetProj = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();

/**
 * Posiciona etiquetas de planetas orientadas a la cámara en espacio 3D sin distorsionar
 * escalas astronómicas ni permitir solapamientos entre nombres visibles.
 */
export function placeSpacePlanetLabels(
  entries,
  camera,
  { width = 1280, height = 800, left = 24, right = 24, top = 74, bottom = 74 } = {}
) {
  if (!entries?.length || !camera) return [];
  camera.updateMatrixWorld();
  const safeW = Math.max(320, width);
  const safeH = Math.max(240, height);
  const fovRad = THREE.MathUtils.degToRad(camera.fov || 55);
  const tanHalfFov = Math.tan(fovRad * 0.5);
  const focalPx = safeH / (2 * Math.max(1e-4, tanHalfFov));

  _camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  _camUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();

  const visibleItems = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const sprite = entry.label;
    if (!sprite) continue;
    if (entry.allowed === false || !entry.pivot) {
      sprite.visible = false;
      sprite.userData.screenBox = null;
      entry.screenHit = null;
      continue;
    }

    entry.pivot.getWorldPosition(_planetWorldPos);
    _planetCamPos.copy(_planetWorldPos).applyMatrix4(camera.matrixWorldInverse);
    const camDepth = -_planetCamPos.z;
    if (!Number.isFinite(camDepth) || camDepth <= 1e-5) {
      sprite.visible = false;
      sprite.userData.screenBox = null;
      entry.screenHit = null;
      continue;
    }

    _planetProj.copy(_planetWorldPos).project(camera);
    if (
      !Number.isFinite(_planetProj.x) ||
      !Number.isFinite(_planetProj.y) ||
      _planetProj.z > 1 ||
      _planetProj.z < -1 ||
      Math.abs(_planetProj.x) > 1.06 ||
      Math.abs(_planetProj.y) > 1.06
    ) {
      sprite.visible = false;
      sprite.userData.screenBox = null;
      entry.screenHit = null;
      continue;
    }

    const anchorPxX = (_planetProj.x * 0.5 + 0.5) * safeW;
    const anchorPxY = (-_planetProj.y * 0.5 + 0.5) * safeH;
    const bodyRadius = Math.max(0.0001, Number(entry.radius || 0.1));
    const apparentRadiusPx = Math.max(5, Math.min(115, (bodyRadius / camDepth) * focalPx));

    visibleItems.push({
      entry,
      sprite,
      worldPos: _planetWorldPos.clone(),
      camDepth,
      anchorPxX,
      anchorPxY,
      apparentRadiusPx,
      boxW: (sprite.userData.pixelWidth || 72) + 8,
      boxH: (sprite.userData.pixelHeight || 20) + 4,
    });
  }

  // Priorizar objetos más cercanos a la cámara para evitar que los lejanos empujen a los cercanos
  visibleItems.sort((a, b) => a.camDepth - b.camDepth);

  const placedBoxes = [];

  for (let i = 0; i < visibleItems.length; i++) {
    const item = visibleItems[i];
    const hw = item.boxW * 0.5;
    const hh = item.boxH * 0.5;
    const edgeGap = Math.min(24, item.apparentRadiusPx + 5);
    const liftY = edgeGap + hh;
    const sideX = edgeGap + hw;

    // Candidatos cercanos abrazando el borde del planeta sin taparlo ni desconectarse
    const candidateOffsets = [
      [0, -liftY],
      [sideX * 0.72, -(edgeGap * 0.55 + hh)],
      [-sideX * 0.72, -(edgeGap * 0.55 + hh)],
      [sideX, 0],
      [-sideX, 0],
      [0, liftY],
      [sideX * 0.72, edgeGap * 0.55 + hh],
      [-sideX * 0.72, edgeGap * 0.55 + hh],
      [0, -(liftY + 22)],
      [0, liftY + 22],
      [sideX + 26, -hh],
      [-(sideX + 26), -hh],
    ];

    let bestBox = null;
    for (let k = 0; k < candidateOffsets.length; k++) {
      const [ox, oy] = candidateOffsets[k];
      const cx = Math.min(safeW - right - hw, Math.max(left + hw, item.anchorPxX + ox));
      const cy = Math.min(safeH - bottom - hh, Math.max(top + hh, item.anchorPxY + oy));
      const candidate = {
        left: cx - hw,
        right: cx + hw,
        top: cy - hh,
        bottom: cy + hh,
        cx,
        cy,
      };
      const overlapsLabel = placedBoxes.some(
        (b) =>
          candidate.left < b.right &&
          candidate.right > b.left &&
          candidate.top < b.bottom &&
          candidate.bottom > b.top
      );
      if (!overlapsLabel) {
        bestBox = candidate;
        break;
      }
    }

    if (!bestBox) {
      // Espiral radial compacta alrededor del astro para resolver aglomeraciones cercanas sin alejar demasiado el nombre
      for (let ring = 1; ring <= 4 && !bestBox; ring++) {
        for (let step = 0; step < 8; step++) {
          const ang = (step / 8) * Math.PI * 2 - Math.PI / 2;
          const distX = sideX + ring * 18;
          const distY = liftY + ring * 18;
          const cx = Math.min(safeW - right - hw, Math.max(left + hw, item.anchorPxX + Math.cos(ang) * distX));
          const cy = Math.min(safeH - bottom - hh, Math.max(top + hh, item.anchorPxY + Math.sin(ang) * distY));
          const candidate = { left: cx - hw, right: cx + hw, top: cy - hh, bottom: cy + hh, cx, cy };
          const overlapsLabel = placedBoxes.some(
            (b) =>
              candidate.left < b.right &&
              candidate.right > b.left &&
              candidate.top < b.bottom &&
              candidate.bottom > b.top
          );
          if (!overlapsLabel) {
            bestBox = candidate;
            break;
          }
        }
      }
      if (!bestBox) {
        const cx = Math.min(safeW - right - hw, Math.max(left + hw, item.anchorPxX));
        const cy = Math.min(safeH - bottom - hh, Math.max(top + hh, item.anchorPxY - liftY));
        bestBox = { left: cx - hw, right: cx + hw, top: cy - hh, bottom: cy + hh, cx, cy };
      }
    }

    placedBoxes.push(bestBox);

    const dxPx = bestBox.cx - item.anchorPxX;
    const dyPx = bestBox.cy - item.anchorPxY;
    // Convertir desplazamiento exacto en píxeles a espacio 3D del plano paralelo a la cámara en camDepth
    const worldPerPx = (2 * item.camDepth * tanHalfFov) / safeH;
    const dxWorld = dxPx * worldPerPx;
    const dyWorld = -dyPx * worldPerPx;

    item.sprite.position
      .copy(item.worldPos)
      .addScaledVector(_camRight, dxWorld)
      .addScaledVector(_camUp, dyWorld);
    item.sprite.visible = true;
    item.sprite.userData.screenBox = bestBox;
    item.entry.screenHit = {
      name: item.entry.name,
      anchorPxX: item.anchorPxX,
      anchorPxY: item.anchorPxY,
      planetRadiusPx: Math.max(15, item.apparentRadiusPx + 6),
      labelBox: bestBox,
      depth: item.camDepth,
    };
  }

  return visibleItems;
}
