# START HIER – RePlant Schritt für Schritt veröffentlichen

Diese Anleitung richtet sich an Personen, die noch nie eine Website veröffentlicht haben. Du brauchst keine Programmierkenntnisse.

## Was du am Ende hast

Nach dieser Anleitung läuft RePlant unter einer Adresse wie:

```text
https://dein-projektname.netlify.app
```

Die Website funktioniert zunächst im **Grundmodus**. Danach hinterlegst du deinen xAI-/Grok-API-Schlüssel sicher bei Netlify und aktivierst den **Grok-KI-Modus** über den kleinen Button oben rechts.

## Wichtig: deinen API-Schlüssel niemals in Dateien schreiben

Dein xAI-Schlüssel ist wie ein Passwort. Er gehört niemals in:

- `public/app.js`
- `index.html`
- GitHub
- einen Screenshot
- ein öffentliches Formular auf deiner Website

Er wird ausschließlich als geheime Umgebungsvariable namens `XAI_API_KEY` in Netlify gespeichert. Der Browser bekommt den Schlüssel nicht zu sehen.

---

# Teil 1 – ZIP-Datei entpacken

## Schritt 1: Projekt herunterladen

Lade die Datei herunter:

```text
replant-grok-netlify.zip
```

## Schritt 2: ZIP-Datei entpacken

### Auf Windows

1. Öffne den Download-Ordner.
2. Klicke mit der rechten Maustaste auf `replant-grok-netlify.zip`.
3. Wähle **Alle extrahieren**.
4. Klicke auf **Extrahieren**.

### Auf einem Mac

1. Öffne den Download-Ordner.
2. Doppelklicke auf `replant-grok-netlify.zip`.
3. macOS erstellt automatisch einen entpackten Ordner.

## Schritt 3: Ordner prüfen

Öffne den entpackten Ordner. Direkt darin müssen unter anderem diese Dateien und Ordner liegen:

```text
package.json
netlify.toml
public
netlify
tests
scripts
START-HIER.md
```

**Entscheidend:** `package.json` und `netlify.toml` müssen ganz oben im Projektordner liegen. Es darf nicht versehentlich so aussehen:

```text
mein-repository/
└── replant-grok-netlify/
    ├── package.json
    └── netlify.toml
```

Richtig ist:

```text
mein-repository/
├── package.json
├── netlify.toml
├── public/
└── netlify/
```

---

# Teil 2 – Projekt zu GitHub hochladen

GitHub speichert den Quellcode. Netlify lädt die Website später automatisch von dort.

## Schritt 1: GitHub-Konto erstellen

1. Öffne `https://github.com/`.
2. Klicke auf **Sign up**.
3. Erstelle dein Konto und bestätige deine E-Mail-Adresse.
4. Melde dich danach bei GitHub an.

## Schritt 2: Neues Repository anlegen

1. Klicke oben rechts auf das **Pluszeichen**.
2. Wähle **New repository**.
3. Trage als Namen zum Beispiel ein:

   ```text
   replant
   ```

4. Unter **Visibility** kannst du **Private** wählen. Netlify kann auch private Repositories verwenden, nachdem du den Zugriff erlaubt hast.
5. Setze keinen Haken bei einer zusätzlichen README, `.gitignore` oder Lizenz. Diese Dateien sind bereits im Projekt enthalten.
6. Klicke auf **Create repository**.

## Schritt 3: Dateien hochladen

Im neuen, noch leeren Repository erscheint eine Seite mit mehreren Möglichkeiten.

1. Klicke auf den Link **uploading an existing file**. Alternativ: **Add file** → **Upload files**.
2. Öffne auf deinem Computer den entpackten RePlant-Ordner.
3. Markiere **den gesamten Inhalt innerhalb des Ordners**.
4. Ziehe alle markierten Dateien und Unterordner in das GitHub-Fenster.
5. Warte, bis der Upload abgeschlossen ist.
6. Prüfe in der Liste, dass mindestens diese Einträge dabei sind:

   ```text
   public
   netlify
   tests
   scripts
   package.json
   netlify.toml
   ```

7. Scrolle nach unten.
8. Trage als Nachricht zum Beispiel ein:

   ```text
   RePlant erste Version
   ```

9. Klicke auf **Commit changes**.

## Schritt 4: GitHub-Struktur kontrollieren

Nach dem Upload siehst du die Startseite des Repositorys. Dort müssen `package.json` und `netlify.toml` direkt neben den Ordnern `public` und `netlify` stehen.

Sind diese Dateien erst sichtbar, nachdem du einen weiteren Unterordner öffnest, wurde der falsche Ordner hochgeladen. In diesem Fall die Dateien löschen und den **Inhalt** des inneren Ordners erneut hochladen.

---

# Teil 3 – Website mit Netlify veröffentlichen

## Schritt 1: Netlify-Konto erstellen

1. Öffne `https://app.netlify.com/`.
2. Klicke auf **Sign up**.
3. Am einfachsten ist **Sign up with GitHub**.
4. Erlaube Netlify den Zugriff auf dein GitHub-Konto.

## Schritt 2: GitHub-Projekt importieren

1. Klicke in Netlify auf **Add new project** oder **Add new site**.
2. Wähle **Import an existing project**.
3. Wähle **GitHub**.
4. Falls GitHub nach Berechtigungen fragt, erlaube Netlify den Zugriff auf dein RePlant-Repository.
5. Wähle das Repository `replant` beziehungsweise deinen gewählten Namen aus.

## Schritt 3: Build-Einstellungen prüfen

Netlify sollte die Datei `netlify.toml` automatisch erkennen. Prüfe trotzdem diese Werte:

```text
Build command:       npm run verify
Publish directory:   public
Functions directory: netlify/functions
```

Bei **Base directory** sollte nichts eingetragen sein.

## Schritt 4: Ersten Deploy starten

1. Klicke auf **Deploy site** oder **Deploy project**.
2. Warte, bis der Build abgeschlossen ist. Das dauert meistens einige Minuten.
3. Der Status muss **Published** oder **Production: Published** anzeigen.
4. Klicke auf die von Netlify erzeugte Adresse.

Du solltest jetzt die RePlant-Startseite sehen.

## Schritt 5: Grundmodus testen

1. Öffne die veröffentlichte Website.
2. Klicke auf **Text eingeben**.
3. Füge das Beispiel aus `examples/carbonara.txt` ein oder verwende ein eigenes vollständiges Rezept.
4. Stelle den linken Ziel-Slider auf **Vegan** oder **Vegetarisch**.
5. Stelle den Slider **Feinabstimmung** ein.
6. Klicke auf **Rezept verwandeln**.

Ohne xAI-Schlüssel arbeitet RePlant im regelbasierten Grundmodus. Das ist beabsichtigt.

---

# Teil 4 – Grok-KI sicher aktivieren

Eine separate Kurzfassung steht auch in `GROK-EINRICHTEN.md`.

## Schritt 1: xAI-Schlüssel bereithalten

Du hast bereits einen Grok-/xAI-API-Schlüssel. Kopiere ihn in die Zwischenablage, aber füge ihn nicht in GitHub ein.

## Schritt 2: Umgebungsvariable in Netlify anlegen

1. Öffne in Netlify dein RePlant-Projekt.
2. Öffne **Project configuration** oder **Site configuration**.
3. Öffne **Environment variables**.
4. Klicke auf **Add a variable** beziehungsweise **Add environment variable**.
5. Trage bei **Key** exakt ein:

   ```text
   XAI_API_KEY
   ```

6. Füge bei **Value** deinen echten xAI-Schlüssel ein.
7. Wähle als Bereich mindestens **Functions** beziehungsweise alle Deploy-Kontexte, in denen die KI funktionieren soll.
8. Speichere die Variable.

## Schritt 3: Optional das Modell festlegen

RePlant verwendet standardmäßig:

```text
XAI_MODEL=grok-4.3
```

Du musst dafür nichts eintragen. Möchtest du später ein anderes in deinem xAI-Konto verfügbares Modell verwenden, lege zusätzlich diese Variable an:

```text
Key:   XAI_MODEL
Value: grok-4.3
```

Ändere den Modellnamen nur auf einen Namen, der in deinem xAI-Konto tatsächlich verfügbar ist.

## Schritt 4: Erneut bereitstellen

Eine neu gespeicherte Umgebungsvariable muss in einem neuen Deploy verfügbar werden.

1. Öffne in Netlify **Deploys**.
2. Klicke auf **Trigger deploy**.
3. Wähle **Deploy site** beziehungsweise **Deploy project**.
4. Warte wieder auf den Status **Published**.

## Schritt 5: KI-Schalter testen

1. Öffne die RePlant-Seite neu.
2. Klicke oben rechts auf **KI aktivieren**.
3. Das Fenster sollte melden, dass Grok bereit ist.
4. Klicke auf **Grok aktivieren**.
5. Der kleine Button zeigt anschließend **Grok aktiv** und den Modellnamen.
6. Starte eine neue Rezeptumwandlung.

Bei einer erfolgreichen KI-Umwandlung erscheint im Ergebnis ein Hinweis auf den Grok-Modus. Falls xAI vorübergehend nicht erreichbar ist, verwendet RePlant automatisch den Grundmodus und zeigt eine Warnung.

## API-Kosten beachten

Jede Grok-Anfrage kann Kosten in deinem xAI-Konto verursachen. Solange die Website öffentlich ohne Anmeldung erreichbar ist, könnten auch andere Personen deine API-Nutzung auslösen. Für einen privaten Test ist das meist überschaubar; vor einer öffentlichen Vermarktung solltest du Benutzerkonten, Nutzungslimits und eine serverseitige Abo-Prüfung ergänzen. Siehe `ABO-SPAETER.md`.

---

# Teil 5 – Eigenen Namen der Netlify-Adresse festlegen

Netlify vergibt zunächst einen zufälligen Namen.

1. Öffne in Netlify dein Projekt.
2. Öffne **Domain management**.
3. Suche nach **Options**, **Edit site name** oder **Change site name**.
4. Trage zum Beispiel ein:

   ```text
   replant-recipes
   ```

Die Adresse wäre dann ungefähr:

```text
https://replant-recipes.netlify.app
```

Ist der Name bereits vergeben, wähle eine andere Variante.

Eine eigene Domain wie `replant.de` kann später ebenfalls unter **Domain management** verbunden werden.

---

# Teil 6 – Website später aktualisieren

Wenn du Dateien änderst:

1. Öffne dein GitHub-Repository.
2. Lade die geänderten Dateien über **Add file** → **Upload files** hoch oder bearbeite eine Datei direkt mit dem Stiftsymbol.
3. Klicke auf **Commit changes**.
4. Netlify erkennt die Änderung und startet automatisch einen neuen Deploy.
5. Prüfe unter **Deploys**, ob der neue Build erfolgreich war.

---

# Teil 7 – Lokal auf deinem Computer testen

Dieser Teil ist optional. Für die Veröffentlichung über GitHub und Netlify ist er nicht zwingend erforderlich.

## Node.js installieren

1. Öffne `https://nodejs.org/`.
2. Installiere eine aktuelle LTS-Version.
3. Öffne anschließend ein Terminal im entpackten Projektordner.

### Terminal auf Windows öffnen

- Öffne den Projektordner im Explorer.
- Klicke oben in die Adresszeile.
- Tippe `powershell` und drücke Enter.

### Terminal auf einem Mac öffnen

- Öffne Terminal.
- Tippe `cd ` inklusive Leerzeichen.
- Ziehe den Projektordner in das Terminalfenster.
- Drücke Enter.

## Prüfungen ausführen

```bash
npm run verify
```

Danach lokal starten:

```bash
npm run dev
```

Beim ersten Start lädt `npx` die Netlify CLI. Die Website ist normalerweise erreichbar unter:

```text
http://localhost:8888
```

## Grok lokal testen

1. Kopiere `.env.example` zu einer neuen Datei namens `.env`.
2. Trage in `.env` deinen echten Schlüssel ein:

   ```dotenv
   XAI_API_KEY=dein_echter_schluessel
   XAI_MODEL=grok-4.3
   ```

3. Starte erneut:

   ```bash
   npm run dev
   ```

Die Datei `.env` wird durch `.gitignore` vom GitHub-Upload ausgeschlossen. Kontrolliere trotzdem vor jedem Upload, dass sie nicht in GitHub erscheint.

---

# Häufige Probleme

## Netlify zeigt „Page not found“

Prüfe:

```text
Publish directory: public
```

und ob `public/index.html` im Repository vorhanden ist.

## Netlify-Build schlägt fehl

1. Öffne den fehlgeschlagenen Deploy.
2. Öffne **Deploy log**.
3. Suche nach der ersten roten Fehlermeldung.
4. Kontrolliere, ob `package.json` und `netlify.toml` wirklich im obersten Repository-Verzeichnis liegen.

## Website zeigt „Netlify nötig“

Du hast wahrscheinlich `public/index.html` direkt auf dem Computer geöffnet. Die API-Funktionen funktionieren nur über Netlify oder `npm run dev`.

## KI-Button meldet „Nicht eingerichtet“

Kontrolliere:

- Variablenname exakt `XAI_API_KEY`
- kein Leerzeichen vor oder nach dem Schlüssel
- Variable im richtigen Netlify-Projekt gespeichert
- nach dem Speichern ein neuer Deploy durchgeführt

## Grok ist aktiv, aber RePlant verwendet den Grundmodus

Mögliche Ursachen:

- xAI-Kontingent oder Guthaben reicht nicht
- Modellname ist im Konto nicht verfügbar
- temporärer Fehler bei xAI
- Anfrage war zu groß oder hat zu lange gedauert

Öffne in Netlify den Bereich **Logs** beziehungsweise **Functions logs** und suche nach der Function `/api/convert`.

## Ein Rezeptlink funktioniert nicht

Einige Rezeptseiten:

- blockieren automatische Abrufe
- verlangen eine Anmeldung
- verwenden eine Bezahlschranke
- laden das Rezept erst durch komplexes JavaScript
- geben keine strukturierten Rezeptdaten aus

Nutze in diesem Fall **Text eingeben** und kopiere Zutaten sowie Zubereitung manuell hinein.

## Profile oder Verlauf sind verschwunden

Profile, Verlauf und Favoriten werden im Browser gespeichert. Sie können fehlen, wenn du:

- Browserdaten gelöscht hast
- den privaten Modus verwendet hast
- einen anderen Browser oder ein anderes Gerät nutzt

Nutze unter **Einstellungen → Datensicherung → Exportieren** regelmäßig die Sicherungsfunktion.

## Allergien

RePlant ist eine Kochhilfe und keine medizinische Freigabe. Prüfe immer Produktetiketten, Spurenhinweise, Kreuzkontaminationen und Herstellerangaben.

---

# Empfohlene Reihenfolge

1. ZIP entpacken.
2. Projekt zu GitHub hochladen.
3. GitHub-Projekt in Netlify importieren.
4. Grundmodus testen.
5. `XAI_API_KEY` in Netlify speichern.
6. neuen Deploy starten.
7. Grok über den kleinen KI-Button aktivieren.
8. vor einer öffentlichen Vermarktung Anmeldung, serverseitige Limits und Abo-Prüfung ergänzen.
