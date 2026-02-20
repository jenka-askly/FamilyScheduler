export const buildInfo = {
  sha: import.meta.env.VITE_BUILD_SHA ?? 'dev',
  time: import.meta.env.VITE_BUILD_TIME ?? '',
};
