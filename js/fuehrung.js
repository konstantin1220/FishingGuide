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
      beschreibung: 'Rute anheben, damit der Köder aufsteigt, dann kontrolliert absinken lassen. Bisse kommen oft beim Absinken.',
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

  const PATHS = {
    gleichmaessig: { path: 'M15,55 L285,55', dur: '3s' },
    twitchen: { path: 'M15,55 L60,50 L50,62 L110,55 L155,50 L145,62 L205,55 L250,50 L240,62 L285,55', dur: '4s' },
    jiggen: { path: 'M15,20 L55,90 L95,20 L135,90 L175,20 L215,90 L255,20 L285,55', dur: '4s' },
    stopandgo: {
      path: 'M15,55 L100,55 L190,55 L285,55',
      dur: '4.5s',
      keyPoints: '0;0.33;0.33;0.66;0.66;1',
      keyTimes: '0;0.28;0.48;0.58;0.78;1',
    },
    schleppen: { path: 'M15,80 L285,80', dur: '6s' },
    topwater: { path: 'M15,20 L70,20 L85,6 L100,20 L150,20 L165,6 L180,20 L230,20 L245,6 L260,20 L285,20', dur: '4s' },
    grund: { path: 'M150,93 L156,88 L144,88 L150,93', dur: '2.5s' },
  };

  function renderAnimation(key) {
    const cfg = PATHS[key];
    if (!cfg) return '';
    counter += 1;
    const uid = `fuehrung-${key}-${counter}`;
    const keyAttrs = cfg.keyPoints
      ? `keyPoints="${cfg.keyPoints}" keyTimes="${cfg.keyTimes}" calcMode="linear"`
      : '';
    const groundRect = key === 'grund'
      ? `<rect x="0" y="93" width="300" height="17" fill="#4a3728" rx="0"/>`
      : '';

    return `
      <svg viewBox="0 0 300 110" class="fuehrung-svg" role="img" aria-label="Animation: ${technikLabel(key)}">
        <defs>
          <linearGradient id="${uid}-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#bfe4ea"/>
            <stop offset="100%" stop-color="#0f4c5c"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="300" height="110" fill="url(#${uid}-grad)" rx="10"/>
        <line x1="0" y1="8" x2="300" y2="8" stroke="#ffffff" stroke-opacity="0.5" stroke-dasharray="4 4"/>
        ${groundRect}
        <g>
          <ellipse cx="0" cy="0" rx="7" ry="3.5" fill="#ff8c42"/>
          <polygon points="-7,0 -12,-3.5 -12,3.5" fill="#ff8c42"/>
          <animateMotion path="${cfg.path}" dur="${cfg.dur}" repeatCount="indefinite" rotate="auto" ${keyAttrs}/>
        </g>
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
