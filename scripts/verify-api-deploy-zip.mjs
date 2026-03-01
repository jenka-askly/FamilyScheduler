#!/usr/bin/env node
import path from 'node:path';
import { listZipEntries } from './zip-utils.mjs';

const zipPath = path.resolve(process.cwd(), '.artifacts/deploy/familyscheduler-api.zip');
const requiredEntries = [
  'host.json',
  'package.json',
  'dist/api/src/index.js',
  'dist/api/src/functions/groupInviteEmail.js'
];
const entries = listZipEntries(zipPath);

for (const required of requiredEntries) {
  if (!entries.includes(required)) throw new Error(`Missing required zip entry: ${required}`);
}
if (!entries.some((entry) => /^dist\/api\/src\/functions\/[^/]+\.js$/.test(entry))) {
  throw new Error('Missing dist/api/src/functions/*.js entries');
}
if (!entries.some((entry) => entry.startsWith('node_modules/'))) throw new Error('Missing node_modules/** entries');

console.log(`Verified ${zipPath}`);
console.log(`Entries checked: ${requiredEntries.join(', ')}`);
