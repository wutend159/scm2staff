// Einstellungen der App. Diese Datei bleibt auf GitHub immer bestehen!
// Werte findest du in Supabase unter Project Settings → API Keys.

window.APP_CONFIG = {
  teamName: "SCM II",            // wird oben in der App und im Bild angezeigt
  loginDomain: "scm2.invalid",   // Platzhalter-Adressen für Logins ohne echte E-Mail

  // Heimplatz (für Wetter und Karte)
  homeLocation: { name: "Chrüzegg, Menzingen", lat: 47.1777, lon: 8.5917 },

  // Offizielles Club-Widget von football.ch (Resultate + Rangliste), leer = ausgeblendet
  ifvWidgetUrl: "",

// Liga-Daten (für Spielplan-Abgleich, Tabelle und Resultate)
  leagueTeamName: "SC Menzingen II",
  leagueGroup: "Gruppe 3",
  
  environments: {
    // Die echte App: gilt nur auf den hier eingetragenen Adressen.
    live: {
      hosts: ["DEIN-NAME.github.io"],
      supabaseUrl: "https://gtoihxapryxssuvztusx.supabase.co",
      supabaseAnonKey: "sb_publishable_8iNNaDNNysBdnyIWBN2mWg_S8zp5PDh"
    },
    // Testumgebung: gilt überall sonst (Cloudflare-Vorschau, lokal geöffnet).
    // Leer lassen = Demo-Modus.
    test: {
      supabaseUrl: "",
      supabaseAnonKey: ""
    }
  },

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
