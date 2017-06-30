const Influx = require('influx');

const database = process.env.ENVIRONMENT === 'production' ? '' : 'platform_v2_staging';

module.exports = new Influx.InfluxDB({
  database,
  host: process.env.INFLUXDB_HOST || 'localhost',
  password: process.env.DB_PASS,
  port: process.env.INFLUXDB_PORT || '8086',
  protocol: process.env.INFLUXDB_PROTOCOL || 'http',
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
  },
  // {
  //     measurement: 'resolution_score',
  //     fields: {
  //       success: Influx.FieldType.BOOLEAN,
  //     },
  //     tags: [
  //       'username',
  //     ],
  //   }
  ],
});
