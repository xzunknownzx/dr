require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const mongoose = require('mongoose');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const Settings = require('./models/Settings');

const token = process.env.TELEGRAM_BOT_TOKEN;
const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiVersion = "2024-04-01-preview";
const deployment = "ProcessorInformation1";
const mongoUri = process.env.MONGO_URI;

if (!mongoUri) {
  console.error('MongoDB URI not defined in environment variables');
  process.exit(1);
}

mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const options = {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: 'Start', callback_data: 'start' }],
      ]
    }),
    parse_mode: 'Markdown'
  };
  bot.sendMessage(chatId, `Welcome to *Tele_Translate_AI_bot*! Click *Start* to choose your language.`, options)
    .then(() => console.log(`Message sent to chatId: ${chatId}`))
    .catch((error) => {
      console.error('Failed to send start message:', error.message, error.stack);
    });
});

bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;

  if (data === 'start') {
    const options = {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [{ text: 'English', callback_data: 'en' }, { text: 'Spanish', callback_data: 'es' }, { text: 'Russian', callback_data: 'ru' }],
          [{ text: 'Chinese', callback_data: 'zh' }, { text: 'French', callback_data: 'fr' }, { text: 'Japanese', callback_data: 'ja' }],
          [{ text: 'Farsi', callback_data: 'fa' }, { text: 'German', callback_data: 'de' }, { text: 'Turkish', callback_data: 'tr' }]
        ]
      }),
      parse_mode: 'Markdown'
    };
    bot.editMessageText('Select your language:', {
      chat_id: message.chat.id,
      message_id: message.message_id,
      reply_markup: options.reply_markup
    })
    .then(() => console.log(`Language selection updated for user with chatId: ${message.chat.id}`))
    .catch((error) => {
      console.error('Failed to update language selection:', error.message, error.stack);
    });
  } else if (['en', 'es', 'ru', 'zh', 'fr', 'ja', 'fa', 'de', 'tr'].includes(data)) {
    try {
      const responseStream = await axios({
        method: 'post',
        url: `${azureEndpoint}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
        headers: {
          'Content-Type': 'application/json',
          'api-key': azureApiKey
        },
        data: {
          messages: [{ role: "system", content: `Configure translation for language: ${data}` }],
          max_tokens: 10,
          stream: true
        },
        responseType: 'stream'
      });

      let buffer = "";

      responseStream.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.trim() === '') {
            continue;
          }
          if (line.trim() === '[DONE]') {
            // End of stream
            break;
          }

          try {
            const dataString = line.replace(/^data: /, '').trim();
            const parsedData = JSON.parse(dataString);
            if (parsedData.choices && parsedData.choices[0] && parsedData.choices[0].delta && parsedData.choices[0].delta.content) {
              buffer += parsedData.choices[0].delta.content;
            }
          } catch (parseError) {
            console.error('Failed to parse data chunk:', parseError.message);
          }
        }
      });

      responseStream.data.on('end', async () => {
        // Store the language setting in MongoDB
        try {
          let user = await User.findOne({ userId: message.chat.id });
          if (!user) {
            user = new User({ userId: message.chat.id, language: data });
          } else {
            user.language = data;
          }
          await user.save();

          // Update the message with language configuration confirmation and new buttons
          const newOptions = {
            reply_markup: JSON.stringify({
              inline_keyboard: [
                [{ text: 'Join Chat', callback_data: 'join_chat' }, { text: 'Create Chat', callback_data: 'create_chat' }],
                [{ text: 'Export History', callback_data: 'export_history' }, { text: 'Clear History', callback_data: 'clear_history' }],
                [{ text: 'Settings', callback_data: 'settings' }, { text: 'Support', callback_data: 'support' }]
              ]
            }),
            parse_mode: 'Markdown'
          };

          bot.editMessageText(`Translation configured for ${data} language. How can I assist you?`, {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reply_markup: newOptions.reply_markup
          });

        } catch (dbError) {
          console.error('Error saving language setting:', dbError.message, dbError.stack);
          bot.sendMessage(message.chat.id, 'Failed to set language.');
        }
      });

      responseStream.data.on('error', (error) => {
        console.error('Stream error:', error);
      });

    } catch (error) {
      console.error('Error setting language:', error.message, error.stack);
      bot.sendMessage(message.chat.id, 'Failed to set language.');
    }
  } else if (data === 'clear_history') {
    // Clear chat history logic here
    try {
      const chatId = message.chat.id;
      const fromMessageId = message.message_id - 1; // Start deleting from one message before the current message

      for (let i = fromMessageId; i > 0; i--) {
        try {
          await bot.deleteMessage(chatId, i);
        } catch (error) {
          // If a message doesn't exist, skip it
          continue;
        }
      }

      bot.sendMessage(chatId, 'Chat history cleared.');

    } catch (error) {
      console.error('Error clearing chat history:', error.message, error.stack);
      bot.sendMessage(message.chat.id, 'Failed to clear chat history.');
    }
  }
});

module.exports = bot;
