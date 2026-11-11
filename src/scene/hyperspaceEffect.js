import * as THREE from 'three';
import { jumpVisualState } from './jumpSequence.js';

/** Temporary camera-relative effects. No changes to astronomical objects, lighting, textures or distribution. */
export function createHyperspaceEffect({ count = 720 } = {}) {
  const group = new THREE.Group();
  group.name = 'TemporaryHyperspaceCorridor';
  group.visible = false;
  const owned = new Set(),
    own = (o) => (owned.add(o), o);
  let seed = 1729;
  const random = () => (seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296;
  const positions = [],
    tips = [],
    seeds = [],
    colors = [];
  const colorPalette = [
    new THREE.Color('#38bdf8'), // Azul cielo
    new THREE.Color('#00f0ff'), // Cian eléctrico
    new THREE.Color('#ffffff'), // Núcleo blanco puro
    new THREE.Color('#67e8f9'), // Cian brillante
    new THREE.Color('#0066ff'), // Azul hiperespacio profundo
    new THREE.Color('#fb923c'), // Ámbar relativista
    new THREE.Color('#f59e0b'), // Oro túnel
    new THREE.Color('#e0f2fe'), // Blanco azulado intenso
  ];
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2,
      r = 2.0 + Math.pow(random(), 0.55) * 26.0,
      z = -6.0 - random() * 220.0,
      s = random(),
      color = colorPalette[Math.floor(random() * colorPalette.length)];
    for (let tip = 0; tip < 2; tip++) {
      positions.push(Math.cos(angle) * r, Math.sin(angle) * r, z);
      tips.push(tip);
      seeds.push(s);
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = own(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aTip', new THREE.Float32BufferAttribute(tips, 1));
  geometry.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uStretch: { value: 0 },
    uSpeed: { value: 0 },
    uTunnel: { value: 0 },
  };
  const material = own(
    new THREE.ShaderMaterial({
      uniforms,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aTip;attribute float aSeed;varying vec3 vColor;varying float vFade;uniform float uTime,uStretch,uSpeed,uTunnel;void main(){vec3 p=position;float travelDist=240.0;float z=-12.5-mod(-p.z+uTime*(20.0+220.0*uSpeed)*(0.6+aSeed*0.6),travelDist);float twist=0.065*uTunnel*sin(z*0.04+uTime*1.2+aSeed*3.1415);mat2 turn=mat2(cos(twist),-sin(twist),sin(twist),cos(twist));p.xy=turn*p.xy;float streakLen=1.2+uStretch*(20.0+80.0*aSeed);p.z=min(-12.5,z+aTip*streakLen);vColor=color;vFade=(0.55+0.45*aSeed)*(1.0-smoothstep(160.0,235.0,-z));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
      fragmentShader: `varying vec3 vColor;varying float vFade;uniform float uOpacity;void main(){gl_FragColor=vec4(vColor*1.65,uOpacity*vFade);}`,
    }),
  );
  const streams = new THREE.LineSegments(geometry, material);
  streams.frustumCulled = false;
  streams.renderOrder = -5;
  group.add(streams);
  const tunnelMaterial = own(
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec2 vUv;uniform float uTime,uOpacity,uTunnel;void main(){float angle=vUv.x*6.28318;float zNorm=vUv.y;float twist=sin(zNorm*10.0-uTime*3.5)*0.7;float stripe=pow(0.5+0.5*sin(angle*16.0+twist+sin(zNorm*5.0-uTime*1.8)*2.2),5.0);float fineStripe=pow(0.5+0.5*sin(angle*38.0-zNorm*18.0+uTime*5.0),7.0);float wave=0.45+0.55*sin(zNorm*20.0-uTime*8.0);vec3 colCyan=vec3(0.0,0.92,1.0);vec3 colBlue=vec3(0.08,0.4,0.98);vec3 colAmber=vec3(1.0,0.58,0.25);vec3 c=mix(colBlue,colCyan,stripe*0.75+fineStripe*0.45);c=mix(c,colAmber,pow(fineStripe,2.0)*0.4);float alpha=uOpacity*uTunnel*(0.12+stripe*0.4+fineStripe*0.28)*wave;gl_FragColor=vec4(c*1.4,alpha);}`,
    }),
  );
  const tube = new THREE.Mesh(
    own(new THREE.CylinderGeometry(24, 24, 240, 48, 1, true)),
    tunnelMaterial,
  );
  tube.rotation.x = Math.PI / 2;
  tube.position.z = -135;
  tube.frustumCulled = false;
  group.add(tube);
  const ringMaterial = own(
      new THREE.MeshBasicMaterial({
        color: 0x67e8f9,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    ),
    ring = new THREE.Mesh(own(new THREE.TorusGeometry(9, 0.08, 6, 100)), ringMaterial);
  ring.frustumCulled = false;
  group.add(ring);
  return {
    group,
    update(nav, camera, delta) {
      const visual = jumpVisualState(nav);
      group.visible = visual.opacity > 0.001;
      if (!group.visible) return;
      group.position.copy(camera.position);
      group.quaternion.copy(camera.quaternion);
      uniforms.uTime.value += delta;
      uniforms.uOpacity.value = visual.opacity;
      uniforms.uStretch.value = visual.stretch;
      uniforms.uSpeed.value = visual.speed;
      uniforms.uTunnel.value = visual.tunnel;
      ring.visible = nav.phase === 'HYPERSPACE_ENTRY';
      ring.position.z = -80 + 76 * nav.phaseProgress;
      ringMaterial.opacity = visual.threshold * 0.85;
    },
    snapshot: () => ({
      visible: group.visible,
      objects: group.children.length,
      vertices: count * 2,
      opacity: uniforms.uOpacity.value,
      stretch: uniforms.uStretch.value,
      tunnel: uniforms.uTunnel.value,
    }),
    dispose() {
      group.parent?.remove(group);
      for (const resource of owned) resource.dispose();
      owned.clear();
      group.visible = false;
    },
  };
}
