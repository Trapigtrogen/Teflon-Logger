const Discord = require("discord.js");
const config = require("./config.json");
const fs = require('fs-extra');
const moment = require('moment');
const bot = new Discord.Client({ disableMentions: 'none' });
const prefix = config.prefix;

let adminLogPath = "./logs/admin";
const helpMessage = new Discord.MessageEmbed()
.setColor(config.embedColor)
.setTitle('Bot automatically logs and organizes all of the channels it has access to')
.setDescription('Commands:')
.addFields(
	{ name: '>printlog [channel mention or id] [YYYY-MM-DD]', value: 'Prints logs for given channel for given date.\n' +
																		'Note that for the time only YYYY-MM-DD is supported (include leading 0 for single digit dates)\n' + 
																		'For admin log you can replace the channel with "admin"\n' +
																		'Replace timestamp with "all" to get all of the channel\'s logs in one file' },
	{ name: '>clearlog [channel mention or id]', value: 'Removes the channels log folder. This is _**ALL**_ logs for that channel' }
)
.setThumbnail('https://puu.sh/AZxe5.png')
.setFooter('Uses of admin commands are stored in special, non-removable logs for safety and blaming reasons');


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
function ensureFolderExists(path, mask, cb) {
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

async function fileExists(filename) {
    try {
        await fs.promises.stat(filename);
        return true;
    } catch (err) {
        if (err.code === 'ENOENT') {
            return false;
        } else {
            throw err;
        }
    }
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
	// Skip check for all
	if(timeParam == "all") return timeParam;

	if(timeParam.length != 10) return -1; // Wrong amount of characters

	// Proper check for format YYYY-MM-DD
	if(/(19|20)[0-9]{2}-((02-(0[1-9]|[1-2][0-9]))|((01|03|05|07|08|10|12)-(0[1-9]|[1-2][0-9]|3[0-1]))|((04|06|09|11)-(0[1-9]|[1-2][0-9]|30)))/.test(timeParam)) {
		return timeParam;
	}

	// At this point the value is just plain wrong. Send error code
	return -1;
}


async function writeFile( filePath, str ) {
	fs.appendFileSync(filePath, str, 'utf8', (err) => {
		if (err) {
			console.warn(err);
			if ( bot.channels.cache.get(config.errMsgChannel) ) {
				bot.channels.cache.get(config.errMsgChannel).send("Couldn't write log! Plz help :sob:");
			}
		}
	});
}

async function removeFolder(dirPath) {
	// delete directory recursively
	fs.rmdirSync(dirPath, { recursive: true }, (err) => {
		if (err) {
			console.log("Couldn't remove logs! ", err);
		}
	});
}

// Create all-in-one channel log
function combineLogs(dirPath) {
	let newPath; // Store new file path
	let newName = "combined.log";

	// Reset combined log
	newPath = dirPath + "/" + newName;
	if(fileExists(newPath)) {
		fs.unlink(newPath);
	}

	fs.readdirSync(dirPath).forEach((file) => {
		 if(file != newPath) {
			writeFile(newPath, fs.readFileSync(dirPath + "/" + file).toString());
		 }
	})
	return newPath;
}


// Write line to file
function writeLog(dirPath, filename, username, line, messageId) {
	ensureFolderExists(dirPath, 0744, function(err) {
		if (err) {
			console.log("couldn't create folder");
			return;
		}
		else {
			let str;
			if(messageId < 0) {
				str = getTime() + "\t\t" + username + ":\t\t" + line + '\n';
			}
			else {
				str = getTime() + "\t\t" + username + ":\t\t" + line + "    (messageID: " + messageId + ')\n';
			}
			writeFile(dirPath + "/" + filename, str);
		}
	});
}

// Send log file to discord
async function printLog(destination, channelId, date, usedBy) {
	let dirpath; // Store the folder path
	let fullpath; // Store filepath here
	let channelName = bot.channels.cache.get(channelId).name;

	// Normal log
	if(channelId != "admin") {
		// Mark usage of this to bot log
		writeLog(adminLogPath, getDate() + ".log", usedBy, "Printed log for: " + channelId + "-" + channelName + " dated: " + date, -1);
		// Set file paths
		dirpath = "./logs/" + channelId + "-" + channelName;
	}
	// Admin log
	else {
		// Mark usage of this to bot log
		writeLog(adminLogPath, getDate() + ".log", usedBy, "Printed admin log dated: " + date, -1);
		// Set file paths
		dirpath = "./logs/" + channelId;
	}

	// Default file
	fullpath = dirpath + "/" + date + ".log";

	// If user wants to print all logs for the channel
	if(date == "all") {
		// Get all files in folder
		fullpath = combineLogs(dirpath);
	}

	if (fileExists(fullpath)) {
		// Send as file since the logs will easily be more than 2000chars
		destination.send("Log for channel: <#" + channelId + "> dated: " + date + " UTC", { files: [fullpath] });
	}
	else destination.send("No log found for: <#" + channelId + "> dated: " + date);
}

// Remove channel's log folder
function removeLog(destination, channelId, usedBy) {
	let channelName = bot.channels.cache.get(channelId).name;
	// Normal remove
	if(channelId != "admin") {
		// Mark usage of this to bot log
		writeLog(adminLogPath, getDate() + ".log", usedBy, "Removed logs for: " + channelId + "-" + channelName, -1);
		
		try {
			removeFolder("./logs/" + channelId + "-" + channelName);
			destination.send("Logs removed for channel: <#" + channelId+ ">!");
		}
		catch (err) {
			console.warn(err);
		}
	}

	// Prevent removing admin logs
	else {
		// Mark usage of this to bot log
		writeLog(adminLogPath, getDate() + ".log", usedBy, "Tried to remove admin logs", -1);
		destination.send("Admin logs cannot be removed!");
	}
}


// General confirmation. Works with any function
function requireConfirmation(userId, destination, str, func, parameters) {
    destination.send(str)
	.then(function(msg) {
		msg.react("👍");
		msg.react("👎");
		msg.awaitReactions((reaction, user) => user.id == userId && (reaction.emoji.name == '👍' || reaction.emoji.name == '👎'),
		{ max: 1, time: 30000 }).then(collected => {
				if (collected.first().emoji.name == '👍') {
					func.apply(this, parameters); // Call the given function
				}
				else
				destination.send('Printing logs cancelled');
		}).catch(() => {
			destination.send('Timeout: Printing logs cancelled');
		});
	});
}


bot.on("ready", function() {
	// The status disappears after while for some reason
	bot.user.setActivity(`everything you do`, { type: 'WATCHING' });
	ensureFolderExists("./logs/", 0744, function(err) {
		if (err) console.warn("couldn't create folder logs")
	});
	console.log("Setup Done!");
});


bot.on("message", function(message) {
	// Ignore bot's own messages when in command mode 
	if (message.author.equals(bot.user)) return;

	// Log all user messages
	// Message can be empty if user send file (like image) with no message
	// There's no point logging the empty message
	if(message.content != "") {
		writeLog("./logs/" + message.channel + "-" + message.channel.name, getDate() + ".log", message.member.user.tag, message.content, message.id);
	}
	// Log urls for included files
	if (message.attachments.size > 0) {
		for(let i = 0; i < message.attachments.size; i++) {
			writeLog("./logs/" + message.channel + "-" + message.channel.name, getDate() + ".log", message.member.user.tag, "<" + message.attachments.array()[i].url + ">", message.id);
		}
	}

// COMMAND MODE:
	// Only continue if user is full admin
	if(message.member.hasPermission('ADMINISTRATOR')) {
		// Remove axtra spaces
		let msg = message.content.replace(/ +(?= )/g,'');
		// Put arguments on their own array
		const args = msg.split(' ').slice(1);
		if  (msg.startsWith(prefix)) {
			const command = msg.substring(1).toLowerCase().split(" ");
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
					requireConfirmation(message.author.id, message.channel, str, removeLog, [message.channel, channelId, message.member.user.tag]);
					
				break;
				
				// Don't do anything is it's not command
				default:
				return;
			};
		}
	}
});

// Log edited messages with old and new content
bot.on('messageUpdate', (oldMessage, newMessage) => {
	let str = "edited message: " + oldMessage.content + " -> " + newMessage.content;
	writeLog("./logs/" + newMessage.channel + "-" + newMessage.channel.name, getDate() + ".log", newMessage.member.user.tag, str, oldMessage.id);
});

// Log removed messages
bot.on ("messageDelete", message => {
	let str = message.member.user.tag + ": " + message.content;
	writeLog("./logs/" + message.channel + "-" + message.channel.name, getDate() + ".log", "Removed message", str, message.id);
});

bot.on('uncaughtException', (e) => console.error(e));
bot.on('error', (e) => console.error(e));
bot.on('warn', (e) => console.warn(e));
bot.login(config.token);