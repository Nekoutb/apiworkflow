// =============================================================================
//  Minimal Next.js custom server — listens on a Unix domain socket
// =============================================================================
//  Why a socket instead of a TCP port?
//   - No port number to manage / collide with other apps on the VPS
//   - Faster than localhost TCP (no TCP/IP stack overhead)
//   - Slightly more secure (filesystem permissions, not network namespace)
//   - nginx connects via `proxy_pass http://unix:/run/cmipaportal.sock:`
//
//  The socket path comes from $SOCKET_PATH (deploy script sets this) and
//  defaults to /run/cmipaportal.sock. The file is chmodded 0666 so nginx
//  (running as www-data) can connect without group management.
//
//  Lifecycle:
//    - On startup, removes any stale socket file at the path
//    - chmods the newly-created socket so nginx can read/write
//    - On SIGINT/SIGTERM (PM2 reload), cleans up the socket file
// =============================================================================

const { createServer } = require('http');
const { parse } = require('url');
const fs = require('fs');
const next = require('next');

const SOCKET_PATH = process.env.SOCKET_PATH || '/run/cmipaportal.sock';
const dev = process.env.NODE_ENV !== 'production';

const app = next({ dev });
const handle = app.getRequestHandler();

function unlinkIfExists(p) {
  try { fs.unlinkSync(p); } catch (_) { /* not present, fine */ }
}

app.prepare().then(() => {
  // Remove leftover socket from a previous run (PM2 reload, crashed process, etc.)
  unlinkIfExists(SOCKET_PATH);

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  server.listen(SOCKET_PATH, () => {
    // 0666 = anyone on the local machine can connect (nginx is the consumer).
    // No port is exposed, so this is equivalent to localhost-only TCP.
    try { fs.chmodSync(SOCKET_PATH, 0o666); } catch (_) {}
    console.log(`> Ready on unix:${SOCKET_PATH}`);
  });

  server.on('error', (err) => {
    console.error('[server] fatal:', err);
    process.exit(1);
  });

  const shutdown = (signal) => () => {
    console.log(`> ${signal} received — closing server`);
    server.close(() => {
      unlinkIfExists(SOCKET_PATH);
      process.exit(0);
    });
    // Force exit if close hangs (PM2 has its own kill timeout)
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT',  shutdown('SIGINT'));
  process.on('SIGTERM', shutdown('SIGTERM'));
});
