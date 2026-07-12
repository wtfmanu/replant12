# RePlant

RePlant verwandelt klassische Rezepte möglichst originalgetreu in vegetarische oder vegane Varianten. Das Projekt ist für Netlify vorbereitet und funktioniert ohne externe Frontend-Bibliotheken.

## Funktionen

- Rezeptimport per öffentlichem Link
- direkte Texteingabe
- vegetarischer und veganer Modus
- Slider für Ziel und Originalnähe
- mehrere lokale Profile
- Allergien, Abneigungen, Küchen und Lieblingszutaten
- Portionsskalierung
- getrennte Anzeige von Produktersetzungen und Mengenänderungen
- Verlauf und Favoriten im Browser
- Kopieren und Drucken
- regelbasierter Grundmodus
- optionaler serverseitiger AI-Modus
- responsive Desktop- und Smartphone-Oberfläche

## AI-Konfiguration

Netlify-Umgebungsvariable:

```text
XAI_API_KEY
```

Optional:

```text
XAI_MODEL
```

Der API-Key bleibt in der Netlify Function und wird nicht an den Browser ausgeliefert. Der AI-Schalter befindet sich direkt rechts neben der Hauptaktion **Rezept verwandeln**.

## Lokaler Start

Voraussetzung: Node.js 20 oder neuer.

```bash
npm run verify
npm run dev
```

Die Netlify CLI stellt normalerweise `http://localhost:8888` bereit.

## Netlify-Konfiguration

```text
Build command: npm run verify
Publish directory: public
Functions directory: netlify/functions
```

Die Werte sind bereits in `netlify.toml` gespeichert.

## API-Routen

```text
GET  /api/health
POST /api/import
POST /api/convert
```

## Daten

Profile, Verlauf, Favoriten und Einstellungen werden ausschließlich im lokalen Browser-Speicher abgelegt. Es gibt in dieser Version keine Benutzerkonten und keine geräteübergreifende Synchronisierung.

## Abonnement später

Der sichtbare AI-Schalter ist noch keine Paywall. Für ein echtes Abo müssen Anmeldung, Zahlungsstatus, Nutzungsgrenzen und Berechtigungen vor jedem AI-Aufruf serverseitig geprüft werden. Siehe `ABO-SPAETER.md`.

## Tests

```bash
npm test
npm run check
npm run verify
```

Die Tests decken Rezeptlogik, Mengenänderungen, Parser, URL-Sicherheit, Netlify Functions und den AI-Adapter mit kontrollierten Mock-Antworten ab.
