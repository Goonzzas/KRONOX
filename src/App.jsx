Warning: truncated output (original token count: 42868)
Total output lines: 4682

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
import SpherexMissionSelector from './components/SpherexMissionSelector.jsx';
import SpaceshipCockpit from './components/SpaceshipCockpit.jsx';
import PauseMenu from './components/PauseMenu.jsx';
import MainMenu from './components/MainMenu.jsx';
import LocalizedDom from './components/LocalizedDom.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import RepairMissionModal from './components/RepairMissionModal.jsx';
import GameInventoryModal from './components/GameInventoryModal.jsx';
import KronoxTutorialOverlay from './components/KronoxTutorialOverlay.jsx';
import NoviceControlsHud from './components/NoviceControlsHud.jsx';
import NoviceMissionWaypointHud from './components/NoviceMissionWaypointHud.jsx';
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
import { detectLanguage, LANGUAGES, t, voiceLanguage } from './i18n.js';
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
const SphereXAdvancedExplorer = React.lazy(() => import('./components/SphereXAdvancedExplorer.jsx'));

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
    [advancedExplorerOpen, setAdvancedExplorerOpen] = useState(missionOpen),
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
    [advancedExplorerTarget, setAdvancedExplorerTarget] = useState(() =>
      SPHEREX_TARGETS.find((target) => target.key === missionTargetKey) || SPHEREX_TARGETS[0],
    ),
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
    [noviceAdventureMode, setNoviceAdventureMode] = useState(false),
    [noviceCabinMissionsOpen, setNoviceCabinMissionsOpen] = useState(false),
    [visitedDecks, setVisitedDecks] = useState(['deck-01']),
    [missionWaypointHud, setMissionWaypointHud] = useState(null),
    [heldToolId, setHeldToolId] = useState(null),
    [interactionFeedback, setInteractionFeedback] = useState(null),
    [voiceFailed, setVoiceFailed] = useState(false),
    [graphicsRuntime, setGraphicsRuntime] = useState(null),
    [performanceWarning, setPerformanceWarning] = useState(null),
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
    officialVoiceUnavailableRef = useRef(false),
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
    previousUiOpenRef = useRef(null),
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
  useEffect(() => {
    const deckId = astronautSectorState?.deckId;
    if (!deckId) return;
    setVisitedDecks((prev) => (prev.includes(deckId) ? prev : [...prev, deckId]));
  }, [astronautSectorState?.deckId]);
  const missionOfferTimer = useRef(null);
  const noviceMissionPhaseRef = useRef('');
  const clearMissionOffer = () => {
    clearTimeout(missionOfferTimer.current);
    setMissionLaunchTarget(null);
    setMissionArrival(false);
  };
  const openSpherexAdvancedExplorer = (target) => {
    const requestedKey = typeof target === 'string' ? target : target?.key;
    const catalogTarget = SPHEREX_TARGETS.find((candidate) => candidate.key === requestedKey);
    const hasCoordinates =
      target &&
      target.ra !== undefined &&
      target.ra !== null &&
      target.dec !== undefined &&
      target.dec !== null &&
      Number.isFinite(Number(target.ra)) &&
      Number.isFinite(Number(target.dec));
    const selectedTarget =
      catalogTarget ||
      (hasCoordinates ? { ...target, ra: Number(target.ra), dec: Number(target.dec) } : null) ||
      SPHEREX_TARGETS.find((candidate) => candidate.key === missionTargetKey) ||
      SPHEREX_TARGETS[0];

    setAdvancedExplorerTarget(selectedTarget);
    if (selectedTarget?.key) setMissionTargetKey(selectedTarget.key);
    setMissionSelectorOpen(false);
    setSpherexDocOpen(false);
    setMissionOpen(true);
    setAdvancedExplorerOpen(true);
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
  const missionGuideSyncRef = useRef(null);
  const languageRef = useRef(language);
  languageRef.current = language;
  const noviceCinematicActiveRef = useRef(false);
  const noviceNarrativeIdsRef = useRef(new Set());
  const lastIntroStageKeyRef = useRef('');
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
    const narrative = createNarrativeMessage(t(message, languageRef.current), options);
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
      localStorage.setItem('kronox-language-v2', language);
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
  const playCue = (kind) => {
    if (!gameAudioRef.current && (kind === 'confirm' || kind === 'tap' || kind === 'interface-open')) {
      ensureGameplayAudioStarted();
    }
    gameAudioRef.current?.cue(kind);
  };
  const syncAudioEngineState = (audio = gameAudioRef.current) => {
    if (!audio) return;
    const master = Number(gameSettingsRef.current?.masterVolume ?? 0.85);
    const music = Number(gameSettingsRef.current?.musicVolume ?? 0.38);
    const sfx = Number(gameSettingsRef.current?.sfxVolume ?? 0.65);
    const hasAudibleBus = master * sfx > 0.005 || master * music > 0.005;
    audio.setMix?.({ master, music, sfx });
    audio.setMusicSuppressed?.(realTimeIntroActiveRef.current);
    audio.setSpeaking?.(speakingRef.current);
    audio.setPaused?.(pauseMenuOpenRef.current);
    audio.setEnvironmentState?.({
      zone: mainMenuVisibleRef.current ? 'menu' : undefined,
      missionOpen: Boolean(missionOpenRef.current),
      paused: Boolean(pauseMenuOpenRef.current),
    });
    return hasAudibleBus;
  };
  const ensureGameplayAudioStarted = () => {
    if (!gameAudioRef.current) {
      gameAudioRef.current = createGameAudio();
    }
    if (gameAudioRef.current) {
      gameAudioRef.current.unlock?.();
      const hasAudibleBus = Boolean(syncAudioEngineState(gameAudioRef.current));
      gameAudioRef.current.setEnabled(hasAudibleBus);
      setAmbientEnabled(hasAudibleBus);
    }
    introSoundtrackRef.current?.unlock?.();
  };
  const toggleAmbient = () => {
    const master = Number(gameSettingsRef.current?.masterVolume ?? 0.85);
    const music = Number(gameSettingsRef.current?.musicVolume ?? 0.38);
    const sfx = Number(gameSettingsRef.current?.sfxVolume ?? 0.65);
    if (!gameAudioRef.current) {
      gameAudioRef.current = createGameAudio();
      if (!gameAudioRef.current) return;
      syncAudioEngineState(gameAudioRef.current);
    } else {
      gameAudioRef.current.setMix?.({ master, music, sfx });
    }
    const next = !ambientEnabled;
    gameAudioRef.current?.setEnabled(next);
    setAmbientEnabled(next);
    if (!next) gameAudioRef.current?.cue('tap');
  };
  const interfaceStates = [
    missionOpen,
    missionSelectorOpen,
    kronoxOpen,
    Boolean(activeCockpitStation),
    open,
    quickOpen,
    pauseMenuOpen,
    personalHubOpen,
    spherexDocOpen,
    nearbyMapActive,
  ];
  useEffect(() => {
    const previous = previousUiOpenRef.current;
    previousUiOpenRef.current = interfaceStates;
    if (!previous) return;
    if (interfaceStates.some((isOpen, index) => isOpen && !previous[index])) {
      playCue('interface-open');
    } else if (interfaceStates.some((isOpen, index) => !isOpen && previous[index])) {
      playCue('interface-close');
    }
  }, [missionOpen, missionSelectorOpen, kronoxOpen, activeCockpitStation, open, quickOpen,
    pauseMenuOpen, personalHubOpen, spherexDocOpen, nearbyMapActive]);
  useEffect(() => {
    const handleFirstGestureUnlock = () => {
      ensureGameplayAudioStarted();
    };
    const handleAchievementUnlocked = () => {
      playCue('achievement');
    };
    window.addEventListener('pointerdown', handleFirstGestureUnlock, { once: true, passive: true });
    window.addEventListener('keydown', handleFirstGestureUnlock, { once: true, passive: true });
    window.addEventListener('kronox:achievement-unlocked', handleAchievementUnlocked);
    return () => {
      window.removeEventListener('pointerdown', handleFirstGestureUnlock);
      window.removeEventListener('keydown', handleFirstGestureUnlock);
      window.removeEventListener('kronox:achievement-unlocked', handleAchievementUnlocked);
    };
  }, []);
  const chooseLanguage = (nextLanguage) => {
    setLanguageState(nextLanguage);
    setVoiceAccent(voiceLanguage(nextLanguage, 'es-US'));
    try {
      localStorage.setItem('kronox-language-v2', nextLanguage);
    } catch {
      /* Preference stays in memory. */
    }
  };
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
    const graphics = {
      ...DEFAULT_GRAPHICS_SETTINGS,
      ...(gameSettings.graphics || {}),
      preset: normalizeGraphicsPreset(gameSettings.graphics?.preset ?? quality, 'auto'),
    };
    api.current?.setGraphicsSettings?.(graphics);
  }, [gameSettings.graphics, quality]);
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
    const translated = t(msg, languageRef.current);
    if (!translated || !String(translated).trim()) {
      options.onComplete?.();
      return;
    }
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
    if (!voiceRef.current) {
      options.onComplete?.();
      return;
    }
    const master = Number(gameSettingsRef.current?.masterVolume ?? 0.85);
    const vox = Number(gameSettingsRef.current?.voiceVolume ?? 0.95);
    const voiceGain = Math.max(0, Math.min(1, master * vox));
    if (voiceGain <= 0.001) {
      options.onComplete?.();
      return;
    }
    if (
      typeof Audio === 'undefined' &&
      (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance)
    ) {
      options.onComplete?.();
      return;
    }
    // Voice audio does not forcefully pop open the command drawer;
    // subtitles display contextually via narrative queue while speaking.
    const shouldInterrupt = Boolean(options.interrupt);

    // Scene callbacks can repeat an identical line with interrupt=true.
    // Avoid restarting its audio while that line is already playing.
    if (speakingRef.current && activeSpeechTextRef.current === cleanMsg) return;

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
      options.onComplete?.();
    };

    const voiceStatusNow = fishVoiceStatusRef.current;
    const officialVoiceUnavailable =
      voiceStatusNow?.configured === false && !voiceStatusNow.geminiTts?.configured;
    const canUseLocalSpeech =
      !voiceProvider.staticAudioUrl?.({ text: cleanMsg }) &&
      officialVoiceUnavailable &&
      typeof window !== 'undefined' &&
      window.speechSynthesis &&
      window.SpeechSynthesisUtterance;

    if (canUseLocalSpeech) {
      const utterance = new window.SpeechSynthesisUtterance(cleanMsg);
      const availableVoices = window.speechSynthesis.getVoices?.() || [];
      const voiceLanguagePrefix = (voiceAccentRef.current || 'en-US').split(/[-_]/)[0];
      const matchingVoice = availableVoices.find((item) =>
        new RegExp(`^${voiceLanguagePrefix}([_-]|$)`, 'i').test(item.lang || ''),
      );
      if (matchingVoice) utterance.voice = matchingVoice;
      utterance.lang = voiceAccentRef.current || 'en-US';
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
      setVoiceFailed(false);
      setVoiceError('');
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
        allowBrowserFallback: Boolean(options.allowBrowserFallback),
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
        // Some browsers keep a partially decoded source alive after `error`.
        // Stop it before retrying or switching to browser speech to prevent overlap.
        fallbackStarted = true;
        const failedAudio = voiceAudio.current;
        if (failedAudio) {
          failedAudio.onended = null;
          failedAudio.onerror = null;
          failedAudio.pause();
          failedAudio.removeAttribute('src');
          voiceAudio.current = null;
        }
        // Reintentar primero con los endpoints oficiales (Charon) y almacenar en caché Blob.
        if (
          !entry.retriedFetch &&
          !officialVoiceUnavailableRef.current &&
          typeof fetch === 'function'
        ) {
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
                  // Allow the retry element to report its own failure, while
                  // the original element's handlers have already been removed.
                  fallbackStarted = false;
                  attachAndPlay({
                    audio: retryAudio,
                    audioUrl: objUrl,
                    fallbackUrl: entry.fallbackUrl,
                    cacheKey: entry.cacheKey,
                    text: entry.text,
                    allowBrowserFallback: entry.allowBrowserFallback,
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
        // Keep narration audible if hosted TTS fails. The browser voice uses the selected language.
        if (
          typeof window !== 'undefined' &&
          window.speechSynthesis &&
          window.SpeechSynthesisUtterance
        ) {
          const utterance = new window.SpeechSynthesisUtterance(entry.text);
          const availableVoices = window.speechSynthesis.getVoices?.() || [];
          const voiceLanguagePrefix = (voiceAccentRef.current || 'en-US').split(/[-_]/)[0];
          const matchingVoice = availableVoices.find((item) =>
            new RegExp(`^${voiceLanguagePrefix}([_-]|$)`, 'i').test(item.lang || ''),
          );
          if (matchingVoice) utterance.voice = matchingVoice;
          utterance.lang = voiceAccentRef.current || 'en-US';
          utterance.rate = 0.94;
          utterance.pitch = 0.9;
          utterance.volume = Math.max(
            0,
            Math.min(
              1,
              Number(gameSettingsRef.current?.masterVolume ?? 0.85) *
                Number(gameSettingsRef.current?.voiceVolume ?? 0.95),
            ),
          );
          const finishBrowserSegment = () => {
            browserVoiceActiveRef.current = false;
            speakingRef.current = false;
            setSpeaking(false);
            playNext();
          };
          utterance.onend = finishBrowserSegment;
          utterance.onerror = finishBrowserSegment;
          voiceAudio.current = null;
          browserVoiceActiveRef.current = true;
          speakingRef.current = true;
          setSpeaking(true);
          setVoiceFailed(false);
          setVoiceError('');
          try {
            window.speechSynthesis.speak(utterance);
            return;
          } catch {
            browserVoiceActiveRef.current = false;
            speakingRef.current = false;
            setSpeaking(false);
          }
        }
        officialVoiceUnavailableRef.current = true;
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
              officialVoiceUnavailableRef.current = false;
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
        allowBrowserFallback: Boolean(options.allowBrowserFallback),
        retriedFetch: false,
      });
    };
    playNext();
  },
    handleRetryVoice = () => {
      officialVoiceUnavailableRef.current = false;
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
        if (voiceAudio.current && !voiceAudio.curr…17868 tokens truncated…ocedurales.',
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
              travelToQuickTarget(key, label);
              setQuickOpen(false);
            },
            onPlanetTravel: (name) => {
              travelToPlanet(name);
              setQuickOpen(false);
            },
          }),
        ),
        menuSection === 'mission' &&
        h(
          'section',
          { className: 'missionMenuCard' },
          h('div', { className: 'missionLaunchMark', 'aria-hidden': 'true' }, '✦'),
          h('small', null, 'NEW OBSERVATORY · SPHEREx'),
          h('h2', null, 'Esfera 360° y Explorador DR1'),
          h(
            'p',
            null,
            'Explora la Estrella de Barnard, galaxias y 10 épocas temporales en la Esfera Celeste 360° junto al cubo de 102 canales DR1 e IRSA.',
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
                  openSpherexAdvancedExplorer('barnard');
                },
              },
              'Abrir Explorador SPHEREx · Barnard & Esfera 360°',
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
      cinematic: Boolean(guideState?.cinematic),
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
        lastIntroStageKeyRef.current = '';
        realTimeIntroActiveRef.current = true;
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
      {
        className: `missionLaunchWindow${noviceMissionPhaseRef.current === 'arrived' ? ' noviceMissionLaunchWindow' : ''}`,
        role: 'dialog',
        'aria-live': 'polite',
      },
      h('div', { className: 'missionLaunchMark', 'aria-hidden': 'true' }, '✦'),
      h(
        'div',
        { className: 'missionLaunchCopy' },
        h('small', null, 'DESTINO LOCALIZADO · SPHEREx'),
        h('b', null, missionLaunchTarget.name),
        h(
          'span',
          null,
          noviceMissionPhaseRef.current === 'arrived' || missionLaunchTarget?.key === 'barnard'
            ? t(
                'Llegamos a la Estrella de Barnard. Pulsa «Empezar misión» para analizarla en el nuevo visualizador SPHEREx.',
                language,
              )
            : t('Llegamos. Cambia a velocidad planetaria para explorar con calma. ¿Empezamos?', language),
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
        openSpherexAdvancedExplorer(target || 'barnard');
      },
    }),
    advancedExplorerOpen &&
    h(
      React.Suspense,
      {
        fallback: h(
          'div',
          { className: 'juanLoadingMission', role: 'status' },
          'Abriendo el nuevo explorador SPHEREx…',
        ),
      },
      h(SphereXAdvancedExplorer, {
        targetName: t(advancedExplorerTarget?.name || SPHEREX_TARGETS[0]?.name || 'Estrella de Barnard', language),
        ra: advancedExplorerTarget?.ra,
        dec: advancedExplorerTarget?.dec,
        language,
        guidedTutorial: noviceCinematicActiveRef.current,
        voiceEnabled: voice,
        onEnableNarration: () => {
          voiceRef.current = true;
          setVoice(true);
        },
        narrate: (text, onComplete) =>
          speak(text, {
            interrupt: true,
            allowBrowserFallback: true,
            skipGuide: true,
            onComplete,
          }),
        onGuidedComplete: (keepModalOpen = false) => A().onNoviceCinematicComplete?.(Boolean(keepModalOpen)),
        onClose: () => {
          const wasNovice = noviceCinematicActiveRef.current;
          setAdvancedExplorerOpen(false);
          setMissionOpen(false);
          if (wasNovice) A().onNoviceCinematicComplete?.(false);
          if (activeCockpitStation === 'science') {
            setActiveCockpitStation(null);
            A().setActiveCabinStation?.(null);
          }
        },
      }),
    ),
    spherexDocOpen &&
    h(SpherexDocumentary, {
      language,
      onClose: () => setSpherexDocOpen(false),
      onOpenObservatory: () => {
        openSpherexAdvancedExplorer(missionTargetKey);
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
        travelToQuickTarget(key, label);
      },
      onTravelToSpherex: (target) => {
        setSelectedObject(null);
        chooseSpherexTarget(target);
      },
      onOpenSpherexObservatory: (target) => {
        setSelectedObject(null);
        A().moveAiToStation?.('science', 'Explicación');
        openSpherexAdvancedExplorer(target || 'barnard');
      },
      onTravelToPlanet: (planetName) => {
        travelToPlanet(planetName);
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
        lastIntroStageKeyRef.current = '';
        realTimeIntroActiveRef.current = true;
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
        playCue(enabled ? 'scan' : 'switch');
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
        openSpherexAdvancedExplorer(target || missionTargetKey || 'barnard');
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
        setPauseMenuOpen(false);
        api.current?.setSimulationPaused?.(false);
        openSpherexAdvancedExplorer(targetKey || 'barnard');
      },
    }),
    h(RepairMissionModal, {
      isOpen: activeCockpitStation === 'sensor-calibration',
      onSfxCue: playCue,
      onStageChange: (stage) => {
        A()?.setRepairMissionStage?.(stage);
      },
      onClose: () => {
        setActiveCockpitStation(null);
        A()?.setActiveCabinStation?.(null);
      },
      onMissionComplete: () => {
        playCue('mission-complete');
        A()?.setRepairMissionStage?.(4);
        setActiveCockpitStation(null);
        A()?.setActiveCabinStation?.(null);
        notify('¡Sensor óptico calibrado con éxito! Logro de Ingeniero desbloqueado.', 'Servicio Técnico');
      },
    }),
    (showFullMainMenu || welcomeOpen) &&
    h(MainMenu, {
      open: true,
      language,
      onChangeLanguage: chooseLanguage,
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
        setNoviceAdventureMode(explorationMode === 'novice');
        setNoviceCabinMissionsOpen(false);
        setVisitedDecks(['deck-01']);
        noviceCinematicActiveRef.current = explorationMode === 'novice';
        noviceMissionPhaseRef.current = '';
        noviceNarrativeIdsRef.current.clear();
        lastIntroStageKeyRef.current = '';
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
        realTimeIntroActiveRef.current = true;
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
        setNoviceAdventureMode(false);
        setNoviceCabinMissionsOpen(false);
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
    !advancedExplorerOpen &&
    !pauseMenuOpen &&
    !personalHubOpen &&
    !guideState?.cinematic &&
    h(KronoxTutorialOverlay, {
      guideState,
      noviceCabinMissionsOpen,
      visitedDecks,
      language,
      onSkipStep: () => A()?.skipGuidedTourStep?.(),
      onDismiss: () => {
        A()?.endGuidedCabinTour?.();
        setNoviceCabinMissionsOpen(false);
        setGuideObjective('');
      },
      onDismissCabinMissions: () => setNoviceCabinMissionsOpen(false),
      onOpenObservatory: () => openSpherexAdvancedExplorer('barnard'),
      onOpenInventoryTab: (tabId) => {
        const nextTab = !tabId || tabId === 'inventory' ? 'map' : tabId;
        setPersonalHubTab(nextTab);
        setPersonalHubOpen(true);
        A()?.onGuidedInventoryOpen?.(nextTab);
      },
    }),
    noviceAdventureMode && !welcomeOpen && !showFullMainMenu && !realTimeIntroActive &&
      h(NoviceControlsHud, { language }),
    noviceAdventureMode &&
      missionWaypointHud?.visible &&
      !welcomeOpen &&
      !showFullMainMenu &&
      !realTimeIntroActive &&
      !missionSelectorOpen &&
      !missionOpen &&
      !advancedExplorerOpen &&
      !pauseMenuOpen &&
      !personalHubOpen &&
      h(NoviceMissionWaypointHud, {
        waypoint: missionWaypointHud,
        language,
        onActivate: () => A()?.activateNearestStation?.(),
        onWalkToConsole: () => A()?.walkNoviceToMissionConsole?.(),
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
        travelToPlanet(planetName);
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
        travelToQuickTarget(key, label);
      },
      onOpenSpherexObservatory: (target) => {
        openSpherexAdvancedExplorer(target || missionTargetKey || 'barnard');
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
        playCue('confirm');
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
      t(
        (fv >= 300 ? ' · ≈ ' + Math.round(fv * 1.156) + ' años luz/s' : '') +
          ' · Exterior Nave 120m' +
          (fo.au ? ' · piloto auto.' : ''),
        language,
      ),
    ),
    !initialLoadingComplete &&
    h(LoadingScreen, {
      isReady: sceneReady,
      onComplete: () => setInitialLoadingComplete(true),
    })
      )}
    </LocalizedDom>
  );
}
