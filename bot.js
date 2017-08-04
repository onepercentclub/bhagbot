const botkit = require('botkit');
const mongoStorage = require('botkit-storage-mongo')({
  mongoUri: process.env.MONGO_URL,
});
const apiai = require('botkit-middleware-apiai')({
  token: process.env.APIAI_TOKEN,
  skip_bot: false // or false. If true, the middleware don't send the bot reply/says to api.ai
});

const controller = botkit.slackbot({
  debug: true,
  retry: 5,
  send_via_rtm: true,
  storage: mongoStorage,
});

controller.middleware.receive.use(apiai.receive);

const bot = controller.spawn({
  token: process.env.TOKEN,
}).startRTM();

module.exports = {
  apiai,
  bot,
  controller,
};
