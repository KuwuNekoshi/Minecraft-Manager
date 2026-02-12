import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getServerLogs, getServers, runServerConsoleCommand } from '../services/craftyApi.js';

const SUBCOMMANDS = ['enable', 'disable', 'list', 'add', 'remove'];
const MAX_AUTOCOMPLETE_CHOICES = 25;
const LOG_POLL_ATTEMPTS = 6;
const LOG_POLL_INTERVAL_MS = 700;

const serverOption = (option) => option
  .setName('server')
  .setDescription('Server to target')
  .setRequired(true)
  .setAutocomplete(true);

const serverLabel = (server) => `${server.name} (${server.id})`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeLogLine = (line) => String(line)
  .replace(/\[(?:\d{1,2}:){2}\d{1,2}\]\s*\[[^\]]+\]:\s*/g, '')
  .replace(/&quot;/g, '"')
  .trim();

const isChatOrNoiseLine = (line) => {
  const normalized = line.toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    'joined the game',
    'left the game',
    'logged in with entity id',
    'lost connection',
    '[not secure]',
    'uuid of player',
    'server empty for'
  ].some((token) => normalized.includes(token));
};

const validationMarker = () => `validation_${Math.random().toString(36).slice(2, 12)}`;

const extractConfirmationLines = (logLines, marker) => {
  const markerIndex = logLines.findIndex((line) => line.includes(marker));
  if (markerIndex < 0) {
    return null;
  }

  return logLines
    .slice(markerIndex + 1)
    .map(normalizeLogLine)
    .filter((line) => line && !line.includes(marker) && !isChatOrNoiseLine(line));
};

const firstConfirmationChunk = (lines) => {
  if (!lines || lines.length === 0) {
    return [];
  }

  const preferred = lines.filter((line) => /whitelist|unknown or incomplete command|incorrect argument|added|removed|turned on|turned off/i.test(line));
  if (preferred.length > 0) {
    return preferred.slice(0, 8);
  }

  return lines.slice(0, 8);
};

const parsePlayersFromConfirmation = (lines) => {
  const text = lines.join('\n');

  if (/there are no whitelisted players/i.test(text)) {
    return [];
  }

  const match = text.match(/whitelisted player(?:\(s\)|s)?:\s*(.*)/i);
  if (!match) {
    return [];
  }

  return match[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
};

const executeWithLogConfirmation = async (serverId, commandText) => {
  const marker = validationMarker();
  await runServerConsoleCommand(serverId, marker);
  await runServerConsoleCommand(serverId, commandText);

  for (let attempt = 0; attempt < LOG_POLL_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(LOG_POLL_INTERVAL_MS);
    }

    const logs = await getServerLogs(serverId, {
      file: false,
      colors: false,
      raw: false,
      html: false
    });

    const scoped = extractConfirmationLines(logs, marker);
    if (!scoped) {
      continue;
    }

    const lines = firstConfirmationChunk(scoped);
    if (lines.length > 0) {
      return lines;
    }
  }

  return [];
};

const findServerById = async (serverId) => {
  const servers = await getServers();
  return servers.find((server) => String(server.id) === String(serverId)) || null;
};

const formatPlayerList = (players) => {
  if (players.length === 0) {
    return 'Whitelist is empty.';
  }

  return players.map((player) => `• ${player}`).join('\n');
};

const buildCommand = ({ subcommand, player }) => {
  if (subcommand === 'enable') {
    return 'whitelist on';
  }

  if (subcommand === 'disable') {
    return 'whitelist off';
  }

  if (subcommand === 'list') {
    return 'whitelist list';
  }

  if (subcommand === 'add') {
    return `whitelist add ${player}`;
  }

  if (subcommand === 'remove') {
    return `whitelist remove ${player}`;
  }

  return null;
};

const autocompleteServerChoices = async (focused) => {
  const servers = await getServers();
  const lower = focused.toLowerCase();

  return servers
    .filter((server) => {
      if (!lower) {
        return true;
      }

      return server.name.toLowerCase().includes(lower) || String(server.id).toLowerCase().includes(lower);
    })
    .slice(0, MAX_AUTOCOMPLETE_CHOICES)
    .map((server) => ({ name: serverLabel(server), value: String(server.id) }));
};

const autocompleteRemovePlayerChoices = async (serverId, focused) => {
  if (!serverId) {
    return [];
  }

  const confirmationLines = await executeWithLogConfirmation(serverId, 'whitelist list');
  const players = parsePlayersFromConfirmation(confirmationLines);
  const lower = focused.toLowerCase();

  return players
    .filter((player) => !lower || player.toLowerCase().includes(lower))
    .slice(0, MAX_AUTOCOMPLETE_CHOICES)
    .map((player) => ({ name: player, value: player }));
};

const withLogConfirmationBlock = (lines) => {
  if (!lines || lines.length === 0) {
    return '⚠️ No log confirmation was found yet.';
  }

  return `\`\`\`\n${lines.join('\n')}\n\`\`\``;
};

const buildWhitelistEmbed = ({ serverName, title, description, confirmationLines, color = 0x5865F2 }) => new EmbedBuilder()
  .setColor(color)
  .setTitle(title)
  .setDescription(description)
  .addFields({
    name: 'Log confirmation',
    value: withLogConfirmationBlock(confirmationLines)
  })
  .setFooter({ text: `Server: ${serverName}` });

export const command = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manage Minecraft server whitelist through Crafty stdin commands.')
    .addSubcommand((subcommand) => subcommand
      .setName('enable')
      .setDescription('Enable whitelist on a server')
      .addStringOption(serverOption))
    .addSubcommand((subcommand) => subcommand
      .setName('disable')
      .setDescription('Disable whitelist on a server')
      .addStringOption(serverOption))
    .addSubcommand((subcommand) => subcommand
      .setName('list')
      .setDescription('List whitelisted players on a server')
      .addStringOption(serverOption))
    .addSubcommand((subcommand) => subcommand
      .setName('add')
      .setDescription('Add player to whitelist')
      .addStringOption(serverOption)
      .addStringOption((option) => option
        .setName('player')
        .setDescription('Minecraft username to add')
        .setRequired(true)))
    .addSubcommand((subcommand) => subcommand
      .setName('remove')
      .setDescription('Remove player from whitelist')
      .addStringOption(serverOption)
      .addStringOption((option) => option
        .setName('player')
        .setDescription('Minecraft username to remove')
        .setRequired(true)
        .setAutocomplete(true))),

  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);

      if (focused.name === 'server') {
        const choices = await autocompleteServerChoices(focused.value || '');
        await interaction.respond(choices);
        return;
      }

      if (focused.name === 'player') {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand !== 'remove') {
          await interaction.respond([]);
          return;
        }

        const serverId = interaction.options.getString('server');
        const choices = await autocompleteRemovePlayerChoices(serverId, focused.value || '');
        await interaction.respond(choices);
        return;
      }

      await interaction.respond([]);
    } catch (error) {
      console.error('Autocomplete error for /whitelist:', error);
      if (!interaction.responded) {
        await interaction.respond([]);
      }
    }
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    const serverId = interaction.options.getString('server', true);
    const player = interaction.options.getString('player');

    if (!SUBCOMMANDS.includes(subcommand)) {
      await interaction.editReply({
        embeds: [buildWhitelistEmbed({
          serverName: 'Unknown',
          title: 'Whitelist command failed',
          description: 'Unsupported subcommand.',
          confirmationLines: [] ,
          color: 0xED4245
        })]
      });
      return;
    }

    const server = await findServerById(serverId);
    if (!server) {
      await interaction.editReply({
        embeds: [buildWhitelistEmbed({
          serverName: 'Unknown',
          title: 'Whitelist command failed',
          description: `Server not found for id: ${serverId}`,
          confirmationLines: [],
          color: 0xED4245
        })]
      });
      return;
    }

    if ((subcommand === 'add' || subcommand === 'remove') && !player) {
      await interaction.editReply({
        embeds: [buildWhitelistEmbed({
          serverName: server.name,
          title: 'Whitelist command failed',
          description: 'You must provide a player name.',
          confirmationLines: [],
          color: 0xED4245
        })]
      });
      return;
    }

    const serverCommand = buildCommand({ subcommand, player });
    if (!serverCommand) {
      await interaction.editReply({
        embeds: [buildWhitelistEmbed({
          serverName: server.name,
          title: 'Whitelist command failed',
          description: 'Could not build server command.',
          confirmationLines: [],
          color: 0xED4245
        })]
      });
      return;
    }

    const confirmationLines = await executeWithLogConfirmation(server.id, serverCommand);

    if (subcommand === 'list') {
      const players = parsePlayersFromConfirmation(confirmationLines);
      const output = formatPlayerList(players);
      await interaction.editReply({
        embeds: [buildWhitelistEmbed({
          serverName: server.name,
          title: `Whitelist for ${server.name}`,
          description: output,
          confirmationLines
        })]
      });
      return;
    }

    if (confirmationLines.length === 0) {
      await interaction.editReply({
        embeds: [buildWhitelistEmbed({
          serverName: server.name,
          title: 'Whitelist command sent',
          description: `Executed command: \`${serverCommand}\`\n\nCommand sent, but no matching confirmation lines were found in logs yet.`,
          confirmationLines
        })]
      });
      return;
    }

    await interaction.editReply({
      embeds: [buildWhitelistEmbed({
        serverName: server.name,
        title: 'Whitelist command executed',
        description: `Executed command: \`${serverCommand}\``,
        confirmationLines
      })]
    });
  }
};
