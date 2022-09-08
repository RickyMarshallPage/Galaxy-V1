// @Bot Version 1
// Procedurally coded bot in a true scripting format with a basic permission-based rank system for command authority
//

/*
1)
    Check `ls`
    Should NOT see `Desktop`, `Documents`, `Downloads`, etc
    If you DO see these folders
        1.5) Use `cd Desktop`

2)
    Use `nano bot.js` to create the file
    Input the required source code
    Then exit and save the file following the prompts at the bottom of the terminal

3)
    Install the required modules:
        `npm install discord.js`
        `npm install express`
        `npm install mysql`
        `npm install pm2 -g`
        `npm install nano -g`
	
3.5) 	
    create the roles on your server
    `Root`,
    `Administrator`,
    `Moderator`,
    `User`,
    `Test`;
4)
    Run the bot
    `pm2 start bot.js`
	
5)
    Monitor for errors
    `pm2 monit`
*/

const Galaxy = {
    "Roles": {
        "Root": {
            "Rank": 3,
            "Permissions": [
                { "type": "other", "value": "OWNER" },
                { "type": "other", "value": "CREATOR" }
            ],
        },

        "Administrator": {
            "Rank": 2,
            "Permissions": [
                { "type": "permission", "value": "ADMINISTRATOR" }
            ],
        },

        "Moderator": {
            "Rank": 1,
            "Permissions": [
                { "type": "permission", "value": "KICK_MEMBERS" },
                { "type": "permission", "value": "BAN_MEMBERS" }
            ]
        },

        "User": {
            "Rank": 0,
            "Permissions": [
                { "type": "permission", "value": "SEND_MESSAGES" }
            ]
        },
        "Test": {
            "Rank": 0.5,
            "Permissions": [
                { "type": "permission", "value": "SEND_MESSAGES" }
            ]
        }
    },

    "Settings": {
        "Prefix": "!",
        "CommandErrors": {
            "NotifyRankExceeds": true, //Notify the speaker if their rank is exceeded by command's requirement
            "NotifyGeneralError": true, //Notify the speaker of command execution errors 
            "NotifyParsedError": false //Notify the speaker of passed errors thrown by Error("Galaxy: error message here")
        }
    },

    "Commands": {},
}

function createCommand(name, rank, list, description, callback) {
    Galaxy.Commands[name] = { rank, list, description, callback }
};

function writeErrorMessage(message, channel, member) {
    return channel.send({
        content: `<\x40${member.id}>, `,
        embeds: [
            {
                title: "Error",
                description: message,
                color: 0xFF0000,
                footer: {

                }
            }
        ]
    });
};

const util = require('util');

function evalCmd(message, user, code) {
    var channel = message;
    try {
        let evaled = eval(code);
        if (typeof evaled !== "string")
            evaled = util.inspect(evaled);
        channel.send({ content: 'Code Evaluated!' });
    } catch (err) {
        writeErrorMessage(`\`EVAL\` \`\`\`xl\n${err}\n\`\`\``, channel, user);
    }
}

function getRole(user, guild) {
    for (var name in Galaxy.Roles) {
        let role = Galaxy.Roles[name];
        for (var i in role.Permissions) {
            let permission = role.Permissions[i];
            let pass = false;

            if (permission.type == "other") {
                if (permission.value == "CREATOR") {
                    pass = user.id == "";
                } else if (permission.value == "OWNER") {
                    pass = user.id == guild.ownerId;
                }
            } else {
                pass = user.permissions.has(permission.value);
            };

            if (pass)
                return ({
                    "name": name,
                    "rank": role.Rank
                });
        };
    };

    return ({
        "name": "User",
        "rank": 0
    });
};

//===============// Command initialisation

//===============// Rank (0, User) commands
var currentCommandRank = 0
createCommand("Ping", currentCommandRank, ["ping"], "Pings you", function (message, speaker, channel) {
    channel.send({
        content: `<\x40${speaker.id}>, ` + (message.length == 0 ? "Pong" : message)
    });
});

//===============// Rank (2, Administrator) commands
var currentCommandRank = 2
createCommand("PrintString", currentCommandRank, ["printstring", "getstring"], "Get $users string", async function (message, speaker, channel, guild) {
    let id = message.match(/(\d+)/)[1];
    if (id != null) {
        let member = await guild.members.fetch(id);
        if (member != null) {
            channel.send(`<\x40${speaker.id}>, <\x40${member.id}>'s string is [${getString(member.id)}]!`);
        } else {
            throw ("Galaxy: cannot find member!");
        };
    } else
        throw ("Galaxy: no member specified!");
});

//===============// Rank (3, Root) commands
var currentCommandRank = 3
createCommand("Execute", currentCommandRank, ["eval", "exe", "execute"], "Evaluates <Code>", function (message, speaker, channel) {
    evalCmd(channel, speaker, message)
});

//===============// Bot initialisation

const { Client } = require('discord.js');
const { GatewayIntentBits } = require('discord.js');
const { executionAsyncId } = require('async_hooks');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping
    ],
});
//===============// Bot finialisation

client.on("messageCreate", message => {
    var guild = message.guild;
    var author = message.author;
    var member = message.member;
    var channel = message.channel;

    if (!message.content.startsWith(Galaxy.Settings.Prefix) || author.bot)
        return;

    var content = message.content.substring(Galaxy.Settings.Prefix.length);
    var match = content.match(/(\S+)\s*(.*)/);
    var role = getRole(member, guild);

    for (var name in Galaxy.Commands) {
        let command = Galaxy.Commands[name];

        for (var i in command.list) {
            let identifier = command.list[i];

            if (match[1].toLowerCase() == identifier.toLowerCase()) {
                if (role.rank < command.rank) {
                    if (Galaxy.Settings.CommandErrors.NotifyRankExceeds)
                        writeErrorMessage("You do not have the required rank for this command!", channel, member);

                    return;
                };

                try {
                    let rtn = command.callback(match[2], member, channel, guild, message);
                    if (rtn instanceof Promise) {
                        rtn.catch(error => {
                            let errorString = error.toString();
                            if (errorString.startsWith("[Galaxy]: ")) {
                                if (Galaxy.Settings.CommandErrors.NotifyParsedError)
                                    writeErrorMessage(errorString, channel, member);
                            } else if (Galaxy.Settings.CommandErrors.NotifyGeneralError)
                                writeErrorMessage(errorString, channel, member);
                        });
                    };
                } catch (error) {
                    let errorString = error.toString();
                    if (errorString.startsWith("[Galaxy]: ")) {
                        if (Galaxy.Settings.CommandErrors.NotifyParsedError)
                            writeErrorMessage(errorString, channel, member);
                    } else if (Galaxy.Settings.CommandErrors.NotifyGeneralError)
                        writeErrorMessage(errorString, channel, member);
                };
            };
        };
    };
});

//===============// 6) https://discordapi.com/permissions.html#

//===============// 7) https://discord.com/developers/applications

client.login("Token here! Get one at step 7, copy the CLIENT ID and put it in step 6");
