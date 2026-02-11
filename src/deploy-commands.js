import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { getSlashCommandJson } from './handlers/commandHandler.js';

const rest = new REST({ version: '10' }).setToken(config.discordToken);
const commands = getSlashCommandJson();

async function deployCommands() {
  console.log(`Deploying ${commands.length} slash commands to guild ${config.discordGuildId}...`);

  await rest.put(
    Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
    { body: commands }
  );

  console.log('Slash commands deployed successfully.');
}

deployCommands().catch((error) => {
  console.error('Failed to deploy slash commands:', error);
  process.exitCode = 1;
});
