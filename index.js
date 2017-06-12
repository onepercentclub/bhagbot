const Botkit = require('botkit');
const os = require('os');

if (!process.env.token) {
  console.log('Error: Specify token in environment');
  process.exit(1);
}

const teams = ['product', 'businness', 'communcations', 'customer success', 'people', 'finance', 'management'];

const controller = Botkit.slackbot({
  debug: true,
});

const bot = controller.spawn({
  token: process.env.token
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
          if (!parseFloat(response.text)) {
            convo.say('Please submit a valid number');
            convo.repeat();
          } else {
            controller.storage.users.get(message.user, function(err, user) {
              if (!user) {
                user = {
                  id: message.user,
                };
              }
              user.happiness = convo.extractResponse('happiness');
              controller.storage.users.save(user, function(err, id) {
                bot.reply(message, 'Your happiness is ' + user.happiness + '.');
              });
            });
          }
          convo.next();
        }, {
          'key': 'happiness'
        }); // store the results in a field called team
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
        }); // store the results in a field called team
      } else {
        askForHappiness(convo);
      }

      convo.on('end', function(convo) {
        if (convo.status === 'completed') {
          bot.reply(message, 'Thank you!')
        } else {
          // this happens if the conversation ended prematurely for some reason
          bot.reply(message, 'OK, nevermind!');
        }
      });
    });
  });
});
