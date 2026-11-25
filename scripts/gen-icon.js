const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const assets = path.join(root, 'assets');
const src = path.join(assets, 'icon.svg');
const out = path.join(assets, 'icon.png');

const sizes = [16, 32, 48, 64, 128, 256, 512];
fs.mkdirSync(assets, { recursive: true });

for (const size of sizes) {
  execSync(
    `rsvg-convert -w ${size} -h ${size} -o "${assets}/icon-${size}.png" "${src}"`,
    { stdio: 'inherit' }
  );
}

execSync(`rsvg-convert -w 512 -h 512 -o "${out}" "${src}"`, { stdio: 'inherit' });
console.log('Icons generated in assets/');
