# Workout App v2 – Master Requirements

## 1. Zweck und Geltungsbereich

Dieses Dokument ist die zentrale Produktspezifikation für die Weiterentwicklung der Trainings-App. Es beschreibt das langfristige Zielbild, die verbindlichen Trainingsinhalte, die Anforderungen an Datenqualität und Rückwärtskompatibilität sowie die Aufteilung in Umsetzungsphasen.

Für jede Umsetzung gelten folgende Grundregeln:

- Vor Änderungen zuerst Repository, Datenmodell, Persistenz und bestehende Funktionen analysieren.
- Vorhandene Strukturen wiederverwenden und unnötige Parallelmodelle vermeiden.
- Keine bestehenden Nutzerdaten oder historischen Trainings löschen oder still überschreiben.
- Gespeicherte Gewichte, Wiederholungen, Sätze und Notizen erhalten.
- Bestehende Funktionen außerhalb des jeweiligen Auftrags möglichst unverändert lassen.
- Bei unklarer Architektur die einfachste robuste und rückwärtskompatible Lösung wählen.

Der beim Anlegen dieses Dokuments vorhandene App-Stand enthält bereits einzelne Funktionen, die in dieser Roadmap späteren Phasen zugeordnet sind. Diese vorhandenen Funktionen werden nicht zurückgebaut. Neue Arbeit folgt dennoch den hier definierten Phasengrenzen.

## 2. Produktziel

Die App soll sich langfristig wie eine moderne klassische Fitness-App verhalten:

- feste Trainingspläne als Ausgangspunkt
- flexible konkrete Trainingseinheiten
- große allgemeine Übungsbibliothek
- Übungen spontan hinzufügen, entfernen oder ersetzen
- saubere, unveränderliche Trainingshistorie
- automatische Übernahme der letzten tatsächlich absolvierten Leistungswerte
- übungsbasierte Fortschrittsstatistiken
- Krafttraining als visueller Hauptfokus
- Mobility und Prehab als kompakte, optionale Ergänzung
- keine künstlichen Nullwerte und keine leeren abgeschlossenen Workouts

## 3. Verbindlicher Trainingsplan A

Der Kraftteil von Training A enthält:

1. Brustpresse oder Schrägbankdrücken
2. Latzug
3. Beinpresse beidbeinig
4. Beinbeuger
5. Wadenheben an der Beinpresse
6. Seitheben
7. Bizeps
8. Trizeps
9. Core

Training A enthält Latzug als klassische Rückenübung. Zusätzliches Rudern ist nicht erforderlich; Rudern gehört in Training B.

Wadenheben an der Beinpresse ist eine eigenständige Exercise, kein Zusatzsatz der Beinpresse. Standard sind 2–3 Sätze mit 12–15 Wiederholungen. Die Übung benötigt eigene Gewichte, Wiederholungen, Satzhistorie, Statistik und Bestleistungen.

## 4. Verbindlicher Trainingsplan B

Der Kraftteil von Training B enthält:

1. niedrige Step-ups
2. Brustpresse oder Kabel-Brustdrücken
3. brustgestütztes Rudern
4. Beinstrecker
5. Hip Thrust oder Glute Bridge Maschine
6. Reverse Flys oder Face Pulls
7. Bizeps oder Hammercurls
8. Trizeps
9. Core

Beinstrecker ist ein dauerhafter Bestandteil mit 2 Sätzen und 12–15 Wiederholungen und wird wie eine normale Kraftübung protokolliert. Reverse Flys oder Face Pulls trainieren primär die hintere Schulter. Training A benötigt derzeit keine zusätzliche direkte hintere-Schulter-Übung.

## 5. Romanian Deadlift

Rumänisches Kreuzheben ist wegen wiederkehrender Verspannungen im unteren Rücken kein regulärer Bestandteil der Standardpläne. Die Exercise bleibt in der allgemeinen Bibliothek erhalten und darf nicht gelöscht werden.

## 6. Allgemeine Übungsbibliothek

Die Bibliothek soll perspektivisch mindestens folgende Übungen enthalten. Varianten bleiben getrennte Exercises, wenn sie sich als Gerät, Ausführung oder sinnvoll getrennte Leistungsserie unterscheiden. Vor Ergänzungen ist immer auf vorhandene gleichwertige Exercises zu prüfen, um unnötige Duplikate zu vermeiden.

### Brust

- Brustpresse Maschine
- Schrägbrustpresse
- Bankdrücken Langhantel
- Schrägbankdrücken Langhantel
- Kurzhantel-Bankdrücken
- Kurzhantel-Schrägbankdrücken
- Kabel-Brustdrücken
- Cable Flys
- Butterfly oder Pec Deck
- Liegestütze
- Dips
- Dips-Maschine

### Rücken

- Latzug breit
- Latzug neutral
- Latzug eng
- einarmiger Latzug
- Klimmzüge
- unterstützte Klimmzüge
- Kabelrudern
- Rudern Maschine
- brustgestütztes Rudern
- einarmiges Kurzhantelrudern
- T-Bar Row
- Pullover Maschine
- Straight-Arm Pulldown

### Beine und Quadrizeps

- Beinpresse
- Hack Squat
- Kniebeuge
- Goblet Squat
- Beinstrecker
- Step-ups
- Bulgarian Split Squat
- Split Squat
- Reverse Lunges
- Walking Lunges

### Hintere Kette und Gesäß

- Beinbeuger sitzend
- Beinbeuger liegend
- Romanian Deadlift
- Kreuzheben
- Hip Thrust
- Glute Bridge
- Glute Bridge Maschine
- Back Extension
- Cable Pull Through
- Kickbacks

### Waden

- Wadenheben an der Beinpresse
- stehendes Wadenheben
- sitzendes Wadenheben
- einbeiniges Wadenheben

### Schultern

- Schulterpresse Maschine
- Kurzhantel-Schulterdrücken
- Landmine Press
- Seitheben Kurzhantel
- Seitheben Kabel
- Seitheben Maschine
- Frontheben
- Reverse Fly Maschine
- Reverse Fly Kabel
- Face Pulls

### Bizeps

- Kurzhantelcurls
- Langhantelcurls
- SZ-Curls
- Kabelcurls
- Hammercurls
- Preacher Curls
- Incline Dumbbell Curls

### Trizeps

- Trizeps Pushdown
- Rope Pushdown
- Overhead Triceps Extension
- einarmiger Kabel-Pushdown
- Skull Crushers
- Dips
- Trizepsmaschine

### Core

- Dead Bug
- Bird Dog
- Plank
- Side Plank
- Pallof Press
- Cable Crunch
- Crunch Maschine
- Hanging Knee Raise
- Hanging Leg Raise
- Ab Wheel
- Farmer Carry

## 7. Zukünftige Übungsmetadaten

Langfristig kann jede Exercise folgende Metadaten besitzen:

- Name und Kategorie
- primäre und sekundäre Muskelgruppen
- Equipment
- unilateral oder bilateral
- Tracking-Art
- mögliche Alternativen

Beispiel Bulgarian Split Squat: Kategorie Beine, primär Quadrizeps und Gesäß, Equipment Körpergewicht oder Kurzhanteln, unilateral, Tracking Gewicht und Wiederholungen.

Dieses Ziel rechtfertigt in Phase 1 kein großes Refactoring. Vorhandene Felder und IDs sollen stabil bleiben.

## 8. Letzte tatsächlich absolvierte Werte

Beim erneuten Auftauchen einer Exercise werden die Werte ihrer letzten tatsächlich abgeschlossenen Ausführung verwendet:

- Die Exercise-ID bestimmt die Historie, nicht der Name des Trainingsplans.
- Die Suche umfasst alle abgeschlossenen WorkoutSessions.
- Ausgelassene Übungen und nicht abgeschlossene Sets werden übersprungen.
- Ein späteres Workout, in dem die Exercise nicht durchgeführt wurde, darf die letzten gültigen Werte nicht verdrängen.
- Eine spontan in einem anderen Trainingsplan durchgeführte Exercise aktualisiert ihre globale Exercise-History.
- Gewicht `0` ist nicht automatisch gleichbedeutend mit „nicht absolviert“; der Abschlussstatus des Sets ist maßgeblich.
- Es werden keine künstlichen `0 kg` oder `0 Wiederholungen` als Ersatzwerte erzeugt.

Beispiel: Wurde Beinstrecker am 01.08. abgeschlossen, am 08.08. ausgelassen und am 15.08. erneut gestartet, werden weiterhin die abgeschlossenen Werte vom 01.08. verwendet.

## 9. Training abbrechen

Eine aktive Session bietet zusätzlich zu „Training beenden“ die Aktion „Training abbrechen“.

Vor dem Abbruch erscheint eine destruktive Bestätigung:

> Training wirklich abbrechen?
>
> Alle Eingaben dieser Trainingseinheit werden verworfen.

Aktionen:

- Weitertrainieren
- Training abbrechen

Beim Abbruch wird die aktive Session vollständig verworfen. Es entsteht kein Verlaufseintrag, keine Statistikänderung, keine erhöhte Trainingsanzahl, kein Nullwert und keine Bestleistung. Danach wird zur Trainingsübersicht navigiert.

## 10. Leere Workouts

Eine WorkoutSession ohne mindestens ein abgeschlossenes Set darf nicht als abgeschlossen gespeichert werden.

Wählt der Nutzer in diesem Zustand „Training beenden“, erscheint:

> In diesem Training wurde noch kein Satz abgeschlossen.

Aktionen:

- Weitertrainieren
- Training abbrechen

Ein leeres Workout gelangt niemals in Verlauf oder Statistik.

## 11. Keine künstlichen Nullwerte

Bei Teiltrainings werden nur tatsächlich abgeschlossene Sets als Leistungswerte behandelt. Nicht durchgeführte Übungen dürfen optional als „nicht durchgeführt“ sichtbar bleiben, erzeugen aber keine Leistungswerte. Nicht abgeschlossene Sets werden weder in Volumen noch in Bestleistungen, Vorwerten oder anderen Statistiken berücksichtigt.

## 12. Pausentimer

Der globale Standard beträgt 150 Sekunden beziehungsweise 2:30 Minuten.

Langfristig beziehungsweise bei bereits passender vorhandener Struktur unterstützt der Timer außerdem:

- individuelle Pausen pro Exercise
- `+30 Sekunden`
- `-30 Sekunden`
- Überspringen oder Beenden
- automatischen Start nach Satzabschluss

Phase 1 soll dafür kein unnötiges Timer-Refactoring erzeugen.

## 13. Mobility- und Warm-up-UI

Krafttraining ist der visuelle Hauptbereich. Warm-up, Prehab und Cool-down sind standardmäßig eingeklappt, optional aufklappbar und kein Pflichtkriterium zum Abschluss.

Zielstruktur einer Kraft-Session:

1. Warm-up & Mobility, eingeklappt, mit Anzahl und ungefährer Dauer
2. Krafttraining, sofort sichtbar
3. Core / Prehab, kompakt und optional
4. Cool-down / Mobility, eingeklappt und optional

Warm-up und Cool-down benötigen kein klassisches Gewichtslogging, können aber optional abgehakt werden.

## 14. Warm-up Training A

1. Knie-vor-Wand mit kurzer Endposition
2. Adductor Rockback
3. aktive 90/90 Hip Switches
4. Glute Bridge March
5. Thoracic Rotation im Vierfüßler
6. Chin Tuck und kontrollierte Rotation

Ziel sind Mobilisation und Aktivierung ohne unnötige Vorermüdung.

## 15. Warm-up Training B

1. Knee-to-Wall oder Soleus-Mobilisation
2. kontrollierter niedriger Step-down
3. 90/90 Lift-off oder aktive Hüftrotation
4. Monster Walks
5. Wall Slide mit Lift-off
6. kontrollierte HWS-Rotation

## 16. Cool-down

Der Cool-down ist kurz, optional, standardmäßig eingeklappt und dauert ungefähr 3–5 Minuten. Mögliche Bestandteile:

- Hüftbeuger-Stretch
- Open Book
- lockere HWS-Rotation
- Wade oder Soleus
- Brust- oder Schultermobilität

## 17. Zukünftige Mobility-Progression

Mobility kann später progressiv gestaltet werden durch:

- größeren kontrollierten Bewegungsradius
- Halten von Endpositionen
- aktive statt passive Beweglichkeit
- Lift-offs und Isometrien
- komplexere Varianten
- leichte Widerstände
- regelmäßige sinnvolle Übungswechsel

Ein automatisches Mobility-Level-System ist nicht Bestandteil von Phase 1.

## 18. Phase 2 – flexible WorkoutSessions

Phase 2 trennt klar zwischen permanentem `WorkoutTemplate` und konkreter `WorkoutSession`. Beim Start wird eine Session auf Basis des Templates erzeugt. Änderungen an der Session dürfen niemals automatisch das Template überschreiben.

Während einer laufenden Session soll möglich sein:

- „Für heute ersetzen“
- „Für heute entfernen“
- „Übung hinzufügen“ aus der allgemeinen Bibliothek

Diese Änderungen gelten nur für die konkrete Session. Beim nächsten Start erscheint wieder das unveränderte Template. Historische Sessions speichern den tatsächlich absolvierten Zustand und bleiben bei späteren Template-Änderungen unverändert.

Diese Fähigkeiten werden in Phase 1 nicht neu entwickelt oder erweitert.

## 19. Eigene Übungen – spätere Phase

Später kann der Nutzer eigene Exercises mit Name, Kategorie, Muskelgruppe, Equipment und Tracking-Art erstellen. Nicht Bestandteil von Phase 1.

## 20. Suche und Filter – spätere Phase

Die Bibliothek soll später Suchfeld, Kategorien, Equipment-Filter und „Zuletzt verwendet“ unterstützen. Häufig spontan verwendete Exercises sollen dadurch schnell erreichbar sein. Kein Ausbau dieser Funktionen in Phase 1.

## 21. Phase 3 – Fortschrittsstatistiken

Langfristig zeigt jede Kraftübung:

- Gewichtsentwicklung
- höchstes Gewicht
- Wiederholungen
- Arbeitssätze
- Gesamtvolumen
- Anzahl der Trainingseinheiten mit dieser Exercise
- zeitlichen Verlauf

Volumen pro Satz ist `Gewicht × Wiederholungen`; Gesamtvolumen ist die Summe aller abgeschlossenen Sätze. Optional folgen Weight PR, Volume PR, Rep PR und geschätztes 1RM.

Statistiken sind Exercise-basiert. Brustpresse Maschine, Kurzhantel-Schrägbankdrücken und Kabel-Brustdrücken bleiben getrennt. Ebenso bleiben Wadenheben an der Beinpresse und stehendes Wadenheben getrennt.

Diese Fähigkeiten werden in Phase 1 nicht neu entwickelt oder erweitert.

## 22. Empfohlenes langfristiges Datenmodell

Als Orientierung, nicht als Auftrag für ein blindes Refactoring:

- `Exercise`
- `WorkoutTemplate`
- `TemplateExercise`
- `WorkoutSession`
- `SessionExercise`
- `SetLog`

Eine `SessionExercise` kann beispielsweise `exerciseId`, optionale `templateExerciseId`, `source`, optionale `replacedExerciseId`, `order`, `restSeconds`, `sets` und `notes` speichern. `source` kann `template`, `added` oder `replacement` sein.

Wichtigste Architekturregel: Eine `WorkoutSession` darf niemals automatisch ein `WorkoutTemplate` überschreiben.

## 23. Phase 1 – verbindlicher Umfang

Phase 1 umfasst ausschließlich:

### Trainingspläne

- Training A und B gemäß diesem Dokument aktualisieren
- Beinstrecker in B
- Wadenheben an der Beinpresse in A
- Latzug in A
- Rudern in B
- Reverse Fly oder Face Pull in B

### Exercise Library

- bestehende Bibliothek prüfen
- Bulgarian Split Squat ergänzen
- weitere eindeutig fehlende klassische Standardübungen aus Abschnitt 6 ergänzen
- keine unnötigen Duplikate erzeugen

### Workout-Datenqualität

- Training abbrechen mit Bestätigung
- abgebrochene Sessions niemals speichern
- leere Sessions niemals abschließen
- nicht absolvierte Übungen nicht als Nullwerte behandeln
- nicht absolvierte Sets aus Leistungswerten in Historie und Statistik ausschließen

### Previous Values

- letzte tatsächlich abgeschlossene Ausführung derselben Exercise finden
- ausgelassene Workouts überspringen
- planunabhängig anhand der Exercise-ID suchen
- keine künstlichen Nullwerte verwenden

### Timer und UI

- Standardpause 150 Sekunden
- Warm-up und Cool-down standardmäßig eingeklappt
- Krafttraining als visueller Hauptbereich

### Mobility

- neue Warm-ups für A und B
- kurzer optionaler Cool-down

## 24. Nicht Bestandteil von Phase 1

In Phase 1 nicht neu implementieren:

- große Template-/Session-Architekturänderung
- Session-Übungen ersetzen, hinzufügen oder entfernen
- eigene Übungen
- komplexe Exercise-Suche und Equipment-Filter
- automatische Alternativvorschläge
- Mobility-Level-System
- Fortschrittscharts, PR-System oder 1RM
- großes Statistik-Dashboard

Vorhandene Funktionen aus früheren App-Versionen werden nicht zurückgebaut.

## 25. Rückwärtskompatibilität

Falls Datenstrukturen angepasst werden müssen:

- bestehende Historie erhalten
- keine gespeicherten Gewichte oder Wiederholungen verlieren
- nur notwendige Migrationen durchführen
- sichere Defaults verwenden
- keine stillen Datenverluste

Historische Sessions sind unveränderlich und müssen den damaligen tatsächlichen Zustand behalten.

## 26. Abnahmetests Phase 1

1. **Training abbrechen:** Ohne abgeschlossenen Satz abbrechen; kein Verlauf und keine Statistikänderung.
2. **Leeres Training beenden:** Beenden ohne abgeschlossenen Satz zeigt Hinweis und speichert nichts.
3. **Normales Training:** Mindestens einen Satz abschließen; Session wird korrekt gespeichert.
4. **Teiltraining:** Nur einige Übungen durchführen; nur echte abgeschlossene Sets zählen.
5. **Previous Values:** Eine spätere ausgelassene Session verdrängt die letzte tatsächliche Ausführung nicht.
6. **Planunabhängige Exercise-History:** Dieselbe Exercise verwendet über alle Pläne die neuesten abgeschlossenen Werte.
7. **Timer:** Neue Session startet mit 2:30 Minuten Standardpause.
8. **Mobility UI:** Warm-up und Cool-down sind eingeklappt, Kraftübungen sofort sichtbar.
9. **Trainingspläne:** A enthält Latzug, Beinpresse, Beinbeuger und Wadenheben an der Beinpresse; B enthält Rudern, Beinstrecker und Reverse Fly oder Face Pull.
10. **Exercise Library:** Bulgarian Split Squat ist vorhanden und normal nutzbar.

## 27. Abschlusskriterien

Vor Abschluss einer Phase-1-Änderung:

1. vorhandene Tests ausführen
2. Produktions-Build ausführen
3. Fehler beheben
4. App-Start und zentrale Abläufe prüfen
5. Rückwärtskompatibilität vorhandener Daten prüfen
6. keine offenen TypeScript-, Lint- oder Build-Fehler hinterlassen

Der Abschlussbericht nennt implementierte Punkte, geänderte Dateien, Datenmodell- und Migrationsauswirkungen, ausgeführte Tests, offene Phase-1-Punkte und voraussichtlich relevante Codebereiche für Phase 2.

## 28. Git-Regel

Nicht automatisch pushen. Erst nach erfolgreichem Build darf ein Commit vorgeschlagen werden.

Vorgeschlagene Commit-Message:

`feat: improve workout plans, session handling and exercise history`
