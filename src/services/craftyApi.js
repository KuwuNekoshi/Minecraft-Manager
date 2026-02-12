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
