import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { P, INFO } from './data/planetData.js';
import { setupScene } from './scene/createScene.js';
import KronoxWidget from './components/KronoxWidget.tsx';
import ToastNotification from './components/ToastNotification.jsx';
import PlanetInfoModal from './components/PlanetInfoModal.jsx';
import QuickTravelMenu from './components/QuickTravelMenu.jsx';
import { NearbyGalaxyControls, NearbyGalaxyInfoModal } from './components/NearbyGalaxies.jsx';
import { NEARBY_GALAXIES } from './data/nearbyGalaxies.js';
import MobileFlightControls from './components/MobileFlightControls.jsx';
import SpherexMission from './components/SpherexMission.jsx';
import SpherexMissionSelector from './components/SpherexMissionSelector.jsx';
import SpaceshipCockpit from './components/SpaceshipCockpit.jsx';
import { SPHEREX_MISSION_TYPES, SPHEREX_TARGETS } from './data/spherexTargets.js';
import { processKronoxQuery } from './utils/kronoxAI.js';
import { loadFindingsFromStorage } from './utils/findingsStorage.js';
import { detectLanguage, hasSavedLanguage, LANGUAGES, t, voiceLanguage } from './i18n.js';
import { createGameAudio } from './utils/gameAudio.js';
import { installFloatingOverlayLayout } from './utils/floatingOverlayLayout.js';
import { createNarrativeMessage, narrativeQueue } from './state/kronoxMessages.ts';
import './styles.css';

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
    [quality, setQuality] = useState(() => {
      try {
        return localStorage.getItem('kronox-quality') || 'auto';
      } catch {
        return 'auto';
      }
    }),
    [reducedMotion, setReducedMotion] = useState(() => {
      try {
        const saved = localStorage.getItem('kronox-reduced-motion');
        return saved === null
          ? window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false
          : saved === 'true';
      } catch {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
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
    [welcomeOpen, setWelcomeOpen] = useState(() => {
      try {
        const p = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        if (p && (p.get('observatory') === 'true' || p.has('target'))) return false;
        if (p && p.get('welcome') === 'false') return false;
        return true;
      } catch {
        return true;
      }
    }),
    [missionOpen, setMissionOpen] = useState(() => {
      try {
        const p = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        return p ? (p.get('observatory') === 'true' || p.has('target')) : false;
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
        const p = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        return p?.get('target') || 'barnard';
      } catch {
        return 'barnard';
      }
    }),
    [missionInitialStage, setMissionInitialStage] = useState('arrival'),
    [missionStageSync, setMissionStageSync] = useState('arrival'),
    [missionRecordsSync, setMissionRecordsSync] = useState([]),
    [missionFindingsSync, setMissionFindingsSync] = useState(() => loadFindingsFromStorage()),
    [selectedObject, setSelectedObject] = useState(null),
    [activeCockpitStation, setActiveCockpitStation] = useState(null),
    [nearestCabinStation, setNearestCabinStation] = useState(null),
    [cabinFirstPerson, setCabinFirstPerson] = useState(true),
    [astronautCoords, setAstronautCoords] = useState({ x: 0, z: -1.8 }),
    [aiProjection, setAiProjection] = useState(null),
    [consoleProjection, setConsoleProjection] = useState(null),
    [directorState, setDirectorState] = useState(null),
    [guideObjective, setGuideObjective] = useState(''),
    [speechPaused, setSpeechPaused] = useState(false),
    [realTimeIntroActive, setRealTimeIntroActive] = useState(false),
    [realTimeIntroCaption, setRealTimeIntroCaption] = useState(''),
    [aiRole, setAiRole] = useState('Entidad Luminosa 3D'),
    [aiAvatarState, setAiAvatarState] = useState('Acompañamiento'),
    [aiPointDirection, setAiPointDirection] = useState('right'),
    [aiEpistemicCategory, setAiEpistemicCategory] = useState('Comunicación espacial en puente 3D'),
    [aiHighlightField, setAiHighlightField] = useState(false),
    [aiHistory, setAiHistory] = useState([]),
    [welcomeSettingsOpen, setWelcomeSettingsOpen] = useState(false),
    [savedExpedition, setSavedExpedition] = useState(() => {
      try {
        const raw = localStorage.getItem('kronox-expedition-progress');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }),
    [welcomeStep, setWelcomeStep] = useState('voice'),
    [voice, setVoice] = useState(() => { try { return new URLSearchParams(window.location.search).get('voice') === 'true'; } catch { return false; } }),
    [voiceError, setVoiceError] = useState(''),
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
    flR = useRef(fl),
    countTimers = useRef([]),
    missionTravelTipTimer = useRef(null),
    voiceRef = useRef(false),
    voiceAudio = useRef(null),
    voiceToken = useRef(0),
    voiceAccentRef = useRef(voiceAccent),
    noticeQueue = useRef([]),
    noticeRef = useRef(null),
    noticeTimer = useRef(null),
    gameAudioRef = useRef(null);
  const languageManuallyChosen = useRef(false);
  const languagePreferenceExists = useRef(hasSavedLanguage());
  const missionGuideSyncRef = useRef(null);
  const guide = useSyncExternalStore(narrativeQueue.subscribe, narrativeQueue.getSnapshot, narrativeQueue.getServerSnapshot);
  useEffect(() => {
    if (speechPaused) narrativeQueue.pause();
    else narrativeQueue.resume();
  }, [speechPaused]);
  const setGuide = (message, options = {}) => {
    if (typeof message !== 'string') throw new TypeError('Narrative channel only accepts text through createNarrativeMessage.');
    const narrative = createNarrativeMessage(t(message, language), options);
    narrativeQueue.enqueue(narrative);
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
    if (nextProps.narrative?.text) nextProps.narrative = { ...nextProps.narrative, text: t(nextProps.narrative.text, language) };
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
  useEffect(() => {
    try {
      localStorage.setItem('kronox-quality', quality);
    } catch {
      /* Preference stays in memory. */
    }
    api.current?.quality?.(quality);
  }, [quality]);
  const playCue = (kind) => gameAudioRef.current?.cue(kind);
  const toggleAmbient = () => {
    if (!gameAudioRef.current) {
      gameAudioRef.current = createGameAudio();
      if (!gameAudioRef.current) return;
      gameAudioRef.current?.setVolume(soundVolume);
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
      .catch(() => {});
  }, []);
  const speakingRef = useRef(false),
    kronoxCloseTimer = useRef(null),
    kronoxDialogHiddenRef = useRef(false),
    travelRef = useRef(false),
    factIndexRef = useRef(0),
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
  const openKronox = () => {
    clearTimeout(kronoxCloseTimer.current);
    if (!kronoxDialogHiddenRef.current) setKronoxOpen(true);
  };
  const closeKronoxLater = () => {
    clearTimeout(kronoxCloseTimer.current);
    kronoxCloseTimer.current = setTimeout(() => {
      if (!speakingRef.current && !kronoxDialogHiddenRef.current) setKronoxOpen(false);
    }, 3000);
  };
  const stopAudioAnalysis = () => {
    if (audioFrameRef.current !== null) cancelAnimationFrame(audioFrameRef.current);
    audioFrameRef.current = null;
    audioSourceRef.current?.disconnect();
    audioSourceRef.current = null;
    setAudioLevels(Array(48).fill(0));
  };
  const startAudioAnalysis = (audio) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;
      const analyser = analyserRef.current || context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.78;
      if (!analyserRef.current) {
        analyserRef.current = analyser;
        analyser.connect(context.destination);
      }
      audioSourceRef.current?.disconnect();
      const source = context.createMediaElementSource(audio);
      source.connect(analyser);
      audioSourceRef.current = source;
      const spectrum = new Uint8Array(analyser.frequencyBinCount);
      let lastUpdate = 0;
      const sample = (time) => {
        if (audioSourceRef.current !== source) return;
        analyser.getByteFrequencyData(spectrum);
        if (time - lastUpdate > 30) {
          const levels = Array.from({ length: 48 }, (_, index) => {
            const start = Math.floor((index / 48) ** 2 * spectrum.length);
            const end = Math.max(start + 1, Math.floor(((index + 1) / 48) ** 2 * spectrum.length));
            let total = 0;
            for (let bin = start; bin < Math.min(end, spectrum.length); bin++)
              total += spectrum[bin];
            return Math.max(0.08, Math.min(4.5, (total / Math.max(1, end - start) / 255) * 5.5));
          });
          setAudioLevels(levels);
          lastUpdate = time;
        }
        audioFrameRef.current = requestAnimationFrame(sample);
      };
      context.resume().catch(() => {});
      audioFrameRef.current = requestAnimationFrame(sample);
    } catch {
      // Keep audio playback working if this browser cannot expose the audio stream.
    }
  };
  const speak = (msg) => {
      msg = t(msg, language);
      if (!voiceRef.current) return;
      openKronox();
      const token = ++voiceToken.current;
      if (voiceAudio.current) {
        voiceAudio.current.pause();
        voiceAudio.current.removeAttribute('src');
        voiceAudio.current = null;
      }
      stopAudioAnalysis();
      const chunks = msg.match(/[^.!?]+[.!?]?/g) || [msg],
        parts = [];
      for (const raw of chunks) {
        let chunk = raw.trim();
        while (chunk.length > 170) {
          let cut = chunk.lastIndexOf(' ', 170);
          if (cut < 60) cut = 170;
          parts.push(chunk.slice(0, cut));
          chunk = chunk.slice(cut).trim();
        }
        if (chunk) parts.push(chunk);
      }
      let i = 0;
      const finishSpeech = () => {
        if (token !== voiceToken.current) return;
        stopAudioAnalysis();
        setSpeaking(false);
        speakingRef.current = false;
        voiceAudio.current = null;
        closeKronoxLater();
      };
      const useBrowserVoice = (remainingText) => {
        if (token !== voiceToken.current || !voiceRef.current) return;
        if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
          setVoiceError('No se pudo reproducir la voz de Kronox. Revisa el audio del navegador.');
          finishSpeech();
          return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(remainingText);
        utterance.lang = voiceAccentRef.current || 'es-US';
        utterance.rate = 1.08;
        utterance.onstart = () => {
          if (token !== voiceToken.current) return;
          setVoiceError('');
          setSpeaking(true);
          speakingRef.current = true;
        };
        utterance.onend = finishSpeech;
        utterance.onerror = () => {
          if (token === voiceToken.current)
            setVoiceError('No se pudo reproducir la voz de Kronox. Revisa el audio del navegador.');
          finishSpeech();
        };
        window.speechSynthesis.speak(utterance);
      };
      const playNext = () => {
        if (token !== voiceToken.current || !voiceRef.current) return;
        if (i >= parts.length) return finishSpeech();
        const text = parts[i++];
        const audioUrl =
          import.meta.env.BASE_URL === '/'
            ? '/api/voice?lang=' +
              encodeURIComponent(voiceAccentRef.current) +
              '&text=' +
              encodeURIComponent(text)
            : 'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=' +
              voiceAccentRef.current +
              '&text=' +
              encodeURIComponent(text);
        const audio = new Audio();
        if (audioUrl.startsWith('/')) audio.crossOrigin = 'anonymous';
        audio.src = audioUrl;
        audio.preload = 'auto';
        audio.playbackRate = 1.28;
        audio.preservesPitch = true;
        audio.volume = 1;
        audio.muted = false;
        voiceAudio.current = audio;
        let fallbackStarted = false;
        const fallbackToBrowserVoice = () => {
          if (fallbackStarted || token !== voiceToken.current) return;
          fallbackStarted = true;
          voiceAudio.current = null;
          stopAudioAnalysis();
          useBrowserVoice([text, ...parts.slice(i)].join(' '));
        };
        audio.onended = playNext;
        audio.onerror = () => {
          fallbackToBrowserVoice();
        };
        audio
          .play()
          .then(() => {
            if (token === voiceToken.current) {
              setVoiceError('');
              setSpeaking(true);
              speakingRef.current = true;
              if (audioUrl.startsWith('/')) startAudioAnalysis(audio);
            }
          })
          .catch((e) => {
            if (token !== voiceToken.current) return;
            if (e && e.name === 'NotAllowedError') {
              setVoiceError('El navegador bloqueó el audio. Pulsa «Activar voz» otra vez.');
              finishSpeech();
            } else {
              fallbackToBrowserVoice();
            }
          });
      };
      playNext();
    },
    say = (msg) => {
      setGuide(msg);
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
      noticeQueue.current.push({
        id: Date.now() + Math.random(),
        text: t(text, language),
        title: t(title, language),
        planet,
      });
      if (!noticeRef.current) showNextNotice();
    };
  useEffect(() => {
    api.current = setupScene(el.current, {
      quality,
      reducedMotion: () => reducedMotion,
      onNearbyGalaxySelect: (key) => {
        setNearbyGalaxyKey(key);
        setNearbyGalaxyInfoKey(key);
      },
      onObjectSelect: (obj) => {
        setSelectedObject(obj);
      },
      onNearestStationChange: (st) => {
        setNearestCabinStation(st);
      },
      onStationInteract: (stationId) => {
        setActiveCockpitStation(stationId);
        A().onGuidedStationInteraction?.(stationId);
        if (stationId === 'comms') {
          kronoxDialogHiddenRef.current = false;
          setKronoxDialogHidden(false);
          setKronoxOpen(true);
        } else if (stationId === 'science') {
          setMissionOpen(true);
        } else if (stationId === 'missions') {
          setMissionSelectorOpen(true);
        }
      },
      onIntroStageChange: (stageKey, captionText) => {
        setRealTimeIntroActive(true);
        setRealTimeIntroCaption(captionText);
        say(captionText);
        if (voiceRef.current) speak(captionText);
      },
      onAiTourNarrative: (text, stateName, stationId) => {
        setAiAvatarState(stateName);
        const intent = /bienvenida/i.test(stateName) ? 'welcome' : /confirm/i.test(stateName) ? 'confirmation' : /orient/i.test(stateName) ? 'orientation' : 'explanation';
        const message = setGuide(text, { intent, once: true });
        if (voiceRef.current) speak(text);
        return message.id;
      },
      onGuideObjective: (objective) => setGuideObjective(objective),
      onGuideStateChange: ({ active, step }) => {
        if (!active || step === 'free') setGuideObjective('');
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
      },
      onConsoleScreenProjection: (proj) => {
        setConsoleProjection(proj);
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
        if (n && INFO[n])
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
    // Start the 3D scene with the KRONOX vessel cruising in exterior view
    try {
      setFr(true);
      setPv(3);
      if (typeof window !== 'undefined') window.__kronoxSceneApi = api.current;
      api.current.free(true, false);
      api.current.view(3);
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
    const target = near || f;
    if (!target || !INFO[target]) return undefined;
    const timer = setInterval(() => {
      if (speakingRef.current || travelRef.current || countdown !== null || noticeRef.current)
        return;
      const data = INFO[target];
      const facts = [
        ['dato', 'Curiosidad'],
        ['clima', 'Clima'],
        ['atmosfera', 'Atmósfera'],
        ['composicion', 'Composición'],
        ['superficie', 'Superficie'],
      ].filter(([key]) => data[key]);
      if (!facts.length) return;
      const [key, label] = facts[factIndexRef.current % facts.length];
      factIndexRef.current += 1;
      notify(
        t(label, language) + ' de ' + t(target, language) + ': ' + t(data[key], language),
        'Dato astronómico',
        target,
      );
    }, 38000);
    return () => clearInterval(timer);
  }, [near, f, countdown]);
  useEffect(
    () => () => {
      clearTimeout(noticeTimer.current);
      clearTimeout(missionTravelTipTimer.current);
      voiceToken.current++;
      clearTimeout(kronoxCloseTimer.current);
      if (voiceAudio.current) voiceAudio.current.pause();
      gameAudioRef.current?.dispose();
      audioContextRef.current?.close().catch(() => {});
      if (window.speechSynthesis) window.speechSynthesis.cancel();
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
      // Keep the active cockpit/exterior perspective for the whole trip. If
      // travel starts from a navigation-only state, use the chase camera.
      const travelView = fr ? pv : 3;
      if (spec) {
        A().board();
        setSpec(false);
      } else if (!fr) {
        A().free(true, false);
      }
      setFr(true);
      setPv(travelView);
      A().view(travelView);
      playCue('travel');
      setNavigation({ label: t(label, language), phase: 'countdown', progress: 0 });
      clearTimeout(missionTravelTipTimer.current);
      travelRef.current = true;
      countTimers.current.forEach(clearTimeout);
      clearTimeout(noticeTimer.current);
      noticeQueue.current = [];
      noticeRef.current = null;
      setNotice(null);
      setCountdown(3);
      say('Preparando viaje rápido hacia ' + t(label, language) + '. Cuenta atrás: 3, 2, 1.');
      speak('Tres.');
      let n = 3;
      const tick = () => {
        if (n === 1) {
          setCountdown(null);
          notify('¡Salto iniciado! Rumbo a ' + t(label, language) + '.', 'Viaje rápido');
          if (awaitSceneArrival) {
            missionTravelTipTimer.current = setTimeout(() => {
              if (travelRef.current)
                notify(
                  'Vas avanzando despacio para la distancia que nos separa. Puedes subir la velocidad a Galaxia o Hiper en el menú Nave espacial para llegar antes.',
                  'Viaje largo',
                );
            }, 8000);
            run(() => {
              travelRef.current = false;
              playCue('arrival');
              setNavigation(null);
              clearTimeout(missionTravelTipTimer.current);
              if (afterArrival) afterArrival();
            });
          } else {
            run();
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
          return;
        }
        n--;
        setCountdown(n);
        speak(n === 2 ? 'Dos.' : 'Uno.');
        countTimers.current.push(setTimeout(tick, 850));
      };
      countTimers.current = [setTimeout(tick, 850)];
    },
    chooseSpherexTarget = (target) => {
      if (travelRef.current || missionArrival || !target) return;
      setMissionSelectorOpen(false);
      setMissionTraveling(true);
      setMissionLaunchTarget(null);
      setMissionArrivalName(target.name);
      say(
        'Destino fijado: ' +
          t(target.name, language) +
          '. Prepararé el salto hasta su posición en el vecindario galáctico.',
      );
      startTravel(
        (onArrive) => {
          if (spec) {
            A().board();
            setSpec(false);
          }
          A().missionTarget(target.key, onArrive);
        },
        target.name,
        () => {
          setMissionTraveling(false);
          setMissionArrival(true);
          notify(
            'Hemos llegado a ' +
              t(target.name, language) +
              '. Para explorar con calma, cambia la velocidad a planetaria en Nave espacial.',
            'Objetivo alcanzado',
          );
          setTimeout(() => {
            setMissionArrival(false);
            setMissionLaunchTarget(target);
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
      setMissionLaunchTarget(null);
      setMissionOpen(true);
      setMissionTargetKey(target.key);
      say(instruction);
      openKronox();
      speak(instruction);
    },
    handleKronoxCommand = (query) => {
      const result = processKronoxQuery(query, {
        activeTargetKey: missionTargetKey,
        missionOpen,
        missionStage: missionStageSync,
        focusedPlanet: f,
        nearPlanet: near,
        selectedObject,
        findings: missionFindingsSync,
        records: missionRecordsSync,
        cockpitActive: fr && pv == 1,
      });
      if (result.role) setAiRole(result.role);
      if (result.avatarState) setAiAvatarState(result.avatarState);
      if (result.pointDirection) setAiPointDirection(result.pointDirection);
      if (result.epistemicCategory) setAiEpistemicCategory(result.epistemicCategory);
      let actionLabel = '';
      const act = result.action;
      if (act) {
        if (act.type === 'PLAY_CINEMATIC_INTRO') {
          actionLabel = 'Intro 3D en tiempo real iniciada';
          setWelcomeOpen(false);
          setRealTimeIntroActive(true);
          A().startRealTimeIntro?.(() => {
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
          setMissionOpen(true);
        } else if (act.type === 'OPEN_MISSION_STAGE') {
          actionLabel = `Etapa activa: ${act.stage}`;
          setMissionTargetKey(act.targetKey);
          setMissionInitialStage(act.stage);
          A().moveAiToStation?.('science', 'Explicación');
          setMissionOpen(true);
        } else if (act.type === 'SELECT_OBJECT') {
          actionLabel = `Señalando en cosmos 3D: ${act.key}`;
          setSelectedObject({ kind: act.kind, key: act.key });
          A().pointAiAtExternalObject?.(act.kind, act.key);
        }
      }
      setAiHistory((prev) => [...prev.slice(-4), { query, actionLabel }]);
      kronoxDialogHiddenRef.current = false;
      setKronoxDialogHidden(false);
      say(result.reply);
      setKronoxOpen(true);
      clearTimeout(kronoxCloseTimer.current);
      if (voiceRef.current) speak(result.reply);
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
  return h(
    'div',
    {
      className: `app ${deviceMode === 'mobile' ? 'mobileMode' : ''} ${fr ? 'flightMode' : ''} ${nearbyMapActive ? 'nearbyMapMode' : ''}`,
    },
    h('div', { ref: el, style: { position: 'absolute', inset: 0 } }),
    nearbyMapActive &&
      h(NearbyGalaxyControls, {
        language,
        selectedKey: nearbyGalaxyKey,
        onSelect: (key) => {
          setNearbyGalaxyKey(key);
          A().focusNearbyGalaxy(key);
        },
        onFocus: (key) => A().focusNearbyGalaxy(key),
        onFocusSolarSystem: () => {
          setNearbyGalaxyKey('milky-way');
          A().focusSolarSystemMap();
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
        { className: 'pn panelOpen kronoxSecondarySettingsModal', role: 'dialog', 'aria-label': 'Interfaz de navegación' },
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
                      { value: 'performance' },
                      language === 'es' ? 'Fluidez' : 'Performance',
                    ),
                    h(
                      'option',
                      { value: 'quality' },
                      language === 'es' ? 'Alta calidad' : 'High quality',
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
                    A().quick(key);
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
                    A().focus(name);
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
                    style: { background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)', borderColor: '#60a5fa' },
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
      dialogueHidden: kronoxDialogHidden,
      showCornerOrb: fr && pv === 3 && !welcomeOpen && !realTimeIntroActive,
      speaking,
      audioLevels,
      panelOpen: kronoxOpen,
      onClose: () => {
        kronoxDialogHiddenRef.current = true;
        setKronoxDialogHidden(true);
        setKronoxOpen(false);
      },
      voice,
      language,
      accent: voiceAccent,
      voiceError,
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
            else voiceAudio.current.play().catch(() => {});
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
        if (!kronoxOpen || kronoxDialogHidden) {
          kronoxDialogHiddenRef.current = false;
          setKronoxDialogHidden(false);
          setKronoxOpen(true);
        } else {
          // Hiding from the orb is an explicit mute of the dialogue too:
          // scene events must not reopen it until the user clicks Kronox again.
          kronoxDialogHiddenRef.current = true;
          setKronoxDialogHidden(true);
          setKronoxOpen(false);
        }
      },
      onToggleVoice: () => {
        if (voice) {
          voiceRef.current = false;
          setVoice(false);
          if (window.speechSynthesis) window.speechSynthesis.cancel();
          voiceToken.current++;
          stopAudioAnalysis();
          audioContextRef.current?.suspend().catch(() => {});
          setSpeaking(false);
          speakingRef.current = false;
          if (voiceAudio.current) {
            voiceAudio.current.pause();
            voiceAudio.current = null;
          }
          say('Voz silenciada. Mis mensajes seguirán apareciendo en pantalla.');
        } else {
          voiceRef.current = true;
          setVoice(true);
          say('Voz de Kronox activada.');
          speak('Hola, soy Kronox, tu guía astral. Mi voz está activada.');
        }
      },
    }),
    h(MobileFlightControls, {
      language,
      active: deviceMode === 'mobile' && fr && pv === 3,
      api: A,
      speed: fv,
      onSpeedChange: (value) => {
        A().speed(value);
        setFv(value);
      },
    }),
    h(ToastNotification, { notice, onMore: setMore, language }),
    navigation &&
      h(
        'div',
        { className: 'navigationGuide', role: 'status', 'aria-live': 'polite' },
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
                  align: 'Alineando rumbo',
                  jumpout: 'Entrando en salto',
                  transit: 'En tránsito',
                  jumpin: 'Saliendo del salto',
                  arrival: 'Llegada al destino',
                }[navigation.phase] || 'Siguiendo la ruta'
              : {
                  countdown: 'Preparing jump',
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
    guideObjective &&
      h('div', { className: 'guideObjectiveHud', role: 'status', 'aria-live': 'polite' },
        h('span', { 'aria-hidden': 'true' }, '✦'),
        h('div', null,
          h('small', null, language === 'es' ? 'RECORRIDO GUIADO' : 'GUIDED TOUR'),
          h('b', null, guideObjective),
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
        onClose: () => setMissionSelectorOpen(false),
        onSelect: chooseSpherexTarget,
        onDirectOpen: (target) => {
          setMissionSelectorOpen(false);
          setMissionTargetKey(target?.key || 'wise-0855');
          setMissionOpen(true);
        },
      }),
    missionOpen &&
      h(SpherexMission, {
        language,
        initialTargetKey: missionTargetKey,
        initialStage: missionInitialStage,
        aiHighlightActive: aiHighlightField,
        onClose: () => setMissionOpen(false),
        onStateSync: ({ targetKey, stage, records, findings }) => {
          if (targetKey && targetKey !== missionTargetKey) setMissionTargetKey(targetKey);
          if (stage) setMissionStageSync(stage);
          if (records) setMissionRecordsSync(records);
          if (findings) setMissionFindingsSync(findings);
          const nextGuideSync = { stage: stage || 'arrival', findingCount: Array.isArray(findings) ? findings.length : 0 };
          const previousGuideSync = missionGuideSyncRef.current;
          missionGuideSyncRef.current = nextGuideSync;
          if (previousGuideSync && (previousGuideSync.stage !== nextGuideSync.stage || previousGuideSync.findingCount < nextGuideSync.findingCount)) {
            A().onGuidedScienceAction?.();
          }
          try {
            const prog = {
              targetKey: targetKey || missionTargetKey,
              stage: stage || missionStageSync,
              findingsCount: Array.isArray(findings) ? findings.length : missionFindingsSync.length,
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
    realTimeIntroActive &&
      h(
        'div',
        {
          className: 'kronoxRealTimeIntroHud',
          role: 'status',
          'aria-live': 'polite',
        },
        h(
          'div',
          { className: 'kronoxRealTimeIntroBadge' },
          h('span', { className: 'kronoxShipDot' }),
          h('strong', null, 'MOTOR 3D EN TIEMPO REAL · ABORDAJE KRONOX (120 m)'),
        ),
        h('p', { className: 'kronoxRealTimeIntroCaption' }, realTimeIntroCaption),
        h(
          'button',
          {
            type: 'button',
            className: 'kronoxRealTimeSkipBtn',
            onClick: () => {
              setRealTimeIntroActive(false);
              A().skipRealTimeIntro?.();
              setFr(true);
              setPv(1);
            },
          },
          language === 'es' ? 'Saltar introducción 3D ⏭' : 'Skip 3D Intro ⏭',
        ),
      ),
    !welcomeOpen &&
      !missionOpen &&
      !realTimeIntroActive &&
      h(SpaceshipCockpit, {
        language,
        cockpitVisible: fr && pv == 1,
        cabinFirstPerson,
        onToggleCabinPerspective: (firstP) => {
          setCabinFirstPerson(firstP);
          A().setCabinFirstPerson?.(firstP);
        },
        nearestStation: nearestCabinStation,
        activeStation: activeCockpitStation,
        onSelectStation: (stId) => {
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
            A().free(false);
          }
        },
        flightSpeed: fv,
        onSpeedPreset: (v) => {
          A().speed(v);
          setFv(v);
        },
        selectedObject,
        onCloseObjectInspector: () => setSelectedObject(null),
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
        onOpenPlanetInfo: (planetName) => {
          setMore(planetName);
        },
        onOpenMissionSelector: () => {
          A().moveAiToStation?.('missions', 'Explicación');
          setMissionSelectorOpen(true);
        },
        onOpenAiConsole: () => {
          A().moveAiToStation?.('comms', 'Comunicación');
          kronoxDialogHiddenRef.current = false;
          setKronoxDialogHidden(false);
          setKronoxOpen(true);
        },
        onStartGuidedTour: () => {
          A().startGuidedTour?.();
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
      }),
    fr && h('canvas', { id: 'warp', className: 'warp' }),
    fr &&
      pv == 3 &&
      !realTimeIntroActive &&
      h(
        'div',
        { className: 'hud' },
        h('b', null, fv.toFixed(fv < 1 ? 2 : 0) + ' u/s'),
        (fv >= 300 ? ' · ≈ ' + Math.round(fv * 1.156) + ' años luz/s' : '') +
          ' · Exterior Nave 120m' +
          (fo.au ? ' · piloto auto.' : ''),
      ),
    welcomeOpen &&
      h(
        'div',
        { className: 'welcomeShade cinematicWelcomeShade' },
        h(
          'section',
          {
            className: 'welcomeCard cinematicWelcomeStage',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'welcome-title',
          },
          /* Top Discreet Utility Bar (Voice quick toggle + Settings drawer button) */
          h(
            'div',
            { className: 'welcomeCinematicTopRow' },
            h(
              'span',
              { className: 'welcomeEyebrow' },
              'VIDEOJUEGO DE EXPLORACIÓN ESPACIAL 3D · NASA SPHEREx / GAIA DR3',
            ),
            h(
              'div',
              { className: 'welcomeDiscreetControls' },
              h(
                'button',
                {
                  type: 'button',
                  className: `welcomeVoicePill ${voice ? 'active' : ''}`,
                  onClick: () => {
                    const next = !voice;
                    voiceRef.current = next;
                    setVoice(next);
                    if (next) {
                      const msg =
                        language === 'es'
                          ? 'Sistemas de voz de Kronox IA en línea.'
                          : 'Kronox AI voice systems online.';
                      say(msg);
                      speak(msg);
                    } else if (voiceAudio.current) {
                      voiceAudio.current.pause();
                      voiceAudio.current = null;
                    }
                  },
                },
                voice
                  ? language === 'es'
                    ? '🔊 Voz IA: Activa'
                    : '🔊 AI Voice: On'
                  : language === 'es'
                    ? '🔇 Activar voz IA'
                    : '🔇 Enable AI Voice',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: `welcomeSettingsToggleBtn ${welcomeSettingsOpen ? 'active' : ''}`,
                  onClick: () => setWelcomeSettingsOpen((prev) => !prev),
                },
                '⚙ ',
                language === 'es' ? 'Ajustes' : 'Settings',
              ),
            ),
          ),

          h(
            'p',
            { className: 'welcomeVoiceHint', role: 'status' },
            voice
              ? language === 'es'
                ? 'La voz de Kronox está activa: escucharás la introducción y las indicaciones de la misión.'
                : 'Kronox voice is on: you will hear the introduction and mission guidance.'
              : language === 'es'
                ? 'Activa la voz de Kronox para escuchar la introducción y las indicaciones de la misión.'
                : 'Turn on Kronox voice to hear the introduction and mission guidance.',
          ),

          /* Integrated Hero Title over the Real-Time 3D Cosmos & 120m Ship */
          h(
            'div',
            { className: 'welcomeHeroCenter' },
            h('h1', { id: 'welcome-title', className: 'welcomeCinematicLogo' }, 'KRONOX'),
            h(
              'p',
              { className: 'welcomeMessage' },
              language === 'es'
                ? 'Aborda la nave científica de 120 metros en un mundo 3D continuo, camina por su cabina habitable (1 unidad = 1 metro) junto a la entidad luminosa Kronox IA e investiga datos infrarrojos reales de SPHEREx.'
                : 'Board the 120-meter scientific vessel in a continuous 3D world, walk through its habitable cabin (1 unit = 1 meter) alongside the luminous Kronox AI entity, and investigate real SPHEREx infrared data.',
            ),
            h(
              'p',
              { className: 'welcomeSequenceSummary' },
              language === 'es'
                ? 'Introducción: despegue desde la Tierra → recorrido espacial → llegada a la cabina en primera persona.'
                : 'Intro: launch from Earth → spaceflight overview → arrival inside the cabin in first person.',
            ),
          ),

          h(
            'section',
            {
              className: 'welcomeDevicePrompt',
              'aria-label': language === 'es' ? 'Selecciona tu dispositivo' : 'Choose your device',
            },
            h(
              'span',
              null,
              language === 'es' ? '¿Desde qué dispositivo jugarás?' : 'Which device are you playing on?',
            ),
            h(
              'div',
              { className: 'welcomeDeviceChoices' },
              h(
                'button',
                {
                  type: 'button',
                  className: deviceMode === 'desktop' ? 'selected' : '',
                  'aria-pressed': deviceMode === 'desktop',
                  onClick: () => setDeviceMode('desktop'),
                },
                '🖥️ ',
                'PC / Laptop',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: deviceMode === 'mobile' ? 'selected' : '',
                  'aria-pressed': deviceMode === 'mobile',
                  onClick: () => setDeviceMode('mobile'),
                },
                '📱 ',
                language === 'es' ? 'Móvil / Táctil' : 'Mobile / Touch',
              ),
            ),
          ),

          /* Primary Narrative Actions (Section 1, 2 & 7) */
          h(
            'div',
            { className: 'welcomeActionButtons cinematicActions' },
            h(
              'button',
              {
                type: 'button',
                className: 'welcomeLaunch primary',
                onClick: () => {
                  try {
                    sessionStorage.setItem('kronox-intro-seen', '1');
                  } catch {
                    /* ignore */
                  }
                  setWelcomeOpen(false);
                  setRealTimeIntroActive(true);
                  A().startRealTimeIntro?.(() => {
                    setRealTimeIntroActive(false);
                    setFr(true);
                    setPv(1);
                    setAiAvatarState('Acompañamiento');
                  });
                },
              },
              language === 'es' ? 'INICIAR EXPEDICIÓN' : 'START EXPEDITION',
            ),

            /* CONTINUAR EXPEDICIÓN: Only rendered when real saved progress exists! */
            (savedExpedition?.targetKey || missionFindingsSync.length > 0) &&
              h(
                'button',
                {
                  type: 'button',
                  className: 'welcomeLaunch continueBtn',
                  onClick: () => {
                    try {
                      sessionStorage.setItem('kronox-intro-seen', '1');
                    } catch {
                      /* ignore */
                    }
                    setWelcomeOpen(false);
                    const resumeKey =
                      savedExpedition?.targetKey ||
                      missionFindingsSync[0]?.targetKey ||
                      'barnard';
                    const resumeStage = savedExpedition?.stage || 'explore';
                    setMissionTargetKey(resumeKey);
                    setMissionInitialStage(resumeStage);
                    A().skipRealTimeIntro?.();
                    setFr(true);
                    setPv(1);
                    setMissionOpen(true);
                    setAiAvatarState('Acompañamiento');
                    const resumeTarget =
                      SPHEREX_TARGETS.find((t) => t.key === resumeKey) || SPHEREX_TARGETS[0];
                    notify(
                      `Expedición retomada en ${resumeTarget.name} (${missionFindingsSync.length} hallazgo(s) en cuaderno).`,
                      'Continuar expedición',
                    );
                  },
                },
                language === 'es'
                  ? `CONTINUAR EXPEDICIÓN (${
                      (
                        SPHEREX_TARGETS.find(
                          (t) =>
                            t.key ===
                            (savedExpedition?.targetKey || missionFindingsSync[0]?.targetKey),
                        ) || SPHEREX_TARGETS[0]
                      ).name
                    })`
                  : 'CONTINUE EXPEDITION',
              ),

            h(
              'button',
              {
                type: 'button',
                className: 'welcomeLaunch secondary skipBtn',
                onClick: () => {
                  try {
                    sessionStorage.setItem('kronox-intro-seen', '1');
                  } catch {
                    /* ignore */
                  }
                  setWelcomeOpen(false);
                  setRealTimeIntroActive(false);
                  if (spec) {
                    A().board();
                    setSpec(false);
                  }
                  setFr(true);
                  setPv(1);
                  A().skipRealTimeIntro?.();
                  setAiAvatarState('Acompañamiento');
                },
              },
              language === 'es' ? 'ENTRAR DIRECTO A LA CABINA 3D' : 'ENTER 3D CABIN DIRECTLY',
            ),
          ),

          /* Secondary Collapsible Settings Panel (Language, Graphics Quality, Reduced Motion, Device Override) */
          welcomeSettingsOpen &&
            h(
              'div',
              { className: 'welcomeSecondarySettings', role: 'region', 'aria-label': 'Configuración secundaria' },
              h(
                'label',
                { className: 'welcomeLanguage' },
                h('span', null, language === 'es' ? 'Idioma' : 'Language'),
                h(
                  'select',
                  {
                    value: language,
                    onChange: (event) => chooseLanguage(event.target.value),
                    'aria-label': language === 'es' ? 'Elegir idioma' : 'Choose language',
                  },
                  LANGUAGES.map((option) =>
                    h('option', { key: option.code, value: option.code }, option.native),
                  ),
                ),
              ),
              h(
                'label',
                { className: 'welcomeLanguage' },
                h('span', null, language === 'es' ? 'Calidad gráfica' : 'Graphics quality'),
                h(
                  'select',
                  {
                    value: quality,
                    onChange: (event) => setQuality(event.target.value),
                  },
                  h('option', { value: 'auto' }, 'Auto'),
                  h('option', { value: 'high' }, 'Alta'),
                  h('option', { value: 'low' }, 'Rendimiento'),
                ),
              ),
              h(
                'label',
                { className: 'welcomeLanguage' },
                h('span', null, language === 'es' ? 'Interfaz (Auto-detectada)' : 'Interface mode'),
                h(
                  'select',
                  {
                    value: deviceMode,
                    onChange: (event) => setDeviceMode(event.target.value),
                  },
                  h('option', { value: 'desktop' }, 'PC / Laptop'),
                  h('option', { value: 'mobile' }, 'Móvil / Táctil'),
                ),
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: `welcomeVoiceBtn ${reducedMotion ? 'active' : ''}`,
                  onClick: () => setReducedMotion((prev) => !prev),
                },
                reducedMotion ? 'Movimiento reducido: Sí' : 'Movimiento reducido: No',
              ),
            ),
        ),
      ),
  );
}
