const { Client } = require("discord.js");

class EvalContainer {
	constructor(interaction) {
		this.interaction = {};
		Object.assign(this.interaction, interaction);
	}

	async eval(code) {
		const normalize = (string) => string.toLowerCase().replace(/[^a-z]/g, '');

		// Find the guild.
		this.guild = {};
		Object.assign(this.guild, await client.guilds.fetch(this.interaction.guild_id));
		if (!this.guild) { return console.error("Failed to fetch interaction's guild."); }

		// Find the member.
		this.member = {};
		Object.assign(this.member, await this.guild.members.fetch(this.interaction.member.user.id));
		if (!this.member) { return console.error("Failed to fetch interaction's member."); }

		// Find the channel.
		this.channel = {};
		Object.assign(this.channel, await client.channels.fetch(this.interaction.channel_id));
		if (!this.channel) { return console.error("Failed to find interaction's channel."); }

		// Get code from message content.
		if (/{\d+}/.test(code)) {
			const message = await this.channel.messages.fetch(code.substring(1, code.length - 1));
			if (!message) {
				return {
					title: "Unknown Message",
					type: "rich",
					description: "Failed to find the referenced message. Make sure that you're targeting a message from this channel.",
					color: ERROR_COLOR
				};
			}
			code = message.cleanContent;
		}

		// Warn the user if the code has no output.
		if (!code.includes("return")) {
			return {
				title: "No Output",
				type: "rich",
				description: "Your code never calls return, so it won't have any output.",
				color: WARNING_COLOR
			};
		}

		// Don't execute code with disallowed words.
		const normalizedCode = normalize(code);
		for (const word of ["send", "reply"]) {
			if (normalizedCode.includes(word)) {
				return {
					title: "Disallowed Word",
					type: "rich",
					description: `Won't execute code with disallowed word "${word}"`,
					color: WARNING_COLOR
				};
			}
		}

		// Clean up code.
		if (code.startsWith("```js")) { code = code.substring(5); }
		if (code.startsWith("```")) { code = code.substring(3); }
		if (code.endsWith("```")) { code = code.substring(0, code.length - 3); }
		code = code.trim();

		// Execute code.
		let output;
		try {
			output = require("util").inspect(Function(code).bind(this)());
		} catch (error) {
			return {
				title: "Error",
				type: "rich",
				description: "Failed to execute your code.",
				color: ERROR_COLOR,
				fields: [{
					name: "Error",
					value: `${error}`
				}]
			};
		}

		// Make sure that no sensitive data is in the output.
		const normalizedOutput = normalize(output);
		for (const word of [normalize(process.env.CLIENT_SECRET), normalize(process.env.TOKEN)]) {
			if (normalizedOutput.includes(word)) {
				return {
					title: "Disallowed Output",
					type: "rich",
					description: "Won't return output with a disallowed word.",
					color: WARNING_COLOR
				};
			}
		}

		// Make sure that output is short enough for Discord to print.
		if (output.length > 2048) {
			return {
				title: "Output Length",
				type: "rich",
				description: "Your output is too long for Discord to print.",
				color: WARNING_COLOR
			}
		}

		// Return output.
		return {
			title: "Output",
			type: "rich",
			description: `\`\`\`json\n${output}\`\`\``,
			color: SUCCESS_COLOR
		};
	}
}

// Create client.
// Invite link: https://discord.com/api/oauth2/authorize?client_id=857693045126463518&permissions=3072&scope=applications.commands%20bot
const client = new Client({ ws: { intents: [ "GUILD_MESSAGES" ] } });

// Application getter.
Object.defineProperty(client, "app", { get: () => client.api.applications(client.user.id) });

// Colors.
const SUCCESS_COLOR = 0x50C878;
const INFO_COLOR = 0x5078C8;
const WARNING_COLOR = 0xFFE791;
const ERROR_COLOR = 0xC80815;

// Error handling.
client.on("error", console.error);
client.on("shardError", console.error);

// Startup.
client.on("ready", () => client.user.setActivity("Evaluate"));

// Handle slash commands.
client.ws.on("INTERACTION_CREATE", async (interaction) => {
	switch (interaction.data.name) {
		case "eval":
			const code = interaction.data.options.find((option) => option.name == "code").value.trim();
			const data = await new EvalContainer(interaction).eval(code);
			return client.api.interactions(interaction.id, interaction.token).callback.post({ data: {
				type: 4,
				data: { embeds: [ data ] }
			} });
		case "docs":
			return client.api.interactions(interaction.id, interaction.token).callback.post({ data: {
				type: 4,
				data: { embeds: [{
					title: "Documentation",
					type: "rich",
					description: "Instead of supplying code directly, you may pass *{snowflake}* into the **code** parameter to supply a message's content as code:" +
						"\n\nMessage #12345:```js\nclass Foo {\n\tconstructor() {\n\t\tthis.bar = \"Hello, world!\";\n\t}\n}\n\nreturn new Foo().bar;```" +
						"\n\n**Use command:** `/eval {12345}`",
					color: INFO_COLOR,
					fields: [
						{
							name: "this",
							value: "Contains references to certain Discord objects. Try inspecting it to find out what you can do!"
						}
					]
				}] }
			} });
	}
});

// Login.
client.login(process.env.TOKEN);