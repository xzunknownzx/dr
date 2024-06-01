// services/stateMiddleware.js
const stateManager = require('./stateManager');

const attachState = async (ctx) => {
  const userId = ctx.chat.id;
  ctx.state = stateManager.getState(userId);
  ctx.setState = (state) => stateManager.setState(userId, state);
  ctx.clearState = () => stateManager.clearState(userId);
};

module.exports = attachState;
