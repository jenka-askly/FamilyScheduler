import { app } from '@azure/functions';
import { chat } from './functions/chat.js';

app.http('chat', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'chat',
  handler: chat
});
