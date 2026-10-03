#!/usr/bin/env node
// One editable SVG supplies the web, store, and density-specific Android artwork.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const res = 'android/app/src/main/res';
const mark = fs.readFileSync(path.join(root, 'scales-app/brand-mark.svg'), 'utf8');
const background = '<defs><linearGradient id="navy" x2="1" y2="1"><stop stop-color="#083769"/><stop offset=".55" stop-color="#032044"/><stop offset="1" stop-color="#001228"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#navy)"/>';
const full = mark.replace('  <defs>', background + '  <defs>');
async function png(source, size, destination, round) {
  let output = sharp(Buffer.from(source)).resize(size, size);
  if (round) output = output.composite([{ input: Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${round === 'circle' ? size / 2 : size * .18}" fill="white"/></svg>`), blend: 'dest-in' }]);
  fs.mkdirSync(path.dirname(path.join(root, destination)), { recursive: true });
  await output.png().toFile(path.join(root, destination));
}
(async () => {
  fs.writeFileSync(path.join(root, 'scales-app/icon.svg'), full);
  await png(full, 1024, 'assets/icon-only.png');
  await png(full, 512, 'assets/store-icon-512.png');
  await png(full, 180, 'scales-app/apple-touch-icon.png');
  await png(full, 192, 'scales-app/icon-192.png');
  await png(full, 512, 'scales-app/icon-512.png');
  const mono = mark.replace(/url\(#gold\)/g, '#ffffff').replace('stroke="#04254b"', 'stroke="none"');
  for (const [bucket, scale] of Object.entries({ ldpi: .75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
    const dir = `${res}/mipmap-${bucket}`;
    await png(full, Math.round(48 * scale), `${dir}/ic_launcher.png`, 'square');
    await png(full, Math.round(48 * scale), `${dir}/ic_launcher_round.png`, 'circle');
    await png(mark, Math.round(108 * scale), `${dir}/ic_launcher_foreground.png`);
    await png(mono, Math.round(108 * scale), `${dir}/ic_launcher_monochrome.png`);
    await png(mark, Math.round(288 * scale), `${res}/drawable-${bucket}/splash_icon.png`);
  }
  console.log('Generated browser, store, Android launcher and splash artwork.');
})().catch(error => { console.error(error); process.exitCode = 1; });
