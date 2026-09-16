import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';

const packageSpec = '@off-market/pmp-mcp@0.1.4';
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';

// The package is on npmjs, so the DEFAULT resolve is the correct one. Only a scope mapping that
// redirects @off-market elsewhere is a problem — it would hand a process carrying
// PMP_EVM_PRIVATE_KEY to a registry we do not own.
const configuredRegistry = spawnSync(npm, ['config', 'get', '@off-market:registry'], {
  encoding: 'utf8',
  shell: isWindows,
  windowsHide: true,
});
const normalized = configuredRegistry.stdout?.trim().replace(/\/+$/, '');
const redirected =
  configuredRegistry.status === 0 &&
  normalized !== 'undefined' &&
  normalized !== '' &&
  normalized !== 'https://registry.npmjs.org';

if (redirected) {
  process.stderr.write(
    `pmp-mcp: @off-market:registry is mapped to ${normalized}, not npmjs. Run \`npm config delete @off-market:registry\` and retry.\n`,
  );
  process.exitCode = 1;
} else {
  const child = spawn(npm, ['exec', '--yes', '--', packageSpec], {
    env: process.env,
    shell: isWindows,
    stdio: 'inherit',
    windowsHide: true,
  });

  child.once('error', () => {
    process.stderr.write('pmp-mcp: failed to start npm.\n');
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
}
