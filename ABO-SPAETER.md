# Später ein Abonnement ergänzen

Der aktuelle AI-Schalter ist nur eine Komfortfunktion im Browser. Er schützt den API-Zugang nicht vor unberechtigter Nutzung und ist keine Paywall.

## Für eine echte Abo-Version erforderlich

1. Benutzerkonten mit sicheren Sitzungen
2. Zahlungsanbieter und Webhooks
3. serverseitig gespeicherter Abo-Status
4. Prüfung der Berechtigung in `/api/convert`
5. monatliche oder tägliche Nutzungsgrenzen
6. Schutz vor mehrfachen und automatisierten Anfragen
7. Kostenüberwachung und Missbrauchserkennung
8. Datenschutzerklärung, Impressum und Vertragsinformationen

## Wichtige Regel

Die Netlify Function muss vor jedem AI-Aufruf selbst prüfen, ob die angemeldete Person ein aktives Abo und noch verfügbares Kontingent besitzt. Eine reine Sperre im Frontend lässt sich leicht umgehen.

## Mögliches Modell

- **Kostenlos:** Grundmodus, lokale Profile, begrenzter Verlauf
- **Pro:** AI-Modus, höhere Limits, Cloud-Synchronisierung
- **Team:** mehrere Personen, gemeinsame Rezepte und zentrale Abrechnung
