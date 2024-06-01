// services/stateManager.js
const states = {};

const getState = (userId) => states[userId] || {};
const setState = (userId, state) => {
  states[userId] = { ...getState(userId), ...state };
};

const clearState = (userId) => {
  delete states[userId];
};

module.exports = {
  getState,
  setState,
  clearState,
};
