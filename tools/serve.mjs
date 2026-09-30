// Piccolo server per provare l'app sul computer: npm run serve  ->  http://localhost:8080
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const radice = join(fileURLToPath(import.meta.url), '..', '..');
const tipi = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
const porta = Number(process.env.PORT) || 8080;

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(radice, p));
    if (!file.startsWith(radice) || file.includes('/tests/') || file.includes('/.git/')) throw new Error('fuori dalla cartella');
    res.writeHead(200, { 'Content-Type': tipi[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404); res.end('Non trovato');
  }
}).listen(porta, () => console.log(`Armadio su http://localhost:${porta}`));
