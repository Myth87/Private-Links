import { mkdir, readFile, writeFile } from 'node:fs/promises';

const dist = new URL('./dist/', import.meta.url);
const names = {
  'index.html': 'text/html; charset=utf-8',
  'app.js': 'text/javascript; charset=utf-8',
  'languages.js': 'text/javascript; charset=utf-8',
  'cleaner.js': 'text/javascript; charset=utf-8',
  'sw.js': 'text/javascript; charset=utf-8',
  'style.css': 'text/css; charset=utf-8',
  'manifest.webmanifest': 'application/manifest+json',
  'icon-192.png': 'image/png',
  'icon-512.png': 'image/png',
};
const assets = {};
for (const [file, type] of Object.entries(names)) {
  const binary = type === 'image/png';
  const body = await readFile(new URL(file, dist), binary ? 'base64' : 'utf8');
  assets[file] = { type, body, binary };
}
const worker = await readFile(new URL('./worker.js', import.meta.url), 'utf8');
await mkdir(new URL('./server/', dist), { recursive: true });
await writeFile(new URL('./server/index.js', dist),
  assets['cleaner.js'].body + '\nconst assets = ' + JSON.stringify(assets) + ';\n' + worker);
