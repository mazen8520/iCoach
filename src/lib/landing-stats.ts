// Home page figures.
//
// The home page shows LIVE platform totals from the `platform_stats()` database function
// (supabase/migrations/0015_platform_stats.sql). The numbers below are PLACEHOLDERS, used only
// when the live figures can't be loaded (for example before that migration is applied); the page
// labels them "Sample figures" whenever they are shown. Edit them freely.
export const PLACEHOLDER_STATS = {
  athletes_coached: 120,
  workouts_completed: 4800,
  programs_created: 350,
} as const;

export type PlatformStats = {
  athletes_coached: number;
  workouts_completed: number;
  programs_created: number;
};
