export function readConfig() {
  const botToken = process.env.BOT_TOKEN;

  if (!botToken) {
    throw new Error('BOT_TOKEN is missing. Copy .env.example to .env and add your token from BotFather.');
  }

  return {
    botToken,
    supportUsername: process.env.SUPPORT_USERNAME || '',
    databasePath: process.env.DATABASE_PATH || './data/astrocode.sqlite',
    adminIds: process.env.ADMIN_IDS || ''
  };
}
