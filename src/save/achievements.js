// Achievement definitions. Each `check` receives the progression summary built by
// Progress.summary() and returns true once the achievement is earned.

export const ACHIEVEMENTS = [
  { id: 'first_complete', name: 'First Light', desc: 'Complete your first level.', icon: 'star', check: (s) => s.completions >= 1 },
  { id: 'attempts_10', name: 'Warming Up', desc: 'Reach 10 total attempts.', icon: 'retry', check: (s) => s.totals.attempts >= 10 },
  { id: 'attempts_100', name: 'Determined', desc: 'Reach 100 total attempts.', icon: 'retry', check: (s) => s.totals.attempts >= 100 },
  { id: 'attempts_1000', name: 'Unbreakable Will', desc: 'Reach 1,000 total attempts.', icon: 'retry', check: (s) => s.totals.attempts >= 1000 },
  { id: 'jumps_500', name: 'Spring Loaded', desc: 'Jump 500 times.', icon: 'jump', check: (s) => s.totals.jumps >= 500 },
  { id: 'jumps_5000', name: 'Gravity Optional', desc: 'Jump 5,000 times.', icon: 'jump', check: (s) => s.totals.jumps >= 5000 },
  { id: 'deaths_1000', name: 'Pixel Dust', desc: 'Crash 1,000 times. It happens.', icon: 'skull', check: (s) => s.totals.deaths >= 1000 },
  { id: 'complete_hard', name: 'Getting Serious', desc: 'Complete a Hard level.', icon: 'hard', check: (s) => s.difficulties.hard },
  { id: 'complete_harder', name: 'Sharper Edges', desc: 'Complete a Harder level.', icon: 'harder', check: (s) => s.difficulties.harder },
  { id: 'complete_insane', name: 'Beyond Reason', desc: 'Complete an Insane level.', icon: 'insane', check: (s) => s.difficulties.insane },
  { id: 'complete_extreme', name: 'Event Horizon', desc: 'Complete an Extreme level.', icon: 'extreme', check: (s) => s.difficulties.extreme },
  { id: 'complete_all', name: 'Full Spectrum', desc: 'Complete every main level.', icon: 'crown', check: (s) => s.mainCompleted >= s.mainTotal && s.mainTotal > 0 },
  { id: 'perfect', name: 'Flawless', desc: 'Complete a level and collect all its coins in a single run.', icon: 'coin', check: (s) => s.perfectRuns >= 1 },
  { id: 'first_try', name: 'Natural Talent', desc: 'Complete a level on your very first attempt.', icon: 'bolt', check: (s) => s.firstTryCompletions >= 1 },
  { id: 'coins_1', name: 'Shiny', desc: 'Collect a secret coin.', icon: 'coin', check: (s) => s.coins >= 1 },
  { id: 'coins_all', name: 'Treasure Hunter', desc: 'Collect every secret coin.', icon: 'coin', check: (s) => s.coins >= s.coinsTotal && s.coinsTotal > 0 },
  { id: 'stars_10', name: 'Stargazer', desc: 'Earn 10 stars.', icon: 'star', check: (s) => s.stars >= 10 },
  { id: 'stars_all', name: 'Constellation', desc: 'Earn every star.', icon: 'star', check: (s) => s.stars >= s.starsTotal && s.starsTotal > 0 },
  { id: 'practice_50', name: 'Practice Run', desc: 'Complete a level in practice mode.', icon: 'flag', check: (s) => s.totals.practiceCompletions >= 1 },
  { id: 'checkpoints_100', name: 'Safety Net', desc: 'Place 100 practice checkpoints.', icon: 'flag', check: (s) => s.totals.checkpoints >= 100 },
  { id: 'editor_create', name: 'Architect', desc: 'Save a level in the editor.', icon: 'build', check: (s) => s.totals.levelsSaved >= 1 },
  { id: 'editor_verify', name: 'Verified Creator', desc: 'Beat your own level from the start in test mode.', icon: 'build', check: (s) => s.totals.levelsVerified >= 1 },
  { id: 'orbs_100', name: 'Orb Weaver', desc: 'Activate 100 orbs.', icon: 'orb', check: (s) => s.totals.orbs >= 100 },
  { id: 'playtime_1h', name: 'In The Zone', desc: 'Play for a total of one hour.', icon: 'clock', check: (s) => s.totals.playTime >= 3600 },
];

export const getAchievement = (id) => ACHIEVEMENTS.find((a) => a.id === id) || null;
