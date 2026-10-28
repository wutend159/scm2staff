# Aufstellungs-App

Eine kleine Webseite für das Trainerteam: Teilnahmen aus SpielerPlus importieren, Trainingspräsenz ansehen und Aufstellungen für das nächste Spiel per Drag & Drop erstellen.

## Ausprobieren ohne Einrichtung

Öffne `index.html` direkt im Browser (Doppelklick). Solange in `config.js` nichts eingetragen ist, läuft die App im **Demo-Modus**: Alles funktioniert, aber die Daten bleiben nur in deinem Browser.

## Einrichtung für das ganze Trainerteam (ca. 20–30 Minuten)

### 1. Supabase-Projekt anlegen (Datenbank und Login)

1. Auf [supabase.com](https://supabase.com) ein kostenloses Konto erstellen.
2. **New project** anlegen. Name z.B. `aufstellung`, ein sicheres Datenbank-Passwort wählen (gut aufbewahren, wird im Alltag aber nicht gebraucht), Region in Europa wählen (z.B. Frankfurt oder Zürich, falls angeboten).
3. Warten, bis das Projekt bereit ist (1–2 Minuten).

### 2. Datenbank einrichten

1. Links auf **SQL Editor** gehen.
2. Den ganzen Inhalt von `supabase.sql` hineinkopieren und **Run** klicken. Es sollte „Success“ erscheinen.

### 3. Registrierung sperren

Damit sich niemand selbst ein Konto anlegen kann:

1. **Authentication** → **Sign In / Providers** (je nach Version auch unter *Settings*).
2. **Allow new users to sign up** ausschalten und speichern.
3. Kontrollieren, dass der Provider **Email** eingeschaltet ist.

### 4. Coaches anlegen

Für jeden Coach (auch für dich):

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Als E-Mail die echte Adresse eintragen oder, falls keine hinterlegt werden soll, eine Platzhalter-Adresse nach dem Muster `benutzername@scm2.invalid`. Dazu ein Startpasswort und **Auto Confirm User** anhaken.
3. Im **SQL Editor** den Coach freischalten und den Benutzernamen setzen:

```sql
select public.add_coach('cmou', 'cmou@scm2.invalid', 'Cédric Mouchous');
```

Danach meldet sich der Coach mit `cmou` und dem Startpasswort an. Unter 👤 (oben rechts) kann er Name, Benutzername und Passwort selbst ändern.

Einen Coach entfernen: unter *Users* löschen. Das Profil verschwindet automatisch mit.
Passwort vergessen: unter *Users* den Coach löschen, neu anlegen und `add_coach` erneut ausführen.

### 5. Zugangsdaten in `config.js` eintragen

1. In Supabase auf **Project Settings** → **API** (bzw. **API Keys**) gehen.
2. Die **Project URL** und den **anon public** bzw. **publishable** Schlüssel in `config.js` unter `environments.live` eintragen.
3. Bei `hosts` die Adresse deiner GitHub-Seite ohne `https://` eintragen, z.B. `"dein-name.github.io"`.

**Wichtig:** Niemals den Schlüssel *service_role* bzw. *secret* verwenden. Der anon-Schlüssel darf öffentlich sein, weil die Datenbank nur eingeloggten, freigeschalteten Coaches etwas zeigt.

### 6. Auf GitHub veröffentlichen

1. Auf [github.com](https://github.com) ein Konto erstellen und ein **neues Repository** anlegen, z.B. `aufstellung`, Sichtbarkeit **Public**. (GitHub Pages ist mit privaten Repos nur im bezahlten Abo möglich. Das ist hier kein Problem: Im Repo liegt nur der Code, keine Spielerdaten.)
2. **Add file** → **Upload files** und diese Dateien hochladen: `index.html`, `app.js`, `styles.css`, `config.js` (mit deinen Werten). Die Dateien `supabase.sql` und `README.md` sind optional.
3. **Settings** → **Pages** → bei *Source* **Deploy from a branch** wählen, Branch **main**, Ordner **/ (root)**, speichern.
4. Nach 1–2 Minuten ist die App erreichbar unter `https://DEIN-NAME.github.io/aufstellung/`. Diesen Link an die Coaches schicken.

**Alternativ GitLab:** Projekt anlegen (darf dort auch privat sein), alle Dateien inklusive `.gitlab-ci.yml` hochladen. Die Seite wird automatisch gebaut; den Link findest du unter **Deploy** → **Pages**.

## Im Alltag

1. **Trainings:** Nach dem Training in SpielerPlus die Teilnahmen des Termins als CSV exportieren und im Tab **Import** hochladen. Wer in der CSV steht, war dabei. Mehrere Dateien auf einmal gehen auch.
2. **Spiel:** Nach Ablauf der Abstimmzeit die Teilnahmen des Spiels exportieren und hochladen. Wird ein Termin erneut importiert, ersetzt der neue Stand den alten.
3. **Ab und zu (z.B. monatlich):** Den Statistik-Export über einen längeren Zeitraum hochladen. Er enthält auch Absagen, Unsichere und Absences und füllt Lücken.
4. Im Tab **Spieler** einmalig Namen, Spitznamen und Positionen ergänzen.
5. Im Tab **Aufstellung** eine neue Aufstellung erstellen, Formation wählen und Spieler aufs Feld ziehen. Eine leere Position antippen zeigt zuerst die Spieler mit genau dieser Position, dann die, die sie zusätzlich abdecken. Einen Spieler auf dem Feld antippen zeigt auf dieselbe Weise passende Ersatzleute; ein Tipp auf einen davon wechselt ihn ein. Am Handy: erst den Spieler antippen, dann die Position.
6. **Bild exportieren** erstellt ein PNG für den Team-Chat. Gegner, Datum und Uhrzeit lassen sich einzeln abwählen. Präsenzwerte erscheinen nie im Bild.

### Trainingsplan

Im Tab **Trainings** stehen die Zeiträume mit den Trainingstagen (vorausgefüllt: Di + Do bis 26.10., Do bis 30.11., Mi in der Halle bis Ende Februar). Darunter sind alle Trainings aufgelistet:

- **Absagen:** Ein abgesagtes Training erscheint als grauer Punkt und zählt für niemanden.
- **Daten fehlen:** Für ein geplantes Training wurde noch nichts importiert. Entweder importieren oder absagen.
- **Spiel statt Training:** Findet an einem Trainingstag ein Spiel statt, entfällt das Training automatisch.
- **Anwesenheit:** Öffnet die Liste aller Spieler für dieses Training zum Abhaken.

### So wird die Präsenz berechnet

Gezählt werden die letzten 1 bis 4 Wochen mit Training (umschaltbar). Wochen ohne Training, etwa über Weihnachten, werden übersprungen. Trainings derselben Woche zählen gleich viel, egal an welchem Tag. Die jüngste Woche zählt am meisten, jede ältere eins weniger. Absagen, Unsichere, Absences und fehlende Antworten zählen als nicht dabei.

Nicht gezählt werden Trainings, bevor jemand zum ersten Mal reagiert hat (Neuzugänge), sowie die Zeit, in der jemand **ausser Gefecht** ist.

Ein Klick auf einen Spieler im Tab **Präsenz** öffnet seine Trainings mit Häkchen. Von Hand gesetzte Häkchen haben Vorrang vor späteren Imports und lassen sich zurücksetzen.

### Rollen und «Ausser Gefecht»

- **Rolle:** Spieler, Spielertrainer oder Trainer. Beim Trainer spielt die Präsenz keine Rolle. Das Trainerteam lässt sich in der Aufstellung mit einem Klick dazuholen, auch ohne Zusage.
- **Ausser Gefecht:** Im Tab **Präsenz** unten über «Jemanden ausser Gefecht melden»: 🩼 Lazarett oder 🏋️ Sonderaufgabe, mit eigenem Titel (z.B. «Fitnesscoach») und optionalem Comeback-Datum. In dieser Zeit zählen die Trainings nicht. Ab dem Comeback ist die Person automatisch wieder dabei und bekommt beim nächsten Spiel ein «Comeback! 🎉».

### Positionen

Pro Spieler werden die eigenen Positionen erfasst. Einige decken automatisch weitere ab, aber nur in eine Richtung: OM auch ZM und ST, DM auch ZM und IV, LM auch LF, RM auch RF, LV auch LM, RV auch RM. Ein oranger Rand auf dem Feld heisst: Weder die Position noch eine abgedeckte passt.

## Gut zu wissen

- Kostenlose Supabase-Projekte werden nach längerer Inaktivität (ca. einer Woche ohne Zugriff) pausiert. Dann im Supabase-Dashboard auf **Restore** klicken; die Daten bleiben erhalten.
- Beim Import werden nur Name, SpielerPlus-ID, Rolle und Rückmeldung gespeichert. E-Mail-Adressen und Telefonnummern aus der CSV werden verworfen.
- Wenn zwei Coaches gleichzeitig dieselbe Aufstellung bearbeiten, gewinnt die zuletzt gespeicherte Version. Am besten erstellt jeder seine eigene oder nutzt **Duplizieren**.

## Entwickeln mit Branches und Testumgebung

- **`main`** ist die Version, die alle nutzen (GitHub Pages). **`dev`** ist für Experimente.
- Die `config.js` enthält zwei Datenbanken: **live** gilt nur auf der GitHub-Adresse, **test** überall sonst. Auf der Testadresse steht oben ein gelbes **TEST**.
- Die `config.js` bleibt auf GitHub immer stehen und ist in beiden Branches gleich.

### Einmalig einrichten

1. **Test-Datenbank:** In Supabase ein zweites Projekt anlegen (z.B. `aufstellung-test`), dort `supabase.sql` ausführen, einen Test-Login anlegen und mit `add_coach` freischalten. URL und Schlüssel in `config.js` unter `environments.test` eintragen.
2. **Branch `dev`:** Auf GitHub im Repository oben links auf das Branch-Menü (`main`) klicken, `dev` eintippen und **Create branch: dev from main** wählen.
3. **Cloudflare Pages:** Auf [dash.cloudflare.com](https://dash.cloudflare.com) ein Gratis-Konto anlegen, dann **Workers & Pages** → **Create** → **Pages** → **Connect to Git** und das Repository auswählen. Bei den Build-Einstellungen kein Framework, keinen Build-Befehl und als Ausgabeordner `/` wählen. Danach bekommt jeder Branch automatisch eine eigene Vorschau-Adresse, z.B. `dev.aufstellung.pages.dev`. (Die Menüs bei Cloudflare ändern ab und zu ihre Namen; sinngemäss ist es immer «Pages-Projekt mit Git verbinden».)

### Ablauf bei einer neuen Version

1. Neue Dateien in den Branch **`dev`** hochladen (vor «Add file» oben den Branch `dev` auswählen).
2. Auf der Cloudflare-Vorschau mit der Test-Datenbank ausprobieren.
3. Braucht die Version ein Datenbank-Update, das Update-Skript zuerst in der **Test**-Datenbank ausführen.
4. Wenn alles passt: Update-Skript in der **Live**-Datenbank ausführen, dann auf GitHub **Pull requests** → **New pull request** → `dev` nach `main` → **Merge**.
