const { bot, controller } = require('./bot');
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

// General-use constants
const crewChannel = 'C5T1YSBK9';
const teams = ['product', 'sales', 'communications', 'customer success', 'operations'];

const askQuestions = (convo, message, user) => {
  const askForHappiness = (convo) => {
    convo.ask('How are you feeling today?', (response, convo) => {
      const happiness = parseFloat(response.text);
      if (!happiness || (happiness < 1) || (happiness > 10)) {
        convo.say('Please submit a number between 1 and 10.');
        convo.repeat();
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
          user.happiness[week] = happiness;

          controller.storage.users.save(user, (err, id) => {
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
    convo.ask('What is your team?', (response, convo) => {
      if (teams.indexOf(response.text.toLowerCase()) === -1) {
        convo.say('Your team should be one of ' + teams.join(', '));
        convo.repeat();
        convo.next();
      } else {
        controller.storage.users.get(message.user, (err, user) => {
          if (!user) {
            user = {
              id: message.user,
            };
          }
          user.team = convo.extractResponse('team').toLowerCase();
          controller.storage.users.save(user, (err, id) => {
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

  convo.on('end', (convo) => {
    if (convo.status === 'completed') {
      bot.reply(message, 'Thank you!')
    } else {
      bot.reply(message, 'OK, nevermind!');
    }
  });
}

controller.hears(['h(ello|i|owdy)'], 'direct_message,direct_mention,mention', (bot, message) => {
  bot.api.reactions.add({
    timestamp: message.ts,
    channel: message.channel,
    name: 'bhag',
  }, (err, res) => {
    if (err) {
      bot.botkit.log('Failed to add emoji reaction :(', err);
    }
  });

  controller.storage.users.get(message.user, (err, user) => {
    bot.startConversation(message, (err, convo) => {
      askQuestions(convo, message, user);
    });
  });
});

// Happiness score

controller.hears(['what is the average happiness score'], 'direct_message,direct_mention,mention', (bot, message) => {
  influx.query(`
    select mean(score) from platform_v2_staging.autogen.ratings
    where type = 'happiness'
    group by department
  `).then((result) => {
    const str = result.map(r => r.department + ': ' + r.mean).join('\n');
    bot.reply(message, str);
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

// Engagement number

controller.hears(['what is the engagement number'], 'direct_message,direct_mention,mention', (bot, message) => {
  influx.query(`
    select sum(engagement_number) FROM platform_v2_staging.autogen.saas
    where type='engagement_number_aggregate'
  `).then((result) => {
    bot.reply(message, String(result[0].sum));
  });
});

// Team

controller.hears(['what is my team'], 'direct_message,direct_mention,mention', (bot, message) => {
  controller.storage.users.get(message.user, (err, user) => {
    bot.reply(message, `Your team is ${user.team}`);
  });
});

// Cryptocurrencies

controller.hears(['(dogecoin|ether|stratis)'], 'direct_message,direct_mention,mention', (bot, message) => {
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
