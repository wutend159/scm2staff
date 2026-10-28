// Einstellungen der App. Diese Datei bleibt auf GitHub immer bestehen!
// Werte findest du in Supabase unter Project Settings → API Keys.

window.APP_CONFIG = {
  teamName: "SCM II",            // wird oben in der App und im Bild angezeigt
  loginDomain: "scm2.invalid",   // Platzhalter-Adressen für Logins ohne echte E-Mail

  environments: {
    // Die echte App: gilt nur auf den hier eingetragenen Adressen.
    live: {
      hosts: ["wutend159.github.io"],
      supabaseUrl: "https://wcmbnmuaqqynoyauxets.supabase.co",
      supabaseAnonKey: "sb_publishable_rRimPfc5gIbKW3p9t10nJg_zhgavZKL"
    },
    // Testumgebung: gilt überall sonst (Cloudflare-Vorschau, lokal geöffnet).
    // Leer lassen = Demo-Modus.
    test: {
      supabaseUrl: "https://gtoihxapryxssuvztusx.supabase.co",
      supabaseAnonKey: "sb_publishable_8iNNaDNNysBdnyIWBN2mWg_S8zp5PDh"
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
