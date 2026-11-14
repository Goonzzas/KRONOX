export const GRAPHICS_PRESET_IDS = ['low', 'medium', 'high'];

export const GRAPHICS_PRESET_OPTIONS = [
  { id: 'auto', label: 'Automática' },
  { id: 'low', label: 'Bajo' },
  { id: 'medium', label: 'Medio' },
  { id: 'high', label: 'Alto' },
];

export const GRAPHICS_PRESETS = {
  low: {
    id: 'low',
    label: 'Bajo',
    shortLabel: 'Bajo',
    description:
      'Máxima fluidez para GPUs integradas o laptops modestos: escala de render reducida, sin sombras dinámicas y densidad de partículas optimizada.',
    renderScale: 0.75,
    maxDpr: 1.0,
    shadowQuality: 'off',
    shadowMapSize: 512,
    visualEffects: 'low',
    fpsLimit: 0,
    antialias: false,
    starBudgetFactor: 0.42,
    particleFactor: 0.35,
    proceduralTexSize: 128,
    astroMetricsIntervalMs: 260,
    hudThrottleMs: 110,
  },
  medium: {
    id: 'medium',
    label: 'Medio',
    shortLabel: 'Medio',
    description:
      'Equilibrio entre detalle espacial y estabilidad a 60 FPS para portátiles estándar y equipos de gama media.',
    renderScale: 1.0,
    maxDpr: 1.1,
    shadowQuality: 'standard',
    shadowMapSize: 1024,
    visualEffects: 'medium',
    fpsLimit: 0,
    antialias: true,
    starBudgetFactor: 0.72,
    particleFactor: 0.68,
    proceduralTexSize: 192,
    astroMetricsIntervalMs: 140,
    hudThrottleMs: 70,
  },
  high: {
    id: 'high',
    label: 'Alto',
    shortLabel: 'Alto',
    description:
      'Calidad visual completa para GPU dedicada: sombras suaves de alta resolución, densidad estelar máxima y efectos volumétricos completos.',
    renderScale: 1.0,
    maxDpr: 1.75,
    shadowQuality: 'high',
    shadowMapSize: 2048,
    visualEffects: 'high',
    fpsLimit: 0,
    antialias: true,
    starBudgetFactor: 1.0,
    particleFactor: 1.0,
    proceduralTexSize: 256,
    astroMetricsIntervalMs: 80,
    hudThrottleMs: 42,
  },
};

export const RENDER_SCALE_OPTIONS = [
  { id: 0.6, label: '60% · Ultra fluidez' },
  { id: 0.75, label: '75% · Rendimiento' },
  { id: 1.0, label: '100% · Nativa' },
  { id: 1.25, label: '125% · Alta nitidez' },
  { id: 1.5, label: '150% · Súper muestreo' },
];

export const SHADOW_QUALITY_OPTIONS = [
  { id: 'off', label: 'Desactivadas' },
  { id: 'standard', label: 'Estándar' },
  { id: 'high', label: 'Altas' },
];

export const VISUAL_EFFECTS_OPTIONS = [
  { id: 'low', label: 'Bajos' },
  { id: 'medium', label: 'Medios' },
  { id: 'high', label: 'Altos' },
];

export const FPS_LIMIT_OPTIONS = [
  { id: 30, label: '30 FPS' },
  { id: 60, label: '60 FPS' },
  { id: 120, label: '120 FPS' },
  { id: 0, label: 'Ilimitado' },
];

export const DEFAULT_GRAPHICS_SETTINGS = {
  preset: 'auto',
  renderScale: null,
  shadowQuality: null,
  visualEffects: null,
  fpsLimit: 0,
};

export function normalizeGraphicsPreset(value, fallback = 'auto') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'performance' || raw === 'low' || raw === 'bajo') return 'low';
  if (raw === 'balanced' || raw === 'medium' || raw === 'medio') return 'medium';
  if (raw === 'quality' || raw === 'high' || raw === 'alto') return 'high';
  if (raw === 'auto' || raw === 'automatic' || raw === 'automática' || raw === 'automatica') {
    return 'auto';
  }
  return fallback;
}

export function detectHardwareCapabilities({
  navigatorObj = typeof navigator !== 'undefined' ? navigator : null,
  windowObj = typeof window !== 'undefined' ? window : null,
  glRendererString = '',
  glVendorString = '',
  maxTextureSize = 8192,
} = {}) {
  const cores = Number(navigatorObj?.hardwareConcurrency) || 4;
  const memoryGb =
    Number.isFinite(Number(navigatorObj?.deviceMemory)) && Number(navigatorObj?.deviceMemory) > 0
      ? Number(navigatorObj.deviceMemory)
      : null;
  const dpr = Math.max(1, Number(windowObj?.devicePixelRatio) || 1);
  const coarsePointer = Boolean(
    windowObj?.matchMedia?.('(max-width: 760px), (pointer: coarse)')?.matches,
  );
  const ua = String(navigatorObj?.userAgent || '').toLowerCase();
  const isMobile =
    coarsePointer || /android|iphone|ipad|ipod|mobile|tablet/.test(ua);
  const renderer = String(glRendererString || '').toLowerCase();
  const vendor = String(glVendorString || '').toLowerCase();

  const isSoftwareRenderer =
    /swiftshader|llvmpipe|softpipe|mesa offscreen|microsoft basic render|angle \(google, vulkan .*swiftshader/.test(
      renderer,
    );
  const isDedicatedGpu =
    /nvidia|geforce|rtx\b|gtx\b|radeon rx|radeon pro|quadro|tesla|arc\b|titan|apple m[234]\s*(pro|max|ultra)/.test(
      renderer,
    ) || /nvidia|amd/.test(vendor) && !/radeon\(tm\) graphics|vega/.test(renderer);
  const isIntegratedGpu =
    /intel|uhd graphics|hd graphics|iris|radeon\(tm\) graphics|vega|mali|adreno|powervr|apple gpu/.test(
      renderer,
    );

  let recommendedPreset = 'medium';
  let reason = 'hardware estándar detectado';

  if (isSoftwareRenderer) {
    recommendedPreset = 'low';
    reason = 'renderizado por software detectado';
  } else if (isMobile) {
    recommendedPreset = cores >= 8 && (memoryGb == null || memoryGb >= 6) ? 'medium' : 'low';
    reason = 'dispositivo móvil o pantalla táctil';
  } else if (isDedicatedGpu && cores >= 4 && (memoryGb == null || memoryGb >= 6)) {
    recommendedPreset = 'high';
    reason = 'GPU dedicada detectada';
  } else if (isIntegratedGpu) {
    if (cores <= 4 || (memoryGb != null && memoryGb <= 4)) {
      recommendedPreset = 'low';
      reason = 'GPU integrada con recursos limitados';
    } else {
      recommendedPreset = 'medium';
      reason = 'GPU integrada moderna detectada';
    }
  } else if (cores <= 2 || (memoryGb != null && memoryGb <= 4) || maxTextureSize < 4096) {
    recommendedPreset = 'low';
    reason = 'CPU o memoria limitadas';
  } else if (cores >= 8 && (memoryGb == null || memoryGb >= 8) && maxTextureSize >= 8192) {
    recommendedPreset = 'high';
    reason = 'alta capacidad multi-núcleo y textura';
  }

  return {
    cores,
    memoryGb,
    dpr,
    isMobile,
    isSoftwareRenderer,
    isDedicatedGpu,
    isIntegratedGpu,
    maxTextureSize: Number(maxTextureSize) || 8192,
    glRendererString: String(glRendererString || ''),
    recommendedPreset,
    reason,
  };
}

export function detectRecommendedGraphicsProfile(options = {}) {
  return detectHardwareCapabilities(options).recommendedPreset;
}

export function extractWebGLHardwareInfo(renderer) {
  try {
    const gl = renderer?.getContext?.();
    if (!gl) {
      return {
        glRendererString: '',
        glVendorString: '',
        maxTextureSize: renderer?.capabilities?.maxTextures ? 8192 : 4096,
      };
    }
    const debugExt = gl.getExtension?.('WEBGL_debug_renderer_info');
    const glRendererString = debugExt
      ? String(gl.getParameter?.(debugExt.UNMASKED_RENDERER_WEBGL) || '')
      : String(gl.getParameter?.(gl.RENDERER) || '');
    const glVendorString = debugExt
      ? String(gl.getParameter?.(debugExt.UNMASKED_VENDOR_WEBGL) || '')
      : String(gl.getParameter?.(gl.VENDOR) || '');
    const maxTextureSize = Number(gl.getParameter?.(gl.MAX_TEXTURE_SIZE)) || 8192;
    return { glRendererString, glVendorString, maxTextureSize };
  } catch {
    return { glRendererString: '', glVendorString: '', maxTextureSize: 8192 };
  }
}

export function detectCompressedTextureSupport(renderer) {
  try {
    const gl = renderer?.getContext?.();
    if (!gl?.getExtension) {
      return { s3tc: false, etc2: false, astc: false, bptc: false, any: false };
    }
    const s3tc = Boolean(
      gl.getExtension('WEBGL_compressed_texture_s3tc') ||
        gl.getExtension('MOZ_WEBGL_compressed_texture_s3tc'),
    );
    const etc2 = Boolean(gl.getExtension('WEBGL_compressed_texture_etc'));
    const astc = Boolean(gl.getExtension('WEBGL_compressed_texture_astc'));
    const bptc = Boolean(gl.getExtension('EXT_texture_compression_bptc'));
    return {
      s3tc,
      etc2,
      astc,
      bptc,
      any: s3tc || etc2 || astc || bptc,
    };
  } catch {
    return { s3tc: false, etc2: false, astc: false, bptc: false, any: false };
  }
}

export function resolveEffectiveGraphicsSettings(
  rawSettings = {},
  {
    autoDetectedPreset = 'medium',
    devicePixelRatio = 1,
  } = {},
) {
  const normalizedInput =
    typeof rawSettings === 'string'
      ? { preset: normalizeGraphicsPreset(rawSettings) }
      : { ...DEFAULT_GRAPHICS_SETTINGS, ...(rawSettings || {}) };

  const requestedPreset = normalizeGraphicsPreset(normalizedInput.preset, 'auto');
  const resolvedAutoPreset =
    normalizeGraphicsPreset(autoDetectedPreset, 'medium') === 'auto'
      ? 'medium'
      : normalizeGraphicsPreset(autoDetectedPreset, 'medium');
  const activePresetId =
    requestedPreset === 'auto' ? resolvedAutoPreset : requestedPreset;
  const presetSpec = GRAPHICS_PRESETS[activePresetId] || GRAPHICS_PRESETS.medium;

  const renderScaleRaw = Number(normalizedInput.renderScale);
  const renderScale =
    Number.isFinite(renderScaleRaw) && renderScaleRaw > 0
      ? Math.max(0.5, Math.min(1.5, renderScaleRaw))
      : presetSpec.renderScale;

  const shadowQualityRaw = String(normalizedInput.shadowQuality || '').toLowerCase();
  const shadowQuality =
    shadowQualityRaw === 'off' || shadowQualityRaw === 'standard' || shadowQualityRaw === 'high'
      ? shadowQualityRaw
      : presetSpec.shadowQuality;

  const visualEffectsRaw = String(normalizedInput.visualEffects || '').toLowerCase();
  const visualEffects =
    visualEffectsRaw === 'low' || visualEffectsRaw === 'medium' || visualEffectsRaw === 'high'
      ? visualEffectsRaw
      : presetSpec.visualEffects;

  const fpsLimitRaw =
    normalizedInput.fpsLimit == null || normalizedInput.fpsLimit === ''
      ? NaN
      : Number(normalizedInput.fpsLimit);
  const fpsLimit =
    Number.isFinite(fpsLimitRaw) && fpsLimitRaw >= 0
      ? Math.round(fpsLimitRaw)
      : presetSpec.fpsLimit;

  const visualSpec = GRAPHICS_PRESETS[visualEffects] || presetSpec;
  const baseDpr = Math.min(presetSpec.maxDpr, Math.max(1, Number(devicePixelRatio) || 1));
  const effectivePixelRatio = Math.max(0.5, Math.min(2.0, +(baseDpr * renderScale).toFixed(3)));

  return {
    requestedPreset,
    preset: activePresetId,
    autoDetectedPreset: resolvedAutoPreset,
    presetLabel: presetSpec.label,
    renderScale,
    effectivePixelRatio,
    shadowQuality,
    shadowsEnabled: shadowQuality !== 'off',
    shadowMapSize: shadowQuality === 'high' ? 2048 : shadowQuality === 'standard' ? 1024 : 512,
    visualEffects,
    fpsLimit,
    minFrameIntervalMs: fpsLimit > 0 ? 1000 / fpsLimit : 0,
    antialias: presetSpec.antialias,
    starBudgetFactor: visualSpec.starBudgetFactor,
    particleFactor: visualSpec.particleFactor,
    proceduralTexSize: visualSpec.proceduralTexSize,
    astroMetricsIntervalMs: visualSpec.astroMetricsIntervalMs,
    hudThrottleMs: visualSpec.hudThrottleMs,
    maxAnisotropy: visualEffects === 'high' ? 8 : visualEffects === 'medium' ? 4 : 2,
  };
}
