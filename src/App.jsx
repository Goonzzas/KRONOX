import { installFlightPanelLayout } from './utils/flightPanelLayout.js';
import StellarCatalogPanel from './components/StellarCatalogPanel.jsx';
import NavigationDock from './components/NavigationDock.jsx';
import './styles/navigationExperience.css';
import { scaleContext } from './scene/navigationScale.js';
import {
  createFishAudioVoiceProvider,
  FISH_AUDIO_VOICE_ID,
} from './utils/voiceProvider.js';
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { P, INFO } from './data/planetData.js';
import { setupScene } from './scene/createScene.js';
import {
  DEFAULT_GRAPHICS_SETTINGS,
  normalizeGraphicsPreset,
} from './scene/graphicsConfig.js';
import { DEFAULT_VR_SETTINGS, normalizeVrSettings } from './scene/vrControls.js';
import KronoxWidget from './components/KronoxWidget.tsx';
import ToastNotification from './components/ToastNotification.jsx';
import PlanetInfoModal from './components/PlanetInfoModal.jsx';
import QuickTravelMenu from './components/QuickTravelMenu.jsx';
import { NearbyGalaxyControls, NearbyGalaxyInfoModal } from './components/NearbyGalaxies.jsx';
import { NEARBY_GALAXIES } from './data/nearbyGalaxies.js';
import MobileFlightControls from './components/MobileFlightControls.jsx';
import SpherexDocumentary from './components/SpherexDocumentary.jsx';
const SpherexMission = React.lazy(() => import('./components/SpherexMission.jsx'));
import './styles/evidenceLab.css';
import SpherexMissionSelector from './components/SpherexMissionSelector.jsx';
import SpaceshipCockpit from './components/SpaceshipCockpit.jsx';
import PauseMenu from './components/PauseMenu.jsx';
import MainMenu from './components/MainMenu.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import RepairMissionModal from './components/RepairMissionModal.jsx';
import GameInventoryModal from './components/GameInventoryModal.jsx';
import KronoxTutorialOverlay from './components/KronoxTutorialOverlay.jsx';
import { SPHEREX_MISSION_TYPES, SPHEREX_TARGETS } from './data/spherexTargets.js';
import { processKronoxQuery, askKronoxDynamic } from './utils/kronoxAI.js';
import { loadFindingsFromStorage } from './utils/findingsStorage.js';
import {
  recordJournalActivity,
  loadGameState,
  loadExpeditionJournal,
  saveGameState,
} from './utils/expeditionJournal.js';
import {
  loadAstronautInventory,
  grantInventoryItem,
  setEquippedInventoryTool,
  loadRecordedAiMessages,
  recordAiMessageToLog,
} from './utils/astronautInventory.js';
import { detectLanguage, hasSavedLanguage, LANGUAGES, t, voiceLanguage } from './i18n.js';
import { createGameAudio } from './utils/gameAudio.js';
import { createCinematicSoundtrack } from './utils/cinematicSoundtrack.js';
import { installFloatingOverlayLayout } from './utils/floatingOverlayLayout.js';
import { createNarrativeMessage, narrativeQueue } from './state/kronoxMessages.ts';
import './styles.css';
import './styles/cinematicNavigation.css';
import './styles/flightDeckMenus.css';

const voiceProvider = createFishAudioVoiceProvider({
  endpoint: import.meta.env.BASE_URL + 'api/fish-tts',
  fallbackEndpoint: import.meta.env.BASE_URL + 'api/voice',
  referenceId: FISH_AUDIO_VOICE_ID,
  baseUrl: import.meta.env.BASE_URL,
});
const completeKronoxNarrative = (id) => narrativeQueue.complete(id);

export default function App() {
  const deviceGuess = () =>
    window.matchMedia?.('(max-width: 760px), (pointer: coarse)')?.matches ? 'mobile' : 'desktop';
  const el = useRef(),
    api = useRef(),
    dayRef = useRef(),
    distRef = useRef(),
    spR = useRef(0.1),
    paR = useRef(false),
    [real, setReal] = useState(false),
    [sp, setSp] = useState(-1),
    [pause, setPause] = useState(false),
    [f, setF] = useState(null),
    [near, setNear] = useState(null),
    [more, setMore] = useState(null),
    [language, setLanguageState] = useState(detectLanguage),
    [speaking, setSpeaking] = useState(false),
    [audioLevels, setAudioLevels] = useState(() => Array(48).fill(0)),
    [kronoxOpen, setKronoxOpen] = useState(false),
    [kronoxDialogHidden, setKronoxDialogHidden] = useState(false),
    [deviceMode, setDeviceMode] = useState(deviceGuess),
    [quality, setQualityState] = useState(() => {
      try {
        return normalizeGraphicsPreset(localStorage.getItem('kronox-quality') || 'auto', 'auto');
      } catch {
        return 'auto';
      }
    }),
    [reducedMotion, setReducedMotion] = useState(() => {
      try {
        const saved = localStorage.getItem('kronox-reduced-motion');
        return saved === 'true';
      } catch {
        return false;
      }
    }),
    [highContrast, setHighContrast] = useState(() => {
      try {
        return localStorage.getItem('kronox-high-contrast') === 'true';
      } catch {
        return false;
      }
    }),
    [ambientEnabled, setAmbientEnabled] = useState(false),
    [soundVolume, setSoundVolume] = useState(0.35),
    [navigation, setNavigation] = useState(null),
    [urlNavParams] = useState(() => {
      try {
        return typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      } catch {
        return null;
      }
    }),
    [startupMode] = useState(() => {
      if (urlNavParams?.get('observatory') === 'true' || urlNavParams?.has('target'))
        return 'observatory';
      if (urlNavParams?.get('intro') === 'false') return 'cabin';
      if (urlNavParams?.get('intro') === 'true' || urlNavParams?.get('welcome') === 'false')
        return 'intro';
      return 'welcome';
    }),
    [welcomeOpen, setWelcomeOpen] = useState(startupMode === 'welcome'),
    [missionOpen, setMissionOpen] = useState(() => {
      try {
        const p =
          typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        return p ? p.get('observatory') === 'true' || p.has('target') : false;
      } catch {
        return false;
      }
    }),
    [missionSelectorOpen, setMissionSelectorOpen] = useState(false),
    [missionArrival, setMissionArrival] = useState(false),
    [missionTraveling, setMissionTraveling] = useState(false),
    [missionLaunchTarget, setMissionLaunchTarget] = useState(null),
    [missionArrivalName, setMissionArrivalName] = useState(''),
    [missionTargetKey, setMissionTargetKey] = useState(() => {
      try {
        const p =
          typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        return p?.get('target') || 'barnard';
      } catch {
        return 'barnard';
      }
    }),
    [missionInitialStage, setMissionInitialStage] = useState('arrival'),
    [missionStageSync, setMissionStageSync] = useState('arrival'),
    [missionRecordsSync, setMissionRecordsSync] = useState([]),
    [navigationScale, setNavigationScale] = useState(() => scaleContext('solar')),
    [performanceReport, setPerformanceReport] = useState(null),
    [missionScienceSync, setMissionScienceSync] = useState(null),
    [missionFindingsSync, setMissionFindingsSync] = useState(() => loadFindingsFromStorage()),
    [selectedObject, setSelectedObject] = useState(null),
    [activeCockpitStation, setActiveCockpitStation] = useState(null),
    [freeHelmMode, setFreeHelmMode] = useState(false),
    [nearestCabinStation, setNearestCabinStation] = useState(null),
    [cabinFirstPerson, setCabinFirstPerson] = useState(true),
    [elevatorState, setElevatorState] = useState(null),
    [mechanismsState, setMechanismsState] = useState(null),
    [restingState, setRestingState] = useState(null),
    [astronautCoords, setAstronautCoords] = useState({ x: 0, z: -44.2 }),
    [astronautSectorState, setAstronautSectorState] = useState({
      deckId: 'deck-01',
      deckNumber: 1,
      deckName: 'Puente de Mando y Mirador de Proa',
      microgravityMode: 'ASSISTED',
      anchoredRailId: null,
      seated: false,
    }),
    [aiProjection, setAiProjection] = useState(null),
    [consoleProjection, setConsoleProjection] = useState(null),
    [directorState, setDirectorState] = useState(null),
    [guideObjective, setGuideObjective] = useState(''),
    [speechPaused, setSpeechPaused] = useState(false),
    [realTimeIntroActive, setRealTimeIntroActive] = useState(false),
    [introPaused, setIntroPaused] = useState(false),
    [cinematicStage, setCinematicStage] = useState(''),
    [realTimeIntroCaption, setRealTimeIntroCaption] = useState(''),
    [savedGameSnapshot, setSavedGameSnapshot] = useState(() => loadGameState()),
    [aiRole, setAiRole] = useState('Entidad Luminosa 3D'),
    [aiAvatarState, setAiAvatarState] = useState('Acompañamiento'),
    [aiPointDirection, setAiPointDirection] = useState('right'),
    [aiEpistemicCategory, setAiEpistemicCategory] = useState('Comunicación espacial en puente 3D'),
    [aiHighlightField, setAiHighlightField] = useState(false),
    [spherexDocOpen, setSpherexDocOpen] = useState(false),
    [aiHistory, setAiHistory] = useState([]),
    [savedExpedition, setSavedExpedition] = useState(() => {
      try {
        const raw = localStorage.getItem('kronox-expedition-progress');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }),
    [voice, setVoice] = useState(() => {
      try {
        return new URLSearchParams(window.location.search).get('voice') !== 'false';
      } catch {
        return true;
      }
    }),
    [voiceBlockedByAutoplay, setVoiceBlockedByAutoplay] = useState(false),
    [voiceError, setVoiceError] = useState(''),
    [introMusicBlocked, setIntroMusicBlocked] = useState(false),
    [fishVoiceStatus, setFishVoiceStatus] = useState(null),
    [voiceAccent, setVoiceAccent] = useState(() => voiceLanguage(detectLanguage(), 'es-US')),
    [notice, setNotice] = useState(null),
    [countdown, setCountdown] = useState(null),
    [fl, setFl] = useState({ orb: 1, lab: 0, ax: 0, vel: 0, gal: 0 }),
    [open, setOpen] = useState(false),
    [menuSection, setMenuSection] = useState('interface'),
    [quickOpen, setQuickOpen] = useState(false),
    [nearbyMapActive, setNearbyMapActive] = useState(false),
    [nearbyGalaxyKey, setNearbyGalaxyKey] = useState('milky-way'),
    [nearbyGalaxyInfoKey, setNearbyGalaxyInfoKey] = useState(null),
    [src, setSrc] = useState(false),
    [fr, setFr] = useState(false),
    [spec, setSpec] = useState(false),
    [intro, setIn] = useState(false),
    [pv, setPv] = useState(3),
    [fo, setFo] = useState({ tr: 1, in: 0, au: 0 }),
    [fov, setFov] = useState(55),
    [fv, setFv] = useState(60),
    [visualProfile, setVisualProfile] = useState('cinematic'),
    [pauseMenuOpen, setPauseMenuOpen] = useState(false),
    [pauseMenuSection, setPauseMenuSection] = useState('save'),
    [observationModeInfo, setObservationModeInfo] = useState(null),
    [planetaryTelemetry, setPlanetaryTelemetry] = useState(null),
    [reticleTarget, setReticleTarget] = useState(null),
    [showFullMainMenu, setShowFullMainMenu] = useState(false),
    [personalHubOpen, setPersonalHubOpen] = useState(false),
    [personalHubTab, setPersonalHubTab] = useState('map'),
    [inventoryState, setInventoryState] = useState(() => loadAstronautInventory()),
    [recordedAiMessages, setRecordedAiMessages] = useState(() => loadRecordedAiMessages()),
    [guideState, setGuideState] = useState({ active: false, step: 'free', completed: false }),
    [heldToolId, setHeldToolId] = useState(null),
    [interactionFeedback, setInteractionFeedback] = useState(null),
    [voiceFailed, setVoiceFailed] = useState(false),
    [graphicsRuntime, setGraphicsRuntime] = useState(null),
    [pointerLockState, setPointerLockState] = useState({
      supported: true,
      active: false,
      eligible: false,
      fallbackMode: false,
    }),
    [assetLoadingState, setAssetLoadingState] = useState(null),
    [sceneReady, setSceneReady] = useState(false),
    [initialLoadingComplete, setInitialLoadingComplete] = useState(false),
    [gameSettings, setGameSettings] = useState(() => {
      let initialPreset = 'auto';
      try {
        initialPreset = normalizeGraphicsPreset(localStorage.getItem('kronox-quality') || 'auto', 'auto');
      } catch {
        initialPreset = 'auto';
      }
      const defaults = {
        settingsVersion: 5,
        cameraSensitivity: 'normal',
        showSubtitles: true,
        subtitleSize: 'normal',
        masterVolume: 0.85,
        musicVolume: 0.38,
        sfxVolume: 0.65,
        voiceVolume: 0.95,
        voiceName: 'Charon',
        showTelescopeTelemetry: true,
        graphics: {
          ...DEFAULT_GRAPHICS_SETTINGS,
          preset: initialPreset,
        },
        vr: {
          ...DEFAULT_VR_SETTINGS,
        },
      };
      try {
        const raw = localStorage.getItem('kronox-game-settings-v1');
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        const migratedMusic =
          !parsed.settingsVersion && Number(parsed.musicVolume) === 0.7
            ? 0.38
            : parsed.musicVolume ?? defaults.musicVolume;
        const mergedGraphics = {
          ...DEFAULT_GRAPHICS_SETTINGS,
          preset: initialPreset,
          ...(parsed.graphics && typeof parsed.graphics === 'object' ? parsed.graphics : {}),
        };
        mergedGraphics.preset = normalizeGraphicsPreset(mergedGraphics.preset, 'auto');
        const migratedVr =
          (!parsed.settingsVersion || Number(parsed.settingsVersion) < 5) &&
          parsed.vr?.turnMode === 'snap'
            ? { ...parsed.vr, turnMode: 'smooth' }
            : parsed.vr;
        return {
          ...defaults,
          ...parsed,
          settingsVersion: 5,
          musicVolume: migratedMusic,
          voiceName: 'Charon',
          graphics: mergedGraphics,
          vr: normalizeVrSettings(migratedVr),
        };
      } catch {
        return defaults;
      }
    }),
    [vrState, setVrState] = useState({
      supported: null,
      webxrApi: false,
      secureContext: true,
      presenting: false,
      connectedHands: 0,
      reason: 'probing',
      settings: DEFAULT_VR_SETTINGS,
    }),
    realTimeIntroActiveRef = useRef(false),
    mainMenuVisibleRef = useRef(welcomeOpen || false),
    introPausedRef = useRef(false),
    pauseMenuOpenRef = useRef(false),
    personalHubOpenRef = useRef(false),
    activeCockpitStationRef = useRef(null),
    missionOpenRef = useRef(false),
    browserVoiceActiveRef = useRef(false),
    voiceStartWatchdogRef = useRef(null),
    voiceMaxWatchdogRef = useRef(null),
    voiceAudioBlobCacheRef = useRef(new Map()),
    interactionFeedbackTimerRef = useRef(null),
    prevSettingMgRef = useRef(null),
    gameSettingsRef = useRef(gameSettings),
    flR = useRef(fl),
    countTimers = useRef([]),
    missionTravelTipTimer = useRef(null),
    voiceRef = useRef(true),
    voiceBlockedByAutoplayRef = useRef(false),
    voiceAudio = useRef(null),
    voiceObjectUrlRef = useRef(null),
    fishVoiceStatusRef = useRef(null),
    voiceToken = useRef(0),
    voiceQueueRef = useRef([]),
    activeSpeechTextRef = useRef(''),
    lastSpokenTextRef = useRef(''),
    voiceGapTimerRef = useRef(null),
    voiceAccentRef = useRef(voiceAccent),
    noticeQueue = useRef([]),
    noticeRef = useRef(null),
    noticeTimer = useRef(null),
    gameAudioRef = useRef(null),
    introSoundtrackRef = useRef(null),
    introMusicElementRef = useRef(null),
    cockpitInsideRef = useRef(false);
  useEffect(() => {
    cockpitInsideRef.current = Boolean(fr && pv == 1);
    if (!fr || pv != 1) {
      setNearestCabinStation(null);
      setActiveCockpitStation(null);
    }
  }, [fr, pv]);
  const missionOfferTimer = useRef(null);
  const clearMissionOffer = () => {
    clearTimeout(missionOfferTimer.current);
    setMissionLaunchTarget(null);
    setMissionArrival(false);
  };
  useEffect(() => () => clearTimeout(missionOfferTimer.current), []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__KRONOX_OPEN_STATION__ = (id) => setActiveCockpitStation(id);
      window.__KRONOX_OPEN_PAUSE_MENU__ = (open = true) => {
        setPauseMenuSection('save');
        setPauseMenuOpen(Boolean(open));
        api.current?.setSimulationPaused?.(Boolean(open));
      };
    }
  }, [setActiveCockpitStation]);
  const languageManuallyChosen = useRef(false);
  const languagePreferenceExists = useRef(hasSavedLanguage());
  const missionGuideSyncRef = useRef(null);
  const noviceCinematicActiveRef = useRef(false);
  const guide = useSyncExternalStore(
    narrativeQueue.subscribe,
    narrativeQueue.getSnapshot,
    narrativeQueue.getServerSnapshot,
  );
  useEffect(() => {
    if (speechPaused) narrativeQueue.pause();
    else narrativeQueue.resume();
  }, [speechPaused]);
  const setGuide = (message, options = {}) => {
    if (typeof message !== 'string')
      throw new TypeError('Narrative channel only accepts text through createNarrativeMessage.');
    const narrative = createNarrativeMessage(t(message, language), options);
    if (options.replace) narrativeQueue.replaceActive(narrative);
    else narrativeQueue.enqueue(narrative);
    const cat =
      options.intent === 'orientation' || String(options.id || '').startsWith('tut-')
        ? 'TUTORIAL'
        : options.intent === 'response' || String(options.id || '').startsWith('reply-')
          ? 'CONSULTA'
          : 'NARRATIVA';
    setRecordedAiMessages(
      recordAiMessageToLog({
        id: narrative.id,
        text: narrative.text,
        category: cat,
      }),
    );
    return narrative;
  };
  const localizeChildren = (child) =>
    Array.isArray(child)
      ? child.map(localizeChildren)
      : typeof child === 'string'
        ? t(child, language)
        : child;
  const h = (type, props, ...children) => {
    const nextProps = { ...(props || {}) };
    for (const key of ['aria-label', 'title', 'placeholder', 'alt']) {
      if (typeof nextProps[key] === 'string') nextProps[key] = t(nextProps[key], language);
    }
    if (nextProps.narrative?.text)
      nextProps.narrative = { ...nextProps.narrative, text: t(nextProps.narrative.text, language) };
    if (nextProps.voiceError) nextProps.voiceError = t(nextProps.voiceError, language);
    if (typeof type !== 'string') nextProps.language = language;
    return React.createElement(type, nextProps, ...children.map(localizeChildren));
  };
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === 'en' ? 'KRONOX · 3D Explorer' : 'KRONOX · Explorador 3D';
    const description = document.querySelector('meta[name="description"]');
    if (description)
      description.content =
        language === 'en'
          ? 'Explore the solar system in 3D with Kronox, your astral guide.'
          : 'Explora el sistema solar en 3D con Kronox, tu guía astral.';
    try {
      localStorage.setItem('kronox-language', language);
    } catch {
      /* Preference stays in memory. */
    }
  }, [language]);
  useEffect(() => installFloatingOverlayLayout(), []);
  useEffect(() => installFlightPanelLayout(), []);
  useEffect(() => {
    document.documentElement.classList.toggle('reduceMotion', reducedMotion);
    try {
      localStorage.setItem('kronox-reduced-motion', String(reducedMotion));
    } catch {
      /* Preference stays in memory. */
    }
  }, [reducedMotion]);
  useEffect(() => {
    document.documentElement.classList.toggle('highContrast', highContrast);
    try {
      localStorage.setItem('kronox-high-contrast', String(highContrast));
    } catch {
      /* Preference stays in memory. */
    }
  }, [highContrast]);
  const setQuality = (nextPreset) => {
    const normalized = normalizeGraphicsPreset(nextPreset, 'auto');
    setQualityState(normalized);
    setGameSettings((prev) => ({
      ...prev,
      graphics: {
        ...DEFAULT_GRAPHICS_SETTINGS,
        ...(prev.graphics || {}),
        preset: normalized,
        renderScale: null,
        shadowQuality: null,
        visualEffects: null,
        fpsLimit: null,
      },
    }));
  };
  useEffect(() => {
    try {
      localStorage.setItem('kronox-quality', quality);
    } catch {
      /* Preference stays in memory. */
    }
  }, [quality]);
  const playCue = (kind) => gameAudioRef.current?.cue(kind);
  const ensureGameplayAudioStarted = () => {
    const master = Number(gameSettingsRef.current?.masterVolume ?? 0.85);
    const sfx = Number(gameSettingsRef.current?.sfxVolume ?? 0.65);
    const mix = Math.max(0, Math.min(1, master * sfx));
    if (!gameAudioRef.current) {
      gameAudioRef.current = createGameAudio();
    }
    if (gameAudioRef.current) {
      gameAudioRef.current.setVolume(mix);
      gameAudioRef.current.setEnabled(mix > 0.005);
      setAmbientEnabled(mix > 0.005);
    }
    introSoundtrackRef.current?.unlock?.();
  };
  const toggleAmbient = () => {
    const master = Number(gameSettingsRef.current?.masterVolume ?? 0.85);
    const sfx = Number(gameSettingsRef.current?.sfxVolume ?? 0.65);
    const mix = Math.max(0, Math.min(1, master * sfx));
    if (!gameAudioRef.current) {
      gameAudioRef.current = createGameAudio();
      if (!gameAudioRef.current) return;
      gameAudioRef.current?.setVolume(mix);
    }
    const next = !ambientEnabled;
    gameAudioRef.current?.setEnabled(next);
    setAmbientEnabled(next);
    if (!next) gameAudioRef.current?.cue('tap');
  };
  const chooseLanguage = (nextLanguage) => {
    languageManuallyChosen.current = true;
    setLanguageState(nextLanguage);
    setVoiceAccent(voiceLanguage(nextLanguage, 'es-US'));
    try {
      localStorage.setItem('kronox-language', nextLanguage);
    } catch {
      /* Preference stays in memory. */
    }
  };
  useEffect(() => {
    if (languagePreferenceExists.current) return;
    fetch('/api/locale')
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (
          !languageManuallyChosen.current &&
          result?.language &&
          LANGUAGES.some((item) => item.code === result.language)
        ) {
          setLanguageState(result.language);
          setVoiceAccent(voiceLanguage(result.language, 'es-US'));
        }
      })
      .catch(() => { });
  }, []);
  const speakingRef = useRef(false),
    kronoxCloseTimer = useRef(null),
    kronoxDialogHiddenRef = useRef(false),
    travelRef = useRef(false),
    audioContextRef = useRef(null),
    analyserRef = useRef(null),
    audioSourceRef = useRef(null),
    audioFrameRef = useRef(null);
  spR.current = Math.pow(10, sp);
  paR.current = pause;
  flR.current = fl;
  voiceRef.current = voice;
  voiceAccentRef.current = voiceLanguage(language, voiceAccent);
  speakingRef.current = speaking;
  realTimeIntroActiveRef.current = realTimeIntroActive;
  mainMenuVisibleRef.current = Boolean(welcomeOpen || showFullMainMenu);
  introPausedRef.current = introPaused;
  pauseMenuOpenRef.current = pauseMenuOpen;
  personalHubOpenRef.current = personalHubOpen;
  activeCockpitStationRef.current = activeCockpitStation;
  missionOpenRef.current = missionOpen;
  gameSettingsRef.current = gameSettings;
  useEffect(() => {
    if (personalHubOpen) {
      api.current?.onGuidedJournalOpen?.();
    }
  }, [personalHubOpen]);
  const openKronox = () => {
    clearTimeout(kronoxCloseTimer.current);
    if (!kronoxDialogHiddenRef.current && !realTimeIntroActiveRef.current) {
      setKronoxDialogHidden(false);
    }
  };
  const closeKronoxLater = () => {
    clearTimeout(kronoxCloseTimer.current);
  };
  const stopAudioAnalysis = () => {
    if (audioFrameRef.current !== null) cancelAnimationFrame(audioFrameRef.current);
    audioFrameRef.current = null;
    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;
    setAudioLevels(Array(48).fill(0));
  };
  const startAudioAnalysis = (_audio) => {
    // Envolvente reactiva segura que mantiene el elemento <audio> conectado directamente a la salida nativa del navegador
    // (evita createMediaElementSource que puede silenciar el audio si AudioContext cambia de estado):
    if (audioFrameRef.current !== null) cancelAnimationFrame(audioFrameRef.current);
    let lastSyntheticUpdate = 0;
    const animateSyntheticLevels = (time) => {
      if (!speakingRef.current) return;
      if (time - lastSyntheticUpdate > 42) {
        const tSec = time * 0.008;
        const levels = Array.from({ length: 48 }, (_, idx) => {
          const wave =
            0.55 +
            0.35 * Math.sin(tSec * 2.3 + idx * 0.28) +
            0.25 * Math.cos(tSec * 3.7 - idx * 0.19);
          return Math.max(0.14, Math.min(3.8, wave * 1.85));
        });
        setAudioLevels(levels);
        lastSyntheticUpdate = time;
      }
      audioFrameRef.current = requestAnimationFrame(animateSyntheticLevels);
    };
    audioFrameRef.current = requestAnimationFrame(animateSyntheticLevels);
  };
  const revokeVoiceObjectUrl = () => {
    if (voiceObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(voiceObjectUrlRef.current);
      } catch { }
      voiceObjectUrlRef.current = null;
    }
  };
  const stopVoiceAndClearQueue = () => {
    voiceToken.current++;
    voiceQueueRef.current = [];
    activeSpeechTextRef.current = '';
    clearTimeout(voiceGapTimerRef.current);
    clearTimeout(voiceStartWatchdogRef.current);
    clearTimeout(voiceMaxWatchdogRef.current);
    browserVoiceActiveRef.current = false;
    if (voiceAudio.current) {
      voiceAudio.current.onended = null;
      voiceAudio.current.onerror = null;
      voiceAudio.current.pause();
      voiceAudio.current.removeAttribute('src');
      voiceAudio.current = null;
    }
    revokeVoiceObjectUrl();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    stopAudioAnalysis();
    speakingRef.current = false;
    setSpeaking(false);
  };

  const speak = (msg, options = {}) => {
    const translated = t(msg, language);
    if (!translated || !String(translated).trim()) return;
    const cleanMsg = String(translated).trim();
    lastSpokenTextRef.current = cleanMsg;
    if (!realTimeIntroActiveRef.current && !options.skipGuide) {
      kronoxDialogHiddenRef.current = false;
      setKronoxDialogHidden(false);
      if (narrativeQueue.getSnapshot()?.text !== cleanMsg) {
        setGuide(cleanMsg, {
          intent: options.intent || 'explanation',
          once: false,
          id: options.id || `speech-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          priority: options.priority ?? 5,
          replace: true,
        });
      }
    }
    if (!voiceRef.current) return;
    const master = Number(gameSettingsRef.current?.masterVolume ?? 0.85);
    const vox = Number(gameSettingsRef.current?.voiceVolume ?? 0.95);
    const voiceGain = Math.max(0, Math.min(1, master * vox));
    if (voiceGain <= 0.001) return;
    if (
      typeof Audio === 'undefined' &&
      (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance)
    ) {
      return;
    }
    // Voice audio does not forcefully pop open the command drawer;
    // subtitles display contextually via narrative queue while speaking.
    const shouldInterrupt = Boolean(options.interrupt);

    if (!shouldInterrupt && (speakingRef.current || voiceAudio.current || voiceQueueRef.current.length > 0)) {
      if (
        activeSpeechTextRef.current === cleanMsg ||
        voiceQueueRef.current.some((item) => item.text === cleanMsg)
      ) {
        return;
      }
      voiceQueueRef.current.push({ text: cleanMsg, options });
      return;
    }

    if (shouldInterrupt) {
      voiceQueueRef.current = [];
      clearTimeout(voiceGapTimerRef.current);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch { }
      }
      speakingRef.current = false;
      setSpeaking(false);
    }

    const token = ++voiceToken.current;
    activeSpeechTextRef.current = cleanMsg;
    if (voiceAudio.current) {
      voiceAudio.current.onended = null;
      voiceAudio.current.onerror = null;
      voiceAudio.current.pause();
      voiceAudio.current.removeAttribute('src');
      voiceAudio.current = null;
    }
    stopAudioAnalysis();

    // Mantener locuciones completas en un solo bloque fluido (hasta 480 caracteres para síntesis Gemini de estudio)
    const parts = [];
    let remaining = cleanMsg;
    while (remaining.length > 480) {
      let cut = -1;
      for (const sep of ['. ', '? ', '! ', '; ', ', ']) {
        const idx = remaining.lastIndexOf(sep, 480);
        if (idx >= 180) {
          cut = idx + 1;
          break;
        }
      }
      if (cut < 0) cut = remaining.lastIndexOf(' ', 480);
      if (cut < 120) cut = 480;
      parts.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining) parts.push(remaining);
    let i = 0;

    const advanceQueueOrFinish = () => {
      if (token !== voiceToken.current) return;
      stopAudioAnalysis();
      voiceAudio.current = null;
      activeSpeechTextRef.current = '';
      browserVoiceActiveRef.current = false;
      if (voiceRef.current && voiceQueueRef.current.length > 0) {
        const nextItem = voiceQueueRef.current.shift();
        speakingRef.current = true;
        setSpeaking(true);
        clearTimeout(voiceGapTimerRef.current);
        voiceGapTimerRef.current = setTimeout(() => {
          if (!voiceRef.current) {
            speakingRef.current = false;
            setSpeaking(false);
            return;
          }
          speakingRef.current = false;
          speak(nextItem.text, { ...nextItem.options, interrupt: false });
        }, 260);
        return;
      }
      setSpeaking(false);
      speakingRef.current = false;
      closeKronoxLater();
    };

    // New Novatos narration remains audible locally even when the hosted TTS keys are absent.
    const voiceStatusNow = fishVoiceStatusRef.current;
    const officialVoiceUnavailable =
      !voiceStatusNow ||
      (voiceStatusNow.configured === false && !voiceStatusNow.geminiTts?.configured);
    const canUseLocalNoviceVoice =
      options.allowBrowserFallback &&
      !voiceProvider.staticAudioUrl?.({ text: cleanMsg }) &&
      officialVoiceUnavailable &&
      typeof window !== 'undefined' &&
      window.speechSynthesis &&
      window.SpeechSynthesisUtterance;

    if (canUseLocalNoviceVoice) {
      const utterance = new window.SpeechSynthesisUtterance(cleanMsg);
      const availableVoices = window.speechSynthesis.getVoices?.() || [];
      const spanishVoice = availableVoices.find((item) => /^es([_-]|$)/i.test(item.lang || ''));
      if (spanishVoice) utterance.voice = spanishVoice;
      utterance.lang = voiceAccentRef.current || 'es-US';
      utterance.rate = 0.94;
      utterance.pitch = 0.9;
      utterance.volume = voiceGain;
      utterance.onend = () => {
        browserVoiceActiveRef.current = false;
        advanceQueueOrFinish();
      };
      utterance.onerror = () => {
        browserVoiceActiveRef.current = false;
        advanceQueueOrFinish();
      };
      browserVoiceActiveRef.current = true;
      speakingRef.current = true;
      setSpeaking(true);
      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        browserVoiceActiveRef.current = false;
        advanceQueueOrFinish();
      }
      return;
    }

    const createPreloadedAudio = (textSegment) => {
      if (typeof Audio === 'undefined') return null;
      const selectedVoice = 'Charon';
      const cacheKey = `${selectedVoice}|${voiceAccentRef.current || 'es-US'}|${textSegment}`;
      const cachedBlobUrl = voiceAudioBlobCacheRef.current.get(cacheKey);
      const staticUrl = voiceProvider.staticAudioUrl?.({ text: textSegment }) || null;
      const primaryEndpointUrl = voiceProvider.audioUrl({
        text: textSegment,
        language: voiceAccentRef.current,
        voiceId: selectedVoice,
      });
      const audioUrl = cachedBlobUrl || staticUrl || primaryEndpointUrl;
      const fallbackUrl = voiceProvider.fallbackAudioUrl({
        text: textSegment,
        language: voiceAccentRef.current,
        voiceId: selectedVoice,
      });
      const a = new Audio();
      a.src = audioUrl;
      a.preload = 'auto';
      a.playbackRate = 1.0;
      a.preservesPitch = true;
      a.volume = Math.max(
        0,
        Math.min(
          1,
          Number(gameSettingsRef.current?.masterVolume ?? 0.85) *
            Number(gameSettingsRef.current?.voiceVolume ?? 0.95),
        ),
      );
      a.muted = false;
      return {
        audio: a,
        audioUrl,
        primaryEndpointUrl,
        fallbackUrl,
        cacheKey,
        text: textSegment,
        retriedFetch: false,
      };
    };

    let preloadedNext = parts.length > 0 ? createPreloadedAudio(parts[0]) : null;

    const playNext = () => {
      if (token !== voiceToken.current || !voiceRef.current) return;
      if (i >= parts.length) return advanceQueueOrFinish();
      const currentIndex = i++;
      const currentEntry = preloadedNext || createPreloadedAudio(parts[currentIndex]);
      preloadedNext = i < parts.length ? createPreloadedAudio(parts[i]) : null;
      if (!currentEntry) {
        advanceQueueOrFinish();
        return;
      }
      const { audio, audioUrl, fallbackUrl, cacheKey, text } = currentEntry;
      voiceAudio.current = audio;
      let fallbackStarted = false;
      const handleSegmentFailure = async (entry) => {
        if (fallbackStarted || token !== voiceToken.current) return;
        // Reintentar únicamente con los endpoints de la voz oficial (Charon) y almacenar en caché Blob.
        // JAMÁS cambiar automáticamente a window.speechSynthesis ni a otra voz robótica.
        if (!entry.retriedFetch && typeof fetch === 'function') {
          entry.retriedFetch = true;
          const candidateUrls = [
            entry.audioUrl,
            entry.primaryEndpointUrl,
            entry.fallbackUrl,
          ].filter((u, idx, arr) => typeof u === 'string' && u.startsWith('/') && arr.indexOf(u) === idx);
          for (const candidateUrl of candidateUrls) {
            try {
              const resp = await fetch(candidateUrl, { cache: 'force-cache' });
              if (token !== voiceToken.current || !voiceRef.current) return;
              if (resp.ok) {
                const blob = await resp.blob();
                if (token !== voiceToken.current || !voiceRef.current) return;
                if (blob.size > 64) {
                  const objUrl = URL.createObjectURL(blob);
                  if (entry.cacheKey) {
                    voiceAudioBlobCacheRef.current.set(entry.cacheKey, objUrl);
                  }
                  if (typeof window !== 'undefined' && window.caches) {
                    window.caches
                      .open('kronox-official-voice-v1')
                      .then((c) => c.put(candidateUrl, new Response(blob)))
                      .catch(() => {});
                  }
                  const retryAudio = new Audio(objUrl);
                  retryAudio.preload = 'auto';
                  retryAudio.playbackRate = 1.0;
                  retryAudio.preservesPitch = true;
                  retryAudio.volume = Math.max(
                    0,
                    Math.min(
                      1,
                      Number(gameSettingsRef.current?.masterVolume ?? 0.85) *
                        Number(gameSettingsRef.current?.voiceVolume ?? 0.95),
                    ),
                  );
                  retryAudio.muted = false;
                  setVoiceFailed(false);
                  setVoiceError('');
                  attachAndPlay({
                    audio: retryAudio,
                    audioUrl: objUrl,
                    fallbackUrl: entry.fallbackUrl,
                    cacheKey: entry.cacheKey,
                    text: entry.text,
                    retriedFetch: true,
                  });
                  return;
                }
              }
            } catch {
              /* probar siguiente endpoint oficial */
            }
          }
        }
        fallbackStarted = true;
        voiceAudio.current = null;
        speakingRef.current = false;
        setSpeaking(false);
        stopAudioAnalysis();
        setVoiceFailed(true);
        setVoiceError(
          'Audio oficial temporalmente no disponible. Subtítulo sincronizado activo (puedes reintentar con la voz oficial).',
        );
        // Mantener el subtítulo sincronizado en pantalla durante su tiempo de lectura sin cambiar jamás a otra voz.
        const words = String(entry.text || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean).length;
        const silentReadingMs = Math.min(6500, Math.max(2200, words * 280));
        clearTimeout(voiceGapTimerRef.current);
        voiceGapTimerRef.current = setTimeout(() => {
          if (token !== voiceToken.current) return;
          playNext();
        }, silentReadingMs);
      };
      const attachAndPlay = (entry) => {
        const activeAudio = entry.audio;
        voiceAudio.current = activeAudio;
        activeAudio.onended = () => {
          playNext();
        };
        activeAudio.onerror = () => {
          handleSegmentFailure(entry);
        };
        speakingRef.current = true;
        setSpeaking(true);
        activeAudio
          .play()
          .then(() => {
            if (token === voiceToken.current) {
              voiceBlockedByAutoplayRef.current = false;
              setVoiceBlockedByAutoplay(false);
              setVoiceFailed(false);
              setVoiceError('');
              setSpeaking(true);
              speakingRef.current = true;
              if (
                entry.cacheKey &&
                !voiceAudioBlobCacheRef.current.has(entry.cacheKey) &&
                typeof fetch === 'function' &&
                entry.audioUrl.startsWith('/')
              ) {
                fetch(entry.audioUrl, { cache: 'force-cache' })
                  .then((r) => (r.ok ? r.blob() : null))
                  .then((b) => {
                    if (b && b.size > 64) {
                      const cachedUrl = URL.createObjectURL(b);
                      voiceAudioBlobCacheRef.current.set(entry.cacheKey, cachedUrl);
                    }
                  })
                  .catch(() => {});
              }
              if (entry.audioUrl.startsWith('/') || entry.audioUrl.startsWith('blob:')) {
                startAudioAnalysis(activeAudio);
              }
            }
          })
          .catch((e) => {
            if (token !== voiceToken.current) return;
            if (e && e.name === 'NotAllowedError') {
              voiceBlockedByAutoplayRef.current = true;
              setVoiceBlockedByAutoplay(true);
              setVoiceError(
                'Pulsa «INICIAR EXPLORACIÓN» para escuchar la narración de KRONOX IA.',
              );
              speakingRef.current = false;
              setSpeaking(false);
              voiceAudio.current = null;
            } else {
              handleSegmentFailure(entry);
            }
          });
      };
      attachAndPlay({
        audio,
        audioUrl,
        fallbackUrl,
        cacheKey,
        text,
        retriedFetch: false,
      });
    };
    playNext();
  },
    handleRetryVoice = () => {
      setVoiceFailed(false);
      setVoiceError('');
      voiceRef.current = true;
      setVoice(true);
      resumeSharedAudioContext();
      const textToRetry = guide?.text || lastSpokenTextRef.current;
      if (textToRetry) {
        speak(textToRetry, { interrupt: true });
      }
    },
    resumeSharedAudioContext = () => {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass && !audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
        }
        audioContextRef.current?.resume?.().catch(() => { });
      } catch {
        /* ignore */
      }
    },
    unlockAndReplayVoice = () => {
      introSoundtrackRef.current?.unlock();
      voiceRef.current = true;
      setVoice(true);
      voiceBlockedByAutoplayRef.current = false;
      setVoiceBlockedByAutoplay(false);
      setIntroMusicBlocked(false);
      setVoiceError('');
      resumeSharedAudioContext();
      // Si KRONOX IA ya está hablando o reproduciendo audio, jamás interrumpir ni reiniciar el diálogo
      if (speakingRef.current || voiceAudio.current) {
        return;
      }
      const pendingText =
        lastSpokenTextRef.current ||
        realTimeIntroCaption ||
        'Durante siglos, contemplamos el universo desde un pequeño mundo, buscando respuestas entre las estrellas.';
      if (pendingText) {
        speak(pendingText, { interrupt: false });
      }
    },
    handleToggleVoiceMute = () => {
      const next = !voice;
      voiceRef.current = next;
      setVoice(next);
      if (!next) stopVoiceAndClearQueue();
    },
    handleToggleVr = async () => {
      const cur = api.current?.getVrState?.() || vrState;
      if (cur?.presenting) {
        await api.current?.exitVr?.();
        return;
      }
      const res = await api.current?.enterVr?.();
      if (res?.ok) {
        setPauseMenuOpen(false);
        api.current?.setSimulationPaused?.(false);
        return;
      }
      if (res && !res.ok && res.message) {
        notify(res.message, 'Realidad Virtual (WebXR)');
      }
    },
    handleTestVoice = () => {
      voiceRef.current = true;
      setVoice(true);
      const testMsg =
        language === 'en'
          ? 'I am KRONOX AI. All navigation and SPHEREx scientific instruments are online.'
          : 'Soy KRONOX IA. Todos los sistemas científicos y de navegación están en línea bajo tu mando.';
      speak(testMsg, { interrupt: true, voiceName: 'Charon' });
    },
    toggleIntroPause = () => {
      const nextPaused = !introPausedRef.current;
      introPausedRef.current = nextPaused;
      setIntroPaused(nextPaused);
      api.current?.pauseRealTimeIntro?.(nextPaused);
      if (nextPaused) {
        if (voiceAudio.current && !voiceAudio.current.paused) voiceAudio.current.pause?.();
        if (typeof window !== 'undefined' && window.speechSynthesis?.speaking) {
          try {
            window.speechSynthesis.pause?.();
          } catch { }
        }
        if (introMusicElementRef.current && !introMusicElementRef.current.paused) {
          introMusicElementRef.current.pause?.();
        }
      } else {
        if (voiceAudio.current && voiceAudio.current.paused) {
          voiceAudio.current.play?.()?.catch?.(() => { });
        }
        if (typeof window !== 'undefined' && window.speechSynthesis?.paused) {
          try {
            window.speechSynthesis.resume?.();
          } catch { }
        }
        if (introMusicElementRef.current && introMusicElementRef.current.paused) {
          introMusicElementRef.current.play?.()?.catch?.(() => { });
        }
      }
    },
    skipIntroAndEnterCabin = () => {
      stopVoiceAndClearQueue();
      clearNotices();
      introPausedRef.current = false;
      setIntroPaused(false);
      introSoundtrackRef.current?.fadeOut?.(1.8);
      setRealTimeIntroActive(false);
      api.current?.skipRealTimeIntro?.();
      setFr(true);
      setPv(1);
      setMissionTargetKey('barnard');
      setAiAvatarState('Bienvenida');
    },
    say = (msg, opts = {}) => {
      kronoxDialogHiddenRef.current = false;
      setKronoxDialogHidden(false);
      setGuide(msg, { replace: true, once: false, ...opts });
    },
    showNextNotice = () => {
      const item = noticeQueue.current.shift();
      if (!item) {
        noticeRef.current = null;
        return;
      }
      noticeRef.current = item;
      setNotice(item);
      const duration = Math.min(14000, Math.max(6500, item.text.split(/\s+/).length * 380));
      noticeTimer.current = setTimeout(() => {
        setNotice(null);
        noticeRef.current = null;
        showNextNotice();
      }, duration);
    },
    notify = (text, title = 'Aviso', planet = null) => {
      if (planet && (mainMenuVisibleRef.current || realTimeIntroActiveRef.current)) return;
      noticeQueue.current.push({
        id: Date.now() + Math.random(),
        text: t(text, language),
        title: t(title, language),
        planet,
      });
      if (!noticeRef.current) showNextNotice();
    },
    clearNotices = () => {
      noticeQueue.current = [];
      clearTimeout(noticeTimer.current);
      noticeRef.current = null;
      setNotice(null);
    };
  useEffect(() => {
    const handleGestureUnlock = () => {
      if (realTimeIntroActive) {
        introSoundtrackRef.current?.unlock();
      }
      resumeSharedAudioContext();

      if (
        voiceBlockedByAutoplayRef.current ||
        introMusicBlocked ||
        (realTimeIntroActive && !speakingRef.current)
      ) {
        unlockAndReplayVoice();
      }
    };

    window.addEventListener('pointerdown', handleGestureUnlock);
    window.addEventListener('keydown', handleGestureUnlock);
    window.addEventListener('click', handleGestureUnlock);
    return () => {
      window.removeEventListener('pointerdown', handleGestureUnlock);
      window.removeEventListener('keydown', handleGestureUnlock);
      window.removeEventListener('click', handleGestureUnlock);
    };
  }, [realTimeIntroActive, introMusicBlocked, voiceBlockedByAutoplay]);
  const vrHandlersRef = useRef({});
  const vrSpeechRecRef = useRef(null);
  const lastNonEmptyGuideTextRef = useRef('');
  useEffect(() => {
    if (guide?.text) lastNonEmptyGuideTextRef.current = guide.text;
    api.current?.syncVrContext?.({
      findingsCount: missionFindingsSync.length,
      lastKronoxReply: guide?.text || lastNonEmptyGuideTextRef.current || '',
      voiceEnabled: voice,
      activeTargetKey: missionTargetKey,
      visualProfile,
    });
  }, [guide?.text, missionFindingsSync.length, voice, missionTargetKey, visualProfile]);
  useEffect(() => {
    api.current = setupScene(el.current, {
      quality,
      graphicsSettings: gameSettingsRef.current?.graphics,
      vrSettings: normalizeVrSettings(gameSettingsRef.current?.vr),
      onSceneReady: () => setSceneReady(true),
      onGraphicsStateChange: (info) => setGraphicsRuntime(info),
      onVrStateChange: (nextVr) => {
        if (nextVr) setVrState(nextVr);
        if (nextVr?.presenting) {
          setPauseMenuOpen(false);
          api.current?.setSimulationPaused?.(false);
        }
        if (nextVr && !nextVr.presenting && vrSpeechRecRef.current) {
          try {
            vrSpeechRecRef.current.stop();
          } catch { }
          vrSpeechRecRef.current = null;
        }
      },
      onVrAction: (action, payload) => vrHandlersRef.current?.[action]?.(payload),
      onVrPauseRequest: (opts) => {
        if (opts?.resumeOnly || pauseMenuOpenRef.current || api.current?.isSimulationPaused?.()) {
          setPauseMenuOpen(false);
          api.current?.setSimulationPaused?.(false);
          return;
        }
        if (api.current?.getVrState?.()?.presenting) {
          api.current?.recenterVr?.();
          return;
        }
        if (
          !pauseMenuOpenRef.current &&
          !mainMenuVisibleRef.current &&
          !realTimeIntroActiveRef.current &&
          !missionOpenRef.current
        ) {
          setPauseMenuSection('save');
          setPauseMenuOpen(true);
          api.current?.setSimulationPaused?.(true);
        }
      },
      onPointerLockChange: (st) => {
        if (st) setPointerLockState(st);
      },
      onPointerLockEscape: () => {
        if (api.current?.getVrState?.()?.presenting) return;
        if (
          !pauseMenuOpenRef.current &&
          !activeCockpitStationRef.current &&
          !mainMenuVisibleRef.current &&
          !realTimeIntroActiveRef.current &&
          !missionOpenRef.current
        ) {
          setPauseMenuSection('save');
          setPauseMenuOpen(true);
          api.current?.setSimulationPaused?.(true);
        }
      },
      onAssetLoadingState: (st) => setAssetLoadingState(st || null),
      onNavigationScale: setNavigationScale,
      onNearbyMapChange: setNearbyMapActive,
      reducedMotion: () => reducedMotion,
      voiceEnabled: () => voiceRef.current,
      // Deja que termine la locución de cada capítulo antes del corte, con límite de seguridad para que
      // una petición de audio atascada nunca pueda dejar la introducción congelada indefinidamente.
      shouldHoldIntroStage: (_stageKey, stageElapsed = 0) => {
        const narrationBusy = Boolean(
          speakingRef.current || voiceAudio.current || voiceQueueRef.current.length > 0,
        );
        return Boolean(
          introPausedRef.current ||
          (voiceRef.current && narrationBusy && stageElapsed < 14),
        );
      },
      onNearbyGalaxySelect: (key) => {
        setNearbyGalaxyKey(key);
        clearMissionOffer();
        setNearbyGalaxyInfoKey(key);
      },
      onObjectSelect: (obj) => {
        setSelectedObject(obj);
        if (obj) {
          clearMissionOffer();
          recordJournalActivity({
            type: 'INSPECT_OBJECT',
            title: `Objeto inspeccionado: ${obj.key}`,
            detail: `Categoría: ${obj.kind}`,
            objectKey: obj.key,
            objectKind: obj.kind,
          });
        }
      },
      onNearestStationChange: (st) => {
        setNearestCabinStation(st);
      },
      onStationInteract: (stationId) => {
        setActiveCockpitStation(stationId);
        if (!stationId && !A()?.isFreeHelmActive?.()) setFreeHelmMode(false);
        const vrPresenting = Boolean(api.current?.getVrState?.()?.presenting);
        const awardInventoryItem = (id) => {
          const res = grantInventoryItem(id);
          if (res?.inventory) setInventoryState(res.inventory);
        };
        if (stationId === 'comms') {
          if (!vrPresenting) {
            kronoxDialogHiddenRef.current = false;
            setKronoxDialogHidden(false);
            setKronoxOpen(true);
          }
        } else if (stationId === 'science') {
          awardInventoryItem('data-spherex-calibration');
          if (!vrPresenting) setMissionOpen(true);
        } else if (stationId === 'missions') {
          if (!vrPresenting) setMissionSelectorOpen(true);
        } else if (stationId === 'bioponics') {
          awardInventoryItem('sample-bioponic-flora');
        } else if (stationId === 'engineering') {
          awardInventoryItem('sample-cryo-he3');
        } else if (stationId === 'storage-c02' || stationId === 'galley') {
          awardInventoryItem('eva-ration-pack');
        } else if (stationId === 'optical-bench' || stationId === 'sensor-calibration') {
          awardInventoryItem('optical-coupler');
        }
      },
      onToolCollected: (toolId) => {
        setHeldToolId(toolId || null);
        if (toolId) {
          const itemKey =
            toolId === 'multitool'
              ? 'multitool'
              : toolId === 'scanner'
                ? 'scanner'
                : 'optical-coupler';
          const res = grantInventoryItem(itemKey);
          if (res?.inventory) setInventoryState(res.inventory);
        }
      },
      onInteractionFeedback: (fb) => {
        setInteractionFeedback(fb || null);
        clearTimeout(interactionFeedbackTimerRef.current);
        if (fb) {
          interactionFeedbackTimerRef.current = setTimeout(() => {
            setInteractionFeedback(null);
          }, 3200);
        }
      },
      onSeatedStateChange: (seated) =>
        setAstronautSectorState((prev) => ({ ...prev, seated: Boolean(seated) })),
      onFreeHelmChange: (enabled) => setFreeHelmMode(Boolean(enabled)),
      onCabinFirstPersonChange: (firstP) => setCabinFirstPerson(Boolean(firstP)),
      onMicrogravityStateChange: (mg) => {
        if (!mg) return;
        setAstronautSectorState((prev) => ({
          ...prev,
          microgravityMode: mg.mode || prev.microgravityMode,
          anchoredRailId: mg.anchored ? (mg.anchoredRailId || 'rail') : null,
        }));
      },
      onElevatorStateChange: (elState) => setElevatorState(elState || null),
      onMechanismsChange: (mechState) => setMechanismsState(mechState || null),
      onRestStateChange: (nextRest) => setRestingState(nextRest || null),
      onViewChange: (v) => setPv(v),
      onIntroStageChange: (stageKey, captionText, stageOpts = {}) => {
        setCinematicStage(stageKey);
        setRealTimeIntroActive(true);
        setRealTimeIntroCaption(captionText);
        // Do NOT enqueue intro prologue into Kronox IA dialogue queue to prevent duplicate speech
        if (voiceRef.current && !stageOpts?.silentVoice) {
          speak(captionText, { interrupt: false });
        }
      },
      onAiTourNarrative: (text, stateName, stationId, opts = {}) => {
        setAiAvatarState(stateName);
        const intent = /bienvenida/i.test(stateName)
          ? 'welcome'
          : /confirm/i.test(stateName)
            ? 'confirmation'
            : /orient/i.test(stateName)
              ? 'orientation'
              : 'explanation';
        const message = setGuide(text, {
          intent,
          once: opts?.once !== undefined ? Boolean(opts.once) : true,
          id: opts?.id,
          priority: opts?.priority ?? 0,
          replace: Boolean(opts?.replace),
        });
        if (voiceRef.current) {
          speak(text, {
            interrupt: Boolean(opts?.replace),
            allowBrowserFallback: noviceCinematicActiveRef.current,
          });
        }
        return message.id;
      },
      onGuideObjective: (objective) => setGuideObjective(objective || ''),
      onGuidedMissionSelectorOpen: () => setMissionSelectorOpen(true),
      onNoviceCinematicSelectDestination: () => {
        const target = SPHEREX_TARGETS.find((item) => item.key === 'barnard') || SPHEREX_TARGETS[0];
        if (target) chooseSpherexTarget(target);
      },
      onNoviceCinematicOpenMission: () => {
        missionGuideSyncRef.current = null;
        setMissionInitialStage('arrival');
        setMissionOpen(true);
        A().onGuidedMissionStarted?.();
      },
      onNoviceCinematicComplete: () => {
        noviceCinematicActiveRef.current = false;
        setMissionArrival(false);
        setMissionTraveling(false);
        setCountdown(null);
        setNavigation(null);
        setMissionOpen(false);
        A().endGuidedCabinTour?.();
      },
      onGuideStateChange: (st) => {
        setGuideState(st || { active: false, step: 'free', completed: false });
        if (!st?.active || st?.step === 'free') setGuideObjective('');
      },
      onAiScreenProjection: (proj) => {
        setAiProjection(proj);
        if (proj && proj.state) {
          setAiAvatarState(proj.state);
        }
        if (proj && Number.isFinite(proj.astronautX)) {
          setAstronautCoords({ x: proj.astronautX, z: proj.astronautZ });
          setCabinFirstPerson(Boolean(proj.cabinFirstPerson));
        }
        if (proj?.deckId) {
          setAstronautSectorState((prev) => ({
            ...prev,
            deckId: proj.deckId,
            deckName: proj.deckName || prev.deckName,
            microgravityMode: proj.microgravityMode || prev.microgravityMode,
            anchoredRailId: proj.anchoredRailId ?? null,
          }));
        }
      },
      onConsoleScreenProjection: (proj) => {
        setConsoleProjection(proj);
        if (api.current?.getObservationMode) {
          const obsInfo = api.current.getObservationMode();
          setObservationModeInfo(obsInfo);
          if (obsInfo?.opticalMagnification > 1 && api.current?.getPlanetaryObservationalTelemetry) {
            setPlanetaryTelemetry(
              api.current.getPlanetaryObservationalTelemetry(
                obsInfo.opticalTargetBody || f || near || 'Júpiter',
              ),
            );
          } else {
            setPlanetaryTelemetry(null);
          }
        }
      },
      onSceneDirectorEvent: (eventName, payload, nextState) => {
        if (nextState) setDirectorState({ ...nextState });
      },
      onNavigation: (status) => {
        setNavigation((current) => {
          if (!status) {
            if (current && current.phase !== 'countdown') travelRef.current = false;
            return current?.phase === 'countdown' ? current : null;
          }
          const progress = Math.round(status.progress * 100);
          if (
            current?.phase === status.phase &&
            Math.round((current.progress || 0) * 100) === progress
          )
            return current;
          return { ...status, label: current?.label || '' };
        });
      },
      f: setF,
      near: (n) => {
        setNear(n);
        if (
          n &&
          INFO[n] &&
          !cockpitInsideRef.current &&
          !mainMenuVisibleRef.current &&
          !realTimeIntroActiveRef.current
        )
          notify(
            'Nos acercamos a ' +
            n +
            '. ' +
            INFO[n].intro +
            ' ' +
            INFO[n].temperatura +
            ' Si quieres saber más, pulsa el botón.',
            'Información del planeta',
            n,
          );
      },
      speedNotice: (v) =>
        notify(
          'Velocidad de nave ajustada a ' +
          (v >= 1000 ? (v / 1000).toFixed(1) + ' mil' : v.toFixed(1)) +
          ' unidades por segundo.',
          'Cambio de velocidad',
        ),
      fr: setFr,
      fv: setFv,
      intro: setIn,
      speed: spR,
      pause: paR,
      fl: flR,
      day: (d) => {
        const x = dayRef.current;
        if (x && document.activeElement !== x)
          x.value = new Date(Date.UTC(2000, 0, 1, 12) + d * 864e5).toISOString().slice(0, 10);
      },
      d: (au) => {
        if (distRef.current)
          distRef.current.textContent = au
            ? 'Distancia actual al Sol: ' +
            au.toFixed(3) +
            ' UA (' +
            (au * 149.6).toFixed(1) +
            ' millones de km)'
            : '';
      },
    });
    // Ordinary page loads own the full intro, including links that only hide the welcome menu.
    // Direct science links and explicit menu/cabin choices keep their requested destination.
    try {
      if (typeof window !== 'undefined') window.__kronoxSceneApi = api.current;
      if (api.current?.isSceneReady?.()) {
        setSceneReady(true);
      }
      if (startupMode === 'intro') {
        setRealTimeIntroActive(true);
        setIntroPaused(false);
        api.current.startRealTimeIntro(() => {
          introSoundtrackRef.current?.fadeOut?.(2.8);
          setRealTimeIntroActive(false);
          setIntroPaused(false);
          setFr(true);
          setPv(1);
          setMissionTargetKey('barnard');
          setAiAvatarState('Bienvenida');
        });
      } else if (startupMode === 'cabin') {
        api.current.skipRealTimeIntro();
        setFr(true);
        setPv(1);
      } else {
        setFr(true);
        setPv(3);
        api.current.setMainMenuOrbit?.(true);
      }
      if (typeof window !== 'undefined') {
        window.__KRONOX_API__ = api.current;
        window.__KRONOX_OPEN_STATION__ = (id) => setActiveCockpitStation(id);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('KRONOX scene initialization failed:', error);
    }
    return () => {
      api.current?.dispose?.();
      api.current = null;
    };
  }, []);
  useEffect(() => () => countTimers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const soundtrack = createCinematicSoundtrack({
      src: import.meta.env.BASE_URL + 'audio/intro-score.mp3',
      audioFactory: () => introMusicElementRef.current,
      onBlocked: setIntroMusicBlocked,
    });
    introSoundtrackRef.current = soundtrack;
    const unlock = () => soundtrack?.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      soundtrack?.dispose();
      introSoundtrackRef.current = null;
    };
  }, []);
  useEffect(() => {
    if (realTimeIntroActive) {
      if (!introPaused) introSoundtrackRef.current?.start();
      // Precarga escalonada de las 10 locuciones (concurrencia acotada y caché WAV en servidor)
      if (
        typeof Audio !== 'undefined' &&
        typeof fetch === 'function' &&
        typeof window !== 'undefined' &&
        !window.__KRONOX_SCENE_HARNESS__
      ) {
        const introTexts = [
          'Durante siglos, contemplamos el universo desde un pequeño mundo azul, buscando respuestas sobre nuestro origen entre millones de estrellas.',
          'Misiones reales como el telescopio espacial NASA SPHEREx abrieron una nueva ventana infrarroja al cosmos, revelando luces ocultas al ojo humano.',
          'En cada longitud de onda infrarroja detectamos hielos primordiales, viveros de estrellas y enigmas gravitacionales más allá de los gigantes gaseosos.',
          'Para descifrar esa historia escrita entre anillos planetarios y brazos galácticos, la humanidad puso en marcha el Proyecto Horizonte.',
          'El Proyecto Horizonte construyó KRONOX Aurora-120: un crucero científico modular de ciento veinte metros diseñado para explorar desde la órbita hasta el espacio profundo.',
          'En el puente de mando coordinamos la astrometría J2000, el rumbo interestelar y los sistemas de observación de toda la expedición.',
          'La cubierta científica combina espectroscopía inspirada en NASA SPHEREx y bancos ópticos de calibración para investigar cada archivo real sin conjeturas.',
          'El módulo de habitabilidad mantiene a la tripulación en microgravedad durante largas travesías con soporte vital de ciclo cerrado y gravedad anular asistida.',
          'En ingeniería, el reactor toroidal de fusión y sus propulsores magnetoplasmadinámicos suministran la energía limpia que impulsa a KRONOX entre mundos.',
          'Soy KRONOX IA, tu inteligencia de a bordo. El puente es tuyo, comandante: calibra tus instrumentos y comienza tu primera investigación espacial.',
        ];
        const selectedVoice = 'Charon';
        (async () => {
          for (let idx = 0; idx < introTexts.length; idx += 3) {
            if (!voiceRef.current || !realTimeIntroActiveRef.current) break;
            const batch = introTexts.slice(idx, idx + 3);
            await Promise.allSettled(
              batch.map((text) =>
                fetch(
                  voiceProvider.audioUrl({
                    text,
                    language: voiceAccentRef.current,
                    voiceId: selectedVoice,
                  }),
                ).catch(() => { }),
              ),
            );
          }
        })();
      }
    } else {
      introSoundtrackRef.current?.fadeOut?.(2.5);
    }
  }, [realTimeIntroActive]);
  useEffect(() => {
    if (
      !(welcomeOpen || showFullMainMenu) ||
      !voiceRef.current ||
      typeof Audio === 'undefined' ||
      typeof fetch !== 'function' ||
      typeof window === 'undefined' ||
      window.__KRONOX_SCENE_HARNESS__
    ) {
      return undefined;
    }
    const warmupTexts = [
      'Durante siglos, contemplamos el universo desde un pequeño mundo azul, buscando respuestas sobre nuestro origen entre millones de estrellas.',
      'Misiones reales como el telescopio espacial NASA SPHEREx abrieron una nueva ventana infrarroja al cosmos, revelando luces ocultas al ojo humano.',
    ];
    const selectedVoice = 'Charon';
    const timer = setTimeout(() => {
      warmupTexts.forEach((text) => {
        fetch(
          voiceProvider.audioUrl({
            text,
            language: voiceAccentRef.current,
            voiceId: selectedVoice,
          }),
        ).catch(() => { });
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [welcomeOpen, showFullMainMenu]);
  useEffect(() => {
    try {
      localStorage.setItem('kronox-game-settings-v1', JSON.stringify(gameSettings));
    } catch {
      /* ignore */
    }
    const master = Number(gameSettings.masterVolume ?? 0.85);
    const music = Number(gameSettings.musicVolume ?? 0.38);
    const sfx = Number(gameSettings.sfxVolume ?? 0.65);
    const vox = Number(gameSettings.voiceVolume ?? 0.95);
    introSoundtrackRef.current?.setSpeaking(speaking);
    introSoundtrackRef.current?.setVolume(Math.max(0, Math.min(1, master * music)));
    gameAudioRef.current?.setVolume(Math.max(0, Math.min(1, master * sfx)));
    if (gameAudioRef.current && ambientEnabled) {
      gameAudioRef.current.setEnabled(master * sfx > 0.005);
    }
    if (voiceAudio.current) {
      voiceAudio.current.volume = voice ? Math.max(0, Math.min(1, master * vox)) : 0;
    }
    api.current?.setCameraSettings?.({
      sensitivity: gameSettings.cameraSensitivity || 'normal',
      distance3P: gameSettings.cameraDistance3P || 'normal',
    });
    api.current?.setVrSettings?.(normalizeVrSettings(gameSettings.vr));
    if (gameSettings.microgravityMode && prevSettingMgRef.current !== gameSettings.microgravityMode) {
      prevSettingMgRef.current = gameSettings.microgravityMode;
      api.current?.setMicrogravityMode?.(gameSettings.microgravityMode);
    }
  }, [speaking, voice, gameSettings, ambientEnabled]);
  useEffect(() => {
    const levelSum = audioLevels.reduce((acc, v) => acc + v, 0);
    const normLevel = speaking
      ? Math.max(0.18, Math.min(1.0, levelSum / Math.max(1, audioLevels.length) / 2.2))
      : 0.08;
    api.current?.setAiLuminousState?.(realTimeIntroActive ? null : aiAvatarState, speaking, normLevel);
  }, [speaking, aiAvatarState, audioLevels, realTimeIntroActive]);
  useEffect(() => {
    let cancelled = false;
    fetch(voiceProvider.statusUrl()).then(response => response.json()).then(status => {
      if (!cancelled) {
        fishVoiceStatusRef.current = status;
        setFishVoiceStatus(status);
      }
    }).catch(() => { });
    return () => { cancelled = true; };
  }, []);

  // Limpiar automáticamente paneles de cuerpos celestes (Luna/planetas) al recorrer cubiertas interiores (C02..C04)
  useEffect(() => {
    const isInteriorDeckWithoutTelescope =
      fr &&
      pv == 1 &&
      astronautSectorState.deckId !== 'deck-01' &&
      (observationModeInfo?.opticalMagnification || 1) <= 1;
    if (isInteriorDeckWithoutTelescope) {
      if (selectedObject) setSelectedObject(null);
      if (more) setMore(null);
      if (reticleTarget) setReticleTarget(null);
      if (notice?.planet) clearNotices();
    }
  }, [
    fr,
    pv,
    astronautSectorState.deckId,
    observationModeInfo?.opticalMagnification,
    selectedObject,
    more,
    reticleTarget,
    notice,
  ]);

  useEffect(() => {
    const handleKeyShortcuts = (event) => {
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (welcomeOpen || showFullMainMenu || realTimeIntroActive) return;

      if (event.key === 'k' || event.key === 'K') {
        event.preventDefault();
        kronoxDialogHiddenRef.current = false;
        setKronoxDialogHidden(false);
        setKronoxOpen((prev) => !prev);
        return;
      }
    };
    window.addEventListener('keydown', handleKeyShortcuts);
    return () => window.removeEventListener('keydown', handleKeyShortcuts);
  }, [welcomeOpen, showFullMainMenu, realTimeIntroActive]);

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key !== 'Escape') return;
      if (guideState?.cinematic) return;
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (personalHubOpen) {
        setPersonalHubOpen(false);
        return;
      }
      if (kronoxOpen) {
        setKronoxOpen(false);
        if (activeCockpitStation === 'comms') {
          setActiveCockpitStation(null);
          api.current?.setActiveCabinStation?.(null);
        }
        return;
      }
      if (pauseMenuOpen) {
        setPauseMenuOpen(false);
        api.current?.setSimulationPaused?.(false);
        return;
      }
      if (api.current?.isFreeHelmActive?.()) {
        api.current?.setFreeHelmMode?.(false);
        setFreeHelmMode(false);
        return;
      }
      if (activeCockpitStation) {
        setActiveCockpitStation(null);
        api.current?.setActiveCabinStation?.(null);
        return;
      }
      if (selectedObject) {
        setSelectedObject(null);
        return;
      }
      if (missionSelectorOpen) {
        setMissionSelectorOpen(false);
        if (activeCockpitStation === 'missions') {
          setActiveCockpitStation(null);
          api.current?.setActiveCabinStation?.(null);
        }
        return;
      }
      if (more) {
        setMore(null);
        return;
      }
      if (open) {
        setOpen(false);
        return;
      }
      if (
        !welcomeOpen &&
        !showFullMainMenu &&
        !realTimeIntroActive &&
        !missionOpen &&
        !api.current?.getVrState?.()?.presenting
      ) {
        setPauseMenuSection('save');
        setPauseMenuOpen(true);
        api.current?.setSimulationPaused?.(true);
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [
    personalHubOpen,
    kronoxOpen,
    pauseMenuOpen,
    activeCockpitStation,
    selectedObject,
    missionSelectorOpen,
    more,
    open,
    welcomeOpen,
    showFullMainMenu,
    realTimeIntroActive,
    missionOpen,
    guideState?.cinematic,
  ]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        (typeof document !== 'undefined' && document.hidden) ||
        mainMenuVisibleRef.current ||
        realTimeIntroActiveRef.current
      ) {
        setReticleTarget((prev) => (prev ? null : prev));
        return;
      }
      const next = api.current?.identifyTargetUnderCrosshair?.() || null;
      setReticleTarget((prev) => {
        if (prev === next) return prev;
        if (
          prev &&
          next &&
          prev.key === next.key &&
          prev.name === next.name &&
          prev.category === next.category &&
          prev.distanceDesc === next.distanceDesc &&
          prev.hasSpherex === next.hasSpherex
        ) {
          return prev;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(
    () => () => {
      clearTimeout(noticeTimer.current);
      clearTimeout(missionTravelTipTimer.current);
      clearTimeout(kronoxCloseTimer.current);
      stopVoiceAndClearQueue();
      gameAudioRef.current?.dispose();
      audioContextRef.current?.close().catch(() => { });
    },
    [],
  );
  const A = () => api.current,
    nm = {
      orb: 'Órbitas',
      lab: 'Mostrar nombres',
      ax: 'Ejes',
      vel: 'Velocidad',
      gal: 'Movimiento galáctico',
    },
    startTravel = (run, label, afterArrival, awaitSceneArrival = false) => {
      const vrPresentingNow = Boolean(api.current?.getVrState?.()?.presenting);
      // In WebXR, travel switches cleanly to the exterior ship camera (pv = 3) so the player watches
      // the KRONOX fly toward the destination instead of locking inside the bridge or an invisible DOM countdown.
      const travelView = vrPresentingNow ? 3 : (fr ? pv : 3);
      if (vrPresentingNow) {
        setPauseMenuOpen(false);
        api.current?.setSimulationPaused?.(false);
        setActiveCockpitStation(null);
        api.current?.setActiveCabinStation?.(null);
        setMissionSelectorOpen(false);
        setKronoxOpen(false);
      }
      if (spec) {
        A().board();
        setSpec(false);
      } else if (!fr) {
        A().free(true, false);
      }
      setFr(true);
      setPv(travelView);
      A().view(travelView);
      A().clearAstronomicalHologram?.();
      playCue('travel');
      setNavigation({
        label: t(label, language),
        phase: vrPresentingNow ? 'PREPARING' : 'countdown',
        progress: 0,
      });
      clearTimeout(missionTravelTipTimer.current);
      travelRef.current = true;
      countTimers.current.forEach(clearTimeout);
      clearTimeout(noticeTimer.current);
      noticeQueue.current = [];
      noticeRef.current = null;
      setNotice(null);
      const launchJump = () => {
        setCountdown(null);
        notify('¡Salto iniciado! Rumbo a ' + t(label, language) + '.', 'Viaje rápido');
        if (awaitSceneArrival) {
          const started = run(() => {
            travelRef.current = false;
            playCue('arrival');
            setNavigation(null);
            clearTimeout(missionTravelTipTimer.current);
            if (afterArrival) afterArrival();
          });
          if (started === false) {
            travelRef.current = false;
            setNavigation(null);
            setMissionTraveling(false);
          }
        } else {
          const started = run();
          if (started === false) {
            travelRef.current = false;
            setNavigation(null);
            setMissionTraveling(false);
            return;
          }
          setTimeout(
            () => {
              if (!api.current?.navigationActive?.()) {
                travelRef.current = false;
                playCue('arrival');
                setNavigation(null);
              }
              if (afterArrival) afterArrival();
            },
            afterArrival ? 1900 : 1200,
          );
        }
      };
      if (vrPresentingNow) {
        setCountdown(null);
        say('Iniciando viaje exterior en la nave KRONOX hacia ' + t(label, language) + '.');
        countTimers.current = [setTimeout(launchJump, 120)];
        return;
      }
      setCountdown(3);
      say('Preparando viaje rápido hacia ' + t(label, language) + '. Cuenta atrás: 3, 2, 1.');
      if (!awaitSceneArrival) speak('Tres.');
      let n = 3;
      const tick = () => {
        if (n === 1) {
          launchJump();
          return;
        }
        n--;
        setCountdown(n);
        if (!awaitSceneArrival) speak(n === 2 ? 'Dos.' : 'Uno.');
        countTimers.current.push(setTimeout(tick, 850));
      };
      countTimers.current = [setTimeout(tick, 850)];
    },
    chooseSpherexTarget = (target) => {
      if (travelRef.current || missionArrival || !target) return;
      setMissionSelectorOpen(false);
      setMissionTraveling(true);
      clearMissionOffer();
      setMissionArrivalName(target.name);
      setMissionTargetKey(target.key);
      A().onGuidedDestinationSelected?.(target);
      if (noviceCinematicActiveRef.current) {
        A().setCinematicMissionDestination?.(target.key);
      }
      const destMsg =
        'Destino fijado: ' +
        t(target.name, language) +
        '. Prepararé el salto hasta su posición en el vecindario galáctico.';
      if (!noviceCinematicActiveRef.current) {
        say(destMsg);
        if (voiceRef.current) speak(destMsg, { interrupt: true });
      }
      startTravel(
        (onArrive) => {
          if (spec) {
            A().board();
            setSpec(false);
          }
          return A().missionTarget(target.key, onArrive);
        },
        target.name,
        () => {
          setMissionTraveling(false);
          setMissionArrival(true);
          A().setArrivedTarget?.(target);
          A().onGuidedDestinationArrival?.(target);
          if (noviceCinematicActiveRef.current) {
            setMissionArrival(false);
            return;
          }
          const arrivalNotice =
            'Hemos llegado a ' +
            t(target.name, language) +
            '. Para explorar con calma, cambia la velocidad a planetaria en Nave espacial.';
          notify(arrivalNotice, 'Objetivo alcanzado');
          if (voiceRef.current) speak(arrivalNotice, { interrupt: false });
          missionOfferTimer.current = setTimeout(() => {
            setMissionArrival(false);
            if (api.current?.getVrState?.()?.presenting) {
              setMissionLaunchTarget(null);
              const vrReadyMsg =
                'Objetivo SPHEREx listo en ' +
                t(target.name, language) +
                '. Pulsa [A] en tu mando cuando quieras regresar a la cabina.';
              say(vrReadyMsg);
              if (voiceRef.current) speak(vrReadyMsg, { interrupt: false });
              api.current?.syncVrContext?.({
                activeTargetKey: target.key,
                lastKronoxReply: vrReadyMsg,
              });
            } else {
              setMissionLaunchTarget(target);
            }
          }, 1900);
        },
        true,
      );
    },
    startSelectedMission = () => {
      const target = missionLaunchTarget;
      if (!target) return;
      const objective = t(
        SPHEREX_MISSION_TYPES.find((mission) => mission.key === target.mission)?.objective ||
        'explorar este objetivo a través del tiempo.',
        language,
      );
      const instruction = t(`Tu misión: ${objective}`, language);
      missionGuideSyncRef.current = null;
      A().onGuidedMissionStarted?.();
      setMissionLaunchTarget(null);
      if (!api.current?.getVrState?.()?.presenting) {
        setMissionOpen(true);
        openKronox();
      }
      setMissionTargetKey(target.key);
      say(instruction);
      speak(instruction);
    },
    handleKronoxCommand = (query) => {
      const ctx = {
        activeTargetKey: missionTargetKey,
        missionOpen,
        missionStage: missionStageSync,
        focusedPlanet: f,
        nearPlanet: near,
        selectedObject,
        findings: missionFindingsSync,
        records: missionRecordsSync,
        scienceContext: missionScienceSync,
        cockpitActive: fr && pv == 1,
        observationMode: observationModeInfo?.mode?.id || 'naked-eye',
        observationModeLabel: observationModeInfo?.mode?.label || 'Simple vista (1×)',
        activeStation: activeCockpitStation || 'Puente de mando',
        activeObjective: guideObjective || 'Exploración científica libre',
      };
      const result = processKronoxQuery(query, ctx);
      if (result.role) setAiRole(result.role);
      if (result.avatarState) setAiAvatarState(result.avatarState);
      if (result.pointDirection) setAiPointDirection(result.pointDirection);
      if (result.epistemicCategory) setAiEpistemicCategory(result.epistemicCategory);
      let actionLabel = '';
      const act = result.action;
      if (act) {
        if (act.type === 'PLAY_SPHEREX_DOCUMENTARY') {
          actionLabel = 'Documental interactivo SPHEREx iniciado';
          setMissionOpen(false);
          setMissionSelectorOpen(false);
          setSpherexDocOpen(true);
        } else if (act.type === 'PLAY_CINEMATIC_INTRO') {
          actionLabel = 'Intro 3D en tiempo real iniciada';
          setWelcomeOpen(false);
          setRealTimeIntroActive(true);
          A().startRealTimeIntro?.(() => {
            introSoundtrackRef.current?.fadeOut?.(3.0);
            setRealTimeIntroActive(false);
            setFr(true);
            setPv(1);
          });
        } else if (act.type === 'HIGHLIGHT_FIELD_REGION') {
          actionLabel = 'Región señalada en campo';
          setAiHighlightField(true);
          A().moveAiToStation?.('science', 'Señalización');
        } else if (act.type === 'ENTER_COCKPIT') {
          actionLabel = 'Puente habitable 3D activado';
          setMissionOpen(false);
          setMissionSelectorOpen(false);
          if (spec) {
            A().board();
            setSpec(false);
          }
          if (!fr) {
            setFr(true);
            A().free(true, false);
          }
          setPv(1);
          A().view(1);
          A().setAiFollowAstronaut?.(true);
        } else if (act.type === 'SET_VIEW_MODE') {
          actionLabel = act.view === 3 ? 'Cámara exterior activada' : 'Vista cabina 3D activada';
          setMissionOpen(false);
          if (!fr) {
            setFr(true);
            A().free(true, false);
          }
          setPv(act.view);
          A().view(act.view);
        } else if (act.type === 'SET_OPTICAL_TELESCOPE') {
          actionLabel = act.enabled
            ? `Telescopio Óptico activado (${act.magnification}×)`
            : 'Observación a simple vista (1×)';
          const obsRes = A().setOpticalTelescope?.(
            Boolean(act.enabled),
            act.magnification || 150,
            f || near || 'Júpiter',
          );
          if (obsRes) setObservationModeInfo(obsRes);
        } else if (act.type === 'OPEN_MISSION_SELECTOR') {
          actionLabel = 'Consola de misiones activa';
          setMissionOpen(false);
          A().moveAiToStation?.('missions', 'Explicación');
          setMissionSelectorOpen(true);
        } else if (act.type === 'TRAVEL_SPHEREX' && act.target) {
          actionLabel = `Viaje iniciado hacia ${act.target.name}`;
          setMissionOpen(false);
          setMissionSelectorOpen(false);
          setSelectedObject(null);
          setMissionTargetKey(act.targetKey);
          A().moveAiToStation?.('nav', 'Desplazamiento');
          recordJournalActivity({
            type: 'TRAVEL_SPHEREX',
            title: `Salto interestelar hacia ${act.target.name}`,
            detail: `Distancia: ${act.target.distanceLabel} · Banda: ${act.target.preferredBand}`,
            objectKey: act.targetKey,
            objectKind: 'spherex',
            objectLabel: act.target.name,
          });
          try {
            const prog = { targetKey: act.targetKey, stage: 'arrival', updatedAt: Date.now() };
            localStorage.setItem('kronox-expedition-progress', JSON.stringify(prog));
            setSavedExpedition(prog);
          } catch {
            /* ignore */
          }
          chooseSpherexTarget(act.target);
        } else if (act.type === 'TRAVEL_PLANET' && act.planetName) {
          actionLabel = `Rumbo fijado a ${act.planetName}`;
          setMissionOpen(false);
          setMissionSelectorOpen(false);
          setSelectedObject(null);
          A().moveAiToStation?.('nav', 'Desplazamiento');
          recordJournalActivity({
            type: 'TRAVEL_PLANET',
            title: `Tránsito planetario hacia ${act.planetName}`,
            detail: 'Navegación en Sistema Solar (Época J2000.0)',
            objectKey: act.planetName,
            objectKind: 'planet',
            objectLabel: act.planetName,
          });
          startTravel(() => {
            if (spec) {
              A().board();
              setSpec(false);
              setFr(true);
            } else if (!fr) {
              setFr(true);
              A().free(true);
            }
            A().focus(act.planetName);
          }, act.planetName);
        } else if (act.type === 'TRAVEL_GALAXY' && act.galaxyKey) {
          actionLabel = `Mapa intergaláctico: ${act.galaxyKey}`;
          setMissionOpen(false);
          setMissionSelectorOpen(false);
          A().nearbyMap();
          setNearbyMapActive(true);
          setNearbyGalaxyKey(act.galaxyKey);
          A().focusNearbyGalaxy(act.galaxyKey);
          setFr(false);
          setSpec(false);
        } else if (act.type === 'OPEN_OBSERVATORY') {
          actionLabel = `Consola Científica SPHEREx: ${act.targetKey}`;
          setMissionTargetKey(act.targetKey);
          setMissionInitialStage('arrival');
          A().moveAiToStation?.('science', 'Explicación');
          if (!api.current?.getVrState?.()?.presenting) setMissionOpen(true);
        } else if (act.type === 'OPEN_MISSION_STAGE') {
          actionLabel = `Etapa activa: ${act.stage}`;
          setMissionTargetKey(act.targetKey);
          setMissionInitialStage(act.stage);
          A().moveAiToStation?.('science', 'Explicación');
          if (!api.current?.getVrState?.()?.presenting) setMissionOpen(true);
        } else if (act.type === 'SELECT_OBJECT') {
          actionLabel = `Señalando en cosmos 3D: ${act.key}`;
          setSelectedObject({ kind: act.kind, key: act.key });
          A().pointAiAtExternalObject?.(act.kind, act.key);
        }
      }

      if (result.isFallback && !act) {
        askKronoxDynamic(query, ctx).then((dynRes) => {
          const finalReply = dynRes?.reply || result.reply;
          if (dynRes?.role) setAiRole(dynRes.role);
          if (dynRes?.avatarState) setAiAvatarState(dynRes.avatarState);
          if (dynRes?.epistemicCategory) setAiEpistemicCategory(dynRes.epistemicCategory);
          setAiHistory((prev) => [...prev.slice(-4), { query, actionLabel }]);
          kronoxDialogHiddenRef.current = false;
          setKronoxDialogHidden(false);
          setGuide(finalReply, {
            id: `reply-${Date.now()}`,
            intent: 'response',
            replace: true,
          });
          clearTimeout(kronoxCloseTimer.current);
          if (voiceRef.current) speak(finalReply, { interrupt: true });
        });
        return;
      }

      setAiHistory((prev) => [...prev.slice(-4), { query, actionLabel }]);
      kronoxDialogHiddenRef.current = false;
      setKronoxDialogHidden(false);
      setGuide(result.reply, {
        id: `reply-${Date.now()}`,
        intent: 'response',
        replace: true,
      });
      clearTimeout(kronoxCloseTimer.current);
      if (voiceRef.current) speak(result.reply, { interrupt: true });
    },
    tg = (k) =>
      h(
        'button',
        {
          key: k,
          className: fl[k] ? 'on' : '',
          onClick: () => {
            const enabling = !fl[k];
            setFl({ ...fl, [k]: enabling ? 1 : 0 });
            if (enabling && ['ax', 'vel', 'gal'].includes(k))
              notify(
                k === 'ax'
                  ? 'Ejes de rotación activados.'
                  : k === 'vel'
                    ? 'Vectores de velocidad activados.'
                    : 'Modo galáctico activado.',
                'Control activado',
              );
          },
        },
        nm[k],
      ),
    pi = f && P.find((x) => x.n == f);
  vrHandlersRef.current = {
    'travel-planet': (payload) => {
      const planetName = payload?.planetName;
      if (!planetName) return;
      setSelectedObject(null);
      startTravel(() => {
        if (spec) {
          A()?.board?.();
          setSpec(false);
          setFr(true);
        } else if (!fr) {
          setFr(true);
          A()?.free?.(true);
        }
        return A()?.focus?.(planetName);
      }, planetName);
    },
    'travel-spherex': (payload) => {
      const key = payload?.targetKey;
      const target = SPHEREX_TARGETS.find((tgt) => tgt.key === key) || SPHEREX_TARGETS[0];
      if (!target) return;
      setSelectedObject(null);
      chooseSpherexTarget(target);
    },
    'quick-travel': (payload) => {
      if (!payload?.key) return;
      startTravel(() => A()?.quick?.(payload.key), payload.label || payload.key);
    },
    'kronox-query': (payload) => {
      const query = String(payload?.query || '').trim();
      if (query) handleKronoxCommand(query);
    },
    'start-tour': () => {
      A()?.startGuidedTour?.();
    },
    'repeat-voice': () => {
      setSpeechPaused(false);
      const lastMessage = narrativeQueue.repeat();
      if (lastMessage) {
        if (voiceRef.current) speak(lastMessage.text, { interrupt: true });
        api.current?.syncVrContext?.({ lastKronoxReply: lastMessage.text });
      }
    },
    'toggle-voice': () => {
      const next = !voiceRef.current;
      voiceRef.current = next;
      setVoice(next);
      if (!next) {
        stopVoiceAndClearQueue();
        say('Voz silenciada. Mis mensajes seguirán activos en consola VR.');
      } else {
        say('Voz de KRONOX IA reactivada.');
        speak('Voz de KRONOX IA reactivada.', { interrupt: true });
      }
    },
    'toggle-mic': async () => {
      if (vrSpeechRecRef.current) {
        try {
          vrSpeechRecRef.current.stop();
        } catch { }
        vrSpeechRecRef.current = null;
        api.current?.syncVrContext?.({ lastKronoxReply: 'Escucha de micrófono detenida.' });
        return;
      }
      const SpeechRecognitionCtor =
        typeof window !== 'undefined'
          ? window.SpeechRecognition || window.webkitSpeechRecognition
          : null;
      if (!SpeechRecognitionCtor) {
        const msg = 'Reconocimiento de voz no disponible en este navegador VR.';
        say(msg);
        api.current?.syncVrContext?.({ lastKronoxReply: msg });
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((tr) => tr.stop());
        } catch {
          const msg = 'Permiso de micrófono denegado en el visor VR.';
          say(msg);
          api.current?.syncVrContext?.({ lastKronoxReply: msg });
          return;
        }
      }
      try {
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = language === 'en' ? 'en-US' : 'es-ES';
        vrSpeechRecRef.current = recognition;
        let finalTranscript = '';
        recognition.onstart = () => {
          api.current?.syncVrContext?.({
            lastKronoxReply: '🎙️ Escuchando a través del micrófono... Habla ahora con KRONOX IA.',
          });
        };
        recognition.onresult = (event) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const textChunk = event.results[i]?.[0]?.transcript || '';
            if (event.results[i].isFinal) finalTranscript += `${textChunk} `;
            else interim += textChunk;
          }
          const preview = (finalTranscript || interim).trim();
          if (preview) {
            api.current?.syncVrContext?.({ lastKronoxReply: `🎙️ "${preview}"` });
          }
        };
        recognition.onerror = () => {
          vrSpeechRecRef.current = null;
          api.current?.syncVrContext?.({
            lastKronoxReply: 'No se pudo capturar audio. Intenta hablar de nuevo.',
          });
        };
        recognition.onend = () => {
          vrSpeechRecRef.current = null;
          const clean = finalTranscript.trim();
          if (clean) handleKronoxCommand(clean);
        };
        recognition.start();
      } catch {
        vrSpeechRecRef.current = null;
      }
    },
    'toggle-visual-profile': (payload) => {
      const next = payload?.profile || (visualProfile === 'scientific' ? 'cinematic' : 'scientific');
      setVisualProfile(next);
      A()?.setVisualProfile?.(next);
    },
    'scientific-scan': (payload) => {
      const targetKey = payload?.targetKey || missionTargetKey || 'barnard';
      const tgt = SPHEREX_TARGETS.find((item) => item.key === targetKey) || SPHEREX_TARGETS[0];
      setMissionTargetKey(targetKey);
      const res = grantInventoryItem('data-spherex-calibration');
      if (res?.inventory) setInventoryState(res.inventory);
      const msg = `Escaneo espectral infrarrojo SPHEREx iniciado sobre ${tgt?.name || targetKey} (${tgt?.preferredBand || 'SPHEREx'}).`;
      say(msg);
      if (voiceRef.current) speak(msg, { interrupt: true });
    },
  };
  return h(
    'div',
    {
      className: `app ${deviceMode === 'mobile' ? 'mobileMode' : ''} ${fr ? 'flightMode' : ''} ${nearbyMapActive ? 'nearbyMapMode' : ''} ${realTimeIntroActive || navigation || guideState?.cinematic ? 'cinematicActive' : ''}`,
    },
    h('div', { ref: el, style: { position: 'absolute', inset: 0 } }),
    h('audio', { ref: introMusicElementRef, 'data-kronox-intro-music': true, preload: 'auto', 'aria-hidden': true, style: { display: 'none' } }),
    !welcomeOpen &&
    !missionOpen &&
    !realTimeIntroActive &&
    !guideState?.cinematic &&
    !fr &&
    h(NavigationDock, {
      context: navigationScale,
      travelActive: !!navigation && navigation.phase !== 'countdown',
      onScale: (id) => {
        if (A()?.setNavigationScale?.(id)) {
          setFr(false);
          setMissionTraveling(false);
          clearMissionOffer();
          setSelectedObject(null);
          setNearbyGalaxyInfoKey(null);
        }
      },
      onObserve: () => {
        clearMissionOffer();
        const key =
          selectedObject?.key ||
          (nearbyMapActive ? nearbyGalaxyKey : navigationScale.targetKey) ||
          missionTargetKey;
        if (!SPHEREX_TARGETS.some((t) => t.key === key)) {
          setMissionSelectorOpen(true);
          return;
        }
        setMissionTargetKey(key);
        setMissionInitialStage('explore');
        setMissionOpen(true);
      },
      onReplayIntro: () => {
        clearMissionOffer();
        setWelcomeOpen(false);
        setRealTimeIntroActive(true);
        A().startRealTimeIntro?.(() => {
          introSoundtrackRef.current?.fadeOut?.(3.0);
          setRealTimeIntroActive(false);
          setFr(true);
          setPv(1);
        });
      },
      onReenter: () => {
        countTimers.current.forEach(clearTimeout);
        clearTimeout(missionTravelTipTimer.current);
        travelRef.current = false;
        setCountdown(null);
        setNavigation(null);
        setMissionTraveling(false);
        A()?.reenterCabin?.();
        setFr(true);
        setPv(1);
        setKronoxDialogHidden(false);
      },
      onStop: () => {
        countTimers.current.forEach(clearTimeout);
        clearTimeout(missionTravelTipTimer.current);
        travelRef.current = false;
        setCountdown(null);
        setNavigation(null);
        A()?.stopAndInspect?.();
        setFr(false);
        setMissionTraveling(false);
      },
      onView: () => {
        A()?.free?.(true);
        A()?.view?.(3);
        setFr(true);
        setPv(3);
      },
      onMissions: () => setMissionSelectorOpen(true),
      onMap: () => {
        const currentId = navigationScale?.id || 'stellar';
        const targetScale = ['regional', 'stellar', 'extragalactic', 'milkyway', 'solar'].includes(currentId)
          ? currentId
          : 'stellar';
        if (A()?.setNavigationScale?.(targetScale)) {
          setFr(false);
          setNearbyMapActive(targetScale === 'extragalactic');
          setSelectedObject(null);
          clearMissionOffer();
        }
      },
      onSettings: () => setOpen(true),
      onStartPerformance: () => {
        A()?.startPerformanceCapture?.();
        setPerformanceReport(null);
      },
      onPerformance: () => setPerformanceReport(A()?.performanceSnapshot?.()),
      performanceReport,
    }),
    !welcomeOpen &&
    !missionOpen &&
    !realTimeIntroActive &&
    !fr &&
    !selectedObject &&
    ['stellar', 'regional'].includes(navigationScale.id) &&
    h(StellarCatalogPanel, {
      mode: navigationScale.id,
      selectedKey: navigationScale.targetKey,
      onFocus: (key) => A()?.focusContextStar?.(key),
    }),
    nearbyMapActive &&
    h(NearbyGalaxyControls, {
      language,
      selectedKey: nearbyGalaxyKey,
      onSelect: (key) => {
        setNearbyGalaxyKey(key);
        clearMissionOffer();
        A().focusNearbyGalaxy(key);
      },
      onFocus: (key) => A().focusNearbyGalaxy(key),
      onFocusSolarSystem: () => {
        setNearbyGalaxyKey('milky-way');
        A().setNavigationScale?.('solar');
        setFr(false);
        setNearbyMapActive(false);
        setSelectedObject(null);
      },
      onInfo: setNearbyGalaxyInfoKey,
      onReturn: () => {
        A().returnFromNearbyMap();
        setNearbyMapActive(false);
        setNearbyGalaxyInfoKey(null);
      },
    }),
    open &&
    h(
      'div',
      {
        className: 'pn panelOpen kronoxSecondarySettingsModal',
        role: 'dialog',
        'aria-label': 'Interfaz de navegación',
      },
      h(
        'div',
        { className: 'panelHeading' },
        h('h1', null, 'Interfaz de navegación'),
        h('button', { onClick: () => setOpen(false) }, 'Cerrar ×'),
      ),
      h(
        'div',
        { className: 'menuContent' },
        h(
          'nav',
          { className: 'menuTabs', 'aria-label': 'Secciones del menú' },
          [
            ['interface', 'Interfaz'],
            ['spaceship', 'Nave espacial'],
            ['mission', 'Misión espacial'],
          ].map(([id, label]) =>
            h(
              'button',
              {
                key: id,
                className: menuSection === id ? 'active' : '',
                onClick: () => setMenuSection(id),
                'aria-current': menuSection === id ? 'page' : undefined,
              },
              label,
            ),
          ),
        ),
        menuSection === 'interface' &&
        h(
          'div',
          { className: 'menuSectionBody' },
          h(
            'label',
            { className: 'languageChoice' },
            h('span', null, language === 'es' ? 'Idioma' : 'Language'),
            h(
              'select',
              {
                value: language,
                onChange: (event) => chooseLanguage(event.target.value),
                'aria-label':
                  language === 'es' ? 'Idioma de la interfaz' : 'Interface language',
              },
              LANGUAGES.map((option) =>
                h('option', { key: option.code, value: option.code }, option.native),
              ),
            ),
          ),
          h(
            'div',
            { className: 'deviceModeChoices' },
            h('small', null, 'Interfaz'),
            h(
              'button',
              {
                className: deviceMode === 'mobile' ? 'on' : '',
                onClick: () => setDeviceMode('mobile'),
              },
              'Móvil',
            ),
            h(
              'button',
              {
                className: deviceMode === 'desktop' ? 'on' : '',
                onClick: () => setDeviceMode('desktop'),
              },
              'PC',
            ),
          ),
          h(
            'section',
            {
              className: 'playPreferences',
              'aria-label': language === 'es' ? 'Preferencias de juego' : 'Game preferences',
            },
            h('b', null, language === 'es' ? 'Experiencia' : 'Experience'),
            h(
              'label',
              { className: 'preferenceRow' },
              h('span', null, language === 'es' ? 'Calidad gráfica' : 'Graphics quality'),
              h(
                'select',
                {
                  value: quality,
                  onChange: (event) => setQuality(event.target.value),
                  'aria-label': language === 'es' ? 'Calidad gráfica' : 'Graphics quality',
                },
                h('option', { value: 'auto' }, language === 'es' ? 'Automática' : 'Automatic'),
                h(
                  'option',
                  { value: 'low' },
                  language === 'es' ? 'Bajo (Fluidez)' : 'Low (Performance)',
                ),
                h(
                  'option',
                  { value: 'medium' },
                  language === 'es' ? 'Medio (Equilibrado)' : 'Medium (Balanced)',
                ),
                h(
                  'option',
                  { value: 'high' },
                  language === 'es' ? 'Alto (Máxima calidad)' : 'High (Best quality)',
                ),
              ),
            ),
            h(
              'label',
              { className: 'preferenceToggle' },
              h('input', {
                type: 'checkbox',
                checked: reducedMotion,
                onChange: (event) => setReducedMotion(event.target.checked),
              }),
              h(
                'span',
                null,
                language === 'es'
                  ? 'Reducir animaciones y movimiento'
                  : 'Reduce animations and motion',
              ),
            ),
            h(
              'label',
              { className: 'preferenceToggle' },
              h('input', {
                type: 'checkbox',
                checked: highContrast,
                onChange: (event) => setHighContrast(event.target.checked),
              }),
              h('span', null, language === 'es' ? 'Aumentar contraste' : 'Increase contrast'),
            ),
            h(
              'div',
              { className: 'soundPreference' },
              h(
                'button',
                {
                  type: 'button',
                  disabled: !window.AudioContext && !window.webkitAudioContext,
                  className: ambientEnabled ? 'on' : '',
                  'aria-pressed': ambientEnabled,
                  onClick: toggleAmbient,
                },
                ambientEnabled
                  ? language === 'es'
                    ? '♫ Ambiente activado'
                    : '♫ Ambience on'
                  : language === 'es'
                    ? '♫ Activar ambiente'
                    : '♫ Enable ambience',
              ),
              h(
                'label',
                { className: 'preferenceRow' },
                h('span', null, language === 'es' ? 'Volumen' : 'Volume'),
                h('input', {
                  type: 'range',
                  min: 0,
                  max: 1,
                  step: 0.01,
                  value: soundVolume,
                  disabled: !gameAudioRef.current,
                  onChange: (event) => {
                    const value = Number(event.target.value);
                    setSoundVolume(value);
                    gameAudioRef.current?.setVolume(value);
                  },
                  'aria-label': language === 'es' ? 'Volumen del juego' : 'Game volume',
                }),
              ),
            ),
          ),
          h('small', null, 'Nivel de escala cósmica'),
          h(
            'div',
            { className: 'r' },
            ['Tierra y Luna', 'Sistema solar', 'Brazo de Orión', 'Vía Láctea'].map((t, i) =>
              h(
                'button',
                {
                  key: t,
                  onClick: () => {
                    if (spec) {
                      A().exitSpectator();
                      setSpec(false);
                    }
                    notify('Cambiando nivel de vista a ' + t + '.', 'Cambio de vista');
                    setReal(false);
                    A().lvl(i);
                  },
                },
                t,
              ),
            ),
          ),
          h(
            'div',
            { className: 'r' },
            h(
              'button',
              {
                className: real ? '' : 'on',
                onClick: () => {
                  if (spec) {
                    A().exitSpectator();
                    setSpec(false);
                  }
                  notify('Activando escala visual.', 'Cambio de escala');
                  setReal(false);
                  A().mode(false);
                },
              },
              'Escala visual',
            ),
            h(
              'button',
              {
                className: real ? 'on' : '',
                onClick: () => {
                  if (spec) {
                    A().exitSpectator();
                    setSpec(false);
                  }
                  notify('Activando escala física.', 'Cambio de escala');
                  setReal(true);
                  A().mode(true);
                },
              },
              'Escala física',
            ),
          ),
          h(
            'small',
            null,
            real
              ? 'Escala física: 1 unidad = 1 millón de km. Radios y distancias a escala real.'
              : 'Escala visual: radios exagerados y distancias comprimidas (d = 14 + 16·a^0,62). Se conservan la forma, la excentricidad y la inclinación de cada órbita.',
          ),
          h(
            'small',
            null,
            'Velocidad: ' + Math.pow(10, sp).toFixed(sp < 0 ? 2 : 0) + ' días por segundo',
          ),
          h('input', {
            type: 'range',
            min: -1,
            max: 3,
            step: 0.05,
            value: sp,
            onChange: (e) => setSp(+e.target.value),
          }),
          h(
            'div',
            { className: 'r' },
            h('button', { onClick: () => setPause(!pause) }, pause ? 'Reanudar' : 'Pausar'),
            h(
              'button',
              {
                onClick: () => {
                  A().reset();
                  setPause(false);
                  setSp(-1);
                },
              },
              'Restablecer',
            ),
          ),
          h(
            'div',
            { className: 'r' },
            h('small', null, 'Fecha simulada'),
            h('input', {
              type: 'date',
              ref: dayRef,
              style: {
                colorScheme: 'dark',
                background: '#ffffff12',
                color: 'inherit',
                border: '1px solid #ffffff2a',
                borderRadius: 7,
                padding: '4px 6px',
              },
              onChange: (e) => {
                const t = Date.parse(e.target.value);
                if (!isNaN(t)) A().setDay((t - Date.UTC(2000, 0, 1, 12)) / 864e5);
              },
            }),
          ),
          h('div', { className: 'r' }, ['orb', 'lab', 'ax', 'vel', 'gal'].map(tg)),
          fl.gal
            ? h(
              'small',
              null,
              'Esquema: el Sol queda fijo en el centro y la galaxia se mueve respecto a él. Tiempo galáctico ×10⁶ (una vuelta = 230 millones de años; el Sol viaja a ~230 km/s). Mira desde «Brazo de Orión» o «Vía Láctea».',
            )
            : null,
          h('button', { onClick: () => setSrc(!src) }, 'Fuentes y metodología'),
          src &&
          h(
            'small',
            { style: { marginTop: 6 } },
            'Datos físicos: NASA Solar System Exploration. Posiciones: elementos keplerianos aproximados de JPL (Standish, válidos 1800–2050) resueltos con la ecuación de Kepler; son aproximaciones, no efemérides de JPL Horizons. La Luna usa una órbita circular simplificada y rotación sincronizada. Todos los ejes apuntan al mismo lado del espacio (simplificación). A alta velocidad la rotación se limita visualmente. Orientación: el plano galáctico está inclinado ~60° respecto a la eclíptica y el centro galáctico queda hacia Sagitario (λ≈266°, β≈−5,6°); el Sol orbita en sentido horario visto desde el polo norte galáctico. Vía Láctea: modelo esquemático, no una fotografía; Sol a unos 26.000 años luz del centro, en el Espolón de Orión; las texturas son procedurales.',
          ),
        ),
        menuSection === 'spaceship' &&
        h(
          'div',
          { className: 'menuSectionBody' },
          h(
            'div',
            { className: 'r' },
            h(
              'button',
              {
                className: fr ? 'on' : '',
                onClick: () => {
                  if (spec) {
                    A().board();
                    setSpec(false);
                    setFr(true);
                    notify(
                      'Regresando a la nave. La nave sigue en el mismo punto y conserva su orientación.',
                      'Nave planetaria',
                    );
                  } else if (!fr) {
                    setFr(true);
                    A().free(true, true);
                    notify(
                      'Despegando desde la Tierra. Tendrás el control al llegar al espacio.',
                      'Nave planetaria',
                    );
                  } else notify('Ya estás dentro de la nave planetaria.', 'Nave planetaria');
                },
              },
              spec ? 'Regresar a la nave' : 'Ingresar en nave planetaria',
            ),
            h(
              'button',
              {
                className: spec ? 'on' : '',
                onClick: () => {
                  if (spec) {
                    A().exitSpectator();
                    setSpec(false);
                    notify('Saliendo de la cámara libre.', 'Cámara libre');
                  } else {
                    A().spectate();
                    setSpec(true);
                    setFr(false);
                    notify(
                      'Cámara libre activada. Puedes observar la nave en 3D; permanece fija mientras exploras.',
                      'Cámara libre',
                    );
                  }
                },
              },
              spec ? 'Salir de cámara libre' : 'Cámara libre',
            ),
            fr &&
            [
              ['Galaxia completa', 0],
              ['Centro galáctico', 1],
              ['Volver al Sol', 2],
            ].map(([t, k]) =>
              h(
                'button',
                {
                  key: k,
                  onClick: () =>
                    startTravel(() => {
                      if (spec) {
                        A().board();
                        setSpec(false);
                        setFr(true);
                      }
                      A().jump(k);
                    }, t),
                },
                t,
              ),
            ),
          ),
          h(
            'div',
            { className: 'r' },
            h('small', null, 'Vista'),
            [
              ['3ª persona', 3],
              ['1ª persona', 1],
            ].map(([t, v]) =>
              h(
                'button',
                {
                  key: v,
                  className: pv == v ? 'on' : '',
                  onClick: () => {
                    if (spec) {
                      A().board();
                      setSpec(false);
                    }
                    if (!fr) {
                      setFr(true);
                      A().free(true, true);
                    }
                    setPv(v);
                    A().view(v);
                    notify(
                      'Cambiando nivel de vista a ' +
                      (v === 1 ? 'primera' : 'tercera') +
                      ' persona.',
                      'Cambio de vista',
                    );
                  },
                },
                t,
              ),
            ),
          ),
          h('small', null, 'Velocidad de vuelo: ' + fv.toFixed(fv < 1 ? 2 : 0) + ' u/s'),
          h('input', {
            type: 'range',
            min: -2,
            max: 4.7,
            step: 0.02,
            value: Math.log10(Math.max(fv, 0.01)),
            onChange: (e) => A().speed(Math.pow(10, +e.target.value)),
            onPointerUp: () =>
              notify(
                'Velocidad de nave ajustada a ' +
                (fv >= 1000 ? (fv / 1000).toFixed(1) + ' mil' : fv.toFixed(1)) +
                ' unidades por segundo.',
                'Cambio de velocidad',
              ),
          }),
          h(
            'div',
            { className: 'r' },
            [
              ['Planeta', 1],
              ['Sistema', 60],
              ['Galaxia', 3000],
              ['Hiper', 4e4],
            ].map(([t, v]) =>
              h(
                'button',
                {
                  key: t,
                  onClick: () => {
                    A().speed(v);
                    notify(
                      'Cambiando velocidad a ' +
                      {
                        Planeta: 'planetaria',
                        Sistema: 'sistema solar',
                        Galaxia: 'galaxia',
                        Hiper: 'hipervelocidad',
                      }[t] +
                      '.',
                      'Cambio de velocidad',
                    );
                  },
                },
                t,
              ),
            ),
          ),
          fr &&
          h(
            'div',
            { className: 'r' },
            [
              ['Estela', 'tr'],
              ['Inercia', 'in'],
              ['Piloto auto.', 'au'],
            ].map(([t, k]) =>
              h(
                'button',
                {
                  key: k,
                  className: fo[k] ? 'on' : '',
                  onClick: () => {
                    const n = { ...fo, [k]: fo[k] ? 0 : 1 };
                    setFo(n);
                    A().opt(n);
                  },
                },
                t,
              ),
            ),
          ),
          fr && h('small', null, 'Campo de visión: ' + fov + '°'),
          fr &&
          h('input', {
            type: 'range',
            min: 40,
            max: 100,
            step: 1,
            value: fov,
            onChange: (e) => {
              setFov(+e.target.value);
              A().fov(+e.target.value);
            },
          }),
          fr &&
          h(
            'small',
            null,
            'Nave planetaria (tú eres la nave): arrastra para mirar, W A S D mover, Q/E bajar/subir, Shift ×5, rueda = velocidad (' +
            fv.toFixed(fv < 1 ? 2 : 0) +
            ' u/s).',
          ),
          spec &&
          h(
            'small',
            null,
            'Cámara libre: la nave permanece inmóvil en su posición. Arrastra para orbitarla y usa W A S D para mover la cámara; pulsa «Regresar a la nave» para abordar sin desplazarla.',
          ),
          fr &&
          h(
            'div',
            { className: 'r' },
            [
              ['▲', 'w'],
              ['▼', 's'],
              ['◀', 'a'],
              ['▶', 'd'],
              ['⬆', 'e'],
              ['⬇', 'q'],
            ].map(([t, k]) =>
              h(
                'button',
                {
                  key: k,
                  onPointerDown: () => A().key(k, 1),
                  onPointerUp: () => A().key(k, 0),
                  onPointerLeave: () => A().key(k, 0),
                },
                t,
              ),
            ),
          ),
          h(
            'small',
            null,
            'Arrastra: girar. Rueda: zoom. Clic derecho: desplazar. W A S D: avanzar. Q E: subir o bajar.',
          ),
          h(QuickTravelMenu, {
            language,
            open: quickOpen,
            onToggle: setQuickOpen,
            selectedPlanet: f,
            planets: P,
            onGalaxyNeighborhood: () => {
              A().nearbyMap();
              setNearbyMapActive(true);
              setNearbyGalaxyKey('milky-way');
              setQuickOpen(false);
              setFr(false);
              setSpec(false);
            },
            onFree: () => {
              A().focus(null);
              setQuickOpen(false);
            },
            onQuickTravel: (key, label) => {
              startTravel(() => {
                if (spec) {
                  A().board();
                  setSpec(false);
                  setFr(true);
                }
                return A().quick(key);
              }, label);
              setQuickOpen(false);
            },
            onPlanetTravel: (name) => {
              startTravel(() => {
                if (spec) {
                  A().board();
                  setSpec(false);
                  setFr(true);
                } else if (!fr) {
                  setFr(true);
                  A().free(true);
                }
                return A().focus(name);
              }, name);
              setQuickOpen(false);
            },
          }),
        ),
        menuSection === 'mission' &&
        h(
          'section',
          { className: 'missionMenuCard' },
          h('div', { className: 'missionLaunchMark', 'aria-hidden': 'true' }, '✦'),
          h('small', null, 'OBSERVATORIO ESPACIAL'),
          h('h2', null, 'Ecos en infrarrojo'),
          h(
            'p',
            null,
            'Viaja al mapa de la Vía Láctea y explora las imágenes del cielo captadas por SPHEREx a través del tiempo.',
          ),
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
            h(
              'button',
              {
                className: 'missionLaunchButton',
                style: {
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                  borderColor: '#60a5fa',
                },
                onClick: () => {
                  setMissionTargetKey('wise-0855');
                  setMissionOpen(true);
                },
              },
              'Abrir Observatorio SPHEREx',
            ),
            h(
              'button',
              {
                className: 'missionLaunchButton',
                disabled: countdown !== null || missionArrival || missionTraveling,
                onClick: () => setMissionSelectorOpen(true),
              },
              countdown !== null || missionArrival || missionTraveling
                ? 'Preparando viaje…'
                : 'Elegir misión ↗',
            ),
          ),
        ),
      ),
    ),
    pi &&
    !fr &&
    !selectedObject &&
    h(
      'div',
      { className: 'in' },
      h('b', null, pi.n),
      'Diámetro: ' + (2 * pi.km).toLocaleString(language === 'en' ? 'en-US' : 'es') + ' km',
      pi.au &&
      h(
        'div',
        null,
        'Distancia media: ' + pi.au + ' UA (' + (pi.au * 149.6).toFixed(1) + ' M km)',
      ),
      pi.e && h('div', null, 'Excentricidad ' + pi.e + ' · inclinación orbital ' + pi.i + '°'),
      pi.tilt &&
      h(
        'div',
        null,
        'Inclinación del eje: ' +
        pi.tilt +
        '°' +
        (pi.tilt > 90 ? ' (rotación retrógrada)' : ''),
      ),
      h('div', null, 'Rotación: ' + (pi.rot / 24).toFixed(2) + ' días'),
      pi.per && h('div', null, 'Traslación: ' + pi.per + ' días'),
      h('div', { ref: distRef, style: { marginTop: 4 } }),
      INFO[pi.n] &&
      h('button', { style: { marginTop: 8 }, onClick: () => setMore(pi.n) }, 'Saber más'),
    ),
    h(KronoxWidget, {
      narrative: guide,
      showSubtitles: gameSettings.showSubtitles !== false,
      subtitleSize: gameSettings.subtitleSize || 'normal',
      dialogueHidden:
        kronoxDialogHidden ||
        realTimeIntroActive ||
        welcomeOpen ||
        showFullMainMenu ||
        (gameSettings.showSubtitles === false && !kronoxOpen),
      showCornerOrb: fr && pv === 3 && !welcomeOpen && !showFullMainMenu && !realTimeIntroActive && !guideState?.cinematic,
      speaking,
      audioLevels,
      panelOpen: kronoxOpen && !guideState?.cinematic,
      onClose: () => {
        setKronoxOpen(false);
        if (activeCockpitStation === 'comms') {
          setActiveCockpitStation(null);
          A().setActiveCabinStation?.(null);
        }
      },
      voice,
      language,
      accent: voiceAccent,
      voiceFailed,
      onRetryVoice: handleRetryVoice,
      voiceError:
        voiceError ||
        (fishVoiceStatus?.configured === false && !fishVoiceStatus?.geminiTts?.configured
          ? 'Servicio de voz externo en espera. Subtítulos sincronizados activos.'
          : ''),
      near,
      onAccentChange: setVoiceAccent,
      onMore: setMore,
      onStartMission: () => setMissionSelectorOpen(true),
      missionStarting: countdown !== null || missionArrival || missionTraveling,
      onCommand: handleKronoxCommand,
      onMessageComplete: (messageId) => {
        completeKronoxNarrative(messageId);
        A().onGuidedNarrativeComplete?.(messageId);
      },
      onEndGuide: () => {
        A().endGuidedCabinTour?.();
        setGuideObjective('');
      },
      speechPaused,
      onPauseSpeech: () => {
        setSpeechPaused((prev) => {
          const next = !prev;
          if (voiceAudio.current) {
            if (next) voiceAudio.current.pause();
            else voiceAudio.current.play().catch(() => { });
          }
          return next;
        });
      },
      onRepeatSpeech: () => {
        setSpeechPaused(false);
        const lastMessage = narrativeQueue.repeat();
        if (lastMessage) {
          if (voiceRef.current) speak(lastMessage.text);
        }
      },
      onReplayCinematic: () => {
        setWelcomeOpen(false);
        setRealTimeIntroActive(true);
        A().startRealTimeIntro?.(() => {
          setRealTimeIntroActive(false);
          setFr(true);
          setPv(1);
        });
      },
      aiRole,
      avatarState: aiAvatarState,
      pointDirection: aiPointDirection,
      epistemicCategory: aiEpistemicCategory,
      history: aiHistory,
      aiProjection,
      onOrbClick: () => {
        if (guideState?.cinematic) return;
        if (!kronoxOpen) {
          kronoxDialogHiddenRef.current = false;
          setKronoxDialogHidden(false);
          setKronoxOpen(true);
        } else {
          setKronoxOpen(false);
          if (activeCockpitStation === 'comms') {
            setActiveCockpitStation(null);
            A().setActiveCabinStation?.(null);
          }
        }
      },
      onToggleVoice: () => {
        if (voice) {
          voiceRef.current = false;
          setVoice(false);
          stopVoiceAndClearQueue();
          audioContextRef.current?.suspend().catch(() => { });
          say('Voz silenciada. Mis mensajes seguirán apareciendo en pantalla.');
        } else {
          voiceRef.current = true;
          setVoice(true);
          say('Voz de Kronox activada.');
          speak('Hola, soy Kronox, tu guía astral. Mi voz está activada.', { interrupt: true });
        }
      },
    }),
    h(MobileFlightControls, {
      language,
      active: !guideState?.cinematic && deviceMode === 'mobile' && fr && pv === 3,
      api: A,
      speed: fv,
      onSpeedChange: (value) => {
        A().speed(value);
        setFv(value);
      },
    }),
    !(welcomeOpen || showFullMainMenu || realTimeIntroActive || pauseMenuOpen || guideState?.cinematic) &&
    h(ToastNotification, { notice, onMore: setMore, language }),
    navigation &&
    !guideState?.cinematic &&
    h(
      'div',
      {
        className: 'navigationGuide',
        role: 'status',
        'aria-live': 'polite',
        'data-phase': navigation.phase,
      },
      h(
        'div',
        { className: 'navigationGuideIcon', 'aria-hidden': 'true' },
        navigation.phase === 'arrival' ? '✦' : '⌖',
      ),
      h(
        'div',
        { className: 'navigationGuideText' },
        h('small', null, language === 'es' ? 'RUTA DE NAVEGACIÓN' : 'NAVIGATION ROUTE'),
        h(
          'b',
          null,
          navigation.label ||
          (language === 'es' ? 'Destino seleccionado' : 'Selected destination'),
        ),
        h(
          'span',
          null,
          language === 'es'
            ? {
              countdown: 'Preparando salto',
              PREPARING: 'Orientando la nave',
              ACCELERATING: 'Aceleración progresiva',
              HYPERSPACE_ENTRY: 'Cruzando el umbral',
              HYPERSPACE_CRUISE: 'Corredor hiperespacial',
              HYPERSPACE_EXIT: 'Salida y desaceleración',
              ARRIVING: 'Revelando el destino',
              align: 'Alineando rumbo',
              jumpout: 'Entrando en salto',
              transit: 'En tránsito',
              jumpin: 'Saliendo del salto',
              arrival: 'Llegada al destino',
            }[navigation.phase] || 'Siguiendo la ruta'
            : {
              countdown: 'Preparing jump',
              PREPARING: 'Aligning vessel',
              ACCELERATING: 'Accelerating',
              HYPERSPACE_ENTRY: 'Crossing the threshold',
              HYPERSPACE_CRUISE: 'Hyperspace corridor',
              HYPERSPACE_EXIT: 'Exiting and decelerating',
              ARRIVING: 'Revealing destination',
              align: 'Aligning heading',
              jumpout: 'Entering jump',
              transit: 'In transit',
              jumpin: 'Exiting jump',
              arrival: 'Arriving at destination',
            }[navigation.phase] || 'Following route',
        ),
        h(
          'div',
          {
            className: 'navigationProgress',
            role: 'progressbar',
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': Math.round((navigation.progress || 0) * 100),
          },
          h('i', {
            style: { transform: `scaleX(${Math.max(0.035, navigation.progress || 0)})` },
          }),
        ),
      ),
    ),

    countdown !== null &&
    h('div', { className: 'countdownOverlay' }, h('b', { key: countdown }, countdown)),
    missionLaunchTarget &&
    h(
      'div',
      { className: 'missionLaunchWindow', role: 'dialog', 'aria-live': 'polite' },
      h('div', { className: 'missionLaunchMark', 'aria-hidden': 'true' }, '✦'),
      h(
        'div',
        { className: 'missionLaunchCopy' },
        h('small', null, 'DESTINO LOCALIZADO · SPHEREx'),
        h('b', null, missionLaunchTarget.name),
        h(
          'span',
          null,
          'Llegamos. Cambia a velocidad planetaria para explorar con calma. ¿Empezamos?',
        ),
      ),
      h(
        'button',
        { className: 'missionLaunchButton', onClick: startSelectedMission },
        'Empezar misión',
      ),
    ),
    missionArrival &&
    h(
      'div',
      { className: 'missionArrivalOverlay', role: 'status', 'aria-live': 'polite' },
      h('span', null, 'SALTO COMPLETADO'),
      h('b', null, missionArrivalName),
      h('small', null, 'Llegamos. Cambia a velocidad planetaria para explorar con calma.'),
    ),
    h(PlanetInfoModal, {
      planet: more,
      data: more && INFO[more],
      onClose: () => setMore(null),
      onExplore: () => {
        const selectedPlanet = more;
        setMore(null);
        if (selectedPlanet) A().focus(selectedPlanet);
      },
      language,
    }),
    h(NearbyGalaxyInfoModal, {
      galaxy:
        nearbyGalaxyInfoKey && NEARBY_GALAXIES.find((item) => item.key === nearbyGalaxyInfoKey),
      language,
      onClose: () => setNearbyGalaxyInfoKey(null),
      onFocus: (key) => {
        setNearbyGalaxyKey(key);
        setNearbyGalaxyInfoKey(null);
        A().focusNearbyGalaxy(key);
      },
    }),
    missionSelectorOpen &&
    h(SpherexMissionSelector, {
      language,
      onClose: () => {
        setMissionSelectorOpen(false);
        if (activeCockpitStation === 'missions') {
          setActiveCockpitStation(null);
          A().setActiveCabinStation?.(null);
        }
      },
      onSelect: chooseSpherexTarget,
      onDirectOpen: (target) => {
        setMissionSelectorOpen(false);
        setMissionTargetKey(target?.key || 'wise-0855');
        setMissionOpen(true);
      },
    }),
    missionOpen &&
    h(
      React.Suspense,
      {
        fallback: h(
          'div',
          { className: 'juanLoadingMission', role: 'status' },
          'Abriendo el observatorio…',
        ),
      },
      h(SpherexMission, {
        language,
        initialTargetKey: missionTargetKey,
        initialStage: missionInitialStage,
        cinematicMode: noviceCinematicActiveRef.current,
        onCinematicComplete: () => A().onNoviceCinematicComplete?.(),
        aiHighlightActive: aiHighlightField,
        onClose: () => {
          setMissionOpen(false);
          if (activeCockpitStation === 'science') {
            setActiveCockpitStation(null);
            A().setActiveCabinStation?.(null);
          }
        },
        onStateSync: ({ targetKey, stage, records, findings, scienceContext }) => {
          setMissionScienceSync(scienceContext || null);
          if (targetKey && targetKey !== missionTargetKey) setMissionTargetKey(targetKey);
          if (stage) setMissionStageSync(stage);
          if (records) setMissionRecordsSync(records);
          if (findings) setMissionFindingsSync(findings);
          const nextGuideSync = {
            stage: stage || 'arrival',
            findingCount: Array.isArray(findings) ? findings.length : 0,
          };
          const previousGuideSync = missionGuideSyncRef.current;
          missionGuideSyncRef.current = nextGuideSync;
          if (
            previousGuideSync &&
            (previousGuideSync.stage !== nextGuideSync.stage ||
              previousGuideSync.findingCount < nextGuideSync.findingCount)
          ) {
            A().onGuidedScienceAction?.(nextGuideSync);
          }
          try {
            const prog = {
              targetKey: targetKey || missionTargetKey,
              stage: stage || missionStageSync,
              findingsCount: Array.isArray(findings)
                ? findings.length
                : missionFindingsSync.length,
              updatedAt: Date.now(),
            };
            localStorage.setItem('kronox-expedition-progress', JSON.stringify(prog));
            setSavedExpedition(prog);
          } catch {
            /* ignore */
          }
        },
        onAskKronox: (q) => handleKronoxCommand(q),
      }),
    ),
    spherexDocOpen &&
    h(SpherexDocumentary, {
      language,
      onClose: () => setSpherexDocOpen(false),
      onOpenObservatory: () => {
        setSpherexDocOpen(false);
        setMissionOpen(true);
      },
      speakNarrator: (text) => speak(text, { interrupt: true }),
      stopNarrator: () => stopVoiceAndClearQueue(),
    }),
    realTimeIntroActive &&
    h(
      'div',
      {
        className: `kronoxFilmIntroOverlay${introPaused ? ' is-paused' : ''}`,
        role: 'region',
        'aria-label': 'Introducción cinematográfica KRONOX',
      },
      h(
        'div',
        { className: 'kronoxFilmControls' },
        (voiceBlockedByAutoplay || introMusicBlocked) &&
        h(
          'button',
          {
            type: 'button',
            className: 'kronoxFilmBtn is-accent',
            onClick: unlockAndReplayVoice,
          },
          '🔊 Activar audio',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'kronoxFilmBtn',
            onClick: toggleIntroPause,
            'aria-pressed': introPaused,
          },
          introPaused ? '▶ Reanudar' : '⏸ Pausar',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'kronoxFilmBtn',
            onClick: () =>
              setGameSettings((prev) => ({
                ...prev,
                showSubtitles: prev.showSubtitles === false,
              })),
            'aria-pressed': gameSettings.showSubtitles !== false,
          },
          gameSettings.showSubtitles !== false ? 'CC Subtítulos: Sí' : 'CC Subtítulos: No',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'kronoxFilmBtn is-skip',
            onClick: skipIntroAndEnterCabin,
          },
          language === 'es' ? 'Omitir / Saltar ⏭' : 'Skip Intro ⏭',
        ),
      ),
      introPaused &&
      h(
        'div',
        { className: 'kronoxFilmPausedTag', role: 'status' },
        'SECUENCIA EN PAUSA',
      ),
      gameSettings.showSubtitles !== false &&
      realTimeIntroCaption &&
      h(
        'div',
        {
          key: cinematicStage || 'subtitle',
          className: `kronoxFilmSubtitleDock${gameSettings.subtitleSize === 'large' ? ' is-large' : ''}`,
          role: 'status',
          'aria-live': 'polite',
        },
        h('p', { className: 'kronoxFilmSubtitleText' }, realTimeIntroCaption),
      ),
    ),
    !welcomeOpen &&
    !missionOpen &&
    !realTimeIntroActive &&
    navigationScale.id === 'milkyway' &&
    h(
      'div',
      {
        role: 'note',
        style: {
          position: 'fixed',
          bottom: '18px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 18,
          padding: '7px 14px',
          borderRadius: '999px',
          background: 'rgba(7, 13, 24, 0.84)',
          border: '1px solid rgba(255, 214, 153, 0.38)',
          color: '#ffe5bd',
          fontSize: '0.76rem',
          letterSpacing: '0.03em',
          pointerEvents: 'none',
        },
      },
      '✦ Vía Láctea (SBbc) · Modelo exterior reconstruido a partir de observaciones internas (NASA Spitzer GLIMPSE sig05-010a / R. Hurt / Gaia DR3)',
    ),
    !welcomeOpen &&
    !showFullMainMenu &&
    !missionOpen &&
    !realTimeIntroActive &&
    !guideState?.cinematic &&
    h(SpaceshipCockpit, {
      language,
      cockpitVisible: fr && pv == 1,
      navigationActive: !!navigation && navigation.phase !== 'countdown',
      cabinFirstPerson,
      astronautSectorState,
      onToggleCabinPerspective: (firstP) => {
        const nextVal = firstP !== undefined ? Boolean(firstP) : !cabinFirstPerson;
        setCabinFirstPerson(nextVal);
        A().setCabinPerspective?.(nextVal);
      },
      onToggleMicrogravityMode: () => {
        const nextMode = astronautSectorState.microgravityMode === 'FREE' ? 'ASSISTED' : 'FREE';
        A().setMicrogravityMode?.(nextMode);
      },
      onToggleGrabRail: () => A().toggleGrabRail?.(),
      onTeleportToDeck: (deckId) => {
        const res =
          A().transitAstronautToDeck?.(deckId) ||
          A().teleportAstronautToDeck?.(deckId);
        if (res) {
          setAstronautSectorState((prev) => ({
            ...prev,
            deckId: res.deckId || prev.deckId,
            deckNumber: res.deckNumber ?? prev.deckNumber,
            deckName: res.deckName || prev.deckName,
          }));
          setActiveCockpitStation(null);
          A().setActiveCabinStation?.(null);
        }
      },
      onOpenArchiveJournal: () => {
        setPersonalHubTab('exploration');
        setPersonalHubOpen(true);
      },
      onOpenPersonalHub: (tab = 'map') => {
        const targetTab = tab === 'journal' ? 'exploration' : !tab || tab === 'inventory' ? 'map' : tab;
        setPersonalHubTab(targetTab);
        setPersonalHubOpen(true);
        A()?.onGuidedInventoryOpen?.(targetTab);
      },
      interactionFeedback,
      heldToolId,
      nearestStation: nearestCabinStation,
      activeStation: activeCockpitStation,
      elevatorState,
      mechanismsState,
      restingState,
      onSelectElevatorFloor: (deckId) => A().selectElevatorFloor?.(deckId),
      onTriggerMechanism: (actionId, value = null) => A().interactStationMechanism?.(actionId, value),
      onActivateNearestStation: () => A().activateNearestStation?.(),
      onSitInCommandSeat: () => A().sitInCommandSeat?.(),
      onTriggerOrbitalNap: () => A().triggerOrbitalNap?.(),
      onStandUpFromRestBed: () => A().standUpFromRestBed?.(),
      onToggleRestLamp: (bayIdx) => {
        const idx = Math.max(0, Math.min(5, Math.floor(Number(bayIdx) || 0)));
        A().interactStationMechanism?.(`lamp-hab-0${idx + 1}`);
      },
      freeHelmMode,
      onToggleFreeHelm: (enabled) => {
        setFreeHelmMode(Boolean(enabled));
        A().setFreeHelmMode?.(enabled);
      },
      onSelectStation: (stId) => {
        if (!stId) {
          setFreeHelmMode(false);
          A().setFreeHelmMode?.(false);
        }
        setActiveCockpitStation(stId);
        A().setActiveCabinStation?.(stId);
        if (stId) A().moveAiToStation?.(stId, 'Explicación');
      },
      onWalkToStation: (stId) => {
        A().walkAstronautToStation?.(stId);
      },
      viewMode: !fr ? 'navigation' : pv == 1 ? 'cockpit' : 'exterior',
      onResetExteriorView: () => A().inspectExterior?.(),
      onChangeViewMode: (nextMode) => {
        if (nextMode === 'cockpit') {
          if (spec) {
            A().board();
            setSpec(false);
          }
          if (!fr) {
            setFr(true);
            A().free(true, false);
          }
          setFreeHelmMode(false);
          A().setFreeHelmMode?.(false);
          setPv(1);
          A().view(1);
        } else if (nextMode === 'exterior') {
          if (spec) {
            A().board();
            setSpec(false);
          }
          if (!fr) {
            setFr(true);
            A().free(true, false);
          }
          setPv(3);
          A().view(3);
        } else {
          if (spec) {
            A().exitSpectator();
            setSpec(false);
          }
          setFr(false);
          clearMissionOffer();
          setSelectedObject(null);
          A().setNavigationScale(
            ['stellar', 'regional', 'milkyway', 'extragalactic'].includes(navigationScale.id)
              ? navigationScale.id
              : 'stellar',
          );
        }
      },
      flightSpeed: fv,
      onSpeedPreset: (v) => {
        A().speed(v);
        setFv(v);
      },
      onFlightKey: (key, pressed) => A().key(key, pressed),
      selectedObject,
      onCloseObjectInspector: () => setSelectedObject(null),
      onQuickTravel: (key, label) => {
        startTravel(() => A().quick(key), label);
      },
      onTravelToSpherex: (target) => {
        setSelectedObject(null);
        chooseSpherexTarget(target);
      },
      onOpenSpherexObservatory: (target) => {
        setSelectedObject(null);
        setMissionTargetKey(target?.key || 'barnard');
        setMissionInitialStage('arrival');
        A().moveAiToStation?.('science', 'Explicación');
        setMissionOpen(true);
      },
      onTravelToPlanet: (planetName) => {
        setSelectedObject(null);
        startTravel(() => {
          if (spec) {
            A().board();
            setSpec(false);
            setFr(true);
          } else if (!fr) {
            setFr(true);
            A().free(true);
          }
          A().focus(planetName);
        }, planetName);
      },
      onFocusPlanet: (planetName) => {
        if (!planetName) return;
        A().orientTowardPlanet?.(planetName);
      },
      onOpenPlanetInfo: (planetName) => {
        setMore(planetName);
      },
      onOpenMissionSelector: () => {
        A().moveAiToStation?.('missions', 'Explicación');
        setMissionSelectorOpen(true);
      },
      onOpenSpherexDoc: () => {
        setSpherexDocOpen(true);
      },
      onOpenAiConsole: () => {
        A().moveAiToStation?.('comms', 'Comunicación');
        kronoxDialogHiddenRef.current = false;
        setKronoxDialogHidden(false);
        setKronoxOpen(true);
      },
      onStartMicConsult: () => {
        kronoxDialogHiddenRef.current = false;
        setKronoxDialogHidden(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('kronox:toggle-mic'));
        }
      },
      guideState,
      onStartGuidedTour: () => {
        A().startGuidedTour?.();
      },
      onSkipTutorialStep: () => {
        A().skipGuidedTourStep?.();
      },
      onEndTutorial: () => {
        A().endGuidedCabinTour?.();
        setGuideObjective('');
      },
      onReplayCinematic: () => {
        setWelcomeOpen(false);
        setRealTimeIntroActive(true);
        A().startRealTimeIntro?.(() => {
          introSoundtrackRef.current?.fadeOut?.(3.0);
          setRealTimeIntroActive(false);
          setFr(true);
          setPv(1);
        });
      },
      onOpenSettingsModal: () => {
        setMenuSection('spaceship');
        setOpen((prev) => !prev);
      },
      onDispatchSceneEvent: (ev, payload) => {
        const next = A().dispatchSceneEvent?.(ev, payload);
        if (next) setDirectorState({ ...next });
      },
      onSkipDirectorSequence: () => {
        A().skipDirectorSequence?.();
        const st = A().getSceneDirectorState?.();
        if (st) setDirectorState({ ...st });
      },
      directorState,
      astronautCoords,
      findingsCount: missionFindingsSync.length,
      consoleProjection,
      visualProfile,
      onOpenPauseMenu: () => {
        setPauseMenuSection('save');
        setPauseMenuOpen(true);
        api.current?.setSimulationPaused?.(true);
      },
      observationModeInfo,
      onSetOpticalTelescope: (enabled, magnification = 150, targetBody = null) => {
        const targetName = targetBody || observationModeInfo?.opticalTargetBody || f || near || 'Júpiter';
        const obsRes = A()?.setOpticalTelescope?.(enabled, magnification, targetName);
        if (obsRes) setObservationModeInfo(obsRes);
        if (enabled && A()?.getPlanetaryObservationalTelemetry) {
          setPlanetaryTelemetry(A().getPlanetaryObservationalTelemetry(targetName));
        } else {
          setPlanetaryTelemetry(null);
        }
      },
      planetaryTelemetry:
        gameSettings.showTelescopeTelemetry === false ? null : planetaryTelemetry,
      pointerLockState,
      assetLoadingState,
      vrState,
      onToggleVr: handleToggleVr,
      onRecenterVr: () => api.current?.recenterVr?.(),
      activeObjectiveText: guideObjective,
      activeMissionId: missionTargetKey,
      onOpenMissionFromObjective: (target) => {
        if (target?.key) setMissionTargetKey(target.key);
        setMissionInitialStage('explore');
        setMissionOpen(true);
      },
      onToggleVisualProfile: () => {
        const next = visualProfile === 'scientific' ? 'cinematic' : 'scientific';
        setVisualProfile(next);
        A()?.setVisualProfile?.(next);
        notify(
          next === 'scientific'
            ? 'Modo Científico activado: brillo estelar estricto según magnitud aparente y menor intensidad difusa.'
            : 'Modo Cinematográfico activado: mayor riqueza visual de la Vía Láctea, polvo oscuro y regiones HII conservando posiciones reales.',
          'Firmamento desde la nave',
        );
      },
    }),
    h(PauseMenu, {
      open: pauseMenuOpen,
      initialSection: pauseMenuSection,
      onClose: () => {
        setSavedGameSnapshot(loadGameState());
        setPauseMenuOpen(false);
        api.current?.setSimulationPaused?.(false);
      },
      onReturnToMainMenu: () => {
        stopVoiceAndClearQueue();
        clearNotices();
        introSoundtrackRef.current?.stop?.();
        setIntroPaused(false);
        introPausedRef.current = false;
        setRealTimeIntroActive(false);
        setPauseMenuOpen(false);
        setSavedGameSnapshot(loadGameState());
        api.current?.setSimulationPaused?.(false);
        api.current?.setMainMenuOrbit?.(true);
        setFr(true);
        setPv(3);
        setWelcomeOpen(true);
        setShowFullMainMenu(true);
      },
      currentBody: f || near || 'Tierra',
      cameraView: !fr ? 'Mapa Cartográfico' : pv == 1 ? 'Cabina 1P' : 'Exterior Nave 120 m',
      observationMode: observationModeInfo?.mode?.id || 'naked-eye',
      opticalMagnification: observationModeInfo?.opticalMagnification || 1,
      scaleMode: real ? 'real' : 'visual',
      visualProfile,
      onToggleVisualProfile: () => {
        const next = visualProfile === 'scientific' ? 'cinematic' : 'scientific';
        setVisualProfile(next);
        A()?.setVisualProfile?.(next);
        notify(
          next === 'scientific'
            ? 'Modo Científico activado: fotometría física rigurosa y menor intensidad difusa.'
            : 'Modo Cinematográfico activado: enriquecimiento estético de la Vía Láctea y nebulosas.',
          'Ajustes visuales',
        );
      },
      onToggleScaleMode: () => {
        const nextReal = !real;
        setReal(nextReal);
        A()?.mode?.(nextReal);
      },
      activeMissionId: missionTargetKey,
      activeObjective: guideObjective,
      voiceMuted: !voice,
      onToggleVoiceMute: handleToggleVoiceMute,
      onTestVoice: handleTestVoice,
      onRepeatLastKronoxMessage: () => {
        const lastMsg = narrativeQueue.repeat();
        if (lastMsg && voiceRef.current) speak(lastMsg.text);
      },
      gameSettings,
      onUpdateGameSettings: setGameSettings,
      graphicsRuntime,
      vrState,
      onToggleVr: handleToggleVr,
      onRecenterVr: () => api.current?.recenterVr?.(),
      onOpenMissionTarget: (targetKey) => {
        setMissionTargetKey(targetKey);
        setMissionInitialStage('investigate');
        setMissionOpen(true);
      },
    }),
    h(RepairMissionModal, {
      isOpen: activeCockpitStation === 'sensor-calibration',
      onStageChange: (stage) => {
        A()?.setRepairMissionStage?.(stage);
      },
      onClose: () => {
        setActiveCockpitStation(null);
        A()?.setActiveCabinStation?.(null);
      },
      onMissionComplete: () => {
        A()?.setRepairMissionStage?.(4);
        setActiveCockpitStation(null);
        A()?.setActiveCabinStation?.(null);
        notify('¡Sensor óptico calibrado con éxito! Logro de Ingeniero desbloqueado.', 'Servicio Técnico');
      },
    }),
    (showFullMainMenu || welcomeOpen) &&
    h(MainMenu, {
      open: true,
      hasSavedGame: Boolean(savedGameSnapshot?.savedAt || savedGameSnapshot?.currentBody),
      savedGameSummary: savedGameSnapshot,
      gameSettings,
      onUpdateGameSettings: setGameSettings,
      voiceMuted: !voice,
      onToggleVoiceMute: handleToggleVoiceMute,
      onTestVoice: handleTestVoice,
      quality,
      onQualityChange: setQuality,
      visualProfile,
      onToggleVisualProfile: () => {
        const next = visualProfile === 'scientific' ? 'cinematic' : 'scientific';
        setVisualProfile(next);
        A()?.setVisualProfile?.(next);
      },
      reducedMotion,
      onToggleReducedMotion: () => setReducedMotion((prev) => !prev),
      realScale: real,
      onToggleScaleMode: () => {
        const nextReal = !real;
        setReal(nextReal);
        A()?.mode?.(nextReal);
      },
      onPlayUiCue: playCue,
      onStartNewExpedition: ({ explorationMode = 'expert' } = {}) => {
        noviceCinematicActiveRef.current = explorationMode === 'novice';
        ensureGameplayAudioStarted();
        stopVoiceAndClearQueue();
        clearNotices();
        introSoundtrackRef.current?.start?.();
        setIntroPaused(false);
        introPausedRef.current = false;
        setShowFullMainMenu(false);
        setWelcomeOpen(false);
        setMissionTargetKey('barnard');
        setMissionInitialStage('arrival');
        setGuideObjective('');
        setRealTimeIntroActive(true);
        A()?.setMainMenuOrbit?.(false);
        A()?.startRealTimeIntro?.(() => {
          introSoundtrackRef.current?.fadeOut?.(2.8);
          setRealTimeIntroActive(false);
          setIntroPaused(false);
          setFr(true);
          setPv(1);
          setMissionTargetKey('barnard');
          setAiAvatarState('Bienvenida');
        }, {
          guidedTour: explorationMode === 'novice',
          guidedTourMode: explorationMode === 'novice' ? 'novice-cinematic' : null,
        });
      },
      onContinueExpedition: (saveData) => {
        ensureGameplayAudioStarted();
        stopVoiceAndClearQueue();
        introSoundtrackRef.current?.stop?.();
        setIntroPaused(false);
        introPausedRef.current = false;
        setRealTimeIntroActive(false);
        setShowFullMainMenu(false);
        setWelcomeOpen(false);
        const save = saveData || loadGameState() || {};
        const resumeKey = save.activeMissionId || savedExpedition?.targetKey || 'barnard';
        const wantReal = save.scaleMode ? save.scaleMode === 'real' : real;
        const wantExterior = String(save.cameraView || '').toLowerCase().includes('exterior');
        setMissionTargetKey(resumeKey);
        setMissionInitialStage(savedExpedition?.stage || 'explore');
        setReal(wantReal);
        A()?.mode?.(wantReal);
        A()?.restoreSavedGameState?.(save);
        setFr(true);
        setPv(wantExterior ? 3 : 1);
        setAiAvatarState('Acompañamiento');
        setGuideObjective(save.activeObjective || '');
        notify(
          `Partida cargada en ${save.currentBody || 'Tierra'} (${save.cameraView || 'Cabina 1P'}).`,
          'Partida reanudada',
        );
      },
      language,
    }),
    !welcomeOpen &&
    !showFullMainMenu &&
    !realTimeIntroActive &&
    !missionOpen &&
    !pauseMenuOpen &&
    !personalHubOpen &&
    !guideState?.cinematic &&
    h(KronoxTutorialOverlay, {
      guideState,
      onSkipStep: () => A()?.skipGuidedTourStep?.(),
      onDismiss: () => {
        A()?.endGuidedCabinTour?.();
        setGuideObjective('');
      },
      onOpenInventoryTab: (tabId) => {
        const nextTab = !tabId || tabId === 'inventory' ? 'map' : tabId;
        setPersonalHubTab(nextTab);
        setPersonalHubOpen(true);
        A()?.onGuidedInventoryOpen?.(nextTab);
      },
    }),
    !welcomeOpen &&
    !showFullMainMenu &&
    !realTimeIntroActive &&
    h(GameInventoryModal, {
      open: personalHubOpen,
      initialTab: personalHubTab,
      onClose: () => setPersonalHubOpen(false),
      onTabChange: (tabId) => A()?.onGuidedInventoryOpen?.(tabId),
      journal: loadExpeditionJournal(),
      findings: missionFindingsSync,
      inventoryState,
      heldToolId,
      activeMissionId: missionTargetKey,
      activeObjective: guideObjective,
      currentDeck: {
        code: String(astronautSectorState.deckId || 'deck-01')
          .replace('deck-', 'C')
          .toUpperCase(),
        name: astronautSectorState.deckName || 'Puente de Mando',
      },
      currentBody: f || near || 'Tierra',
      viewMode: !fr ? 'navigation' : pv == 1 ? 'cockpit' : 'exterior',
      cabinFirstPerson,
      visualProfile,
      scaleMode: real ? 'real' : 'visual',
      astronautSectorState,
      observationModeInfo,
      navigationScaleId: navigationScale?.id || 'solar',
      selectedGalaxyKey: nearbyGalaxyKey || 'milky-way',
      onEquipTool: (toolKey) => {
        const nextTool = toolKey || null;
        setHeldToolId(nextTool);
        A()?.setHeldTool?.(nextTool);
        setInventoryState(
          setEquippedInventoryTool(
            nextTool === 'multitool'
              ? 'multitool'
              : nextTool === 'scanner'
                ? 'scanner'
                : nextTool === 'optical-coupler'
                  ? 'optical-coupler'
                  : null,
          ),
        );
      },
      onInspectSampleWithAi: (item) => {
        if (!item) return;
        setPersonalHubOpen(false);
        handleKronoxCommand(
          `Analiza la muestra científica "${item.name}": ${item.scientificNote || item.description}`,
        );
      },
      onUseInventoryItem: (item) => {
        if (!item) return;
        notify(`${item.name}: verificado operativo a bordo.`, 'Operaciones');
      },
      onSelectScale: (scaleId) => {
        A()?.setNavigationScale?.(scaleId);
        A()?.onGuidedInventoryOpen?.('map');
      },
      onActivateSceneMapView: (scaleId) => {
        const targetScale = scaleId || navigationScale?.id || 'stellar';
        if (spec) {
          A()?.exitSpectator?.();
          setSpec(false);
        }
        setFr(false);
        setSelectedObject(null);
        A()?.setNavigationScale?.(targetScale);
        setNearbyMapActive(targetScale === 'extragalactic');
        A()?.onGuidedInventoryOpen?.('map');
      },
      onFocusPlanet: (planetName) => {
        A()?.focus?.(planetName);
      },
      onTravelToPlanet: (planetName) => {
        setSelectedObject(null);
        startTravel(() => {
          if (spec) {
            A()?.board?.();
            setSpec(false);
            setFr(true);
          } else if (!fr) {
            setFr(true);
            A()?.free?.(true);
          }
          A()?.focus?.(planetName);
        }, planetName);
      },
      onTravelToSpherex: (target) => {
        setSelectedObject(null);
        chooseSpherexTarget(target);
      },
      onFocusStar: (starName) => {
        A()?.focus?.(starName);
      },
      onFocusGalaxy: (galKey) => {
        A()?.nearbyMap?.();
        setNearbyMapActive(true);
        setNearbyGalaxyKey(galKey);
        setFr(false);
        A()?.focusNearbyGalaxy?.(galKey);
      },
      onQuickTravel: (key, label) => {
        startTravel(() => A()?.quick?.(key), label);
      },
      onOpenSpherexObservatory: (target) => {
        setMissionTargetKey(target?.key || missionTargetKey || 'barnard');
        setMissionInitialStage('arrival');
        setMissionOpen(true);
      },
      onOpenMissionSelector: () => {
        setMissionSelectorOpen(true);
      },
      onOpenPlanetInfo: (planetName) => {
        setMore(planetName);
      },
      onSetOpticalTelescope: (enabled, magnification = 150) => {
        const targetName = observationModeInfo?.opticalTargetBody || f || near || 'Júpiter';
        const obsRes = A()?.setOpticalTelescope?.(enabled, magnification, targetName);
        if (obsRes) setObservationModeInfo(obsRes);
      },
      onChangeCameraPerspective: (mode) => {
        if (mode === 'exterior') {
          if (spec) {
            A()?.board?.();
            setSpec(false);
          }
          if (!fr) {
            setFr(true);
            A()?.free?.(true, false);
          }
          setPv(3);
          A()?.view?.(3);
        } else {
          const is1p = mode === '1p';
          if (spec) {
            A()?.board?.();
            setSpec(false);
          }
          if (!fr) {
            setFr(true);
            A()?.free?.(true, false);
          }
          setPv(1);
          A()?.view?.(1);
          setCabinFirstPerson(is1p);
          A()?.setCabinPerspective?.(is1p);
        }
      },
      onToggleVisualProfile: () => {
        const next = visualProfile === 'scientific' ? 'cinematic' : 'scientific';
        setVisualProfile(next);
        A()?.setVisualProfile?.(next);
      },
      onToggleScaleMode: () => {
        const nextReal = !real;
        setReal(nextReal);
        A()?.mode?.(nextReal);
      },
      onToggleMicrogravityMode: () => {
        const nextMode = astronautSectorState.microgravityMode === 'FREE' ? 'ASSISTED' : 'FREE';
        A()?.setMicrogravityMode?.(nextMode);
      },
      onTransitToDeck: (deckId) => {
        const res = A()?.transitAstronautToDeck?.(deckId) || A()?.teleportAstronautToDeck?.(deckId);
        if (res) {
          setAstronautSectorState((prev) => ({
            ...prev,
            deckId: res.deckId || prev.deckId,
            deckNumber: res.deckNumber ?? prev.deckNumber,
            deckName: res.deckName || prev.deckName,
          }));
        }
      },
      onRestartTutorial: () => {
        A()?.startGuidedTour?.();
      },
      onSaveGame: () => {
        const snap = saveGameState({
          currentBody: f || near || 'Tierra',
          cameraView: !fr ? 'Mapa Cartográfico' : pv == 1 ? 'Cabina 1P' : 'Exterior Nave 120 m',
          scaleMode: real ? 'real' : 'visual',
          activeMissionId: missionTargetKey,
          activeObjective: guideObjective,
          astronautDeckId: astronautSectorState.deckId,
        });
        setSavedGameSnapshot(snap);
        notify('Estado de expedición guardado.', 'Guardado');
      },
    }),
    reticleTarget &&
    !pauseMenuOpen &&
    !personalHubOpen &&
    !welcomeOpen &&
    !showFullMainMenu &&
    !realTimeIntroActive &&
    (!fr ||
      pv != 1 ||
      astronautSectorState.deckId === 'deck-01' ||
      (observationModeInfo?.opticalMagnification || 1) > 1) &&
    h('div', {
      className: 'kronox-reticle-identifier',
      style: {
        position: 'fixed',
        bottom: '72px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 35,
        pointerEvents: 'none',
        background: 'rgba(7, 16, 25, 0.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '10px',
        padding: '8px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: '#f8fafc',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.65)',
      },
    },
      h('span', { style: { fontSize: '1.4rem', color: '#38bdf8' } }, '◎'),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
        h('div', { style: { fontWeight: '700', fontSize: '0.92rem', color: '#f8fafc' } }, reticleTarget.name),
        h('div', { style: { fontSize: '0.75rem', color: '#94a3b8' } }, `${reticleTarget.category} · ${reticleTarget.distanceDesc}`),
        reticleTarget.hasSpherex && h('div', { style: { fontSize: '0.72rem', color: '#38bdf8', fontWeight: '500' } }, '✦ Datos NASA SPHEREx disponibles')
      )
    ),
    fr && h('canvas', { id: 'warp', className: 'warp' }),
    fr &&
    pv == 3 &&
    !realTimeIntroActive &&
    !welcomeOpen &&
    !showFullMainMenu &&
    h(
      'div',
      { className: 'hud' },
      h('b', null, fv.toFixed(fv < 1 ? 2 : 0) + ' u/s'),
      (fv >= 300 ? ' · ≈ ' + Math.round(fv * 1.156) + ' años luz/s' : '') +
      ' · Exterior Nave 120m' +
      (fo.au ? ' · piloto auto.' : ''),
    ),
    !initialLoadingComplete &&
    h(LoadingScreen, {
      isReady: sceneReady,
      onComplete: () => setInitialLoadingComplete(true),
    })
  );
}
