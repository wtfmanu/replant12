# RePlant veröffentlichen – Schritt für Schritt

Diese Anleitung ist für Personen ohne Vorerfahrung. Die Website funktioniert bereits ohne AI im Grundmodus. Der vorhandene API-Key wird erst nach dem ersten erfolgreichen Netlify-Deploy hinzugefügt.

## 1. Projekt entpacken

1. Lade `replant-ai-netlify-v4.zip` herunter.
2. Doppelklicke auf die ZIP-Datei.
3. Öffne den entpackten Ordner.
4. Direkt darin müssen unter anderem diese Elemente sichtbar sein:

```text
package.json
netlify.toml
README.md
START-HIER.md
public/
netlify/
scripts/
tests/
```

Wichtig: Lade später den **Inhalt dieses Ordners** zu GitHub hoch, nicht nur die ZIP-Datei.

## 2. GitHub-Repository anlegen

1. Öffne `github.com` und melde dich an.
2. Klicke rechts oben auf das Pluszeichen.
3. Wähle **New repository**.
4. Repository name: `replantv1` oder ein anderer Name deiner Wahl.
5. Wähle **Private**, wenn der Quellcode nicht öffentlich sichtbar sein soll.
6. Aktiviere keine zusätzlichen Startdateien.
7. Klicke auf **Create repository**.

## 3. Alle Dateien zu GitHub hochladen

1. Öffne dein neues, noch leeres Repository.
2. Klicke auf **uploading an existing file**. Falls bereits Dateien vorhanden sind: **Add file → Upload files**.
3. Öffne auf deinem Computer den entpackten RePlant-Ordner.
4. Markiere **alle darin enthaltenen Dateien und Ordner**.
5. Ziehe sie in das GitHub-Fenster.
6. Warte, bis der Upload vollständig ist.
7. Trage unten bei der Beschreibung zum Beispiel `RePlant Version 4` ein.
8. Klicke auf **Commit changes**.

Danach müssen `package.json`, `netlify.toml`, `README.md` und `START-HIER.md` direkt auf der ersten Repository-Seite sichtbar sein.

## 4. Repository mit Netlify verbinden

1. Öffne `app.netlify.com` und melde dich an.
2. Klicke auf **Add new project**.
3. Wähle **Import an existing project**.
4. Wähle **GitHub**.
5. Erlaube Netlify den Zugriff auf dein Repository.
6. Wähle dein RePlant-Repository.
7. Kontrolliere die automatisch erkannten Angaben:

```text
Build command: npm run verify
Publish directory: public
Functions directory: netlify/functions
```

8. Klicke auf **Deploy**.
9. Warte, bis der Status **Published** oder **Deploy succeeded** erscheint.

## 5. Website im Grundmodus testen

1. Öffne die von Netlify angezeigte Webadresse.
2. Wähle **Text eingeben**.
3. Klicke auf **Beispiel laden**.
4. Wähle vegetarisch oder vegan.
5. Klicke auf **Rezept verwandeln**.
6. Prüfe Zutaten, Zubereitung und den Bereich **Was wurde verändert?**.

Dort werden nun getrennt angezeigt:

- **Ersetzte Produkte**
- **Angepasste Mengen**

## 6. AI-Key sicher bei Netlify hinterlegen

Der API-Key darf niemals in GitHub, `app.js`, HTML oder eine öffentlich sichtbare Datei kopiert werden.

1. Öffne dein Projekt in Netlify.
2. Öffne **Project configuration**.
3. Öffne **Environment variables**.
4. Klicke auf **Add a variable**.
5. Name:

```text
XAI_API_KEY
```

6. Value: dein echter API-Key.
7. Speichere die Variable.
8. Öffne **Deploys**.
9. Klicke auf **Trigger deploy → Deploy site**.
10. Warte erneut auf einen erfolgreichen Deploy.

Optional kannst du zusätzlich `XAI_MODEL` mit einem in deinem API-Konto verfügbaren Modellnamen anlegen. Für den ersten Test ist das nicht erforderlich.

## 7. AI auf der Website einschalten

1. Lade die Website neu.
2. Neben **Rezept verwandeln** befindet sich der Schalter **AI**.
3. Klicke auf den Schalter.
4. Der Regler bewegt sich nach rechts und wird grünlich.
5. Die nächste Umwandlung verwendet AI.

Falls kein API-Key eingerichtet wurde, öffnet der Schalter eine kurze Einrichtungsanleitung.

## 8. Spätere Änderungen veröffentlichen

1. Öffne dein GitHub-Repository.
2. Lade die geänderten Dateien über **Add file → Upload files** hoch.
3. Bestehende Dateien dürfen ersetzt werden.
4. Klicke auf **Commit changes**.
5. Netlify startet normalerweise automatisch einen neuen Deploy.

## Typische Fehler

### Netlify meldet fehlende Dateien

Prüfe, ob `README.md`, `START-HIER.md`, `package.json`, `netlify.toml` und der Ordner `tests` wirklich auf der obersten Repository-Ebene liegen.

### Es wurden 0 Tests gefunden

Der Ordner `tests` wurde nicht vollständig zu GitHub hochgeladen. Lade ihn erneut hoch.

### AI lässt sich nicht aktivieren

Prüfe:

- Variablenname exakt `XAI_API_KEY`
- Schlüssel ohne zusätzliche Leerzeichen
- nach dem Speichern einen neuen Deploy gestartet
- Website anschließend vollständig neu geladen

### Ein Rezeptlink funktioniert nicht

Manche Seiten blockieren automatische Abrufe. Kopiere in diesem Fall das Rezept und verwende **Text eingeben**.

## Sicherheit

Die Website speichert Profile und Verlauf lokal im jeweiligen Browser. Allergiehinweise sind keine medizinische Freigabe. Prüfe bei Allergien weiterhin Etiketten, Spurenhinweise und Kreuzkontamination.
