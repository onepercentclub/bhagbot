const Influx = require('influx');

const database = process.env.ENVIRONMENT === 'production' ? '' : 'platform_v2_staging';

module.exports = new Influx.InfluxDB({
  database,
  host: 'localhost',
  password: process.env.DB_PASS,
  username: 'admin',
  schema: [{
    measurement: 'ratings',
    fields: {
      score: Influx.FieldType.FLOAT,
    },
    tags: [
      'department',
      'username',
      'type',
    ],
  }],
});
