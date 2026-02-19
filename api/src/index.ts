import { app } from '@azure/functions';
import { chat } from './functions/chat.js';
import { direct } from './functions/direct.js';
import { groupCreate } from './functions/groupCreate.js';
import { groupJoin } from './functions/groupJoin.js';

app.http('groupCreate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'group/create',
  handler: groupCreate
});

app.http('groupJoin', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'group/join',
  handler: groupJoin
});

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
