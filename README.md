# RePlant – Same taste. Better planet.

RePlant verwandelt klassische Rezepte möglichst originalgetreu in vegetarische oder vegane Varianten. Das Projekt ist für Netlify vorbereitet und orientiert sich an der gelieferten Dashboard-Vorlage: feste Navigation, RePlant-Logo, Link-First-Eingabe, zwei Slider, Profilübersicht und kompakte Ergebnisansicht.

## Einstieg

Für die vollständige Anleitung ohne Vorkenntnisse:

**[START-HIER.md](START-HIER.md)**

Weitere Dokumente:

- [GROK-EINRICHTEN.md](GROK-EINRICHTEN.md)
- [DEPLOY-CHECKLISTE.md](DEPLOY-CHECKLISTE.md)
- [ABO-SPAETER.md](ABO-SPAETER.md)
- [TESTREPORT.md](TESTREPORT.md)

## Funktionsumfang

- Rezeptlink als erste Eingabemöglichkeit
- alternative direkte Texteingabe
- vegetarisch/vegan per Slider
- Originalnähe von „Sehr nah“ bis „Kreativ“
- Portionen-Skalierung
- mehrere lokale Profile
- Allergien, Unverträglichkeiten, Abneigungen, Küchen und Lieblingszutaten
- Verlauf und Favoriten
- Kopieren und Drucken
- helle und dunkle Darstellung
- reduzierte Animationen auf Wunsch
- responsive Desktop-, Tablet- und Smartphone-Ansicht
- regelbasierter Grundmodus ohne API-Schlüssel
- optionaler Grok-KI-Modus über xAI
- sicherer serverseitiger Linkimport
- lokale Sicherung als JSON-Datei

## Architektur

```text
Browser
├─ public/index.html
├─ public/styles.css
├─ public/app.js
├─ localStorage: Profile, Verlauf, Favoriten, Einstellungen
└─ /api/* Aufrufe an die eigene Netlify-Site

Netlify Functions
├─ /api/health   Status des Grok-Modus
├─ /api/import   sicherer Rezeptlink-Import
└─ /api/convert  Grok-KI oder regelbasierter Grundmodus
```

## Grok-Konfiguration

Serverseitige Variablen:

```dotenv
XAI_API_KEY=dein_xai_api_key
XAI_MODEL=grok-4.3
```

`XAI_MODEL` ist optional. Der API-Schlüssel gehört ausschließlich in Netlify Environment Variables oder lokal in `.env`. Er darf niemals in Dateien unter `public/` stehen.

Die serverseitige Integration verwendet:

```text
https://api.x.ai/v1/responses
```

mit Bearer-Authentifizierung, `store: false` und strengem JSON-Schema. Bei kompatibilitätsbedingten Fehlern kann die Function auf `/v1/chat/completions` ausweichen. Schlägt der KI-Aufruf fehl, bleibt der Grundmodus verfügbar.

## Lokale Entwicklung

Voraussetzung: Node.js 20 oder neuer.

```bash
npm run verify
npm run dev
```

Netlify Dev startet die Website normalerweise unter:

```text
http://localhost:8888
```

## Tests

```bash
npm test
npm run check
npm run smoke
npm run verify
```

- `npm test`: Logik-, Parser-, Sicherheits-, Function- und Grok-Mocktests
- `npm run check`: statische Projektprüfung
- `npm run smoke`: Browser-Oberflächentest mit kontrolliertem API-Mock
- `npm run verify`: Logiktests plus statische Prüfung

## Netlify-Konfiguration

`netlify.toml` enthält bereits:

```toml
[build]
  command = "npm run verify"
  publish = "public"
  functions = "netlify/functions"
```

Die Function-Routen werden direkt über `export const config` festgelegt und besitzen codebasierte Rate-Limits.

## Datenschutz und Speicherung

Im Browser werden lokal gespeichert:

- Profile
- aktives Profil
- Entwurf
- Verlauf
- Favoriten
- Darstellungs- und KI-Einstellung

Im Grundmodus wird kein Rezept an xAI gesendet. Ist Grok aktiviert, sendet die eigene Netlify Function die für die Umwandlung nötigen Rezept- und Profildaten an die xAI API. Der xAI-Schlüssel bleibt serverseitig.

Beim Linkimport ruft die Netlify Function die angegebene öffentliche Rezeptseite ab. Private Netzwerkadressen, localhost, ungewöhnliche Ports und problematische Weiterleitungen werden blockiert.

## Sicherheit

Enthalten sind unter anderem:

- API-Schlüssel nur serverseitig
- Same-Origin-Prüfung bei POST-Routen
- JSON- und Größenlimits
- Rate-Limits pro Domain und IP
- URL-Protokoll-, Port-, DNS- und IP-Prüfung
- Blockade privater und reservierter Netze
- erneute URL-Prüfung nach Weiterleitungen
- Antwortzeit-, Dateigrößen- und Inhaltstyp-Limits
- keine unbereinigte HTML-Ausgabe
- Content Security Policy
- `X-Frame-Options`, `Referrer-Policy` und `Permissions-Policy`

Kein technisches System bietet absolute Sicherheit. Vor starkem öffentlichem Verkehr sollten Logging, Monitoring, Benutzerkonten und weitere Missbrauchsgrenzen ergänzt werden.

## Allergiehinweis

RePlant liefert kulinarische Vorschläge, keine medizinische Freigabe. Zutatenlisten, Spurenhinweise, Herstellerangaben und Kreuzkontaminationen müssen immer separat geprüft werden.

## Späteres Abo

Der aktuelle KI-Button ist keine Paywall. Eine echte Abo-Version muss Anmeldung, Zahlungsstatus, Nutzungslimits und Berechtigungen in der serverseitigen Function prüfen. Die empfohlene Erweiterungsstruktur steht in [ABO-SPAETER.md](ABO-SPAETER.md).
