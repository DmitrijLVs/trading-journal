// Дев-сервер ходит в API платформы через прокси: гейтвей не отвечает на
// CORS, а куки авторизации host-only — фронт и API должны быть одного
// происхождения (в проде их разводит по префиксам edge-прокси, Caddy).
// Другой стенд: API_TARGET=https://host npm start.
const target = process.env['API_TARGET'] ?? 'https://165.245.248.24';

// Префиксы API как на edge. Регулярки, а не строки: `/account` не должен
// цеплять маршрут приложения `/accounts`.
const prefixes = ['account', 'exchange', 'journal', 'stats', 'payment', 'config', 'healthcheck', 'ws'];

export default Object.fromEntries(
  prefixes.map((prefix) => [
    `^/${prefix}(/|\\?|$)`,
    // Стенд на самоподписанном сертификате Caddy — проверку TLS не делаем.
    { target, secure: false, changeOrigin: true, ws: prefix === 'ws' },
  ]),
);
