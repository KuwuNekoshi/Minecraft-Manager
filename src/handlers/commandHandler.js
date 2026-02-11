import { Collection, Events } from 'discord.js';
import { commands as commandList } from '../commands/index.js';
import { config } from '../config.js';

export function registerCommandHandlers(client) {
  client.commands = new Collection();
  for (const command of commandList) {
    client.commands.set(command.data.name, command);
  }

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      await interaction.reply({ content: 'Unknown command.', ephemeral: true });
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Command error for /${interaction.commandName}:`, error);

      const message = 'Command failed. Check bot logs and Crafty API settings.';
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(message);
      } else {
        await interaction.reply({ content: message, ephemeral: true });
      }
    }
  });
}

export function getSlashCommandJson() {
  return commandList.map((command) => command.data.toJSON());
}

export async function resetAndRegisterSlashCommands(client) {
  const guild = await client.guilds.fetch(config.discordGuildId);
  const commands = getSlashCommandJson();

  console.log(`Clearing existing slash commands for guild ${config.discordGuildId}...`);
  await guild.commands.set([]);

  console.log(`Registering ${commands.length} slash commands for guild ${config.discordGuildId}...`);
  await guild.commands.set(commands);
}
