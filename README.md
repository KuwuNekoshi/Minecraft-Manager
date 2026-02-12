# Minecraft Manager Discord Bot

A Discord slash-command bot that gives a quick overview of your Crafty Controller panel.

## Features

- `/servers` posts an embed-only Megamonner overview with server IP mapping, status (online/offline/updating/crashed), version, player counts, and online player names.
- Deployment tooling now clears old guild slash commands before re-registering, so removed commands do not linger.

## Project structure

```text
src/
  commands/            # Slash command modules
  handlers/            # Command registration + interaction handler
  services/            # Crafty API client
  utils/               # Formatting and helper utilities
  config.js            # Environment variable validation and config
  deploy-commands.js   # Manual slash command deployment helper
  index.js             # Runtime entrypoint
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your values.
3. Start the bot (it clears old guild commands and re-registers current commands on startup):
   ```bash
   npm start
   ```


You can still run manual deployment if needed:

```bash
npm run deploy:commands
```

## Crafty API notes

This bot expects Crafty v2 API auth via bearer token and requests:

- `GET /api/v2/servers`
- `GET /api/v2/servers/{serverId}/stats`

Because Crafty fields can vary between versions, the bot normalizes multiple possible field names for:

- server id
- server name
- status
- server port

If your instance uses unusual field names, update `src/services/craftyApi.js`.
