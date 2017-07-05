const currentWeekNumber = require('current-week-number');
const schedule = require('node-schedule');

const { apiai, bot, controller } = require('./bot');

const crewChannel = 'C63PW9UGM'; // C63PW9UGM for test channel, C02A2JZQY for crew channel, C4CF2GA91 for team-engineering

module.exports = (bot, controller, influx) => {
  // Ask question on Friday
  const friday = { dayOfWeek: 5, hour: 9, minute: 0 };
  schedule.scheduleJob({ hour: 10, minute: 0 }, () => {
    bot.api.channels.info({ channel: crewChannel }, (err, { channel }) => {
      channel.members.map(userId => {
        bot.api.users.info({ user: userId }, (err, { user }) => {
          bot.reply({ channel: userId }, `Howdy ${user.profile.first_name}! How are you feeling this week?`);
        });
      });
    });
  });

  // Sync with InFlux on Sunday
  const sunday = { dayOfWeek: 0, hour: 0, minute: 0 };
  schedule.scheduleJob(sunday, () => {
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
