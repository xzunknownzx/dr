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
const User = require('./models/User');

const token = process.env.TELEGRAM_BOT_TOKEN;
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  logger.error('MongoDB URI not defined in environment variables');
  process.exit(1);
}

mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => logger.info('MongoDB connected'))
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
  });

const bot = new TelegramBot(token, { polling: true });

async function checkAndShowStartButton(bot, chatId) {
  const user = await User.findOne({ userId: chatId });
  if (!user) {
    // User is new, show Start button
    const options = {
      reply_markup: {
        keyboard: [
          [{ text: 'Start' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true
      },
      parse_mode: 'Markdown'
    };
    await bot.sendMessage(chatId, `Welcome to *Tele_Translate_AI_bot*! Click *Start* to choose your language.`, options);
  }
}

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  logger.info(`Received /start command from chatId: ${chatId}`, msg);
  await checkAndShowStartButton(bot, chatId);
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

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  logger.info('Received message', msg);
  if (msg.text === 'Start') {
    logger.info(`Handling "Start" text message from chatId: ${chatId}`);
    await handleStart(bot, msg);
  } else {
    await handleMessage(bot, msg);
  }
});

module.exports = bot;
