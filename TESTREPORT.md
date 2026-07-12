# Prüfbericht – RePlant 4.0

## Automatisierte Logiktests

Ausgeführt mit:

```bash
npm test
```

Ergebnis:

```text
18 Tests
18 bestanden
0 fehlgeschlagen
```

Geprüft werden unter anderem:

- vegane und vegetarische Umwandlung
- Allergieausschlüsse
- Zutaten- und Rezeptparser
- Produktersetzungen
- Portionsskalierung
- getrennte Mengenänderungen
- JSON-LD-Linkimport
- HTML-Fallback
- private und reservierte Netzwerkziele
- sichere Weiterleitungen
- Größen- und Inhaltstypgrenzen
- Netlify Functions
- serverseitiger AI-Key
- AI-Antwortparser mit Mock-Dienst

## Statische Projektprüfung

Ausgeführt mit:

```bash
npm run check
```

Geprüft werden Pflichtdateien, JavaScript-Syntax, HTML-IDs, Assets, responsive CSS-Regeln, Fokusdarstellung, Druckansicht, Netlify-Routen, Security-Header und versehentlich eingebettete API-Schlüssel.

## Bekannte Grenzen

- Nicht jede Rezeptseite erlaubt automatischen Import.
- Der Grundmodus ist weniger flexibel als AI.
- Profile und Verlauf liegen nur im jeweiligen Browser.
- Allergiehinweise sind keine medizinische Freigabe.
