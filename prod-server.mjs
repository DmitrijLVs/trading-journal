// Прод-сервер (web service на DigitalOcean App Platform): отдаёт собранное SPA
// и пересылает префиксы API на гейтвей — то же, что proxy.conf.mjs в деве.
// Гейтвей не обрабатывает CORS и ставит host-only куки, поэтому браузер ходит
// только сюда. Без зависимостей: после сборки buildpack выкидывает devDependencies.
//
//   npm run build && npm run serve:prod      PORT и API_TARGET — из окружения
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, sep } from 'node:path';
import { prefixes, target } from './proxy.conf.mjs';

const ROOT = join(import.meta.dirname, 'dist/trading-journal/browser');
const INDEX = join(ROOT, 'index.html');
const PORT = Number(process.env['PORT'] ?? 8080);

const upstream = new URL(target);
const send = upstream.protocol === 'https:' ? httpsRequest : httpRequest;
const API_PATH = new RegExp(`^/(${prefixes.join('|')})(/|\\?|$)`);

/** Заголовки одного соединения — дальше прокси их не передаёт. */
const HOP_BY_HOP = [
  'connection',
  'keep-alive',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

/** Бандлы с хэшем в имени (outputHashing: all) не меняются — кэш на год. */
const HASHED = /-[A-Z0-9]{8}\.(js|css)$/;

// ── API ──────────────────────────────────────────────────────────────────────

function upstreamOptions(req, headers) {
  return {
    hostname: upstream.hostname,
    port: upstream.port || undefined,
    method: req.method,
    path: req.url,
    // Caddy стенда отвечает только своему адресу; SNI по IP не отправляется —
    // его подставляет default_sni Caddy.
    headers: { ...headers, host: upstream.host },
    // Стенд на самоподписанном сертификате Caddy — как secure: false в деве.
    rejectUnauthorized: false,
  };
}

function withoutHopByHop(headers, keep = []) {
  const out = { ...headers };
  for (const name of HOP_BY_HOP) if (!keep.includes(name)) delete out[name];
  return out;
}

function proxy(req, res) {
  const upstreamReq = send(upstreamOptions(req, withoutHopByHop(req.headers)), (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode ?? 502, withoutHopByHop(upstreamRes.headers));
    upstreamRes.pipe(res);
  });
  upstreamReq.on('error', () => {
    if (res.headersSent) return res.destroy();
    res.writeHead(502, { 'content-type': 'application/json' }).end('{"error":"bad gateway"}');
  });
  res.on('close', () => {
    if (!res.writableFinished) upstreamReq.destroy();
  });
  req.pipe(upstreamReq);
}

/** WebSocket `/ws/events`: апгрейд у гейтвея, дальше — две склеенные трубы. */
function proxyUpgrade(req, socket, head) {
  const headers = {
    ...withoutHopByHop(req.headers, ['connection', 'upgrade']),
    // Origin браузера — наш домен; гейтвею показываем его собственный.
    origin: upstream.origin,
  };
  const upstreamReq = send(upstreamOptions(req, headers));
  upstreamReq.on('upgrade', (upstreamRes, upstreamSocket, upstreamHead) => {
    const lines = [`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}`];
    const raw = upstreamRes.rawHeaders;
    for (let i = 0; i < raw.length; i += 2) lines.push(`${raw[i]}: ${raw[i + 1]}`);
    socket.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (upstreamHead.length) socket.write(upstreamHead);
    if (head.length) upstreamSocket.write(head);
    upstreamSocket.on('error', () => socket.destroy());
    socket.on('error', () => upstreamSocket.destroy());
    upstreamSocket.pipe(socket).pipe(upstreamSocket);
  });
  // Гейтвей отказал без апгрейда — отдаём его статус и закрываем.
  upstreamReq.on('response', (upstreamRes) => {
    socket.end(`HTTP/1.1 ${upstreamRes.statusCode} ${upstreamRes.statusMessage}\r\n\r\n`);
    upstreamRes.resume();
  });
  upstreamReq.on('error', () => socket.destroy());
  socket.on('error', () => upstreamReq.destroy());
  upstreamReq.end();
}

// ── SPA ──────────────────────────────────────────────────────────────────────

async function fileStats(file) {
  try {
    const stats = await stat(file);
    return stats.isFile() ? stats : null;
  } catch {
    return null;
  }
}

function sendFile(req, res, file, stats) {
  const modified = stats.mtime.toUTCString();
  const headers = {
    'cache-control': HASHED.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache',
    'last-modified': modified,
    'x-content-type-options': 'nosniff',
  };
  if (req.headers['if-modified-since'] === modified) return res.writeHead(304, headers).end();
  res.writeHead(200, {
    ...headers,
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'content-length': stats.size,
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file)
    .on('error', () => res.destroy())
    .pipe(res);
}

async function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.writeHead(405, { allow: 'GET, HEAD' }).end();
  }
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://app').pathname);
  } catch {
    return res.writeHead(400).end();
  }
  const file = join(ROOT, pathname);
  const stats = file.startsWith(ROOT + sep) ? await fileStats(file) : null;
  if (stats) return sendFile(req, res, file, stats);
  // Нет файла с расширением — честный 404 (чанк прошлого релиза не должен
  // получить index.html вместо скрипта). Остальное — маршруты приложения.
  if (extname(pathname)) return res.writeHead(404).end();
  const index = await fileStats(INDEX);
  if (!index) return res.writeHead(503).end('build not found: run npm run build');
  return sendFile(req, res, INDEX, index);
}

// ── Сервер ───────────────────────────────────────────────────────────────────

const server = createServer((req, res) => {
  if (API_PATH.test(req.url ?? '')) return proxy(req, res);
  serveStatic(req, res).catch(() => {
    if (!res.headersSent) res.writeHead(500);
    res.end();
  });
});

server.on('upgrade', (req, socket, head) => {
  if (API_PATH.test(req.url ?? '')) proxyUpgrade(req, socket, head);
  else socket.destroy();
});

// Балансировщик держит соединения дольше дефолтных 5 с — иначе он изредка
// попадает в уже закрытое соединение и отдаёт 502.
server.keepAliveTimeout = 65_000;

server.listen(PORT, () => {
  console.log(`trading-journal: :${PORT}, API → ${upstream.origin}`);
});
