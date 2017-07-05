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
jobs(bot, controller, influx);

///////////////////
// Conversations //
///////////////////

// Hi, Howdy, Hello, etc.
controller.hears(['Default Welcome Intent'], 'direct_message,direct_mention,mention', apiai.hears, (bot, message) => {
  // Add the bhag emoji as reaction to the message of the sender
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'bhag',
  }, (err, res) => {
    if (err) {
      bot.botkit.log('Failed to add emoji reaction :(', err);
    }
  });

  bot.reply(message, message.fulfillment.speech); // Hi, how are you?
});

// Fine and you, I'm doing great, etc.
controller.hears(['Welcome Response Intent'], 'direct_message,direct_mention,mention', apiai.hears, (bot, message) => {
  bot.reply(message, message.fulfillment.speech);
});

// My score is ...
controller.hears(['Happiness Score Personal'], 'direct_message,direct_mention,mention', apiai.hears, (bot, message) => {
  const score = message.entities.number;

  if (!score || (score < 1) || (score > 10)) {
    bot.reply('Please submit a number between 1 and 10.');
  } else {
    controller.storage.users.get(message.user, (err, user) => {
      if (!user) {
        user = {
          id: message.user,
        };
      }

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

        if (!user.team) {
          setTimeout(() => {
            bot.reply(message, 'By the way, what is your team?');
          }, 250);
        }

        bot.reply(message, 'Where you successfull in obtaining your Personal Smart Resolution?');

      });
    });
  }
});

// My team is ...
controller.hears(['Team'], 'direct_message,direct_mention,mention', apiai.hears, (bot, message) => {
  controller.storage.users.get(message.user, (err, user) => {
    if (!user) {
      user = {
        id: message.user,
      };
    }
    user.team = message.entities.team;
    controller.storage.users.save(user, (err, id) => {
      bot.reply(message, message.fulfillment.speech);
    });
  });
});

// I want to change team
controller.hears(['Change Team'], 'direct_message,direct_mention,mention', apiai.hears, (bot, message) => {
  bot.reply(message, message.fulfillment.speech);
});

controller.hears(['set.team'], '', apiai.actions, (bot, message) => {
  controller.storage.users.get(message.user, (err, user) => {
    if (!user) {
      user = {
        id: message.user,
      };
    }
    user.team = message.entities.team;
    controller.storage.users.save(user, (err, id) => {
      bot.reply(message, message.fulfillment.speech);
    });
  });
});

// Happiness score

controller.hears(['Happiness Score Team'], 'direct_message,direct_mention,mention', apiai.hears, (bot, message) => {
  const team = message.entities.team;

  influx.query(`
    select mean(score) from ratings
    where type = 'happiness' ${team ? `and department='${team}'` : ''}
  `).then((result) => {
    bot.reply(message, message.fulfillment.speech.replace('{}', result[0].mean));
  })
});

controller.hears(['what is my happiness score'], 'direct_message,direct_mention,mention', (bot, message) => {
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

// Personal resolution score

controller.hears(['yes, i have obtained my personal resolution score'], 'direct_message,direct_mention,mention', (bot, message) => {
  controller.storage.users.get(message.user, (err, user) => {
    bot.reply(message,
      `Wow, that's awesome, you are legen - wait for it - dairy!`
    );
  });
});

controller.hears(['nope, i have not obtained my personal resolution score'], 'direct_message,direct_mention,mention', (bot, message) => {
  controller.storage.users.get(message.user, (err, user) => {
    bot.reply(message,
      `Bummer, here's some inspiriation: "_do or do not; there is no try_". Go get 'em tiger!`
    );
  });
});

controller.hears(['what is my happiness score'], 'direct_message,direct_mention,mention', (bot, message) => {
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

controller.hears(['Engagement Number Aggregated'], 'direct_message,direct_mention,mention', apiai.hears, (bot, message) => {
  influx.query(`
    select sum(engagement_number) from saas
    where type='engagement_number_aggregate'
  `).then((result) => {
    bot.reply(message, message.fulfillment.speech.replace('{}', result[0].sum));
  });
});

// Team

controller.hears(['what is my team'], 'direct_message,direct_mention,mention', (bot, message) => {
  controller.storage.users.get(message.user, (err, user) => {
    bot.reply(message, `Your team is ${user.team}`);
  });
});

// Cryptocurrencies

controller.hears(['(bitcoin|dogecoin|ether|stratis)'], 'direct_message,direct_mention,mention', (bot, message) => {
  const match = message.match[1] === 'ether' ? 'ethereum' : message.match[1];
  fetch(`https://api.coinmarketcap.com/v1/ticker/${match}/?convert=EUR`)
    .then((result) => result.json())
    .then((json) => {
      bot.reply(message, `€${json[0].price_eur} (${json[0].percent_change_24h}%)`);
    });
});

// Help

controller.hears(['help'], 'direct_message,direct_mention,mention', (bot, message) => {
  bot.reply(message, `
    Howdy stranger, let me tell you the amazing stuff that I can do! Use the commands in a private message to me, or use it in a channel like so '@bhag [COMMAND]'

    - What is the engagement number?
    - What is the average happiness score?
    - What is my happiness score?
    - What is my team?
    - Hi, Howdy or Hello
     _submit your happiness score_
    - Ether, Dogecoin or Stratis
    _I will tell you the value of the cryptocoin in euros together with the change in value in the past 24h_
  `);
});

// Easter eggs

controller.hears('In a galaxy far far away', 'direct_message,direct_mention,mention', (bot, message) => {
  bot.reply(message, `
    Luke Skywalker has vanished. In his absence, the sinister FIRST ORDER has risen from the ashes of the Empire and will not rest until Skywalker, the last Jedi, has been destroyed. With the support of the REPUBLIC, General Leia Organa leads a brave RESISTANCE. She is desperate to find her brother Luke and gain his help in restoring peace and justice to the galaxy. Leia has sent her most daring pilot on a secret mission to Jakku, where an old ally has discovered a clue to Luke's whereabouts....
  `);
});
