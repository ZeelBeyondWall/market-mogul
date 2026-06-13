// Monorepo Metro config: bundle the shared engine that lives outside mobile/.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

// Let Metro see ../shared (game engine reused from the web client).
config.watchFolders = [path.resolve(repoRoot, 'shared')];
// Resolve node_modules from mobile/ only (avoid picking up the web client's).
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
