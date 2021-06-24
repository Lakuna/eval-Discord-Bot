const { Client, MessageEmbed } = require("discord.js");

// Create client.
// Invite link: https://discord.com/api/oauth2/authorize?client_id=857693045126463518&permissions=3072&scope=applications.commands%20bot
const client = new Client({ ws: { intents: [ "GUILD_MESSAGES" ] } });

// Application getter.
Object.defineProperty(client, "app", { get: () => client.api.applications(client.user.id) });

// Colors.
const SUCCESS_COLOR = "#50C878";
const WARNING_COLOR = "#FFE791";
const ERROR_COLOR = "C80815";

// Error handling.
client.on("error", console.error);
client.on("shardError", console.error);

// Startup.
client.on("ready", () => {
	client.user.setActivity("Evaluate");

	/*
	Print commands:
	console.log(await client.app.commands.get());
	Create command:
	// https://discord.com/developers/docs/interactions/slash-commands#registering-a-command
	await client.app.commands.post({
		data: {
			name: "command_name",
			description: "command_description"
		}
	});
	Delete command:
	// https://discord.com/developers/docs/interactions/slash-commands#updating-and-deleting-a-command
	await client.app.commands('command_id').delete();
	*/
});

// Handle slash commands.
client.ws.on("INTERACTION_CREATE", async (interaction) => {

});

// Login.
client.login(process.env.TOKEN);