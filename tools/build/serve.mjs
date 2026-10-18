// Простейший статический сервер для локального просмотра сайта.
//
//   npm run serve   →   http://localhost:5173
//
// Нужен только для разработки: на хостинге достаточно отдать содержимое web/.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB = path.join(ROOT, 'web');
const PORT = Number(process.env.PORT || 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let filePath = path.join(WEB, urlPath === '/' ? 'index.html' : urlPath);

    // Защита от выхода за пределы папки web/.
    if (!filePath.startsWith(WEB)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    let info;
    try {
      info = await stat(filePath);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Не найдено');
      return;
    }
    if (info.isDirectory()) filePath = path.join(filePath, 'index.html');

    const body = await readFile(filePath);
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type }).end(body);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }).end(String(err.message));
  }
});

server.listen(PORT, () => {
  console.log(`Сайт доступен по адресу: http://localhost:${PORT}`);
});
