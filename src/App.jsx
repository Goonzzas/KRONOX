import React, { useEffect, useRef, useState } from 'react';
import { P, INFO } from './data/planetData.js';
import { setupScene, CK, YK, SC } from './scene/createScene.js';
import KronoxWidget from './components/KronoxWidget.jsx';
import ToastNotification from './components/ToastNotification.jsx';
import PlanetInfoModal from './components/PlanetInfoModal.jsx';
import QuickTravelMenu from './components/QuickTravelMenu.jsx';
import './styles.css';

const h = React.createElement;

export default function App() {
  const el = useRef(),
    api = useRef(),
    dayRef = useRef(),
    distRef = useRef(),
    spR = useRef(10),
    paR = useRef(false),
    [real, setReal] = useState(false),
    [sp, setSp] = useState(1),
    [pause, setPause] = useState(false),
    [f, setF] = useState(null),
    [near, setNear] = useState(null),
    [more, setMore] = useState(null),
    [guide, setGuide] = useState('A tu lado, explorador. Soy Kronox, tu guía astral.'),
    [speaking, setSpeaking] = useState(false),
    [kronoxOpen, setKronoxOpen] = useState(false),
    [voice, setVoice] = useState(false),
    [voiceError, setVoiceError] = useState(''),
    [voiceAccent, setVoiceAccent] = useState('es-US'),
    [notice, setNotice] = useState(null),
    [countdown, setCountdown] = useState(null),
    [fl, setFl] = useState({ orb: 1, lab: 1, ax: 0, vel: 0, gal: 0 }),
    [open, setOpen] = useState(true),
    [quickOpen, setQuickOpen] = useState(false),
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
    voiceRef = useRef(false),
    voiceAudio = useRef(null),
    voiceToken = useRef(0),
    voiceAccentRef = useRef(voiceAccent),
    noticeQueue = useRef([]),
    noticeRef = useRef(null),
    noticeTimer = useRef(null);
  const speakingRef = useRef(false),
    kronoxCloseTimer = useRef(null),
    travelRef = useRef(false),
    factIndexRef = useRef(0);
  spR.current = Math.pow(10, sp);
  paR.current = pause;
  flR.current = fl;
  voiceRef.current = voice;
  voiceAccentRef.current = voiceAccent;
  speakingRef.current = speaking;
  const openKronox = () => {
    clearTimeout(kronoxCloseTimer.current);
    setKronoxOpen(true);
  };
  const closeKronoxLater = () => {
    clearTimeout(kronoxCloseTimer.current);
    kronoxCloseTimer.current = setTimeout(() => {
      if (!speakingRef.current) setKronoxOpen(false);
    }, 3000);
  };
  const speak = (msg) => {
      if (!voiceRef.current) return;
      openKronox();
      const token = ++voiceToken.current;
      if (voiceAudio.current) {
        voiceAudio.current.pause();
        voiceAudio.current.removeAttribute('src');
        voiceAudio.current = null;
      }
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
        setSpeaking(false);
        speakingRef.current = false;
        voiceAudio.current = null;
        closeKronoxLater();
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
        const audio = new Audio(audioUrl);
        audio.preload = 'auto';
        audio.playbackRate = 1.28;
        audio.preservesPitch = true;
        voiceAudio.current = audio;
        audio.onended = playNext;
        audio.onerror = () => {
          if (token === voiceToken.current) {
            setVoiceError('No se pudo cargar la voz en español. Revisa tu conexión a internet.');
            finishSpeech();
          }
        };
        audio
          .play()
          .then(() => {
            if (token === voiceToken.current) {
              setVoiceError('');
              setSpeaking(true);
              speakingRef.current = true;
            }
          })
          .catch((e) => {
            if (token !== voiceToken.current) return;
            setVoiceError(
              e && e.name === 'NotAllowedError'
                ? 'El navegador bloqueó el audio. Pulsa «Activar voz» otra vez.'
                : 'No se pudo reproducir la voz en español. Revisa tu conexión a internet.',
            );
            finishSpeech();
          });
      };
      playNext();
    },
    say = (msg) => {
      setGuide(msg);
      openKronox();
      if (!voiceRef.current) {
        clearTimeout(kronoxCloseTimer.current);
        kronoxCloseTimer.current = setTimeout(() => setKronoxOpen(false), Math.max(3000, msg.length * 22 + 3000));
      }
    },
    showNextNotice = () => {
      const item = noticeQueue.current.shift();
      if (!item) {
        noticeRef.current = null;
        return;
      }
      noticeRef.current = item;
      setNotice(item);
      say(item.text);
      speak(item.text);
      const duration = Math.min(14000, Math.max(6500, item.text.split(/\s+/).length * 380));
      noticeTimer.current = setTimeout(() => {
        setNotice(null);
        noticeRef.current = null;
        showNextNotice();
      }, duration);
    },
    notify = (text, title = 'Aviso', planet = null) => {
      noticeQueue.current.push({ id: Date.now() + Math.random(), text, title, planet });
      if (!noticeRef.current) showNextNotice();
    };
  useEffect(() => {
    api.current = setupScene(el.current, {
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
      if (speakingRef.current || travelRef.current || countdown !== null || noticeRef.current) return;
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
      notify(label + ' de ' + target + ': ' + data[key], 'Dato astronómico', target);
    }, 38000);
    return () => clearInterval(timer);
  }, [near, f, countdown]);
  useEffect(
    () => () => {
      clearTimeout(noticeTimer.current);
      voiceToken.current++;
      clearTimeout(kronoxCloseTimer.current);
      if (voiceAudio.current) voiceAudio.current.pause();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    },
    [],
  );
  const A = () => api.current,
    nm = {
      orb: 'Órbitas',
      lab: 'Etiquetas',
      ax: 'Ejes',
      vel: 'Velocidad',
      gal: 'Movimiento galáctico',
    },
    startTravel = (run, label) => {
      travelRef.current = true;
      countTimers.current.forEach(clearTimeout);
      clearTimeout(noticeTimer.current);
      noticeQueue.current = [];
      noticeRef.current = null;
      setNotice(null);
      setCountdown(3);
      setGuide('Preparando viaje rápido hacia ' + label + '. Cuenta atrás: 3, 2, 1.');
      speak('Tres.');
      let n = 3;
      const tick = () => {
        if (n === 1) {
          setCountdown(null);
          notify('¡Salto iniciado! Rumbo a ' + label + '.', 'Viaje rápido');
          run();
          setTimeout(() => { travelRef.current = false; }, 1200);
          return;
        }
        n--;
        setCountdown(n);
        speak(n === 2 ? 'Dos.' : 'Uno.');
        countTimers.current.push(setTimeout(tick, 850));
      };
      countTimers.current = [setTimeout(tick, 850)];
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
              notify(k === 'ax' ? 'Ejes de rotación activados.' : k === 'vel' ? 'Vectores de velocidad activados.' : 'Modo galáctico activado.', 'Control activado');
          },
        },
        nm[k],
      ),
    pi = f && P.find((x) => x.n == f);
  return h(
    'div',
    { className: 'app' },
    h('div', { ref: el, style: { position: 'absolute', inset: 0 } }),
    h(
      'div',
      { className: 'pn' },
      h('h1', null, 'Sistema Solar 3D'),
      h('button', { onClick: () => setOpen(!open) }, open ? 'Ocultar panel' : 'Mostrar panel'),
      open &&
        h(
          'div',
          null,
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
                  setSp(1);
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
                    A().free(true);
                    notify('Ingresando en la nave planetaria.', 'Nave planetaria');
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
          fr &&
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
          fr && h('small', null, 'Velocidad de vuelo: ' + fv.toFixed(fv < 1 ? 2 : 0) + ' u/s'),
          fr &&
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
          fr &&
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
          h('button', { onClick: () => setSrc(!src) }, 'Fuentes y metodología'),
          src &&
            h(
              'small',
              { style: { marginTop: 6 } },
              'Datos físicos: NASA Solar System Exploration. Posiciones: elementos keplerianos aproximados de JPL (Standish, válidos 1800–2050) resueltos con la ecuación de Kepler; son aproximaciones, no efemérides de JPL Horizons. La Luna usa una órbita circular simplificada y rotación sincronizada. Todos los ejes apuntan al mismo lado del espacio (simplificación). A alta velocidad la rotación se limita visualmente. Orientación: el plano galáctico está inclinado ~60° respecto a la eclíptica y el centro galáctico queda hacia Sagitario (λ≈266°, β≈−5,6°); el Sol orbita en sentido horario visto desde el polo norte galáctico. Vía Láctea: modelo esquemático, no una fotografía; Sol a unos 26.000 años luz del centro, en el Espolón de Orión; las texturas son procedurales.',
            ),
        ),
    ),
    pi &&
      h(
        'div',
        { className: 'in' },
        h('b', null, pi.n),
        'Diámetro: ' + (2 * pi.km).toLocaleString('es') + ' km',
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
      guide,
      speaking,
      panelOpen: kronoxOpen,
      onClose: () => setKronoxOpen(false),
      voice,
      accent: voiceAccent,
      voiceError,
      near,
      onAccentChange: setVoiceAccent,
      onMore: setMore,
      onOrbClick: () => {
        say('Aquí estoy, explorador. Te avisaré de cada cambio y de los mundos que encontremos.');
        speak('Aquí estoy, explorador.');
      },
      onToggleVoice: () => {
        if (voice) {
          voiceRef.current = false;
          setVoice(false);
          if (window.speechSynthesis) window.speechSynthesis.cancel();
          voiceToken.current++;
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
    h(ToastNotification, { notice, onMore: setMore }),
    countdown !== null &&
      h('div', { className: 'countdownOverlay' }, h('b', { key: countdown }, countdown)),
    h(PlanetInfoModal, { planet: more, data: more && INFO[more], onClose: () => setMore(null) }),
    fr && h('canvas', { id: 'warp', className: 'warp' }),
    fr &&
      pv == 1 &&
      h(
        'div',
        { className: 'ck' },
        h('div', { dangerouslySetInnerHTML: { __html: CK } }),
        h('div', { className: 'scr', dangerouslySetInnerHTML: { __html: SC } }),
        h('div', { id: 'tb', className: 'tb' }),
        h('div', { id: 'yk', className: 'yk', dangerouslySetInnerHTML: { __html: YK } }),
      ),
    fr &&
      h(
        'div',
        { className: 'hud' },
        h('b', null, fv.toFixed(fv < 1 ? 2 : 0) + ' u/s'),
        (fv >= 300 ? ' · ≈ ' + Math.round(fv * 1.156) + ' años luz/s' : '') +
          ' · ' +
          (pv == 3 ? '3ª' : '1ª') +
          ' persona' +
          (fo.au ? ' · piloto auto.' : ''),
      ),
    intro &&
      h(
        'div',
        { className: 'cp' },
        h('div', { className: 'cpf' }),
        h('div', { className: 'dl' }),
        h('div', { className: 'dr' }),
        h(
          'div',
          { className: 'ht' },
          h('div', null, '▸ ABORDANDO NAVE…'),
          h('div', null, '▸ SISTEMAS EN LÍNEA'),
          h('div', null, '▸ MOTORES ENCENDIDOS'),
        ),
      ),
    h(QuickTravelMenu, {
      open: quickOpen,
      onToggle: setQuickOpen,
      selectedPlanet: f,
      planets: P,
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
  );
}
