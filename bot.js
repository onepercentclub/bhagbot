const Botkit = require('botkit');
const mongoStorage = require('botkit-storage-mongo')({
  mongoUri: process.env.MONGO_URL,
});

const controller = Botkit.slackbot({
  debug: true,
  storage: mongoStorage,
});

const bot = controller.spawn({
  token: process.env.TOKEN,
}).startRTM();

module.exports = {
  bot,
  controller,
};
