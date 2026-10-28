// Hier trägst du nach der Supabase-Einrichtung die beiden Werte ein
// (Supabase → Project Settings → API).
// Solange die Felder leer sind, läuft die App im Demo-Modus:
// Die Daten bleiben dann nur in deinem Browser.

window.APP_CONFIG = {
  supabaseUrl: "https://wcmbnmuaqqynoyauxets.supabase.co",      // z.B. "https://abcdefgh.supabase.co"
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjbWJubXVhcXF5bm95YXV4ZXRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMTA2NDksImV4cCI6MjEwODY4NjY0OX0.fUD25xv7ion2IlHBMX05oo-wMz0mVJpzmd5Y2CmK6ss",  // der lange "anon public" Schlüssel
  teamName: "SCM II",   // wird oben in der App und im Bild angezeigt

  // Startwerte für Personen, die beim ersten Import neu angelegt werden
  // (Schlüssel = SpielerPlus user_id). Später alles in der App änderbar.
  initialPlayers: {
    "4428293":  { role: "trainer", nickname: "ovr" },            // Oliver von Rickenbach
    "9450295":  { role: "spielertrainer" },                      // Cédric Mouchous
    "5186296":  { role: "spielertrainer" },                      // Pascal Hotz
    "17047099": { role: "spielertrainer", last_name: "Elezi" },  // Besir Elezi
    "4428295":  { role: "spielertrainer" }                       // Nicolas Kälin
  }
};
