// Public connection settings of the Hodhod backend.
// Both values are public by design (they are sent to every visitor's browser);
// access to data is controlled by row level security in the database.
// NEVER put a secret / service-role key or an OpenAI key in this file.
window.HODHOD_CONFIG = {
  supabaseUrl: 'https://arhmdxtclovgfwokrxob.supabase.co',
  supabaseAnonKey: 'sb_publishable_GVcfVq0yWLl-k6safBKFEg_UUoEQoSa',
}
