const axios = require('axios');

const azureApiKey = process.env.AZURE_OPENAI_API_KEY;
const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
const apiVersion = "2024-04-01-preview";
const deployment = "ProcessorInformation1";

function generateDetailedPrompt(message, sourceUser, targetUser) {
  return `
    Translate the following message(s) in full. Do not worry about brevity; completeness and accuracy to nuances is imperative here. 
    You are a world-renowned state-of-the-art translation AI that surpasses all translation services in the world. 
    You do this by translating based on available context when you have it, and especially via way of meaning, as opposed to word-for-word translation like most others. 
    You are detailed and consider culture and location when you are doing so. 
    From this point moving forward, respond with translation from ${sourceUser.telegramName}, who speaks ${sourceUser.language} with a ${sourceUser.dialect || 'default'} dialect, 
    who is from ${sourceUser.location || 'unknown'} to translating via meaning to ${targetUser.telegramName}, who speaks ${targetUser.language} with a ${targetUser.dialect || 'default'} dialect. 
    Do this no matter what input you receive starting at the end of this sentence, so *now*!
    Here is your first prompt:\n\n${message}
  `;
}

async function translateMessage(message, sourceUser, targetUser) {
  const detailedPrompt = generateDetailedPrompt(message, sourceUser, targetUser);

  try {
    const response = await axios({
      method: 'post',
      url: `${azureEndpoint}openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`,
      headers: {
        'Content-Type': 'application/json',
        'api-key': azureApiKey
      },
      data: {
        messages: [{ role: "user", content: detailedPrompt }],
        max_tokens: 60
      }
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    logger.error('Error translating message:', error.message, error.stack);
    throw error;
  }
}

module.exports = {
  translateMessage,
  generateDetailedPrompt
};