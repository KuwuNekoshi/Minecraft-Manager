# Minecraft Manager Discord Bot

A Discord slash-command bot that gives a quick overview of your Crafty Controller panel.

## Features

- `/servers` shows all registered servers with server name, status, and port (if available).
- `/unused-ports` checks your configured port range and reports unassigned ports plus servers that have no configured port.

## Project structure

```text
src/
  commands/            # Slash command modules
  handlers/            # Command registration + interaction handler
  services/            # Crafty API client
  utils/               # Formatting and helper utilities
  config.js            # Environment variable validation and config
  deploy-commands.js   # One-time slash command deployment
  index.js             # Runtime entrypoint
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in your values.
3. Deploy slash commands to your guild:
   ```bash
   npm run deploy:commands
   ```
4. Start the bot:
   ```bash
   npm start
   ```

## Crafty API notes

This bot expects Crafty v2 API auth via bearer token and requests:

- `GET /api/v2/servers`

Because Crafty fields can vary between versions, the bot normalizes multiple possible field names for:

- server id
- server name
- status
- server port

If your instance uses unusual field names, update `src/services/craftyApi.js`.
