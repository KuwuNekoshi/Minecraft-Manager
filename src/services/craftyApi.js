import { config } from '../config.js';

const jsonHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${config.craftyToken}`
};

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseStatus = (raw) => {
  if (raw === undefined || raw === null) {
    return 'unknown';
  }

  const normalized = String(raw).toLowerCase();
  if (['running', 'online', 'started', 'up', 'active'].includes(normalized)) {
    return 'running';
  }
  if (['stopped', 'offline', 'down', 'inactive'].includes(normalized)) {
    return 'stopped';
  }

  return normalized;
};

const normalizeServer = (server) => {
  const statusSource = firstDefined(
    server.status,
    server.server_status,
    server.stats?.status,
    server.state
  );

  const portSource = firstDefined(
    server.server_port,
    server.port,
    server.ports?.primary,
    server.server_properties?.server_port,
    server.execution_stats?.port
  );

  return {
    id: firstDefined(server.server_id, server.id, server.uuid, 'unknown-id'),
    name: firstDefined(server.server_name, server.name, server.display_name, 'Unnamed Server'),
    status: parseStatus(statusSource),
    port: toNumber(portSource),
    raw: server
  };
};

const extractServerArray = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.servers)) {
    return payload.servers;
  }

  if (Array.isArray(payload?.data?.servers)) {
    return payload.data.servers;
  }

  return [];
};

const ensureOk = async (response, endpoint) => {
  if (response.ok) {
    return;
  }

  const body = await response.text();
  throw new Error(`Crafty API request failed (${response.status}) on ${endpoint}: ${body.slice(0, 300)}`);
};

const normalizeServerStats = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const dataSection = payload.data && typeof payload.data === 'object' ? payload.data : {};
  return {
    ...dataSection,
    ...payload
  };
};

const collectStrings = (value, acc = []) => {
  if (typeof value === 'string') {
    acc.push(value);
    return acc;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, acc));
    return acc;
  }

  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectStrings(item, acc));
  }

  return acc;
};

const parseWhitelistPlayers = (raw) => {
  const candidates = collectStrings(raw)
    .join('\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const set = new Set();

  for (const line of candidates) {
    const directMatch = line.match(/whitelisted players?:\s*(.*)/i);
    if (directMatch) {
      directMatch[1]
        .split(',')
        .map((name) => name.trim().replace(/[.'`]/g, ''))
        .filter(Boolean)
        .forEach((name) => set.add(name));
      continue;
    }

    const singleAddMatch = line.match(/added\s+([^\s]+)\s+to the whitelist/i);
    if (singleAddMatch) {
      set.add(singleAddMatch[1]);
      continue;
    }

    const listedNamesMatch = line.match(/^([A-Za-z0-9_\-.,\s]+)$/);
    if (listedNamesMatch && line.includes(',')) {
      line.split(',').map((name) => name.trim()).filter(Boolean).forEach((name) => set.add(name));
    }
  }

  return [...set];
};

const parseLogPayload = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = await response.json();
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.data)) {
      return payload.data;
    }

    return [];
  }

  const text = await response.text();
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};

export async function getServers() {
  const endpoint = '/api/v2/servers';
  const response = await fetch(`${config.craftyBaseUrl}${endpoint}`, {
    headers: jsonHeaders,
    method: 'GET'
  });

  await ensureOk(response, endpoint);

  const payload = await response.json();
  return extractServerArray(payload).map(normalizeServer);
}

export async function getServerStats(serverId) {
  const endpoint = `/api/v2/servers/${serverId}/stats`;
  const response = await fetch(`${config.craftyBaseUrl}${endpoint}`, {
    headers: jsonHeaders,
    method: 'GET'
  });

  await ensureOk(response, endpoint);

  const payload = await response.json();
  return normalizeServerStats(payload);
}

export async function runServerConsoleCommand(serverId, command) {
  const endpoint = `/api/v2/servers/${serverId}/stdin`;
  const commandText = String(command ?? '').trim();
  const response = await fetch(`${config.craftyBaseUrl}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${config.craftyToken}`,
      'Content-Type': 'text/plain'
    },
    method: 'POST',
    body: commandText
  });

  await ensureOk(response, endpoint);

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export async function getServerLogs(serverId, options = {}) {
  const query = new URLSearchParams({
    file: String(options.file ?? false),
    colors: String(options.colors ?? false),
    raw: String(options.raw ?? false),
    html: String(options.html ?? false)
  });

  const endpoint = `/api/v2/servers/${serverId}/logs?${query.toString()}`;
  const response = await fetch(`${config.craftyBaseUrl}${endpoint}`, {
    headers: jsonHeaders,
    method: 'GET'
  });

  await ensureOk(response, endpoint);

  return parseLogPayload(response);
}

export async function getWhitelistPlayers(serverId) {
  const result = await runServerConsoleCommand(serverId, 'whitelist list');
  return parseWhitelistPlayers(result);
}
