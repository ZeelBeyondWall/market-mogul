// Standard Expo Metro config. The shared game engine is vendored into
// src/engine (synced from ../shared via `npm run sync-shared`), so there is no
// cross-package resolution to configure — everything lives inside mobile/.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
