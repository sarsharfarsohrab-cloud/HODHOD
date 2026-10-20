// Public connection settings of the TEST version (served at …/HODHOD/staging/).
// It uses its own, separate Supabase project, so trying things out never touches real data.
// Both values are public by design, like public/config.js. NEVER put a secret key here.
// While this still says REPLACE, the test version is simply not built.
window.HODHOD_CONFIG = {
  supabaseUrl: 'REPLACE_WITH_STAGING_PROJECT_URL',
  supabaseAnonKey: 'REPLACE_WITH_STAGING_PUBLISHABLE_KEY',
}
