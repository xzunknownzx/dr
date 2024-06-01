// services/stateTransitions.js
const stateManager = require('./stateManager');

const setLanguageSelectionState = (userId) => {
  stateManager.setState(userId, { currentState: 'language_selection' });
};

const setChatCreationState = (userId) => {
  stateManager.setState(userId, { currentState: 'chat_creation' });
};

const clearUserState = (userId) => {
  stateManager.clearState(userId);
};

module.exports = {
  setLanguageSelectionState,
  setChatCreationState,
  clearUserState,
};
