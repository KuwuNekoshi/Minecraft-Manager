import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { getSlashCommandJson } from './handlers/commandHandler.js';

const rest = new REST({ version: '10' }).setToken(config.discordToken);
const commands = getSlashCommandJson();

async function deployCommands() {
  const route = Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId);

  console.log(`Clearing old slash commands on guild ${config.discordGuildId} to remove lingering commands...`);
  await rest.put(route, { body: [] });

  console.log(`Deploying ${commands.length} slash commands to guild ${config.discordGuildId}...`);
  await rest.put(route, { body: commands });

  console.log('Slash commands deployed successfully.');
}

deployCommands().catch((error) => {
  console.error('Failed to deploy slash commands:', error);
  process.exitCode = 1;
});
