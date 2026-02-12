import { SlashCommandBuilder } from 'discord.js';
import { getServers, getServerStats } from '../services/craftyApi.js';

const SERVER_PORT_START = 25570;
const SERVER_PORT_STEP = 2;
const SERVER_HOST_PREFIX = 'server';
const SERVER_HOST_DOMAIN = 'megamonner.dk';
const MAX_FIELDS_PER_EMBED = 25;

const toPlayers = (players) => {
  if (Array.isArray(players)) {
    return players;
  }

  if (typeof players === 'string') {
    const trimmed = players.trim();

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const withoutBrackets = trimmed.slice(1, -1).trim();
      if (!withoutBrackets) {
        return [];
      }

      return withoutBrackets
        .split(',')
        .map((player) => player.trim().replace(/^['\"]|['\"]$/g, ''))
        .filter(Boolean);
    }

    try {
      const parsed = JSON.parse(players);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const inferServerIpFromPort = (port) => {
  if (!Number.isInteger(port) || port < SERVER_PORT_START) {
    return 'Ukendt IP';
  }

  const offset = port - SERVER_PORT_START;
  if (offset % SERVER_PORT_STEP !== 0) {
    return `Port ${port}`;
  }

  const serverIndex = offset / SERVER_PORT_STEP + 1;
  return `${SERVER_HOST_PREFIX}${serverIndex}.${SERVER_HOST_DOMAIN}:${port}`;
};

const statusPresentation = (stats) => {
  if (stats.updating || stats.waiting_start) {
    return { dot: '🟡', text: 'Updating' };
  }

  if (stats.crashed) {
    return { dot: '🔴', text: 'Crashed' };
  }

  if (stats.running) {
    return { dot: '🟢', text: 'Online' };
  }

  return { dot: '🔴', text: 'Offline' };
};

const chunkBy = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
};

const buildServerField = (server, stats) => {
  const version = stats.version || 'Ukendt version';
  const port = Number.isInteger(stats.server_port) ? stats.server_port : server.port;
  const ip = inferServerIpFromPort(port);
  const { dot, text } = statusPresentation(stats);
  const online = Number.isFinite(Number(stats.online)) ? Number(stats.online) : 0;
  const max = Number.isFinite(Number(stats.max)) ? Number(stats.max) : 0;
  const players = toPlayers(stats.players);

  return {
    name: `${dot} ${server.name} | ${version}`,
    value: [
      `**Status:** ${text}`,
      `**IP:** \`${ip}\``,
      `**${online}/${max} Players online:**`,
      players.length > 0 ? players.map((player) => `• ${player}`).join('\n') : '• Ingen spillere online'
    ].join('\n')
  };
};

const getServerStatsSafe = async (server) => {
  try {
    return await getServerStats(server.id);
  } catch (error) {
    console.error(`Failed to fetch stats for server ${server.id}:`, error);
    return {};
  }
};

export const command = {
  data: new SlashCommandBuilder()
    .setName('servers')
    .setDescription('Vis alle Megamonner servers med live status og spillere.'),
  async execute(interaction) {
    await interaction.deferReply();

    const servers = await getServers();
    if (servers.length === 0) {
      await interaction.editReply({
        embeds: [
          {
            title: 'Megamonner Servers:',
            description: 'Her er alle megamonner servers, hvis du vil lave din egen kan du få en bruger og logge ind til at styre din egen.\n\nIngen servers blev fundet i Crafty API lige nu.'
          }
        ]
      });
      return;
    }

    const statsList = await Promise.all(
      servers.map(async (server) => ({
        server,
        stats: await getServerStatsSafe(server)
      }))
    );

    const fields = statsList.map(({ server, stats }) => buildServerField(server, stats));
    const fieldChunks = chunkBy(fields, MAX_FIELDS_PER_EMBED);

    await interaction.editReply({
      embeds: fieldChunks.map((chunk, index) => ({
        title: index === 0 ? 'Megamonner Servers:' : `Megamonner Servers: (${index + 1}/${fieldChunks.length})`,
        description: index === 0
          ? 'Her er alle megamonner servers, hvis du vil lave din egen kan du få en bruger og logge ind til at styre din egen.'
          : undefined,
        fields: chunk
      }))
    });
  }
};
