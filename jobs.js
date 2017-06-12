const currentWeekNumber = require('current-week-number');
const schedule = require('node-schedule');

module.exports = (bot, controller, influx) => {
  const rule = new schedule.RecurrenceRule();
  rule.dayOfWeek = 5;
  rule.hour = [1];

  schedule.scheduleJob(rule, () => {
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

  const influxRule = new schedule.RecurrenceRule();
  influxRule.second = [5];

  schedule.scheduleJob(influxRule, () => {
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
      const points = users.filter((user) => Boolean(user.happiness[week])).map((user) => ({
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
