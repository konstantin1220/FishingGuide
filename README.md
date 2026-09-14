# FishingGuide

Angel-Helfer-App als Progressive Web App (PWA) – läuft im Browser, kann aufs
Smartphone-Homescreen installiert werden, kein App-Store nötig.

**Live:** https://konstantin1220.github.io/FishingGuide/

## Funktionen

- **Eigene Konten**: Name + selbstgewähltes Passwort pro Nutzer (Registrierung
  nur mit Einladungscode möglich), jedes Konto sieht nur seine eigenen Daten
- **Gewässer** verwalten: Name (per Reverse-Geocoding vorgeschlagen), interaktive
  Karte (Klick zum Setzen des Standorts, Mausrad-Zoom nach Klick), Standort-Button
- **Fanglog**: Fänge erfassen (Art mit Autofill, Länge/Gewicht, Köder, Gewässer,
  Datum), zuletzt verwendetes Gewässer/Köder wird vorausgewählt
- **Köder-Bestand**: eigene Köder, Basis-Vorlagen gängiger Köder, Führungstechnik
  je Köder mit animierter Visualisierung ("Wie führe ich das?")
- **Wetter-Tipps**: aktuelles Wetter je Gewässer (via [Open-Meteo](https://open-meteo.com/))
  inkl. Luftdrucktrend, ausklappbarer 7-Tage-Prognose, daraus abgeleitete Tipps zu
  Köderführung, Köderwahl, Angelart und Angelstelle
- **Angeltrips**: Trip mit mehreren Orten (Stops) und je eigener Zeitspanne planen,
  inkl. Wetterprognose + Köder-Tipps pro Stop
- **Einstellungen**: Datenexport/-import als JSON-Backup, Impressum & Datenschutz

Alle Daten werden lokal auf dem Gerät gespeichert (`localStorage`), getrennt
pro Konto – kein eigener Server nötig. Das bedeutet auch: Daten sind nicht
geräteübergreifend synchronisiert, wer sich auf einem anderen Gerät anmeldet,
sieht dort einen leeren, eigenen Datenbereich.

## Lokal starten

Einfach `index.html` in einem lokalen Server öffnen (wegen Service Worker
und Fetch-Aufrufen reicht ein Doppelklick auf die Datei nicht immer aus,
z.B. in Safari). Am einfachsten mit einem simplen lokalen Server:

```bash
python3 -m http.server 8000
```

Danach im Browser `http://localhost:8000` öffnen.

## Deployment

Läuft über **GitHub Pages** direkt aus diesem (öffentlichen) Repository –
jeder Push auf `main` wird automatisch neu veröffentlicht, kein separater
Deploy-Befehl nötig. Der Quellcode ist dadurch öffentlich einsehbar; die
eigentlichen Nutzdaten bleiben trotzdem privat, da sie ausschließlich lokal
im Browser jedes Nutzers liegen und Passwörter/Einladungscode nur gehasht
im Code bzw. lokal gespeichert werden.

## Geplante Ausbaustufen

- Gruppen & Leaderboard mit Challenges, gemeinsame Spot-Karte mit Kommentaren
  (braucht ein echtes Cloud-Backend wie Firebase/Supabase)
- Crowdsourced Tiefenkarten pro Gewässer mit Querschnitts-Ansicht an
  einzelnen Spots
