const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

require('./telegramBot');

app.get('/', (req, res) => {
  res.send('Tele_Translate_AI_bot is running');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});