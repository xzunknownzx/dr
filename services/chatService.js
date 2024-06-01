const axios = require('axios');
const User = require('../models/User');
const { translateMessage } = require('./azureService');
const { saveMessage } = require('./messageService');
const logger = require('../logger');

function escapeMarkdown(text) {
  return text.replace(/([_*\[\]()~`>#+-=|{}.!])/g, '\\$1');
}

async function deleteAllMessages(bot, chatId, excludeMessageIds = []) {
  try {
    let lastMessageId = 10000; // Arbitrary large number to attempt clearing all messages

    for (let i = lastMessageId; i > 0; i--) {
      if (!excludeMessageIds.includes(i)) {
        try {
          await bot.deleteMessage(chatId, i);
        } catch (error) {
          // Ignore errors for messages that don't exist or can't be deleted
          continue;
        }
      }
    }
  } catch (error) {
    console.error('Error deleting messages:', error.message, error.stack);
  }
}

async function handleStart(bot, msg) {
  if (!msg || !msg.chat || !msg.chat.id) {
    logger.error('Invalid message object received in handleStart:', msg);
    return;
  }

  const chatId = msg.chat.id;

  // Check if user is already in a chat
  const user = await User.findOne({ userId: chatId });
  if (user && user.connectedChatId) {
    await bot.sendMessage(chatId, `You are currently in a chat. Please end the current chat before starting a new one.`);
    return;
  }

  const options = {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: 'Start', callback_data: 'start' }],
      ]
    }),
    parse_mode: 'Markdown'
  };
  await bot.sendMessage(chatId, `Welcome to *Tele_Translate_AI_bot*! Click *Start* to choose your language.`, options);
}

async function handleLanguageSelection(bot, message) {
  const options = {
    reply_markup: JSON.stringify({
      inline_keyboard: [
        [{ text: 'English', callback_data: 'lang_en' }, { text: 'Spanish', callback_data: 'lang_es' }, { text: 'Russian', callback_data: 'lang_ru' }],
        [{ text: 'Chinese', callback_data: 'lang_zh' }, { text: 'French', callback_data: 'lang_fr' }, { text: 'Japanese', callback_data: 'lang_ja' }],
        [{ text: 'Farsi', callback_data: 'lang_fa' }, { text: 'German', callback_data: 'lang_de' }, { text: 'Turkish', callback_data: 'lang_tr' }]
      ]
    }),
    parse_mode: 'Markdown'
  };
  await bot.editMessageText('Select your language:', {
    chat_id: message.chat.id,
    message_id: message.message_id,
    reply_markup: options.reply_markup
  });
}

async function handleLanguageChange(bot, message, language) {
  const userId = message.chat.id;
  const telegramName = message.chat.username || message.from.first_name || 'User';

  try {
    const responseStream = await axios({
      method: 'post',
      url: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.DEPLOYMENT}/chat/completions?api-version=${process.env.API_VERSION}`,
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.AZURE_OPENAI_API_KEY
      },
      data: {
        messages: [{ role: "system", content: `Configure translation for language: ${language}` }],
        max_tokens: 10,
        stream: true
      },
      responseType: 'stream'
    });

    let buffer = "";

    responseStream.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.trim() === '[DONE]') break;

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
      try {
        let user = await User.findOne({ userId: userId });
        if (!user) {
          user = new User({ userId, language, telegramName });
        } else {
          user.language = language;
          user.telegramName = telegramName;
        }
        await user.save();

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

        await bot.editMessageText(`Translation configured for ${language} language. How can I assist you?`, {
          chat_id: message.chat.id,
          message_id: message.message_id,
          reply_markup: newOptions.reply_markup
        });

      } catch (dbError) {
        console.error('Error saving language setting:', dbError.message, dbError.stack);
        await bot.sendMessage(message.chat.id, 'Failed to set language.');
      }
    });

    responseStream.data.on('error', (error) => {
      console.error('Stream error:', error);
    });

  } catch (error) {
    console.error('Error setting language:', error.message, error.stack);
    await bot.sendMessage(message.chat.id, 'Failed to set language.');
  }
}

async function handleCreateChat(bot, message) {
  const connectionCode = Math.random().toString(36).substr(2, 9).toUpperCase();
  const sentMessage = await bot.sendMessage(message.chat.id, `Your connection code is: ${connectionCode}`);
  await User.updateOne(
    { userId: message.chat.id },
    { connectionCode, connectionCodeExpiry: new Date(Date.now() + 10 * 60000), message_id: sentMessage.message_id },
    { upsert: true }
  );
}

function escapeMarkdown(text) {
  return text.replace(/([_*\[\]()~`>#+-=|{}.!])/g, '\\$1');
}

async function deleteAllMessages(bot, chatId, messageId) {
  try {
    for (let i = messageId; i > 0; i--) {
      try {
        await bot.deleteMessage(chatId, i);
      } catch (error) {
        // Ignore errors for messages that don't exist or can't be deleted
        continue;
      }
    }
  } catch (error) {
    console.error('Error deleting messages:', error.message, error.stack);
  }
}

async function handleJoinChat(bot, message) {
  // Edit the message to ask for the connection code and save the message ID
  const sentMessage = await bot.editMessageText('Please enter the connection code:', {
    chat_id: message.chat.id,
    message_id: message.message_id
  });

  // Update the user's message_id with the ID of the prompt message
  await User.updateOne({ userId: message.chat.id }, { message_id: sentMessage.message_id });

  // Handle the user's response with the connection code
  bot.once('message', async (msg) => {
    const enteredCode = msg.text.toUpperCase();
    const joinRequestingUser = await User.findOne({ userId: message.chat.id });
    const userToConnect = await User.findOne({ connectionCode: enteredCode, connectionCodeExpiry: { $gte: new Date() } });

    if (userToConnect) {
      // Update both users to connect each other
      await User.updateOne({ userId: msg.chat.id }, { connectedChatId: userToConnect.userId });
      await User.updateOne({ userId: userToConnect.userId }, { connectedChatId: msg.chat.id });

      // Delete all previous messages for both users
      await deleteAllMessages(bot, msg.chat.id, joinRequestingUser.message_id);
      await deleteAllMessages(bot, userToConnect.userId, userToConnect.message_id);

      const newOptions = {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'End Chat', callback_data: 'end_chat', color: 'red' }],
            [{ text: 'Settings', callback_data: 'settings' }, { text: 'Support', callback_data: 'support' }]
          ]
        },
        parse_mode: 'Markdown'
      };

      // Escape usernames
      const escapedUsername1 = escapeMarkdown(userToConnect.telegramName);
      const escapedUsername2 = escapeMarkdown(joinRequestingUser.telegramName);

      // Send new menu/message to both users
      const newMessage1 = await bot.sendMessage(msg.chat.id, `Connected to chat with user: @${escapedUsername1}`, newOptions);
      const newMessage2 = await bot.sendMessage(userToConnect.userId, `Connected to chat with user: @${escapedUsername2}`, newOptions);

      // Update message IDs for the new messages
      await User.updateOne({ userId: msg.chat.id }, { message_id: newMessage1.message_id });
      await User.updateOne({ userId: userToConnect.userId }, { message_id: newMessage2.message_id });
    } else {
      await bot.sendMessage(msg.chat.id, 'Invalid or expired connection code. Please try again.');
    }
  });
}


async function handleClearHistory(bot, message) {
  try {
    const chatId = message.chat.id;
    const fromMessageId = message.message_id - 1;

    for (let i = fromMessageId; i > 0; i--) {
      try {
        await bot.deleteMessage(chatId, i);
      } catch (error) {
        continue;
      }
    }

    await bot.sendMessage(chatId, 'Chat history cleared.');
  } catch (error) {
    logger.error('Error clearing chat history:', error.message, error.stack);
    await bot.sendMessage(message.chat.id, 'Failed to clear chat history.');
  }
}

async function handleEndChat(bot, message) {
  try {
    const user = await User.findOne({ userId: message.chat.id });
    if (user && user.connectedChatId) {
      const connectedUser = await User.findOne({ userId: user.connectedChatId });
      if (connectedUser) {
        await User.updateOne({ userId: connectedUser.userId }, { connectedChatId: null });
        await bot.sendMessage(connectedUser.userId, 'The chat has been ended by the other user.');
        await deleteAllMessages(bot, connectedUser.userId, connectedUser.message_id);

        const newOptions = {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Join Chat', callback_data: 'join_chat' }, { text: 'Create Chat', callback_data: 'create_chat' }],
              [{ text: 'Export History', callback_data: 'export_history' }, { text: 'Clear History', callback_data: 'clear_history' }],
              [{ text: 'Settings', callback_data: 'settings' }, { text: 'Support', callback_data: 'support' }]
            ]
          },
          parse_mode: 'Markdown'
        };

        await bot.sendMessage(connectedUser.userId, 'How can I assist you further?', newOptions);
      }

      user.connectedChatId = null;
      await user.save();
      await bot.sendMessage(message.chat.id, 'You have successfully ended the chat.');
      await deleteAllMessages(bot, message.chat.id, message.message_id);

      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Join Chat', callback_data: 'join_chat' }, { text: 'Create Chat', callback_data: 'create_chat' }],
            [{ text: 'Export History', callback_data: 'export_history' }, { text: 'Clear History', callback_data: 'clear_history' }],
            [{ text: 'Settings', callback_data: 'settings' }, { text: 'Support', callback_data: 'support' }]
          ]
        },
        parse_mode: 'Markdown'
      };

      await bot.sendMessage(message.chat.id, 'How can I assist you further?', options);

      // Clear the database (replace this with actual clearing logic)
      await clearDatabase();
    } else {
      await bot.sendMessage(message.chat.id, 'You are not currently in a chat.');
    }
  } catch (error) {
    console.error('Error ending chat:', error.message);
    await bot.sendMessage(message.chat.id, 'Failed to end chat.');
  }
}


async function handleKillChat(bot, msg) {
  try {
    const user = await User.findOne({ userId: msg.chat.id });
    if (user && user.connectedChatId) {
      const connectedUser = await User.findOne({ userId: user.connectedChatId });
      if (connectedUser) {
        await User.updateOne({ userId: connectedUser.userId }, { connectedChatId: null });
        await bot.sendMessage(connectedUser.userId, 'The chat has been forcibly ended by the other user.');
      }
      user.connectedChatId = null;
      await user.save();
      await bot.sendMessage(msg.chat.id, 'You have forcibly ended the chat.');

      const options = {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Join Chat', callback_data: 'join_chat' }, { text: 'Create Chat', callback_data: 'create_chat' }],
            [{ text: 'Export History', callback_data: 'export_history' }, { text: 'Clear History', callback_data: 'clear_history' }],
            [{ text: 'Settings', callback_data: 'settings' }, { text: 'Support', callback_data: 'support' }]
          ]
        },
        parse_mode: 'Markdown'
      };

      try {
        await bot.editMessageText('How can I assist you further?', {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
          reply_markup: options.reply_markup
        });
      } catch (error) {
        if (error.response && error.response.body && error.response.body.error_code === 400) {
          console.warn('Message to edit not found. Sending a new message instead.');
          await bot.sendMessage(msg.chat.id, 'How can I assist you further?', { reply_markup: options.reply_markup });
        } else {
          throw error;
        }
      }
    } else {
      await bot.sendMessage(msg.chat.id, 'You are not currently in a chat.');
    }
  } catch (error) {
    console.error('Error forcibly ending chat:', error.message);
    await bot.sendMessage(msg.chat.id, 'Failed to forcibly end chat.');
  }
}

async function handleMessage(bot, msg) {
  const user = await User.findOne({ userId: msg.chat.id });
  if (user && user.connectedChatId) {
    const targetUser = await User.findOne({ userId: user.connectedChatId });
    if (targetUser) {
      try {
        const translatedText = await translateMessage(msg.text, user, targetUser);
        await bot.sendMessage(targetUser.userId, translatedText);
        await saveMessage(user.connectedChatId, msg.chat.id, msg.text, translatedText);
      } catch (error) {
        logger.error('Error translating message:', error.message, error.stack);
      }
    }
  }
}

async function handleDialectChange(bot, message, dialect) {
  try {
    const user = await User.findOne({ userId: message.chat.id });
    if (user) {
      user.dialect = dialect;
      await user.save();
      await bot.sendMessage(message.chat.id, `Dialect updated to ${dialect}.`);
    } else {
      await bot.sendMessage(message.chat.id, `User not found.`);
    }
  } catch (error) {
    logger.error('Error updating dialect:', error.message);
    await bot.sendMessage(message.chat.id, 'Failed to update dialect.');
  }
}

async function handleLocationChange(bot, message, location) {
  try {
    const user = await User.findOne({ userId: message.chat.id });
    if (user) {
      user.location = location;
      await user.save();
      await bot.sendMessage(message.chat.id, `Location updated to ${location}.`);
    } else {
      await bot.sendMessage(message.chat.id, `User not found.`);
    }
  } catch (error) {
    logger.error('Error updating location:', error.message);
    await bot.sendMessage(message.chat.id, 'Failed to update location.');
  }
}

async function clearDatabase() {
  try {
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await Settings.deleteMany({});
    console.log('Database cleared.');
  } catch (error) {
    console.error('Error clearing database:', error.message, error.stack);
  }
}


module.exports = {
  handleStart,
  handleLanguageSelection,
  handleCreateChat,
  handleJoinChat,
  handleClearHistory,
  handleKillChat,
  handleEndChat,
  handleMessage,
  handleLanguageChange,
  clearDatabase
};