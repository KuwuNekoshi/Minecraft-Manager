import {
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SectionBuilder,
  SlashCommandBuilder
} from 'discord.js';
import { getServers, getServerStats } from '../services/craftyApi.js';

const SERVER_PORT_START = 25570;
const SERVER_PORT_STEP = 2;
const UNUSED_PORT_RANGE_START = 25570;
const UNUSED_PORT_RANGE_END = 25580;
const SERVER_HOST_PREFIX = 'server';
const SERVER_HOST_DOMAIN = 'megamonner.dk';
const MAX_SECTIONS_PER_CONTAINER = 10;
const DESCRIPTION_TEXT = 'Her er alle megamonner servers, hvis du vil lave din egen kan du få en bruger og logge ind til at styre din egen.';

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
  return `${SERVER_HOST_PREFIX}${serverIndex}.${SERVER_HOST_DOMAIN}`;
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

const getUnusedPortsField = (statsList) => {
  const usedPorts = new Set(
    statsList
      .map(({ server, stats }) => {
        const port = Number.isInteger(stats.server_port) ? stats.server_port : server.port;
        return Number.isInteger(port) ? port : null;
      })
      .filter((port) => Number.isInteger(port) && port >= SERVER_PORT_START && (port - SERVER_PORT_START) % SERVER_PORT_STEP === 0)
  );

  const unusedPorts = [];

  for (let port = UNUSED_PORT_RANGE_START; port <= UNUSED_PORT_RANGE_END; port += SERVER_PORT_STEP) {
    if (!usedPorts.has(port)) {
      unusedPorts.push({
        port,
        ip: inferServerIpFromPort(port)
      });
    }
  }

  return {
    name: '**Unused IP/Ports**',
    value:
      unusedPorts.length > 0
        ? unusedPorts.map(({ ip, port }) => `-# IP: ${ip} - (Port: ${port})`).join('\n')
        : '-# Ingen ubrugte IP/Ports fundet.'
  };
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

const getLunarConnectUrl = (ip) => {
  if (!ip || ip === 'Ukendt IP' || ip.startsWith('Port ')) {
    return null;
  }

  return `https://megamonner.dk/lunar?serveraddress=${encodeURIComponent(ip)}`;
};

const buildServerSection = (server, stats) => {
  const field = buildServerField(server, stats);
  const port = Number.isInteger(stats.server_port) ? stats.server_port : server.port;
  const ip = inferServerIpFromPort(port);
  const lunarConnectUrl = getLunarConnectUrl(ip);

  const section = new SectionBuilder().addTextDisplayComponents((textDisplay) => textDisplay.setContent(`## ${field.name}\n${field.value}`));

  if (lunarConnectUrl) {
    section.setButtonAccessory(
      new ButtonBuilder()
        .setLabel('Lunar Connect')
        .setStyle(ButtonStyle.Link)
        .setURL(lunarConnectUrl)
    );
  }

  return section;
};

const buildUnusedPortsSection = (statsList) => {
  const field = getUnusedPortsField(statsList);

  return new SectionBuilder().addTextDisplayComponents((textDisplay) => textDisplay.setContent(`## ${field.name}\n${field.value}`));
};

const buildComponentContainers = (statsList) => {
  const serverSections = statsList.map(({ server, stats }) => buildServerSection(server, stats));
  const chunkedSections = chunkBy(serverSections, MAX_SECTIONS_PER_CONTAINER);

  if (chunkedSections.length === 0) {
    chunkedSections.push([]);
  }

  chunkedSections[chunkedSections.length - 1].push(buildUnusedPortsSection(statsList));

  return chunkedSections.map((sections, index) => {
    const container = new ContainerBuilder();

    if (index === 0) {
      container.addTextDisplayComponents((textDisplay) => textDisplay.setContent(`# Megamonner Servers\n${DESCRIPTION_TEXT}`));
    } else {
      container.addTextDisplayComponents((textDisplay) => textDisplay.setContent(`# Megamonner Servers (${index + 1}/${chunkedSections.length})`));
    }

    container.addSectionComponents(sections);

    return container;
  });
};

export const command = {
  data: new SlashCommandBuilder()
    .setName('servers')
    .setDescription('Vis alle Megamonner servers med live status og spillere.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const servers = await getServers();
    if (servers.length === 0) {
      await interaction.editReply({
        content: `${DESCRIPTION_TEXT}\n\nIngen servers blev fundet i Crafty API lige nu.`
      });
      return;
    }

    const statsList = await Promise.all(
      servers.map(async (server) => ({
        server,
        stats: await getServerStatsSafe(server)
      }))
    );

    const componentContainers = buildComponentContainers(statsList);

    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: componentContainers
    });
  }
};
