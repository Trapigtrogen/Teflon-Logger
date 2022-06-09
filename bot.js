const { Client, Intents } = require('discord.js');
const Discord = require('discord.js');
const config = require("./config.json");
const fs = require('fs-extra');
const moment = require('moment');
const bot = new Client({ intents: [
	Intents.FLAGS.GUILDS,
	Intents.FLAGS.GUILD_MESSAGES,
	Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
	Intents.FLAGS.DIRECT_MESSAGES,
	Intents.FLAGS.DIRECT_MESSAGE_REACTIONS
]});

// Slash commands
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { connected } = require('process');

const commands = [
	{
		name: 'help',
		description: 'Show help message'
	},
	{
		name: 'listlogs',
		description: 'List available logs for given channel',
		options: [
			{
				name: "channel",
				description: "Channel mention or ID",
				required: true,
				type: Discord.Constants.ApplicationCommandOptionTypes.CHANNEL
			}
		]
	},
	{
		name: 'printlog',
		description: 'Prints logs for given channel for given date',
		options: [
			{
				name: "channel",
				description: "Channel mention or ID",
				required: true,
				type: Discord.Constants.ApplicationCommandOptionTypes.CHANNEL
			},
			{
				name: "date",
				description: "Date for logs. Only YYYY-MM-DD format is supported!",
				required: true,
				type: Discord.Constants.ApplicationCommandOptionTypes.STRING
			}
		]
	},
	{
		name: 'clearlog',
		description: 'Remove all logs from given channel',
		options: [
			{
				name: "channel",
				description: "Channel mention or ID",
				required: true,
				type: Discord.Constants.ApplicationCommandOptionTypes.CHANNEL
			}
		]
	}
];

const rest = new REST({ version: '10' }).setToken(config.token);
(async () => {
	//try {
	//	await rest.put(
	//		Routes.applicationGuildCommands(config.application_id, config.test_guild_id),
	//		{ body: commands }
	//	);
	//	console.log('Successfully reloaded slash commands.');
	//} catch (error) {
	//	console.error(error);
	//}

	try {
		await rest.put(
			Routes.applicationCommands(config.application_id),
			{ body: commands }
		);
		console.log('Successfully reloaded slash commands.');
	} catch (error) {
		console.error(error);
	}
})();


// param_variables are user given
const logsFolder = "./logs/";
const adminLogPath = "admin/";
const combinedLogsFileName = "combined.log";

// Permissions for using commands:
// Everyone who can read audit log can use printing commands
const PRINT_PERMISSION = "VIEW_AUDIT_LOG";
// Only full admins (the 'administrator' checkbox is on) can remove logs
const EDIT_PERMISSION = "ADMINISTRATOR";


const helpMessage = {
	color: config.embedColor,
	title: 'Bot automatically logs and organizes all of the channels it has access to',
	description: 'Audit Log reading permission is needed for print and list commands. For editing you need to be full Admin\n\nCommands:',
	thumbnail: {
		url: 'https://puu.sh/AZxe5.png'
	},
	fields: [
		{ name: '>printlog [channel mention or id] [YYYY-MM-DD]', value: 'Prints logs for given channel for given date.\n' +
				'Note that for the time only YYYY-MM-DD is supported (include leading 0 for single digit dates)\n' + 
				'For admin log you can replace the channel with "admin"\n' +
				'Replace timestamp with "all" to get all of the channel\'s logs in one file' },
		{ name: '>listlogs [channel mention or id]', value: 'Lists all log files for the channel' },
		{ name: '>clearlog [channel mention or id]', value: 'Removes the channels log folder. This is _**ALL**_ logs for that channel' }
	],
	timestamp: new Date(),
	footer: {
		text: 'Uses of admin commands are stored in special, non-removable logs for safety and blaming reasons'
	}
};

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

// Check if channel parameter is valid
function checkChannelFormat(channelParam) {
	// Is the parameter given at all
	if(channelParam) {
		// Skip check for admin
		if(channelParam == "admin") return channelParam;

		// Remove extra characters and give number only
		// Reveals wrong id and changes mention to id
		let fixedId = channelParam.replace(/\D/g, "");

		// channel ids are 18 characters of numbers
		if(fixedId.length == 18) return fixedId;
	}

	// At this point the value is just plain wrong. Send error code
	return -1;
}


// Check if timeframe parameter is valid
function checkTimeFormat(timeParam) {
	// Is the parameter given at all
	if(timeParam) {
		// Skip check for all
		if(timeParam == "all") return timeParam;

		if(timeParam.length != 10) return -1; // Wrong amount of characters

		// Proper check for format YYYY-MM-DD
		if(/(19|20)[0-9]{2}-((02-(0[1-9]|[1-2][0-9]))|((01|03|05|07|08|10|12)-(0[1-9]|[1-2][0-9]|3[0-1]))|((04|06|09|11)-(0[1-9]|[1-2][0-9]|30)))/.test(timeParam)) {
			return timeParam;
		}
	}

	// At this point the value is just plain wrong. Send error code
	return -1;
}


async function writeFile( filePath, str ) {
	let stream = fs.createWriteStream(filePath, {flags: 'a'});
	stream.write(str, function() {
	// Now the data has been written.
	});

	stream.end();
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
async function combineLogs(dirPath) {
	// Reset combined log
	let newPath = dirPath + "/" + combinedLogsFileName;
	if(fs.existsSync(newPath)) {
		fs.unlinkSync(newPath);
	}

	fs.readdirSync(dirPath).forEach((file) => {
		 if(file != newPath) {
			writeFile(newPath, fs.readFileSync(dirPath + "/" + file).toString());
		 }
	})
	return Promise.resolve(newPath);
}

// List all log files in channel folder
function listLogs(dirPath) {
	let listStr = "";

	fs.readdirSync(dirPath).forEach((file) => {
		if(file != combinedLogsFileName) {
			listStr += file + "\n";
		}
	})
	return listStr;
}

// Write line to file
function writeLog(guildId, channelId, filename, username, line, messageId) {
	let dirPath = logsFolder + guildId;

	// Check guild folder
	ensureFolderExists(dirPath, 0744, function(err) {
		if (err) {
			console.log("couldn't create guild folder");
			return;
		}
		else {
			dirPath += "/" + channelId;
			// Check channel folder
			ensureFolderExists(dirPath, 0744, function(err) {
				if (err) {
					console.log("couldn't create channel folder");
					return;
				}
				else {
					let str;
					if(messageId < 0) {
						str = getDate() + " " + getTime() + "\t" + username + ":\t\t" + line + '\n';
					}
					else {
						str = getDate() + " " + getTime() + "\t" + username + ":\t\t" + line + "    (messageId: " + messageId + ')\n';
					}
					writeFile(dirPath + "/" + filename, str);
				}
			});
		}
	});
}

// Send log file to discord
async function printLog(destination, guildId, param_channel, param_date, usedBy) {
	// Normal log
	if(param_channel.id != "admin") {
		let channelName = bot.channels.cache.get(param_channel.id).name;
		// Mark usage of this to bot log
		writeLog(guildId, adminLogPath, getDate() + ".log", usedBy, "Printed log for: " +  + " - " + channelName + " - dated " + param_date, -1);
	}
	// Admin log
	else {
		// Mark usage of this to bot log
		writeLog(guildId, adminLogPath, getDate() + ".log", usedBy, "Printed admin log dated: " + param_date, -1);
	}

	// Set file paths
	let dirpath = logsFolder + guildId + "/" + param_channel.id;

	// Path for file for now
	let fullpath = dirpath + "/" + param_date + ".log";

	// Prevent crashing if there's no logs at all
	// Guild
	ensureFolderExists(logsFolder + guildId, 0744, function(err) {
		if (err) console.warn("couldn't create guild folder for printed channel");
		else {
			// Channel
			ensureFolderExists(dirpath, 0744, function(err) {
				if (err) console.warn("couldn't create channel folder for printed channel");
			});
		}
	});

	// Override if user wants to print all logs for the channel
	if(param_date == "all") {
		// Get all files in folder and change filepath to this
		fullpath = await combineLogs(dirpath);

		// DEBUG: Currently sends empty file if there's no source logs to combine
	}

	// Prevent accidentally showing logs in public channels
	let isEphemeral = false;
	if(!isAdminChannel(destination.channel.id)) {
		isEphemeral = true;
	}

	// Does that date's log exist?
	if (fs.existsSync(fullpath)) {
		// Send as file since Discord messages cannot be over 2000 characters
		destination.reply({
			files: [fullpath],
			content: "Log for channel: <#" + param_channel.id + "> dated: " + param_date + " (timestamps in UTC)",
			ephemeral: isEphemeral
		});
	}
	else destination.reply({
		content: "No log found for: <#" + param_channel.id + "> dated: " + param_date,
		ephemeral: isEphemeral
	});
}

// Remove channel's log folder
function removeLog(interaction, guildId, param_channelId, usedBy) {
	// Prevent removing admin logs
	if(param_channelId == "admin") {
		// Mark usage of this to bot log
		writeLog(guildId, adminLogPath, getDate() + ".log", usedBy, "tried to remove admin logs", -1);
		interaction.reply("Admin logs cannot be removed for safety reasons!");
		return;
	}

	// Confirm
	let str = "Are you sure you want to clear all logs for channel <#" + param_channelId + ">?";
	requireConfirmation(interaction.member.id, interaction, str, removeFolder, [logsFolder + guildId + "/" + param_channelId], "Logs removed for channel: <#" + param_channelId + ">!");

	// Mark usage of this to bot log
	writeLog(guildId, adminLogPath, getDate() + ".log", usedBy, "Removed logs for: " + param_channelId, -1);
}


// General confirmation. Works with any function
function requireConfirmation(userId, destination, str, func, parameters, successMessage) {
	msg = destination.reply({
	    content: str,
	    ephemeral: true
	})
	.then(function(msg) {
		msg.react("👍");
		msg.react("👎");
		msg.awaitReactions((reaction, user) => user.id == userId && (reaction.emoji.name == '👍' || reaction.emoji.name == '👎'),
		{ max: 1, time: 30000 }).then(collected => {
				if (collected.first().emoji.name == '👍') {
					func.apply(this, parameters); // Call the given function
					if(successMessage) destination.followUp({
						content: successMessage,
						ephemeral: true
					});
				}
				else
				destination.followUp({
					content: "Cancelled by user",
					ephemeral: true
				});
		}).catch(() => {
			destination.followUp({
				content: "Timeout: Cancelled automatically",
				ephemeral: true
			});
		});
	});
}


function isAdminChannel(channelId) {
	for (i in config.adminChannelIds) {
		if(channelId == config.adminChannelIds[i]) return true;
	}
	return false;
}

function isBlacklistedChannel(channelId) {
	for (i in config.blackChannelIds) {
		if(channelId == config.blackChannelIds[i]) return true;
	}
	return false;
}


bot.on("ready", function() {
	// DEBUG: The status disappears after while for some reason
	bot.user.setActivity("everything you do", { type: 3 });
	ensureFolderExists(logsFolder, 0744, function(err) {
		if (err) console.warn("couldn't create folder: logs");
	});
	console.log("Setup Done! Teflon-logger running");
});


// SLASH COMMANDS:
bot.on('interactionCreate', async interaction => {
	if (!interaction.isCommand()) return;
	// Only continue if user has view audit log permissions
	if(!interaction.member.permissions.has(PRINT_PERMISSION)) {
		interaction.reply("You don't have permission to print logs");
		return;
	}

	switch(interaction.commandName) {
		case "help": // Print help message
			await interaction.reply({ embeds: [helpMessage] });
		break;

		case "listlogs":
			let str = listLogs(logsFolder + interaction.guild.id + "/" + interaction.options.getChannel("channel"));
			interaction.reply("log files for <#" + interaction.options.getChannel("channel") + ">:\n" + str);
		break;

		case "printlog":
			let param_timeFrame = checkTimeFormat(interaction.options.getString("date"));

			// Check if date parameter was give correctly
			if(param_timeFrame == -1) {
				interaction.reply("Invalid time format! Only YYYY-MM-DD is supported");
				return;
			}

			printLog(interaction, interaction.guild.id, interaction.options.getChannel("channel"), param_timeFrame, interaction.member.user.tag);
		break;

		case "clearlog":
			if(!interaction.member.permissions.has(EDIT_PERMISSION)) {
				interaction.reply("You don't have permission to remove logs");
				return;
			}

			interaction.reply("Broken at the moment");

			//removeLog(interaction, interaction.guild.id, interaction.options.getChannel("channel"), interaction.member.user.tag);
		break;
	}
});

// LOGGING:
bot.on("messageCreate", function(message) {
	// Ignore any bot messages
	if(message.author.bot) { return; }

	// Some messages (I'm guessing it was a webhook) don't have message.member.user
	let messageByUser;
	if(!message.member.user) messageByUser = "webhook";
	else messageByUser = message.member.user.tag;

// LOG ALL USER MESSAGES:
	// Skip blacklisted channels
	let skipLog = isBlacklistedChannel(message.channel.id);
	if(skipLog == false) {
		// Message can be empty if user send file (like image) with no message
		// There's no point logging the empty message
		if(message.content != "") {
			let cleanMessage = message.content.replace(/\n/g, " <new_Line> ");
			writeLog(message.guild.id, message.channel.id, getDate() + ".log", messageByUser, cleanMessage, message.id);
		}
		// Log urls for attached files
		if (message.attachments.size > 0) {
			for(let i = 0; i < message.attachments.size; i++) {
				writeLog(message.guild.id, message.channel.id, getDate() + ".log", messageByUser, message.attachments.array()[i].url, message.id);
			}
		}
	}
});

// Log edited messages with old and new content
bot.on('messageUpdate', (oldMessage, newMessage) => {
	let str = "Edited message: " + oldMessage.content + " -> " + newMessage.content;

	// Sometimes when the bot has been offline and someone edits the bot cannot get user info and crashes
	// This should fix that
	let user = "Unknown";
	if(newMessage.member) user = newMessage.member.user.tag;
	else if(oldMessage.member) user = oldMessage.member.user.tag;

	writeLog(newMessage.guild.id, newMessage.channel.id, getDate() + ".log", user, str, oldMessage.id);
});

// Log removed messages
bot.on ("messageDelete", message => {
	let str = "";
	// All this information either can exist or not
	if(message.member) {
		if(message.member.user) {
			str += message.member.user.tag;
		}
	}
	if(message.content) str += ": " + message.content;

	writeLog(message.guild.id, message.channel.id, getDate() + ".log", "Removed message", str, message.id);
});

bot.on('uncaughtException', (e) => console.error(e));
bot.on('error', (e) => console.error(e));
bot.on('warn', (e) => console.warn(e));
bot.login(config.token);
