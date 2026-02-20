import { app, type HttpHandler, type HttpMethod } from '@azure/functions';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chat } from './functions/chat.js';
import { direct } from './functions/direct.js';
import { groupCreate } from './functions/groupCreate.js';
import { groupJoin } from './functions/groupJoin.js';
import { groupMeta } from './functions/groupMeta.js';

const startupId = `startup-${Date.now().toString(36)}`;
const startupDebugEnabled = (process.env.FUNCTIONS_STARTUP_DEBUG ?? '').toLowerCase() === 'true';
const modulePath = fileURLToPath(import.meta.url);
const moduleDir = dirname(modulePath);

const startupLog = (message: string, details?: Record<string, unknown>): void => {
  const payload = { component: 'api-startup', startupId, message, ...(details ?? {}) };
  console.log(JSON.stringify(payload));
};

const registerHttp = (name: string, route: string, methods: HttpMethod[], handler: HttpHandler): void => {
  app.http(name, {
    methods,
    authLevel: 'anonymous',
    route,
    handler
  });
  startupLog('registered-function', { functionName: name, route, methods });
};

startupLog('loading-functions-entrypoint', {
  modulePath,
  nodeVersion: process.version
});

if (startupDebugEnabled) {
  startupLog('startup-debug-enabled', {
    cwd: process.cwd(),
    distIndexExists: existsSync(resolve(moduleDir, 'index.js')),
    hostJsonExists: existsSync(resolve(moduleDir, '../host.json')),
    packageJsonExists: existsSync(resolve(moduleDir, '../package.json'))
  });
}

registerHttp('groupCreate', 'group/create', ['POST'], groupCreate);

registerHttp('groupJoin', 'group/join', ['POST'], groupJoin);

registerHttp('groupMeta', 'group/meta', ['GET'], groupMeta);

registerHttp('chat', 'chat', ['POST'], chat);

registerHttp('direct', 'direct', ['POST'], direct);
