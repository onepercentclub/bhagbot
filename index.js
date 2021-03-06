const { apiai, bot, controller } = require('./bot');
const currentWeekNumber = require('current-week-number');
const fetch = require('node-fetch');
const influx = require('./influx');
const jobs = require('./jobs');

// No token, no bot
if (!process.env.TOKEN) {
  console.log('Error: Specify token in environment');
  process.exit(1);
}

// Set up the scheduled jobs
// jobs(bot, controller, influx);

// Teams
const teams = [
  'business',
  'communications',
  'customer success',
  'operations',
  'product',
];

///////////////////
// Conversations //
///////////////////

// Basic flow:
// Default Welcome Intent -> Happiness Score Personal -> Team
//                                                    -> PSR Not Obtained
//                                                    -> PSR Obtained

// Hi, Howdy, Hello, etc.
controller.hears(['Default Welcome Intent'], 'direct_message,direct_mention', apiai.hears, (bot, message) => {
  // Add the bhag emoji as reaction to the message of the sender
  bot.api.reactions.add({
    channel: message.channel,
    name: 'bhag',
    timestamp: message.ts,
  }, (err, res) => {
    if (err) {
      bot.botkit.log('Failed to add emoji reaction :(', err);
    }
  });

  bot.reply(message, message.fulfillment.speech); // Hi, how are you?
});

// Fine and you, I'm doing great, etc.
controller.hears(['Welcome Response Intent'], 'direct_message,direct_mention', apiai.hears, (bot, message) => {
  bot.reply(message, message.fulfillment.speech);
});

// My score is ...
controller.hears(['Happiness Score Personal'], 'direct_message,direct_mention', apiai.hears, (bot, message) => {
  const score = message.entities.number;

  if (!score || (score < 1) || (score > 10)) {
    bot.reply(message, 'Please submit a number between 1 and 10.');
  } else {
    controller.storage.users.get(message.user, (err, user = { id: message.user }) => {
      const week = currentWeekNumber();

      if (!user.happiness) {
        user.happiness = {};
      }
      user.happiness[week] = score;

      controller.storage.users.save(user, (err, id) => {
        const r = Math.floor(Math.random() * message.fulfillment.messages.length);
        const reply = message.fulfillment.messages[r];

        if (score > 6) {
          bot.reply(message, reply.payload.high);
        } else {
          bot.reply(message, reply.payload.low);
        }

        setTimeout(() => {
          if (!user.team) {
            bot.reply(message, 'By the way, what is your team?');
          } else if (!user.psrObtained) {
            bot.reply(message, 'Where you successfull in obtaining your Personal Smart Resolution?');
          } else {
            bot.reply(message, `Woop woop, you've already obtained your Personal Smart Resolution. Me so proud!`);
          }
        }, 250);
      });
    });
  }
});

// My team is ...
controller.hears(['Team'], 'direct_message,direct_mention', apiai.hears, (bot, message) => {
  controller.storage.users.get(message.user, (err, user = { id: message.user }) => {
    const team = message.entities.team.toLowerCase();

    if (teams.indexOf(team) === -1) {
      bot.reply(message, `Your team should be one of ${teams.join(', ')}`);
    } else {
      user.team = team;
      controller.storage.users.save(user, (err, id) => {
        bot.reply(message, message.fulfillment.speech);
      });
    }
  });
});

// I want to change team
controller.hears(['Change Team'], 'direct_message,direct_mention', apiai.hears, (bot, message) => {
  bot.reply(message, message.fulfillment.speech);
});

// Happiness score
controller.hears(['Happiness Score Team'], 'direct_message,direct_mention', apiai.hears, (bot, message) => {
  const team = message.entities.team;

  influx.query(`
    select mean(score) from ratings
    where type = 'happiness' ${team ? `and department='${team}'` : ''}
  `).then((result) => {
    bot.reply(message, message.fulfillment.speech.replace('{}', result[0].mean));
  })
});

// Personal resolution score
controller.hears(['PSR Obtained'], 'direct_message,direct_mention', apiai.hears, (bot, message) => {
  controller.storage.users.get(message.user, (err, user = { id: message.user }) => {
    user.psrObtained = true;
    controller.storage.users.save(user, (err, id) => {
      bot.reply(message, message.fulfillment.speech);
    });
  });
});

controller.hears(['PSR Not Obtained'], 'direct_message,direct_mention', apiai.hears, (bot, message) => {
  controller.storage.users.get(message.user, (err, user = { id: message.user }) => {
    user.psrObtained = false;
    controller.storage.users.save(user, (err, id) => {
      bot.reply(message, message.fulfillment.speech);
    });
  });
});

controller.hears(['PSR Obtained Revert'], 'direct_message,direct_mention', apiai.hears, (bot, message) => {
  controller.storage.users.get(message.user, (err, user = { id: message.user }) => {
    user.psrObtained = false;
    controller.storage.users.save(user, (err, id) => {
      bot.reply(message, message.fulfillment.speech);
    });
  });
});

controller.hears(['what is my happiness score'], 'direct_message,direct_mention', (bot, message) => {
  controller.storage.users.get(message.user, (err, user) => {
    const week = currentWeekNumber();
    const happiness = user.happiness[week];

    if (happiness < 5) {
      bot.reply(message,
        `Ah bummer, your happiness this week was ${happiness}. Cheer up, every cloud has a silver lining!
      `);
    } else if (happiness < 7) {
      bot.reply(message,
        `Close to a 7, but there's room for improvement. Your happiness this week was ${happiness}
      `);
    } else {
      bot.reply(message,
        `That's what I'm talking about! With a happiness of ${happiness} this week, I'm sure that next week will be a good one as well!
      `);
    }
  });
});

// Engagement number
controller.hears(['Engagement Number Aggregated'], 'direct_message,direct_mention', apiai.hears, (bot, message) => {
  influx.query(`
    select sum(engagement_number) from saas
    where type='engagement_number_aggregate'
  `).then((result) => {
    bot.reply(message, message.fulfillment.speech.replace('{}', result[0].sum));
  });
});

// Team
controller.hears(['what\'s my team', 'what is my team'], 'direct_message,direct_mention', (bot, message) => {
  controller.storage.users.get(message.user, (err, user) => {
    bot.reply(message, `Your team is ${user.team}`);
  });
});

// Help
controller.hears(['help'], 'direct_message,direct_mention', (bot, message) => {
  bot.reply(message, `
    Hey you! Let me tell you the amazing stuff that I can do! Say it in a private message, or use it in a channel like so '@bhag [COMMAND]'

    *Questions*
    - What is the engagement number?
    - What is the happiness score (of the X team)?
    - What is my team?

    *Actions*
    - Hi, Howdy or Hello _submit your happiness score and whether or not you've obtained your PSR_
    - I want to change teams _that says it all right?_
    - I did not obtain my PSR _if you've accidentally said that you did_
  `);
});

// Easter eggs
controller.hears('In a galaxy far far away', 'direct_message,direct_mention', (bot, message) => {
  bot.api.reactions.add({
    channel: message.channel,
    name: 'r2d2',
    timestamp: message.ts,
  }, (err, res) => {
    if (err) {
      bot.botkit.log('Failed to add emoji reaction :(', err);
    }
  });

  bot.reply(message, `
    Luke Skywalker has vanished. In his absence, the sinister FIRST ORDER has risen from the ashes of the Empire and will not rest until Skywalker, the last Jedi, has been destroyed. With the support of the REPUBLIC, General Leia Organa leads a brave RESISTANCE. She is desperate to find her brother Luke and gain his help in restoring peace and justice to the galaxy. Leia has sent her most daring pilot on a secret mission to Jakku, where an old ally has discovered a clue to Luke's whereabouts....
  `);
});

// Cryptocurrencies
controller.hears(['(bitcoin|dogecoin|ether|stratis)'], 'direct_message,direct_mention', (bot, message) => {
  const match = message.match[1] === 'ether' ? 'ethereum' : message.match[1];
  fetch(`https://api.coinmarketcap.com/v1/ticker/${match}/?convert=EUR`)
    .then((result) => result.json())
    .then((json) => {
      bot.reply(message, `€${json[0].price_eur} (${json[0].percent_change_24h}%)`);
    });
});


// Fallback
controller.hears('.*', 'direct_message,direct_mention', (bot, message) => {
  bot.reply(message, message.fulfillment.speech);
});
