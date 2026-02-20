#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
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

execFileSync('pnpm', ['--filter', '@familyscheduler/api', 'deploy', '--legacy', '--prod', stagingRoot], {
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

const createZipWithTar = () => {
  execFileSync('tar', ['-a', '-c', '-f', zipPath, '.'], {
    cwd: stagingRoot,
    stdio: 'inherit'
  });
};


const isZipFile = (filePath) => {
  if (!existsSync(filePath)) {
    return false;
  }

  const signature = readFileSync(filePath, { encoding: null, flag: 'r' }).subarray(0, 2);
  return signature.length === 2 && signature[0] === 0x50 && signature[1] === 0x4b;
};

const createZipWithPython = () => {
  const script = [
    'import pathlib, sys, zipfile',
    'root = pathlib.Path(sys.argv[1]).resolve()',
    'zip_path = pathlib.Path(sys.argv[2]).resolve()',
    "with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:",
    '    for path in sorted(root.rglob("*")):',
    '        if path.is_file():',
    '            arcname = path.relative_to(root).as_posix()',
    '            zf.write(path, arcname)',
    "print(f'Created {zip_path}')"
  ].join('\n');

  const candidates = process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'];
  let lastError;

  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['-c', script, stagingRoot, zipPath], { stdio: 'inherit' });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Unable to package zip: tar unavailable and no Python runtime found. Last error: ${lastError?.message ?? 'unknown'}`);
};

try {
  createZipWithTar();

  if (!isZipFile(zipPath)) {
    throw new Error('tar output is not a zip archive on this platform');
  }

  console.log('Packaged deploy zip using tar -a (POSIX entry names).');
} catch (error) {
  console.warn('tar -a packaging unavailable; falling back to Python zipfile POSIX packaging.', error.message);
  createZipWithPython();
  console.log('Packaged deploy zip using Python zipfile fallback (POSIX entry names).');
}

console.log(`Created ${zipPath}`);
