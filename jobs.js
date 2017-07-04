const currentWeekNumber = require('current-week-number');
const schedule = require('node-schedule');

const { bot, controller } = require('./bot');

const crewChannel = 'C02A2JZQY'; // C02A2JZQY for test channel, C02A2JZQY for crew channel, C4CF2GA91 for team-engineering
const teams = ['product', 'sales', 'communications', 'customer success', 'operations'];

const askQuestions = (convo, message, user) => {
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
}

module.exports = (bot, controller, influx) => {
  // Ask question on Friday
  schedule.scheduleJob({ second: 1 }, () => {
    console.log('job running!')
    bot.api.channels.info({ channel: crewChannel }, (err,response) => {
      response.channel.members.map(userId => {
        controller.storage.users.get(userId, (err, user) => {
          bot.startPrivateConversation({ user: userId }, (err, convo) => {
            askQuestions(convo, { channel: userId }, user);
          });
        });
      });
    });
  });

  // Sync with InFlux on Sunday
  schedule.scheduleJob({ dayOfWeek: 0, hour: 0, minute: 0 }, () => {
    const week = currentWeekNumber();

    const timestamp = new Date; // get current date
    const first = timestamp.getDate() - timestamp.getDay(); // First day is the day of the month - the day of the week
    const last = first + 6; // last day is the first day + 6

    timestamp.setMilliseconds(999);
    timestamp.setSeconds(59);
    timestamp.setMinutes(59);
    timestamp.setHours(23);
    timestamp.setDate(last);

    controller.storage.users.all((err, users) => {
      const points = users.filter((user) => (user.happiness && Boolean(user.happiness[week]))).map((user) => ({
        measurement: 'ratings',
        fields: {
          score: user.happiness[week],
        },
        tags: {
          department: user.team,
          username: user.id,
          type: 'happiness',
        },
        timestamp,
      }));

      influx.writePoints(points).then((result) => {
        // Written to influx
      }).catch((err) => {
        console.log('influx err: ' + err);
      });
    });
  });
}
