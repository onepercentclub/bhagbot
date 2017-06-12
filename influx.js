const Influx = require('influx');

module.exports = new Influx.InfluxDB({
  database: 'platform_v2_staging',
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
