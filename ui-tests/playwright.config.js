/**
 * Configuration for Playwright using default from @jupyterlab/galata
 */
const { execFileSync } = require('child_process');
const baseConfig = require('@jupyterlab/galata/lib/playwright-config');
const hasExternalTarget = Boolean(process.env.TARGET_URL);

// Pin to IPv4 so the server bind address and the URL Galata connects to agree
// (localhost can otherwise resolve to IPv6 ::1 while Jupyter binds 127.0.0.1).
const HOST = '127.0.0.1';

/**
 * Ask the OS for a free TCP port. Ephemeral ports never collide with Jupyter's
 * default (8888); the loop is a belt-and-suspenders guard on that promise.
 */
function findFreePort() {
  const script =
    "const s=require('net').createServer();" +
    `s.listen(0,'${HOST}',()=>{const p=s.address().port;` +
    's.close(()=>process.stdout.write(String(p)))});';
  return parseInt(
    execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }).trim(),
    10
  );
}

// Playwright re-evaluates this config in every worker process, so resolve the
// port once and share it through the environment (workers inherit it). Without
// this each worker would pick a different port from the running server.
if (!hasExternalTarget && !process.env.JLAB_TEST_PORT) {
  let candidate = findFreePort();
  while (candidate === 8888) {
    candidate = findFreePort();
  }
  process.env.JLAB_TEST_PORT = String(candidate);
}
const port = process.env.JLAB_TEST_PORT;

// Galata's fixtures read the server origin from `baseURL` (otherwise defaulting
// to http://localhost:8888). Point it at the test server (or an external
// target) so galata-fixture specs reach the right server.
const baseURL = process.env.TARGET_URL ?? `http://${HOST}:${port}`;

const config = {
  ...baseConfig,
  timeout: 180 * 1000,
  retries: 1,
  use: {
    ...(baseConfig.use ?? {}),
    baseURL
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...(baseConfig.use ?? {}),
        browserName: 'chromium'
      }
    },
    {
      name: 'firefox',
      use: {
        ...(baseConfig.use ?? {}),
        browserName: 'firefox'
      }
    },
    {
      name: 'webkit',
      use: {
        ...(baseConfig.use ?? {}),
        browserName: 'webkit'
      }
    }
  ],
  webServer: hasExternalTarget
    ? undefined
    : {
        // Start a fresh server on the free port; never reuse an existing
        // server, and never sit on Jupyter's default 8888.
        command: `jupyter lab scratch --ServerApp.port=${port} --ServerApp.ip=${HOST} --config jupyter_server_test_config.py`,
        url: `${baseURL}/lab`,
        timeout: 120 * 1000,
        reuseExistingServer: false,
        gracefulShutdown: {
          signal: 'SIGINT',
          timeout: 15 * 1000
        }
      }
};

module.exports = config;
