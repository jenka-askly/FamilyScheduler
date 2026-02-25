import { app, type HttpHandler, type HttpMethod } from '@azure/functions';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chat } from './functions/chat.js';
import { direct } from './functions/direct.js';
import { diagnoseOpenAi } from './functions/diagnoseOpenAi.js';
import { groupCreate } from './functions/groupCreate.js';
import { groupJoin } from './functions/groupJoin.js';
import { groupJoinLink } from './functions/groupJoinLink.js';
import { groupMeta } from './functions/groupMeta.js';
import { groupRename } from './functions/groupRename.js';
import { usage } from './functions/usage.js';
import { scanAppointment } from './functions/scanAppointment.js';
import { appointmentScanImage } from './functions/appointmentScanImage.js';
import { appointmentScanDelete } from './functions/appointmentScanDelete.js';
import { appointmentScanRescan } from './functions/appointmentScanRescan.js';
import { authRequestLink } from './functions/authRequestLink.js';
import { authConsumeLink } from './functions/authConsumeLink.js';
import { igniteStart } from './functions/igniteStart.js';
import { igniteClose } from './functions/igniteClose.js';
import { igniteJoin } from './functions/igniteJoin.js';
import { ignitePhoto } from './functions/ignitePhoto.js';
import { ignitePhotoGet } from './functions/ignitePhotoGet.js';
import { igniteMeta } from './functions/igniteMeta.js';
import { igniteSpinoff } from './functions/igniteSpinoff.js';
import { userProfilePhotoSet } from './functions/userProfilePhotoSet.js';
import { userProfilePhotoMeta } from './functions/userProfilePhotoMeta.js';
import { userProfilePhotoGet } from './functions/userProfilePhotoGet.js';

const startupId = `startup-${Date.now().toString(36)}`;
const startupDebugEnabled = (process.env.FUNCTIONS_STARTUP_DEBUG ?? '').toLowerCase() === 'true';
const modulePath = fileURLToPath(import.meta.url);
const moduleDir = dirname(modulePath);
const expectedFunctions = ['groupCreate', 'groupJoin', 'groupJoinLink', 'groupMeta', 'groupRename', 'chat', 'direct', 'diagnoseOpenAi', 'usage', 'scanAppointment', 'appointmentScanImage', 'appointmentScanDelete', 'appointmentScanRescan', 'authRequestLink', 'authConsumeLink', 'igniteStart', 'igniteClose', 'igniteJoin', 'ignitePhoto', 'ignitePhotoGet', 'igniteMeta', 'igniteSpinoff', 'userProfilePhotoSet', 'userProfilePhotoMeta', 'userProfilePhotoGet'];
let registeredFunctionCount = 0;

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
  registeredFunctionCount += 1;
  startupLog('registered-function', { functionName: name, route, methods });
};

startupLog('loading-functions-entrypoint', {
  modulePath,
  nodeVersion: process.version
});


startupLog('time-resolve-ai-config', {
  timeResolveModel: process.env.TIME_RESOLVE_MODEL ?? null,
  openAiModel: process.env.OPENAI_MODEL ?? null,
  azureEndpointConfigured: Boolean(process.env.AZURE_OPENAI_ENDPOINT?.trim()),
});

if (startupDebugEnabled) {
  startupLog('startup-debug-enabled', {
    cwd: process.cwd(),
    functionsWorkerRuntime: process.env.FUNCTIONS_WORKER_RUNTIME,
    nodeProcessCommandLine: process.execPath,
    distIndexExists: existsSync(resolve(moduleDir, 'index.js')),
    hostJsonExists: existsSync(resolve(moduleDir, '../host.json')),
    packageJsonExists: existsSync(resolve(moduleDir, '../package.json'))
  });
}

registerHttp('groupCreate', 'group/create', ['POST'], groupCreate);

registerHttp('groupJoin', 'group/join', ['POST'], groupJoin);
registerHttp('groupJoinLink', 'group/join-link', ['POST'], groupJoinLink);

registerHttp('groupMeta', 'group/meta', ['GET'], groupMeta);

registerHttp('groupRename', 'group/rename', ['POST'], groupRename);

registerHttp('chat', 'chat', ['POST'], chat);

registerHttp('direct', 'direct', ['POST'], direct);

registerHttp('diagnoseOpenAi', 'diagnose/openai', ['GET'], diagnoseOpenAi);

registerHttp('usage', 'usage', ['GET'], usage);


registerHttp('scanAppointment', 'scanAppointment', ['POST'], scanAppointment);
registerHttp('appointmentScanImage', 'appointmentScanImage', ['GET'], appointmentScanImage);
registerHttp('appointmentScanDelete', 'appointmentScanDelete', ['POST'], appointmentScanDelete);
registerHttp('appointmentScanRescan', 'appointmentScanRescan', ['POST'], appointmentScanRescan);

registerHttp('authRequestLink', 'auth/request-link', ['POST'], authRequestLink);
registerHttp('authConsumeLink', 'auth/consume-link', ['POST'], authConsumeLink);

registerHttp('igniteStart', 'ignite/start', ['POST'], igniteStart);
registerHttp('igniteClose', 'ignite/close', ['POST'], igniteClose);
registerHttp('igniteJoin', 'ignite/join', ['POST'], igniteJoin);
registerHttp('ignitePhoto', 'ignite/photo', ['POST'], ignitePhoto);
registerHttp('ignitePhotoGet', 'ignite/photo', ['GET'], ignitePhotoGet);
registerHttp('igniteMeta', 'ignite/meta', ['GET', 'POST'], igniteMeta);
registerHttp('igniteSpinoff', 'ignite/spinoff', ['POST'], igniteSpinoff);
registerHttp('userProfilePhotoSet', 'user/profile-photo', ['POST'], userProfilePhotoSet);
registerHttp('userProfilePhotoMeta', 'user/profile-photo', ['GET'], userProfilePhotoMeta);
registerHttp('userProfilePhotoGet', 'user/profile-photo/image', ['GET'], userProfilePhotoGet);

startupLog('registration-summary', {
  expectedFunctions,
  expectedCount: expectedFunctions.length,
  registeredCount: registeredFunctionCount
});
