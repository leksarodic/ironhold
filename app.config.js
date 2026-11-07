/**
 * Dynamic Expo config.
 *
 * The static values live in app.json; this file only overrides what must differ
 * between environments. GitHub Pages serves project sites from a sub-path
 * (`/ironhold/`), so the web export needs a matching baseUrl. Local development
 * leaves GH_PAGES_BASE_URL unset and keeps serving from the root.
 */
module.exports = ({ config }) => {
  const base = process.env.GH_PAGES_BASE_URL;
  if (!base) return config;

  return {
    ...config,
    web: {
      ...config.web,
      bundler: 'metro',
    },
    experiments: {
      ...config.experiments,
      baseUrl: base.replace(/\/+$/, ''),
    },
  };
};
