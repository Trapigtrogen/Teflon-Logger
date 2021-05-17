## Discord logging bot
---

### Features:
- Logs all channels that it has permissions to read
- Log organized to folders per channel, files per date
- Print given date's log from Discord
- Clear channel log from Discord
- Safety features like double checking printing to public channel
- 

### Config.json
```
{
  "token" : "bot_token",
  "prefix" : ">",
  "embedColor": "hex_color",
  "adminChannelId" : "admin-only_channel_id", (In this channel bot wont double check the print)
  "localTime" : false (Timestamps in machine's local time or UTC)
}
```