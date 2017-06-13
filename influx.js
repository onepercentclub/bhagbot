const Influx = require('influx');

const database = process.env.ENVIRONMENT === 'production' ? '' : 'platform_v2_staging';

module.exports = new Influx.InfluxDB({
  database,
  host: process.env.INFLUXDB_HOST,
  password: process.env.DB_PASS,
  port: process.env.INFLUXDB_PORT,
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
