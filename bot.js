const { Client } = require("discord.js");

const paste = (content) => new Promise((resolve) => {
	const query = require("qs").stringify({
		api_option:				"paste",
		api_dev_key:			process.env.PASTEBIN_API_KEY,
		api_paste_code:			content,
		api_paste_private:		0,
		api_paste_name:			"output.txt",
		api_paste_expire_date:	"10M",
		api_paste_format:		"json",
		api_user_key:			""
	});

	const request = require("https").request("https://pastebin.com/api/api_post.php", {
		headers: {
			"Content-Type":		"application/x-www-form-urlencoded",
			"Content-Length":	query.length
		},
		method:					"POST"
	}, (response) => {
		let data = "";
		response.on("data", (chunk) => data += chunk);
		response.on("end", () => resolve(data));
	});

	request.write(query);
	request.end();
});

class EvalContainer {
	constructor(interaction) {
		this.interaction = {};
		Object.assign(this.interaction, interaction);
	}

	async eval(code, fromMessage) {
		const normalize = (string) => string.toLowerCase().replace(/[^a-z]/g, '');

		// Find the guild.
		this.guild = {};
		const guild = await client.guilds.fetch(this.interaction.guild_id);
		Object.assign(this.guild, guild);
		if (!this.guild) { return console.error("Failed to fetch interaction's guild."); }

		// Find the member.
		this.member = {};
		const member = await this.guild.members.fetch(this.interaction.member.user.id);
		Object.assign(this.member, member);
		if (!this.member) { return console.error("Failed to fetch interaction's member."); }

		// Find the channel.
		this.channel = {};
		const channel = await client.channels.fetch(this.interaction.channel_id);
		Object.assign(this.channel, channel);
		if (!this.channel) { return console.error("Failed to find interaction's channel."); }

		// Get code from message content.
		if (fromMessage) {
			const messageNotFoundOutput = {
				title: "Unknown Message",
				type: "rich",
				description: "Failed to find the referenced message. Make sure that you're targeting a message from this channel.",
				color: ERROR_COLOR
			};

			try { code = (await this.channel.messages.fetch(code)).cleanContent; } catch { return messageNotFoundOutput; }
			if (!code) { return messageNotFoundOutput; }
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
		for (const word of []) {
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

		// Remove disallowed global variables.
		for (const word of ["global", "process"]) { code = `const ${word} = {};\n${code}`; }

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
			// Post to Pastebin.
			try {
				paste(output).then((url) => member.send(url));

				return {
					title: "Output",
					type: "rich",
					description: "Your output is too long for Discord to print, so it has been posted to Pastebin."
					+ "You will receive a DM in a moment with a link to your paste.\n\n"
					+ "**Note:** the paste is set to expire in 10 minutes. If it expires before that, Pastebin's filters detected your output as suspicious and automatically removed it.",
					color: SUCCESS_COLOR
				};
			} catch {
				return {
					title: "Output Length",
					type: "rich",
					description: "Your output is too long for Discord to print.",
					color: WARNING_COLOR
				};
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
			const output = await new EvalContainer(interaction).eval(code);
			return client.api.interactions(interaction.id, interaction.token).callback.post({ data: {
				type: 4,
				data: { embeds: [ output ] }
			} });
		case "evalmessage":
			const snowflake = interaction.data.options.find((option) => option.name == "snowflake").value;
			const messageOutput = await new EvalContainer(interaction).eval(snowflake, true);
			return client.api.interactions(interaction.id, interaction.token).callback.post({ data: {
				type: 4,
				data: { embeds: [ messageOutput ] }
			} });
		case "docs":
			return client.api.interactions(interaction.id, interaction.token).callback.post({ data: {
				type: 4,
				data: { embeds: [{
					title: "Documentation",
					type: "rich",
					description: "`this` contains references to some Discord objects. Try inspecting it to find out what you can do!```js\nreturn Object.keys(this);```",
					color: INFO_COLOR
				}] }
			} });
	}
});

// Login.
client.login(process.env.TOKEN);