# bhagbot

## Installation
```
~ EXPORT APIAI_TOKEN=[API AI TOKEN]
~ EXPORT DB_PASS=[INFLUX PASSWORD]
~ EXPORT INFLUXDB_HOST=[HOST] _default is localhost_
~ EXPORT INFLUXDB_PORT=[PORT] _default is 8086_
~ EXPORT INFLUXDB_PROTOCOL=[PROTOCOL] _default is http_
~ EXPORT MONGO_URL=[MONGO URL]
~ EXPORT TOKEN=[SLACKBOT TOKEN]
~ yarn
```

If you want to run in production, also run `EXPORT NODE_ENV=production`

And then run `node .` in the project folder.
