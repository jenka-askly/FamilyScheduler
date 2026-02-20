#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createZipFromDirectory, listZipEntries } from './zip-utils.mjs';

const repoRoot = process.cwd();
const apiRoot = path.join(repoRoot, 'api');
const distRoot = path.join(apiRoot, 'dist');
const outRoot = path.join(repoRoot, '.artifacts', 'deploy');
const stagingRoot = path.join(outRoot, 'api-package');
const deployWorkspaceRoot = path.join(outRoot, 'api-deploy-install');
const zipPath = path.join(outRoot, 'familyscheduler-api.zip');
const requiredEntries = ['host.json', 'package.json', 'dist/index.js', 'dist/functions/groupCreate.js'];

if (!existsSync(distRoot)) throw new Error('Missing api/dist. Run `pnpm --filter @familyscheduler/api build` first.');

rmSync(stagingRoot, { recursive: true, force: true });
rmSync(deployWorkspaceRoot, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(stagingRoot, { recursive: true });

cpSync(path.join(apiRoot, 'host.json'), path.join(stagingRoot, 'host.json'));
cpSync(path.join(apiRoot, 'package.json'), path.join(stagingRoot, 'package.json'));
cpSync(distRoot, path.join(stagingRoot, 'dist'), { recursive: true });

execFileSync('pnpm', ['--filter', '@familyscheduler/api', 'deploy', '--legacy', '--prod', deployWorkspaceRoot], {
  cwd: repoRoot,
  stdio: 'inherit'
});

cpSync(path.join(deployWorkspaceRoot, 'node_modules'), path.join(stagingRoot, 'node_modules'), { recursive: true });

createZipFromDirectory(stagingRoot, zipPath);

const entries = listZipEntries(zipPath);
for (const required of requiredEntries) {
  if (!entries.includes(required)) throw new Error(`Deploy zip missing required entry: ${required}`);
}
if (!entries.some((entry) => /^dist\/functions\/[^/]+\.js$/.test(entry))) throw new Error('Deploy zip missing dist/functions/*.js');
if (!entries.some((entry) => entry.startsWith('node_modules/'))) throw new Error('Deploy zip missing node_modules/**');

console.log(`Created ${zipPath}`);
console.log(`Verified zip invariant entries (${requiredEntries.join(', ')})`);
