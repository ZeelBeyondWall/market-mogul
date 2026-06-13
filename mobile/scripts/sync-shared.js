// Copy the canonical game engine (../shared/engine) into src/engine so the
// Expo app can import it as plain in-project files (Metro can't reliably
// resolve across the monorepo boundary when the repo path contains spaces).
// Run this after editing anything in ../shared/engine.
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '..', '..', 'shared', 'engine');
const dest = path.resolve(__dirname, '..', 'src', 'engine');

fs.mkdirSync(dest, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(src)) {
  if (!f.endsWith('.ts')) continue;
  fs.copyFileSync(path.join(src, f), path.join(dest, f));
  n++;
}
console.log(`synced ${n} engine files → src/engine`);
