# FishingGuide

Angel-Helfer-App als Progressive Web App (PWA) – läuft im Browser, kann aufs
Smartphone-Homescreen installiert werden, kein App-Store nötig.

## Funktionen (MVP)

- **Gewässer** verwalten (Name, Koordinaten)
- **Fanglog**: Fänge erfassen (Art, Länge/Gewicht, Köder, Gewässer, Datum)
- **Köder-Bestand**: eigene Köder mit Kategorie und Menge
- **Wetter-Tipps**: aktuelles Wetter je Gewässer (via [Open-Meteo](https://open-meteo.com/))
  inkl. Luftdrucktrend, daraus abgeleitete Tipps zu Köderführung, Köderwahl,
  Angelart und Angelstelle

Alle Daten werden lokal auf dem Gerät gespeichert (`localStorage`) – kein
Account, kein Server nötig.

## Lokal starten

Einfach `index.html` in einem lokalen Server öffnen (wegen Service Worker
und Fetch-Aufrufen reicht ein Doppelklick auf die Datei nicht immer aus,
z.B. in Safari). Am einfachsten mit einem simplen lokalen Server:

```bash
python3 -m http.server 8000
```

Danach im Browser `http://localhost:8000` öffnen.

## Geplante Ausbaustufen

- Gruppen & Leaderboard mit Challenges (braucht Cloud-Backend)
- Crowdsourced Tiefenkarten pro Gewässer mit Querschnitts-Ansicht an
  einzelnen Spots
