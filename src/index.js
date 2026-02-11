import { Client, GatewayIntentBits, Events } from 'discord.js';
import { config } from './config.js';
import { registerCommandHandlers, resetAndRegisterSlashCommands } from './handlers/commandHandler.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

registerCommandHandlers(client);

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);

  try {
    await resetAndRegisterSlashCommands(client);
    console.log('Slash commands reset and re-registered successfully.');
  } catch (error) {
    console.error('Failed to reset and re-register slash commands:', error);
  }
});

client.login(config.discordToken);
