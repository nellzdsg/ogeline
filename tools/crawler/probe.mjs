// Сторож доступности банка ФИПИ: раз в несколько минут пробует открыть
// стартовую страницу и пишет результат в data/math/probe.log. Нужен, чтобы
// заметить момент, когда банк снова начнёт отвечать (без ручных проверок).

import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { req } from './lib/http.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOG = path.join(ROOT, 'data', 'math', 'probe.log');
const every = Number(process.env.PROBE_EVERY_MS || 180000);

for (;;) {
  const startedAt = new Date();
  let line;
  try {
    const { status, text } = await req('index.php?proj=DE0E276E497AB3784C3FC4CC20248DC0', { retries: 1 });
    line = status === 200 && /<html/i.test(text) ? 'OK' : `HTTP ${status}`;
  } catch (err) {
    line = `FAIL ${err.message}`;
  }
  await appendFile(LOG, `${startedAt.toISOString()} ${line}\n`, 'utf8');
  if (line === 'OK') break;
  await new Promise((r) => setTimeout(r, every));
}
