import { SlashCommandBuilder } from 'discord.js';
import { config } from '../config.js';
import { getServers } from '../services/craftyApi.js';
import { parsePortRange } from '../utils/discordFormat.js';

const summarizePorts = (servers, range) => {
  const usedPorts = new Set();
  const noPortServers = [];

  for (const server of servers) {
    if (server.port) {
      usedPorts.add(server.port);
    } else {
      noPortServers.push(server);
    }
  }

  const availablePorts = [];
  for (let port = range.start; port <= range.end; port += 1) {
    if (!usedPorts.has(port)) {
      availablePorts.push(port);
    }
  }

  return { usedPorts, availablePorts, noPortServers };
};

export const command = {
  data: new SlashCommandBuilder()
    .setName('unused-ports')
    .setDescription('List unassigned ports in your configured Crafty range and servers without ports.'),
  async execute(interaction) {
    await interaction.deferReply();

    const servers = await getServers();
    const range = parsePortRange(config.craftyPortRange);
    const { usedPorts, availablePorts, noPortServers } = summarizePorts(servers, range);

    const lines = [
      `Port range checked: **${range.start}-${range.end}**`,
      `Registered servers: **${servers.length}**`,
      `Used ports in range: **${[...usedPorts].filter((port) => port >= range.start && port <= range.end).length}**`,
      `Unused ports in range: **${availablePorts.length}**`
    ];

    const sampledUnused = availablePorts.slice(0, 30);
    if (sampledUnused.length > 0) {
      lines.push(`Example unused ports: ${sampledUnused.join(', ')}${availablePorts.length > sampledUnused.length ? ' ...' : ''}`);
    }

    if (noPortServers.length > 0) {
      lines.push('');
      lines.push('Servers with no port configured:');
      for (const server of noPortServers.slice(0, 20)) {
        lines.push(`• ${server.name} (ID: ${server.id}, status: ${server.status})`);
      }
      if (noPortServers.length > 20) {
        lines.push(`• ...and ${noPortServers.length - 20} more`);
      }
    }

    await interaction.editReply(lines.join('\n'));
  }
};
