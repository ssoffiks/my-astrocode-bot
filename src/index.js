import 'dotenv/config';
import { initDb } from './db.js';
import { readConfig } from './config.js';
import { createBot } from './bot.js';

const config = readConfig();
initDb(config.databasePath);

const bot = createBot(config);

await bot.telegram.setMyCommands([
  { command: 'start', description: 'собрать мини-астропрофиль' },
  { command: 'profile', description: 'мой мини-профиль' },
  { command: 'compatibility', description: 'совместимость' },
  { command: 'meditation', description: 'медитация дня' },
  { command: 'channel', description: 'канал проекта' },
  { command: 'help', description: 'меню и помощь' },
  { command: 'paysupport', description: 'поддержка по оплатам' }
]);

await bot.launch();
console.log('Мой Астрокод запущен 🌙');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
