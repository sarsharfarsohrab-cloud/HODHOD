/**
 * Switches for the introduction site. Change a value here and publish: the site follows.
 */
export const SITE_CONFIG = {
  /** Where "Start free" and "Open the app" go. */
  appUrl: 'https://app.apphodhod.com/',
  /**
   * Store pages. While a value is null the button says "Coming soon"; put the link in when the
   * app is in the store and the button becomes a real download button.
   */
  stores: {
    ios: null as string | null,
    android: null as string | null,
  },
  /** Hodhod Plus prices in euros. `available: false` shows them with "Coming soon". */
  plus: { available: false, month: 4.99, year: 29.99, lifetime: 69 },
  /**
   * The live numbers (learners, words, reviews) appear only once there are at least this many
   * learners, so the site never shows embarrassingly small numbers.
   */
  statsMinLearners: 200,
  /** Supabase: the public address and publishable key (both public by design, as in the app). */
  supabaseUrl: 'https://arhmdxtclovgfwokrxob.supabase.co',
  /** Contact e-mail in the footer; null hides it until the address exists. */
  contactEmail: 'support@apphodhod.com' as string | null,
  /**
   * Reviews from real learners only, with their permission. While the list is empty the section
   * is not shown at all. Example: { name: 'Sara', place: 'Berlin', text: '…', lang: 'fa', stars: 5 }
   */
  reviews: [] as { name: string; place: string; text: string; lang: string; stars: number }[],
}
