import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { buildKronoxAvatarMesh, KRONOX_AVATAR_STATES } from '../scene/kronoxAvatar3D.js';

/**
 * Interactive 3D WebGL Hologram Stage for Kronox IA.
 * Renders the rigged humanoid holographic avatar in real time using Three.js,
 * coordinating its skeletal animation state (IDLE, GREETING, TALKING, EXPLAINING,
 * POINTING, NAVIGATING, LISTENING, SUCCESS, FAREWELL) and audio-level vocal aperture
 * with the live state of the expedition.
 */
export default function KronoxAvatarStage({
  animState = 'IDLE',
  speaking = false,
  audioLevels = [],
  pointDirection = 'right',
  compact = false,
  onClickAvatar,
}) {
  const mountRef = useRef(null);
  const stateRef = useRef({
    animState,
    speaking,
    audioLevel: 0.08,
    pointDirection,
  });

  useEffect(() => {
    const avg =
      Array.isArray(audioLevels) && audioLevels.length > 0
        ? audioLevels.slice(0, 16).reduce((acc, v) => acc + (Number(v) || 0), 0) / 16
        : speaking
          ? 0.42
          : 0.06;
    stateRef.current = {
      animState: KRONOX_AVATAR_STATES.includes(animState) ? animState : 'IDLE',
      speaking: Boolean(speaking),
      audioLevel: avg,
      pointDirection: pointDirection || 'right',
    };
  }, [animState, speaking, audioLevels, pointDirection]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
    } catch {
      return undefined;
    }

    const width = container.clientWidth || (compact ? 110 : 165);
    const height = container.clientHeight || (compact ? 140 : 210);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 20);
    camera.position.set(0, 0.08, 2.55);
    camera.lookAt(0, 0.02, 0);

    // Holographic Studio Lighting
    const ambient = new THREE.AmbientLight(0x7dd3fc, 0.85);
    const keyLight = new THREE.DirectionalLight(0x38bdf8, 1.45);
    keyLight.position.set(1.8, 2.4, 2.5);
    const rimLight = new THREE.PointLight(0xfef08a, 1.15, 6);
    rimLight.position.set(-1.5, 0.9, -1.2);
    scene.add(ambient, keyLight, rimLight);

    const avatar = buildKronoxAvatarMesh();
    scene.add(avatar.root);

    const clock = new THREE.Clock();
    let rafId = null;
    let disposed = false;

    const animate = () => {
      if (disposed) return;
      rafId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.1);
      const s = stateRef.current;
      const effectiveState =
        s.speaking && (s.animState === 'IDLE' || s.animState === 'LISTENING')
          ? 'TALKING'
          : s.animState;
      avatar.update(dt, {
        state: effectiveState,
        speaking: s.speaking,
        audioLevel: s.audioLevel,
        pointDirection: s.pointDirection,
      });
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || (compact ? 110 : 165);
      const h = container.clientHeight || (compact ? 140 : 210);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [compact]);

  return (
    <div
      className={`kronoxAvatar3DContainer ${compact ? 'is-compact' : ''} state-${animState.toLowerCase()}`}
      onClick={onClickAvatar}
      role={onClickAvatar ? 'button' : 'img'}
      tabIndex={onClickAvatar ? 0 : -1}
      aria-label={`Proyección holográfica 3D de Kronox IA (estado: ${animState})`}
      title="Kronox IA · Proyección Holográfica 3D"
    >
      <div ref={mountRef} className="kronoxAvatarCanvasMount" />
      <div className="kronoxAvatarStateChip">
        <span className="kronoxAvatarHoloDot" />
        <small>{animState}</small>
      </div>
    </div>
  );
}

