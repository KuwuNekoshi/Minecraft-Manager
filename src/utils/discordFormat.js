export const formatServerLine = (server) => {
  const statusEmoji = server.status === 'running' ? '🟢' : server.status === 'stopped' ? '🔴' : '⚪';
  const portLabel = server.port ? `${server.port}` : 'No port configured';
  return `${statusEmoji} **${server.name}** (ID: ${server.id}) • Status: ${server.status} • Port: ${portLabel}`;
};

export const parsePortRange = (range) => {
  const [startRaw, endRaw] = range.split('-').map((value) => Number(value.trim()));

  if (!Number.isInteger(startRaw) || !Number.isInteger(endRaw) || startRaw <= 0 || endRaw <= 0) {
    throw new Error(`Invalid CRAFTY_PORT_RANGE value: ${range}`);
  }

  const start = Math.min(startRaw, endRaw);
  const end = Math.max(startRaw, endRaw);

  return { start, end };
};

export const chunkLines = (lines, maxChunkSize = 8) => {
  const chunks = [];
  for (let i = 0; i < lines.length; i += maxChunkSize) {
    chunks.push(lines.slice(i, i + maxChunkSize));
  }

  return chunks;
};
