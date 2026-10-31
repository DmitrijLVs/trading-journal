// «Разбор от ИИ»: POST /ai/review — короткий разбор сделки или торгового дня
// голосом тренера. Его вызывают и прод-сервер (prod-server.mjs), и dev-прокси
// (proxy.conf.mjs, через `bypass`), поэтому модуль без Angular и без состояния
// между процессами.
//
// Фронт присылает только факты, которые журнал уже посчитал по данным биржи
// (features/analytics/data/ai-facts.ts) — ключей биржи и сырой истории здесь нет.
// Сервер проверяет сессию журнала (куки → гейтвей /account/info), ограничивает
// частоту на пользователя и спрашивает Claude.
//
// Ключ: пока наш — ANTHROPIC_API_KEY из окружения (DigitalOcean → App → Settings →
// Environment Variables). Потом пользователь будет вставлять свой — тогда он
// придёт сюда из его настроек, см. `apiKeyFor`.
import Anthropic from '@anthropic-ai/sdk';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export const AI_PATH = /^\/ai(\/|\?|$)/;

const MODEL = 'claude-opus-5-5';
/** Короткий текст по готовым цифрам — низкого усилия хватает, и ответ быстрее. */
const EFFORT = 'low';
/** Ответ короткий, но мышление модели (оно всегда включено) тоже в этом бюджете. */
const MAX_TOKENS = 4000;
const MAX_BODY_BYTES = 48 * 1024;
/** Сколько разборов на пользователя в час — защита нашего ключа от перебора. */
const HOURLY_LIMIT = 40;
const KINDS = new Set(['trade', 'day']);

const SYSTEM_PROMPT = `Вы — тренер трейдера в торговом журнале ProboyScalp. Трейдер в основном скальпирует фьючерсы USDⓈ-M на Binance. Вам приходят факты одной сделки (kind = trade) или одного торгового дня (kind = day) в JSON — журнал посчитал их по данным биржи.

Напишите короткий разбор по-русски, обращаясь к трейдеру на «вы».
- Опирайтесь только на факты из JSON. Уровней, новостей, причин входа и стопов в данных нет — не выдумывайте их. Если вывод — предположение, так и скажите («похоже», «возможно»).
- Называйте конкретные цифры из фактов: деньги, проценты, минуты, число сделок.
- Оценивайте процесс, а не только результат: правила дисциплины (rules), автотеги журнала (autoTags: реванш, торговля после серии убытков, овертрейд, передержанный убыток, съедено комиссией), длительность, издержки, вход и выход относительно хода цены. Прибыльная сделка может быть плохой по процессу, убыточная — хорошей.
- priceAction: maxFavorablePct и maxAdversePct — насколько цена уходила в сторону позиции и против неё, пока позиция была открыта (по свечам таймфрейма timeframe); afterExitPct — куда цена ушла за afterExitBars свечей после выхода (плюс — в сторону позиции). Если priceAction нет — о ходе цены не рассуждайте.
- manualTags — пометки самого трейдера (сетап, стратегия, ошибка); учитывайте их.
- Без общих советов вроде «используйте стоп-лосс» или «управляйте рисками», без дисклеймеров и без советов, что покупать.

Поля ответа:
- headline: одна фраза до 70 символов — главный вывод, как пометка тренера на полях.
- review: 2–4 предложения разбора.
- actions: 1–3 конкретных действия на следующую сделку или день, каждое — одно короткое предложение.
- tone: good — процесс в порядке; mixed — есть что поправить; bad — серьёзно нарушены правила.`;

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    review: { type: 'string' },
    actions: { type: 'array', items: { type: 'string' } },
    tone: { type: 'string', enum: ['good', 'mixed', 'bad'] },
  },
  required: ['headline', 'review', 'actions', 'tone'],
  additionalProperties: false,
};

/** id пользователя → время его разборов за последний час. TODO(release): в памяти одного процесса. */
const recent = new Map();

/**
 * Обрабатывает запрос `/ai/*`. `target` — адрес гейтвея платформы (проверка
 * сессии), тот же, что у прокси API.
 */
export async function handleAiRequest(req, res, target) {
  const url = new URL(req.url ?? '/', 'http://app');
  if (url.pathname !== '/ai/review') return reply(res, 404, { error: 'not found' });
  if (req.method !== 'POST') return reply(res, 405, { error: 'method not allowed' }, { allow: 'POST' });

  const apiKey = apiKeyFor(req);
  if (!apiKey) return reply(res, 503, { error: 'ai disabled' });

  const user = await sessionUser(req, target).catch(() => undefined);
  if (user === undefined) return reply(res, 502, { error: 'bad gateway' });
  if (user === null) return reply(res, 401, { error: 'unauthorized' });
  if (!takeQuota(user)) return reply(res, 429, { error: 'ai limit' });

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return reply(res, 400, { error: 'invalid json' });
  }
  const kind = body?.kind;
  const facts = body?.facts;
  if (!KINDS.has(kind) || !facts || typeof facts !== 'object') {
    return reply(res, 400, { error: 'invalid request' });
  }

  try {
    const review = await askClaude(apiKey, kind, facts);
    if (!review) return reply(res, 422, { error: 'ai refused' });
    return reply(res, 200, review);
  } catch (error) {
    return reply(res, ...claudeFailure(error));
  }
}

/**
 * Ключ Anthropic для запроса. TODO(release): сейчас — общий из окружения; пользователь
 * будет вставлять свой (настройки → заголовок запроса), тогда он берётся здесь первым.
 */
function apiKeyFor(_req) {
  return process.env['ANTHROPIC_API_KEY'] || null;
}

async function askClaude(apiKey, kind, facts) {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 90_000 });
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // Отказ классификатора — повтор на модели, которую Anthropic советует для этой категории.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: REVIEW_SCHEMA } },
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: `kind: ${kind}\n\nФакты (JSON):\n${JSON.stringify(facts)}` },
    ],
  });
  if (response.stop_reason === 'refusal') return null;
  const text = response.content.find((block) => block.type === 'text')?.text;
  if (!text) throw new Error(`empty answer (${response.stop_reason})`);
  const parsed = JSON.parse(text);
  return {
    headline: String(parsed.headline ?? ''),
    review: String(parsed.review ?? ''),
    actions: Array.isArray(parsed.actions) ? parsed.actions.map(String).slice(0, 3) : [],
    tone: ['good', 'mixed', 'bad'].includes(parsed.tone) ? parsed.tone : 'mixed',
  };
}

/** Ошибка API Anthropic → наш ответ фронту (тексты фронт переводит сам). */
function claudeFailure(error) {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    console.error('ai: key rejected', error.status);
    return [503, { error: 'ai disabled' }];
  }
  if (error instanceof Anthropic.RateLimitError) return [429, { error: 'ai busy' }];
  if (error instanceof Anthropic.BadRequestError) {
    console.error('ai: bad request', error.message);
    return [502, { error: 'ai failed' }];
  }
  if (error instanceof Anthropic.APIError) {
    console.error('ai: api error', error.status, error.message);
    return [502, { error: 'ai failed' }];
  }
  console.error('ai: failed', error);
  return [502, { error: 'ai failed' }];
}

/**
 * Пользователь сессии по кукам браузера: гейтвей отвечает на /account/info.
 * null — сессии нет (фронт обновит её и повторит), undefined — гейтвей недоступен.
 */
function sessionUser(req, target) {
  const upstream = new URL(target);
  const send = upstream.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const check = send(
      {
        hostname: upstream.hostname,
        port: upstream.port || undefined,
        method: 'GET',
        path: '/account/info',
        headers: {
          host: upstream.host,
          cookie: req.headers['cookie'] ?? '',
          'x-from': 'BROWSER',
          accept: 'application/json',
        },
        // Стенд на самоподписанном сертификате Caddy — как у прокси API.
        rejectUnauthorized: false,
        timeout: 10_000,
      },
      (answer) => {
        let raw = '';
        answer.setEncoding('utf8');
        answer.on('data', (chunk) => (raw += chunk));
        answer.on('end', () => {
          if (answer.statusCode === 401 || answer.statusCode === 403) return resolve(null);
          if (answer.statusCode !== 200) return reject(new Error(`account/info ${answer.statusCode}`));
          try {
            const id = JSON.parse(raw)?.id;
            resolve(id ? String(id) : null);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    check.on('timeout', () => check.destroy(new Error('account/info timeout')));
    check.on('error', reject);
    check.end();
  });
}

function takeQuota(user) {
  const hourAgo = Date.now() - 3_600_000;
  const times = (recent.get(user) ?? []).filter((t) => t > hourAgo);
  if (times.length >= HOURLY_LIMIT) {
    recent.set(user, times);
    return false;
  }
  times.push(Date.now());
  recent.set(user, times);
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function reply(res, status, body, headers = {}) {
  if (res.headersSent) return;
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}
