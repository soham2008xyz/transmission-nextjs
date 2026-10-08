/** Largest .torrent file the Add dialog and RPC route accept. */
export const MAX_TORRENT_FILE_BYTES = 20 * 1024 * 1024;

/**
 * Largest RPC request body the route accepts. The UI sends the file as base64
 * (4 bytes per 3), so this covers a maximum-size file plus JSON overhead.
 * Keep `proxyClientMaxBodySize` in next.config.mjs above this value.
 */
export const MAX_RPC_BODY_BYTES = Math.ceil((MAX_TORRENT_FILE_BYTES * 4) / 3) + 64 * 1024;
