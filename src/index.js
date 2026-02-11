import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from './config.js';
import { registerCommandHandlers } from './handlers/commandHandler.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

registerCommandHandlers(client);

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.login(config.discordToken);
