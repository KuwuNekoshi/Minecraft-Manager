import { SlashCommandBuilder } from 'discord.js';
import { getServers } from '../services/craftyApi.js';
import { chunkLines, formatServerLine } from '../utils/discordFormat.js';

export const command = {
  data: new SlashCommandBuilder()
    .setName('servers')
    .setDescription('Show all registered Crafty servers and their current status.'),
  async execute(interaction) {
    await interaction.deferReply();

    const servers = await getServers();
    if (servers.length === 0) {
      await interaction.editReply('No servers were returned by the Crafty API.');
      return;
    }

    const lines = servers.map(formatServerLine);
    const chunks = chunkLines(lines, 8);

    await interaction.editReply({
      content: `Found **${servers.length}** servers in Crafty.`,
      embeds: chunks.map((chunk, index) => ({
        title: `Server Overview ${chunks.length > 1 ? `(${index + 1}/${chunks.length})` : ''}`,
        description: chunk.join('\n')
      }))
    });
  }
};
