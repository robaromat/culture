// Génère les icônes de l'app (PNG) à partir d'un dessin SVG : trois livres sur une étagère, fond bordeaux.
// Usage : node scripts/icons.mjs   (les PNG sont versionnés dans public/icons, à relancer seulement si le dessin change)
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const BG = '#74303A';
const PAPER = '#F7F2E9';
const ROSE = '#E8D3CC';

// Dessin dans un carré 100×100, centré sur la zone utile.
const art = `
  <rect x="25" y="22" width="13" height="50" rx="2" fill="${PAPER}"/>
  <rect x="27.5" y="30" width="8" height="2.2" rx="1" fill="${BG}" opacity=".45"/>
  <rect x="41" y="27" width="13" height="45" rx="2" fill="${ROSE}"/>
  <rect x="43.5" y="35" width="8" height="2.2" rx="1" fill="${BG}" opacity=".45"/>
  <g transform="rotate(-14 64 72)"><rect x="58" y="25" width="13" height="47" rx="2" fill="${PAPER}"/>
  <rect x="60.5" y="33" width="8" height="2.2" rx="1" fill="${BG}" opacity=".45"/></g>
  <rect x="20" y="73.5" width="60" height="4" rx="2" fill="${PAPER}" opacity=".85"/>`;

/** rounded : coins arrondis (icône « any ») ; scale : réduction du dessin (zone de sécurité des icônes « maskable »). */
const svg = ({ rounded, scale }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" ${rounded ? 'rx="22"' : ''} fill="${BG}"/>
  <g transform="translate(50 50) scale(${scale}) translate(-50 -50)">${art}</g></svg>`;

mkdirSync('public/icons', { recursive: true });
const out = [
  ['icon-192.png', 192, { rounded: true, scale: 1 }],
  ['icon-512.png', 512, { rounded: true, scale: 1 }],
  ['maskable-512.png', 512, { rounded: false, scale: 0.72 }],
  ['apple-touch-icon.png', 180, { rounded: false, scale: 0.9 }],
];
for (const [name, size, opts] of out) {
  await sharp(Buffer.from(svg(opts))).resize(size, size).png({ compressionLevel: 9 }).toFile(`public/icons/${name}`);
  console.log('✓', name);
}
writeFileSync('public/favicon.svg', svg({ rounded: true, scale: 1 }).replace(/\n\s*/g, ''));
console.log('✓ favicon.svg');
