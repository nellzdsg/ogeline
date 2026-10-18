// Сетевой слой для работы с открытым банком заданий ФИПИ.
//
// Особенности источника:
//  - кодировка ответов windows-1251;
//  - для списка заданий и проверки ответа нужна сессия (cookie);
//  - сервер отдаёт только листовой сертификат, без промежуточного, поэтому обычный
//    fetch в Node падает с «unable to verify the first certificate». Промежуточный
//    сертификат GlobalSign лежит в certs/ и добавляется к доверенным корням.
//    Проверка сертификата при этом не отключается.
//  - ходим не спеша, чтобы не выглядеть как атака.

import { request as httpsRequest } from 'node:https';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import tls from 'node:tls';

export const BANK = 'https://oge.fipi.ru/bank';
export const SITE = 'https://oge.fipi.ru';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const extraCa = readFileSync(new URL('../../../certs/globalsign-gcc-r3-dv-tls-ca-2020.pem', import.meta.url), 'utf8');
const CA = [...tls.rootCertificates, extraCa];

const cookies = new Map();
let lastRequestAt = 0;
const MIN_DELAY_MS = 400;

async function throttle() {
  const wait = MIN_DELAY_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

function cookieHeader() {
  return [...cookies].map(([k, v]) => `${k}=${v}`).join('; ');
}

function storeCookies(setCookie) {
  for (const raw of setCookie ?? []) {
    const [pair] = raw.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function rawRequest(url, { method, headers, body, timeout }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = httpsRequest(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method,
        headers,
        ca: CA,
        timeout,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, buffer: Buffer.concat(chunks) }),
        );
      },
    );
    req.on('timeout', () => req.destroy(new Error('таймаут соединения')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function follow(url, opts, depth = 0) {
  if (depth > 5) throw new Error('слишком много перенаправлений');
  const res = await rawRequest(url, opts);
  storeCookies(res.headers['set-cookie']);
  if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.location) {
    const next = new URL(res.headers.location, url).toString();
    return follow(next, { ...opts, method: res.status === 303 ? 'GET' : opts.method, body: res.status === 303 ? null : opts.body }, depth + 1);
  }
  return res;
}

/**
 * Выполняет запрос к банку.
 * @param {string} path абсолютный URL или путь относительно BANK
 * @param {{method?: string, form?: Record<string, string>, retries?: number, binary?: boolean, referer?: string}} opts
 */
export async function req(path, opts = {}) {
  const { method = 'GET', form = null, retries = 4, binary = false, referer } = opts;
  const url = /^https?:/.test(path) ? path : `${BANK}/${path}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    await throttle();
    try {
      const headers = {
        'User-Agent': UA,
        Referer: referer || `${BANK}/index.php`,
        'Accept-Language': 'ru-RU,ru;q=0.9',
        Accept: binary ? '*/*' : 'text/html,application/xhtml+xml',
      };
      if (cookies.size) headers.Cookie = cookieHeader();

      let body = null;
      if (form) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        body = Buffer.from(new URLSearchParams(form).toString(), 'utf8');
        headers['Content-Length'] = body.length;
      }

      const res = await follow(url, { method, headers, body, timeout: 45000 });

      if (binary) {
        return { status: res.status, buf: res.buffer, contentType: res.headers['content-type'] };
      }
      return {
        status: res.status,
        text: new TextDecoder('windows-1251').decode(res.buffer),
        contentType: res.headers['content-type'],
      };
    } catch (err) {
      if (attempt === retries) throw new Error(`Запрос не удался: ${url} (${err.message})`);
      await sleep(900 * attempt);
    }
  }
}

/** Открывает сессию для проекта — без этого список заданий пустой. */
export async function openSession(proj) {
  const { status, text } = await req(`index.php?proj=${proj}`);
  if (status !== 200) throw new Error(`Не удалось открыть сессию для ${proj}: HTTP ${status}`);
  return text;
}

/** Возвращает страницу со списком заданий по фильтру. */
export async function fetchTaskPage(proj, filter = {}) {
  const form = { search: 1, pagesize: 50, proj, ...filter };
  const { status, text } = await req('questions.php', {
    method: 'POST',
    form,
    referer: `${BANK}/index.php?proj=${proj}`,
  });
  if (status !== 200) throw new Error(`questions.php вернул HTTP ${status}`);
  return text;
}

/**
 * Спрашивает у ФИПИ, верный ли ответ. Это «оракул»: он отдаёт только вердикт.
 * @returns {Promise<boolean>} true — ответ верный
 */
export async function checkAnswer(proj, guid, answer) {
  const { text } = await req('solve.php', {
    method: 'POST',
    form: { guid, answer: String(answer), chkcode: '', ajax: 1, proj },
    referer: `${BANK}/questions.php`,
  });
  return text.trim() === '3';
}

/** Скачивает файл картинки. */
export async function fetchBinary(url) {
  return req(url, { binary: true, referer: `${BANK}/questions.php` });
}

export function sleepMs(ms) {
  return sleep(ms);
}
