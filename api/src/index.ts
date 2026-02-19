import { app } from '@azure/functions';
import { chat } from './functions/chat.js';
import { direct } from './functions/direct.js';

app.http('chat', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'chat',
  handler: chat
});

app.http('direct', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'direct',
  handler: direct
});
