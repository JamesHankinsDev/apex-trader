/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // NOTE: there is deliberately no rewrite to the bot here. A rewrite is a
  // transparent proxy — it cannot attach the bot's API_TOKEN, so it would
  // either bypass auth or fail. app/api/bot/[...path]/route.js does the
  // proxying instead, adding the token server-side where the browser can't
  // see it. BOT_API_URL and BOT_API_TOKEN are server-only on purpose.
};

module.exports = nextConfig;
