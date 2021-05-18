# Discord logging bot
The bot uses discord.js v12 which requires node.js v12 or newer.\
Should work on multiple servers at the same time but only one admin channel can be inputted at the moment.

## Features:
- Logs all channels that it has permissions to read
- Log organized to folders per channel, files per date
- Print given date's log from Discord
- Clear channel log from Discord
- Safety features like:
  * double checking printing to public channel
  * Logging used admin commands on non-removable log for blaming

## Config.json
```
{
  "token" : "bot_login_token",
  "prefix" : ">",
  "embedColor": "hex_color",
  "adminChannelId" : "admin-only_channel_id", (In this channel bot wont double check the print)
  "localTime" : false (Timestamps in machine's local time or UTC)
}
```

## Commands
Only admins can use commands

- help - list commands
- printlog [channel mention or id] [time in YYYY-MM-DD format] - print channel's log for given date
- clearlog [channel mention or id] - clears the channel's logs

For checking the used admin commands log print with string "admin" as channel name. Admin logs cannot be cleared\
You can replace timestamp with "all" to get all channel's logs in one file 
