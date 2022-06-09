# Discord logging bot
The bot uses discord.js v12 which requires node.js v12 or newer.\
Should work on multiple servers at the same time but only one admin channel can be inputted at the moment.

## Features:
- Logs all channels that it has permissions to read
- Log organized to folders per channel, files per date
- Print given date's log with Discord command
- Remove channel's log with Discord command
- Logs are separated per guild so they cannot be printed outside of the server
- Safety features:
  * Double checking printing to public channel
  * Logging used admin commands on non-removable log for blaming
  * Permissions are tied to Audit log for printing and Full admin for removing

## Config.json
```
{
  "token" : "bot_login_token",
  "prefix" : ">",
  "embedColor": "hex_color",
  "adminChannelIds" : ["channel_id", "channel_id", ...], (In these channel bot wont double check the print))
  "blackChannelIds" : ["channel_id", "channel_id", ...], (These channels won't be logged)
  "errMsgChannel" : "channel_id", (The bot will inform critical errors here)
  "localTime" : false (Timestamps in machine's local time or UTC)
}
```

## Commands
Users with audit log reading permsission can use printlog and listlogs (and help). Full admin mode needed for clearlog.
The bot will not say or do anything if anyone else tries to use them.

- help - list commands
- printlog [channel mention or id] [time in YYYY-MM-DD format] - Print channel's log for given date
- listlogs [channel mention or id] - Lists all log files for given channel
- clearlog [channel mention or id] - Clears the channel's logs

For checking the used admin commands log print with string "admin" as channel name. Admin logs cannot be cleared\
You can replace timestamp with "all" to get all channel's logs in one file 
