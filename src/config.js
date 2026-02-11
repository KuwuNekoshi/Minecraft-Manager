import dotenv from 'dotenv';

dotenv.config();

const requiredVars = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
  'DISCORD_GUILD_ID',
  'CRAFTY_BASE_URL',
  'CRAFTY_TOKEN'
];

for (const key of requiredVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  discordToken: process.env.DISCORD_TOKEN,
  discordClientId: process.env.DISCORD_CLIENT_ID,
  discordGuildId: process.env.DISCORD_GUILD_ID,
  craftyBaseUrl: process.env.CRAFTY_BASE_URL.replace(/\/$/, ''),
  craftyToken: process.env.CRAFTY_TOKEN,
  craftyPortRange: process.env.CRAFTY_PORT_RANGE || '25565-25590'
};
