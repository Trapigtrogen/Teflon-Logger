const Discord = require("discord.js");
const config = require("./config.json");
const fs = require('fs-extra');
const moment = require('moment');
const bot = new Discord.Client({ disableMentions: 'none' });
const prefix = config.prefix;

let adminLogPath = "./logs/admin/";

const helpMessage = new Discord.MessageEmbed()
	.setColor(config.embedColor)
	.setTitle('Bot automatically logs and organizes all of the channels it has access to')
	.setDescription('Commands:')
	.addFields(
		{ name: '>printlog [channel mention or id] [YYYY-MM-DD]', value: 'Prints logs for given channel for given date.\n' +
																		 'Note that for the time only YYYY-MM-DD is supported (include leading 0 for single digit dates)' + 
																		 'For admin log you can replace the channel with "admin"' },
		{ name: '>clearlog [channel mention or id]', value: 'Removes the channels log folder. This is _**ALL**_ logs for that channel' }
	)
	.setThumbnail('https://puu.sh/AZxe5.png')
	.setTimestamp()
	.setFooter('Uses of admin commands are stored in special, non-removable logs for safety and blaming reasons', 'https://i.imgur.com/wSTFkRM.png');

// Get date and time. Machines local time or UTC based on config
function getDate() {
	if(config.localTime) {
		return moment().format('YYYY-MM-DD');
	}
	return moment.utc().format('YYYY-MM-DD');
}
function getTime() {
	if(config.localTime) {
		return moment().format('HH:mm:ss');
	}
	return moment.utc().format('HH:mm:ss');
}

// Checks if the folder exists and creates it if not
function ensureExists(path, mask, cb) {
    if (typeof mask == 'function') { // Allow the `mask` parameter to be optional
        cb = mask;
        mask = 0777;
    }
    fs.mkdir(path + "/", mask, function(err) {
        if (err) {
            if (err.code == 'EEXIST') cb(null); // Ignore the error if the folder already exists
            else cb(err); // Something else went wrong
        } else cb(null); // Successfully created folder
    });
}

// Check if channel parameter is valid
function checkChannelFormat(channelParam) {
	let fixedId = channelParam;

	// Remove extra characters and give number only
	// Reveals both wrong formatting and if mention was used
	fixedId = channelParam.replace(/\D/g, "");

	// channel ids are 18 characters of numbers
	if(fixedId.length == 18) return fixedId;

	// At this point the value is just plain wrong. Send error code
	return -1;
}

// Check if timeframe parameter is valid
function checkTimeFormat(timeParam) {
	if(timeParam.length != 10) return -1; // Wrong amount of characters

	if(/(19|20)[0-9]{2}-((02-(0[1-9]|[1-2][0-9]))|((01|03|05|07|08|10|12)-(0[1-9]|[1-2][0-9]|3[0-1]))|((04|06|09|11)-(0[1-9]|[1-2][0-9]|30)))/.test(timeParam)) {
		return timeParam;
	}

	// At this point the value is just plain wrong. Send error code
	return -1;
}

function writeLog(path, filename, username, line) {
	ensureExists(path, 0744, function(err) {
		if (err) {
			console.log("couldn't create folder")
			return;
		}
		else {
			fs.appendFile(path + "/" + filename, getTime() + "\t**" + username + ":**\t" + line + '\n', 'utf8', (err) => {
				if (err) {
					console.warn(err);
					if(bot.channels.cache.get(config.errMsgChannel))
						bot.channels.cache.get(config.errMsgChannel).send("Couldn't write log! Plz help :sob:");
				}
			});
		}
	});
}

function printLog(destination, channelId, date, usedBy) {
	// Separate for admin and normal
	if(channelId != "admin") {
		// Mark usage of this to bot log
		writeLog(adminLogPath, getDate() + ".log", usedBy, "Printed log for: " + channelId + "-" + bot.channels.cache.get(channelId).name + " dated: " + date);

		destination.send("printing log for channel: <#" + channelId + "> dated: " + date + " UTC");
		fs.readFile("./logs/" + channelId + "-" + bot.channels.cache.get(channelId).name + "/" + date + ".log", 'utf8', function(err, contents) {
			if(contents) destination.send(contents.toString());
			else destination.send("No channel log exists for given day");
		});
	}
	// Admin log
	else {
		writeLog(adminLogPath, getDate() + ".log", usedBy, "Printed log for: " + channelId + " dated: " + date);

		destination.send("printing admin log dated: " + date + " UTC");
		fs.readFile("./logs/" + channelId + "/" + date + ".log", 'utf8', function(err, contents) {
			if(contents) destination.send(contents.toString());
			else destination.send("No admin log exists for given day");
		});
	}
}

async function removeLog(destination, channel, usedBy) {
	if(channel == "admin") {
		writeLog(adminLogPath, getDate() + ".log", usedBy, "Printed log for: " + destination + "-" + destination.name + " dated: " + date);
		destination.send("Admin logs cannot be removed!");
	}

	// Mark usage of this to bot log
	writeLog(adminLogPath, getDate() + ".log", usedBy, "Printed log for: " + destination + "-" + destination.name + " dated: " + date);
	
	try {
		await fs.remove("./logs/" + channel + "-" + channel.name);
		destination.send("Log removed!");
	} 
	catch (err) {
		console.warn(err);
	}
}

// General confirmation. Works with any function
function requireConfirmation(userId, msgChannel, str, func, parameters) {
    msgChannel.send(str)
	.then(function(msg) {
		msg.react("👍");
		msg.react("👎");
		msg.awaitReactions((reaction, user) => user.id == userId && (reaction.emoji.name == '👍' || reaction.emoji.name == '👎'),
		{ max: 1, time: 30000 }).then(collected => {
				if (collected.first().emoji.name == '👍') {
					func.apply(this, parameters); // Call the given function
				}
				else
					msgChannel.send('Printing logs cancelled');
		}).catch(() => {
			msgChannel.send('Timeout: Printing logs cancelled');
		});
	});
}

bot.on("ready", function() {
	bot.user.setActivity(`everything you do`, { type: 3 });
	ensureExists("./logs/", 0744, function(err) {
		if (err) console.warn("couldn't create folder logs")
	});
	console.log("Setup Done!");
});


bot.on("message", function(message) {
	// Ignore bot's own messages when in command mode 
	if (message.author.equals(bot.user)) return;

	// Log all user messages
	writeLog("./logs/" + message.channel + "-" + message.channel.name, getDate() + ".log", message.member.user.tag, message.content);

// COMMAND MODE:
	// Only continue if user is full admin
	if(message.member.hasPermission('ADMINISTRATOR')) {
		// Put arguments on their own array
		const args = message.content.split(' ').slice(1);
		if  (message.content.startsWith(prefix)) {
			const command = message.content.substring(1).toLowerCase().split(" ");
			let precommand = command.shift(); // Remove the prefix as it can be changed from config
			// Variables to store fixed parameters in later
			let channelId;
			let timeFrame;
			switch(precommand) {	
				case "help":
					message.channel.send({embed:helpMessage});
				break;		

				case "printlog":
					// Printing admin is special case
					if(args[0] != "admin") { 
						// Check and fix formatting so it's possible to use mention as well
						channelId = checkChannelFormat(args[0]);
						if(channelId == -1) {
							message.channel.send("Invalid channel! Either mention the channel with *#* or give the id as number");
							return;
						}
					}
					else {
						channelId = "admin";
					}

					// Check time format: Currently only yyyy-mm-dd
					timeFrame = checkTimeFormat(args[1]);
					if(timeFrame == -1) {
						message.channel.send("Invalid time format! Only YYYY-MM-DD is supported");
						return;
					}
					
					// Prevent from accidentally showing the logs in public
					if(message.channel.id != config.adminChannelId) {
						let str = "**Heads up!**\n" + 
								  "You are trying to print logs in non-admin channel!\n" +
								  "Are you sure you want everyone to see the logs?\n" + 
								  "This will be timed out and automatically canceled after half a minute";
						requireConfirmation(message.author.id, message.channel, str, printLog, [message.channel, channelId, timeFrame, message.member.user.tag]);
					}
					else printLog(message.channel, channelId, timeFrame, message.member.user.tag);
				break;

				case "clearlog":
					// Check and fix formatting so it's possible to use mention as well
					channelId = checkChannelFormat(args[0]);
					if(channelId == -1) {
						message.channel.send("Invalid channel! Either mention the channel with *#* or give the id as number");
						return;
					}
					let str = "Are you sure you want to clear all logs for channel <#" + channelId + ">?";
					requireConfirmation(message.author.id, message.channel, str, removeLog, [message.channel, message.member.user.tag]);
					
				break;
				
				// Don't do anything is it's not command
				default:
				return;
			};
		}
	}
});

bot.on('uncaughtException', (e) => console.error(e));
bot.on('error', (e) => console.error(e));
bot.on('warn', (e) => console.warn(e));
bot.login(config.token);