// Дев-сервер ходит в API платформы через прокси: гейтвей не отвечает на
// CORS, а куки авторизации host-only — фронт и API должны быть одного
// происхождения (в проде их разводит по префиксам edge-прокси, Caddy).
// Другой стенд: API_TARGET=https://host npm start. Тот же список и адрес
// берёт прод-сервер (prod-server.mjs).
export const target = process.env['API_TARGET'] ?? 'https://165.245.248.24';

// Префиксы API как на edge. Регулярки, а не строки: `/account` не должен
// цеплять маршрут приложения `/accounts`.
export const prefixes = ['account', 'exchange', 'journal', 'stats', 'payment', 'config', 'healthcheck', 'ws'];

export default {
  ...Object.fromEntries(
    prefixes.map((prefix) => [
      `^/${prefix}(/|\\?|$)`,
      // Стенд на самоподписанном сертификате Caddy — проверку TLS не делаем.
      { target, secure: false, changeOrigin: true, ws: prefix === 'ws' },
    ]),
  ),
  // «Разбор от ИИ» отвечает сам дев-сервер — тем же модулем, что и прод-сервер.
  // Ключ: ANTHROPIC_API_KEY=… npm start. Ответ уже записан — Vite дальше не идёт.
  '^/ai(/|\\?|$)': {
    target,
    bypass: async (req, res) => {
      const { handleAiRequest } = await import('./server/ai-review.mjs');
      if (res) await handleAiRequest(req, res, target);
      return req.url;
    },
  },
};
