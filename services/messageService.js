const Message = require('../models/Message');

async function saveMessage(conversationId, senderId, originalText, translatedText) {
  const message = new Message({
    conversationId,
    senderId,
    originalText,
    translatedText,
    timestamp: new Date()
  });

  await message.save();
}

module.exports = {
  saveMessage
};
