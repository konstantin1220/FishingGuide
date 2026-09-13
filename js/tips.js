// Regel-Engine: aus Wetterdaten werden konkrete Angeltipps abgeleitet.
// Bewusst einfach gehalten und erweiterbar - jede Regel prüft eine Bedingung
// und liefert bei Zutreffen einen Tipp mit Kategorie zurück.
const Tips = (() => {
  const RULES = [
    {
      test: w => w.pressureTrend.direction === 'fallend',
      tip: {
        kategorie: 'Angelart',
        text: 'Fallender Luftdruck: Fische sind oft aktiver und beißfreudiger. Jetzt aktiv fischen (Spinnfischen, Schleppen) statt nur auf Grund zu warten.',
      },
    },
    {
      test: w => w.pressureTrend.direction === 'steigend',
      tip: {
        kategorie: 'Köderführung',
        text: 'Steigender Luftdruck: Fische stehen oft tiefer und sind zurückhaltender. Langsame, ruhige Köderführung, eher Naturköder am Grund anbieten.',
      },
    },
    {
      test: w => w.pressureTrend.direction === 'stabil',
      tip: {
        kategorie: 'Köder',
        text: 'Stabiler Luftdruck: normales Fressverhalten zu erwarten. Bewährte Köder für diese Jahreszeit nutzen.',
      },
    },
    {
      test: w => w.temperature <= 8,
      tip: {
        kategorie: 'Köderführung',
        text: 'Kaltes Wasser (≤8°C): Stoffwechsel der Fische ist verlangsamt. Sehr langsame Köderführung, kleine Köder mit wenig Aktion wählen.',
      },
    },
    {
      test: w => w.temperature >= 20,
      tip: {
        kategorie: 'Angelstelle',
        text: 'Warmes Wasser (≥20°C): Fische ziehen sich oft in tiefere, kühlere Zonen zurück oder sind in der Dämmerung/Nacht aktiver.',
      },
    },
    {
      test: w => w.windSpeed >= 20,
      tip: w => ({
        kategorie: 'Angelstelle',
        text: `Starker Wind (${Math.round(w.windSpeed)} km/h): windzugewandte Ufer meiden, aber die dadurch aufgewühlte, sauerstoffreiche Zone kann Raubfische aktivieren.`,
      }),
    },
    {
      test: w => [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(w.weatherCode),
      tip: {
        kategorie: 'Angelart',
        text: 'Regen/Niederschlag: oft gute Beißphasen, besonders bei leichtem Dauerregen. Trübung durch Regen kann Köderwahl in Richtung auffälliger Farben lenken.',
      },
    },
    {
      test: w => w.cloudCover <= 20 && w.weatherCode === 0,
      tip: {
        kategorie: 'Köder',
        text: 'Klarer Himmel/starke Sonne: Fische oft vorsichtiger und tiefer stehend. Natürlichere Köderfarben und feinere Führung erhöhen die Erfolgschance.',
      },
    },
  ];

  function getTips(weather) {
    return RULES.filter(rule => rule.test(weather))
      .map(rule => (typeof rule.tip === 'function' ? rule.tip(weather) : rule.tip));
  }

  return { getTips };
})();
