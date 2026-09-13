// Führungstechniken: Beschreibung + animierte SVG-Visualisierung der Köderbewegung.
const Fuehrung = (() => {
  const TECHNIKEN = {
    gleichmaessig: {
      label: 'Gleichmäßige Führung',
      beschreibung: 'Konstant und gleichmäßig einkurbeln, ohne Pausen. Das Spiel entsteht allein durch die Eigenaktion des Köders.',
    },
    twitchen: {
      label: 'Twitchen',
      beschreibung: 'Mit kurzen, scharfen Rutenspitzen-Schlägen den Köder ruckartig bewegen, dazwischen kurze Pausen einlegen.',
    },
    jiggen: {
      label: 'Jiggen',
      beschreibung: 'Rute zügig anheben, damit der Köder aufsteigt, dann kontrolliert und langsam absinken lassen. Bisse kommen oft beim Absinken.',
    },
    stopandgo: {
      label: 'Stop & Go',
      beschreibung: 'Einkurbeln, bewusst stoppen und den Köder auslaufen bzw. absinken lassen, danach wieder beschleunigen.',
    },
    schleppen: {
      label: 'Schleppen',
      beschreibung: 'Köder mit konstanter, langsamer Fahrt (Boot oder am Ufer entlang) in gleichbleibender Tiefe ziehen.',
    },
    topwater: {
      label: 'Oberflächenführung',
      beschreibung: 'An der Oberfläche führen, mit Pausen "poppen" oder "walken" lassen, um Fische von oben anzulocken.',
    },
    grund: {
      label: 'Grundmontage',
      beschreibung: 'Köder liegt/ruht am Gewässergrund und wird kaum bewegt. Geduld: warten, bis der Fisch ihn findet.',
    },
  };

  let counter = 0;

  function lureMarker(uid) {
    return `
      <g filter="url(#${uid}-shadow)">
        <path d="M2,0 C2,-3.2 -6,-4.2 -10,0 C-6,4.2 2,3.2 2,0 Z" fill="url(#${uid}-lure)"/>
        <path d="M-9,0 L-14.5,-3.6 L-12.3,0 L-14.5,3.6 Z" fill="#c96324"/>
        <circle cx="0.3" cy="-0.9" r="0.9" fill="#fff" opacity="0.75"/>
      </g>
    `;
  }

  function defs(uid) {
    return `
      <defs>
        <linearGradient id="${uid}-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#cdeaef"/>
          <stop offset="100%" stop-color="#0c3e4a"/>
        </linearGradient>
        <linearGradient id="${uid}-lure" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffab6b"/>
          <stop offset="100%" stop-color="#e8712c"/>
        </linearGradient>
        <filter id="${uid}-shadow" x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.1" flood-color="#00151a" flood-opacity="0.4"/>
        </filter>
      </defs>
    `;
  }

  function frame(uid, inner, extra = '') {
    return `
      <rect x="0" y="0" width="300" height="110" fill="url(#${uid}-grad)" rx="12"/>
      <line x1="0" y1="8" x2="300" y2="8" stroke="#ffffff" stroke-opacity="0.55" stroke-dasharray="4 4"/>
      <line x1="0" y1="40" x2="300" y2="40" stroke="#ffffff" stroke-opacity="0.12"/>
      <line x1="0" y1="72" x2="300" y2="72" stroke="#ffffff" stroke-opacity="0.12"/>
      ${extra}
      ${inner}
    `;
  }

  function ripple(cx, cy, peak, dur) {
    const a = Math.max(0, peak - 0.05);
    const b = Math.min(1, peak + 0.14);
    return `
      <circle cx="${cx}" cy="${cy}" r="2" fill="none" stroke="#e7f6f8" stroke-width="1.3" opacity="0">
        <animate attributeName="r" values="2;2;15;2" keyTimes="0;${a};${b};1" dur="${dur}" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0;0;0.6;0" keyTimes="0;${a};${a + 0.03};${b}" dur="${dur}" repeatCount="indefinite"/>
      </circle>
    `;
  }

  function sedimentParticles(uid) {
    const specs = [{ cx: 138, dur: '3.4s' }, { cx: 152, dur: '4.1s' }, { cx: 165, dur: '3.7s' }];
    return specs.map((s, i) => `
      <circle cx="${s.cx}" cy="90" r="1.4" fill="#cdb9a0" opacity="0">
        <animate attributeName="cy" values="90;80;90" dur="${s.dur}" repeatCount="indefinite" begin="${i * 0.6}s"/>
        <animate attributeName="opacity" values="0;0.6;0" dur="${s.dur}" repeatCount="indefinite" begin="${i * 0.6}s"/>
      </circle>
    `).join('');
  }

  const MOTION = {
    gleichmaessig: () => ({
      path: 'M15,55 C80,50 150,60 215,52 C250,48 270,55 285,55',
      dur: '3.2s',
    }),
    twitchen: () => ({
      path: 'M15,55 C25,45 35,45 45,55 C55,65 60,50 70,52 C120,54 150,50 160,55 C200,60 210,48 220,52 C260,54 270,50 285,55',
      dur: '4.5s',
      keyPoints: '0;0.25;0.25;0.5;0.5;0.75;0.75;1',
      keyTimes: '0;0.15;0.40;0.55;0.75;0.85;0.95;1',
    }),
    jiggen: () => ({
      path: 'M15,85 C20,45 30,20 40,20 C50,20 55,50 60,85 C70,50 80,20 90,20 C100,20 105,50 110,85 C120,50 130,20 140,20 C150,20 155,50 160,85 C190,80 230,78 285,75',
      dur: '5s',
      keyPoints: '0;0.03;0.09;0.12;0.18;0.21;0.27;1',
      keyTimes: '0;0.03;0.20;0.23;0.40;0.43;0.60;1',
    }),
    stopandgo: () => ({
      path: 'M15,55 C60,50 90,60 100,55 C150,50 180,60 190,55 C240,50 270,60 285,55',
      dur: '4.5s',
      keyPoints: '0;0.33;0.33;0.66;0.66;1',
      keyTimes: '0;0.28;0.48;0.58;0.78;1',
    }),
    schleppen: () => ({
      path: 'M15,80 C100,77 200,83 285,80',
      dur: '7s',
    }),
    topwater: () => ({
      path: 'M15,20 C40,20 55,20 65,20 C72,20 72,4 80,4 C88,4 88,20 95,20 C130,20 150,20 160,20 C167,20 167,4 175,4 C183,4 183,20 190,20 C220,20 240,20 260,20 C267,20 267,6 275,6 C280,6 283,14 285,20',
      dur: '4.5s',
      ripples: [{ cx: 76, peak: 0.19 }, { cx: 171, peak: 0.52 }, { cx: 276, peak: 0.86 }],
    }),
    grund: () => ({
      path: 'M150,93 L156,88 L144,88 L150,93',
      dur: '2.5s',
    }),
  };

  function renderAnimation(key) {
    const build = MOTION[key];
    if (!build) return '';
    const cfg = build();
    counter += 1;
    const uid = `fu-${key}-${counter}`;
    const keyAttrs = cfg.keyPoints
      ? `keyPoints="${cfg.keyPoints}" keyTimes="${cfg.keyTimes}" calcMode="linear"`
      : '';
    const groundRect = key === 'grund' ? `<rect x="0" y="93" width="300" height="17" fill="#4a3728" rx="0"/>` : '';
    const particles = key === 'grund' ? sedimentParticles(uid) : '';
    const ripples = (cfg.ripples || []).map(r => ripple(r.cx, 20, r.peak, cfg.dur)).join('');

    const inner = `
      <g>
        ${lureMarker(uid)}
        <animateMotion path="${cfg.path}" dur="${cfg.dur}" repeatCount="indefinite" rotate="auto" ${keyAttrs}/>
      </g>
    `;

    return `
      <svg viewBox="0 0 300 110" class="fuehrung-svg" role="img" aria-label="Animation: ${technikLabel(key)}">
        ${defs(uid)}
        ${frame(uid, inner, groundRect + particles + ripples)}
      </svg>
    `;
  }

  function technikLabel(key) {
    return TECHNIKEN[key] ? TECHNIKEN[key].label : key;
  }

  function renderInfo(key) {
    const t = TECHNIKEN[key];
    if (!t) return '<p class="muted">Keine Führungstechnik hinterlegt.</p>';
    return `
      <div class="fuehrung-info">
        ${renderAnimation(key)}
        <div class="fuehrung-text">
          <strong>${t.label}</strong>
          <p>${t.beschreibung}</p>
        </div>
      </div>
    `;
  }

  return { TECHNIKEN, renderAnimation, renderInfo };
})();
