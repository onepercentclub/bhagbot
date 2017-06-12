const Botkit = require('botkit');
const currentWeekNumber = require('current-week-number');
const mongoStorage = require('botkit-storage-mongo')({
  mongoUri: process.env.MONGO_URL,
});

if (!process.env.TOKEN) {
  console.log('Error: Specify token in environment');
  process.exit(1);
}

const teams = ['product', 'businness', 'communications', 'customer success', 'people', 'finance', 'management'];

const controller = Botkit.slackbot({
  debug: true,
  storage: mongoStorage,
});

const bot = controller.spawn({
  token: process.env.TOKEN,
}).startRTM();

controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function(bot, message) {

  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'bhag',
  }, function(err, res) {
    if (err) {
      bot.botkit.log('Failed to add emoji reaction :(', err);
    }
  });

  controller.storage.users.get(message.user, function(err, user) {
    bot.startConversation(message, function(err, convo) {

      function askForHappiness(convo) {
        convo.ask('How are you feeling today?', function(response, convo) {
          const happiness = parseFloat(response.text);
          if (!happiness || (happiness < 1) || (happiness > 10)) {
            convo.say('Please submit a valid number');
            convo.repeat();
          } else {
            controller.storage.users.get(message.user, function(err, user) {
              if (!user) {
                user = {
                  id: message.user,
                };
              }

              const week = currentWeekNumber();

              if (!user.happiness) {
                user.happiness = {};
              }
              user.happiness[week] = happiness;

              controller.storage.users.save(user, function(err, id) {
                bot.reply(message, 'Your happiness is ' + user.happiness[week] + '.');
              });
            });
          }
          convo.next();
        }, {
          'key': 'happiness'
        });
      }

      if (!user || !user.team) {
        convo.ask('What is your team?', function(response, convo) {
          if (teams.indexOf(response.text.toLowerCase()) === -1) {
            convo.say('Your team should be one of ' + teams.join(', '));
            convo.repeat();
            convo.next();
          } else {
            controller.storage.users.get(message.user, function(err, user) {
              if (!user) {
                user = {
                  id: message.user,
                };
              }
              user.team = convo.extractResponse('team');
              controller.storage.users.save(user, function(err, id) {
                bot.reply(message, 'Got it. You are in team ' + user.team + '.');
              });
            });

            askForHappiness(convo);
            convo.next();
          }
        }, {
          'key': 'team'
        });
      } else {
        askForHappiness(convo);
      }

      convo.on('end', function(convo) {
        if (convo.status === 'completed') {
          bot.reply(message, 'Thank you!')
        } else {
          bot.reply(message, 'OK, nevermind!');
        }
      });
    });
  });
});

controller.hears(['What is my happiness'], 'direct_message,direct_mention,mention', function(bot, message) {
  const week = currentWeekNumber();

  controller.storage.users.get(message.user, function(err, user) {
    bot.reply(message, 'Your happiness this week is ' + user.happiness[week]);
  });
});

controller.hears(['What is my team'], 'direct_message,direct_mention,mention', function(bot, message) {
  controller.storage.users.get(message.user, function(err, user) {
    bot.reply(message, 'Your team is ' + user.team);
  });
});
