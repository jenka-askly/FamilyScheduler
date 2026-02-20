const buildSha = import.meta.env.VITE_BUILD_SHA?.trim();
const buildRun = import.meta.env.VITE_BUILD_RUN?.trim();

export const BUILD_SHA = buildSha || 'dev';
export const BUILD_RUN = buildRun || '';

const shortSha = BUILD_SHA === 'dev' ? 'dev' : BUILD_SHA.slice(0, 7);

export const BUILD_STAMP = BUILD_SHA === 'dev' || !BUILD_RUN ? 'Build: dev' : `Build: ${shortSha} • Run: ${BUILD_RUN}`;
