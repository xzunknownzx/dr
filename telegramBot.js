require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const logger = require('./logger');
const {
  handleStart,
  handleLanguageSelection,
  handleCreateChat,
  handleJoinChat,
  handleClearHistory,
  handleMessage,
  handleLanguageChange,
  handleDialectChange,
  handleLocationChange,
  handleEndChat,
  handleKillChat
} = require('./services/chatService');

const token = process.env.TELEGRAM_BOT_TOKEN;
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  logger.error('MongoDB URI not defined in environment variables');
  process.exit(1);
}

mongoose.connect(mongoUri)
  .then(() => logger.info('MongoDB connected'))
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  logger.info('Received /start command', msg);
  handleStart(bot, msg);
});

bot.onText(/\/kill/, (msg) => {
  logger.info('Received /kill command', msg);
  handleKillChat(bot, msg);
});

bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;

  if (data === 'start') {
    handleLanguageSelection(bot, message);
  } else if (data === 'create_chat') {
    handleCreateChat(bot, message);
  } else if (data === 'join_chat') {
    handleJoinChat(bot, message);
  } else if (data === 'clear_history') {
    handleClearHistory(bot, message);
  } else if (data.startsWith('lang_')) {
    await handleLanguageChange(bot, message, data.replace('lang_', ''));
  } else if (data === 'update_dialect') {
    await bot.sendMessage(message.chat.id, 'Please enter your dialect:');
    bot.once('message', async (msg) => {
      await handleDialectChange(bot, message, msg.text);
    });
  } else if (data === 'update_location') {
    await bot.sendMessage(message.chat.id, 'Please enter your location:');
    bot.once('message', async (msg) => {
      await handleLocationChange(bot, message, msg.text);
    });
  } else if (data === 'end_chat') {
    handleEndChat(bot, message);
  }
});

bot.on('message', (msg) => handleMessage(bot, msg));

module.exports = bot;
