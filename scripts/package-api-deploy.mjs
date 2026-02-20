#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const apiRoot = path.join(repoRoot, 'api');
const distRoot = path.join(apiRoot, 'dist');
const outRoot = path.join(repoRoot, '.artifacts', 'deploy');
const stagingRoot = path.join(outRoot, 'api-package');
const zipPath = path.join(outRoot, 'familyscheduler-api.zip');

if (!existsSync(distRoot)) {
  throw new Error('Missing api/dist. Run `pnpm --filter @familyscheduler/api build` first.');
}

rmSync(stagingRoot, { recursive: true, force: true });
mkdirSync(outRoot, { recursive: true });

execSync(`pnpm --filter @familyscheduler/api deploy --legacy --prod ${JSON.stringify(stagingRoot)}`, {
  cwd: repoRoot,
  stdio: 'inherit'
});

cpSync(path.join(apiRoot, 'host.json'), path.join(stagingRoot, 'host.json'));
cpSync(path.join(apiRoot, 'package.json'), path.join(stagingRoot, 'package.json'));
cpSync(distRoot, path.join(stagingRoot, 'dist'), { recursive: true });

rmSync(path.join(stagingRoot, 'src'), { recursive: true, force: true });
rmSync(path.join(stagingRoot, 'tsconfig.json'), { force: true });
rmSync(path.join(stagingRoot, 'README.md'), { force: true });
rmSync(path.join(stagingRoot, 'local.settings.example.json'), { force: true });

rmSync(zipPath, { force: true });

if (process.platform === 'win32') {
  const escapedZipPath = zipPath.replace(/'/g, "''");
  const escapedStagingRoot = stagingRoot.replace(/'/g, "''");

  execSync(
    [
      'powershell -NoProfile -NonInteractive -Command',
      `"Compress-Archive -Path '${escapedStagingRoot}\\*' -DestinationPath '${escapedZipPath}' -CompressionLevel Optimal -Force"`
    ].join(' '),
    {
      cwd: stagingRoot,
      stdio: 'inherit'
    }
  );
} else {
  execSync(`zip -qr ${JSON.stringify(zipPath)} .`, {
    cwd: stagingRoot,
    stdio: 'inherit'
  });
}

console.log(`Created ${zipPath}`);
