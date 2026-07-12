# AI in RePlant einrichten

## Benötigte Variable

Lege in Netlify unter **Project configuration → Environment variables** diese geheime Variable an:

```text
XAI_API_KEY
```

Der Wert ist dein vorhandener API-Key.

Optional kannst du zusätzlich festlegen:

```text
XAI_MODEL
```

Verwende dafür einen Modellnamen, der in deinem API-Konto verfügbar ist.

## Danach

1. Variable speichern.
2. Unter **Deploys** einen neuen Production Deploy starten.
3. Website neu laden.
4. Den Schalter **AI** rechts neben **Rezept verwandeln** betätigen.

## Sicherheitsregel

Der echte API-Key gehört ausschließlich in die Netlify-Umgebungsvariablen. Er darf nicht in GitHub, Browser-JavaScript, HTML, Screenshots oder Support-Nachrichten veröffentlicht werden.

## Fallback

Ist der AI-Dienst nicht verfügbar, erzeugt RePlant automatisch eine regelbasierte Grundversion und zeigt einen Hinweis im Ergebnis.
