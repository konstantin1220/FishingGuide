// Wetterdaten über Open-Meteo (kostenlos, kein API-Key nötig).
const Weather = (() => {
  const WMO_LABELS = {
    0: 'Klar', 1: 'Meist klar', 2: 'Teilweise bewölkt', 3: 'Bewölkt',
    45: 'Nebel', 48: 'Nebel (Reif)',
    51: 'Leichter Sprühregen', 53: 'Sprühregen', 55: 'Starker Sprühregen',
    61: 'Leichter Regen', 63: 'Regen', 65: 'Starker Regen',
    71: 'Leichter Schnee', 73: 'Schnee', 75: 'Starker Schnee',
    80: 'Regenschauer', 81: 'Regenschauer', 82: 'Heftige Regenschauer',
    95: 'Gewitter', 96: 'Gewitter mit Hagel', 99: 'Gewitter mit Hagel',
  };

  function weatherLabel(code) {
    return WMO_LABELS[code] || 'Unbekannt';
  }

  async function fetchCurrent(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,pressure_msl,wind_speed_10m,weather_code,cloud_cover` +
      `&hourly=pressure_msl&past_hours=6` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max` +
      `&forecast_days=7&timezone=auto`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Wetterdaten konnten nicht geladen werden');
    const data = await res.json();

    const current = data.current;
    const pressureTrend = computePressureTrend(data.hourly, current.time, current.pressure_msl);

    return {
      temperature: current.temperature_2m,
      pressure: current.pressure_msl,
      pressureTrend, // { diff, direction: 'fallend' | 'steigend' | 'stabil' }
      windSpeed: current.wind_speed_10m,
      cloudCover: current.cloud_cover,
      weatherCode: current.weather_code,
      weatherLabel: weatherLabel(current.weather_code),
      forecast: buildForecast(data.daily),
    };
  }

  function buildForecast(daily) {
    if (!daily || !daily.time) return [];
    return daily.time.map((date, i) => ({
      date,
      tempMax: daily.temperature_2m_max[i],
      tempMin: daily.temperature_2m_min[i],
      weatherCode: daily.weather_code[i],
      weatherLabel: weatherLabel(daily.weather_code[i]),
      precipProb: daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : null,
      windSpeedMax: daily.wind_speed_10m_max ? daily.wind_speed_10m_max[i] : null,
    }));
  }

  function computePressureTrend(hourly, currentTime, currentPressure) {
    if (!hourly || !hourly.time || !hourly.pressure_msl) {
      return { diff: 0, direction: 'stabil' };
    }
    const idxNow = hourly.time.indexOf(currentTime);
    const idxPast = idxNow - 3; // Vergleich mit vor 3 Stunden
    if (idxNow === -1 || idxPast < 0) {
      return { diff: 0, direction: 'stabil' };
    }
    const pastPressure = hourly.pressure_msl[idxPast];
    const diff = Math.round((currentPressure - pastPressure) * 10) / 10;

    let direction = 'stabil';
    if (diff <= -1) direction = 'fallend';
    else if (diff >= 1) direction = 'steigend';

    return { diff, direction };
  }

  return { fetchCurrent, weatherLabel };
})();
