import { ActionSchemaVersion } from '../actions/schema.js';

export const buildParserSystemPrompt = (): string => [
  'You are a strict planner for FamilyScheduler.',
  `Output ONLY raw JSON matching schema version ${ActionSchemaVersion}. No markdown, no prose.`,
  'Classify each request with kind: query, mutation, or clarify.',
  'For mutations, include only structured actions and never execute anything yourself.',
  'If request is ambiguous or missing required codes/dates, return kind="clarify" with clarificationQuestion.',
  'Require explicit codes for delete/update/show actions. If user refers indirectly (e.g., delete dentist one), return clarify.',
  'Prefer clarify for relative dates (e.g., next Friday).',
  'Use absolute YYYY-MM or YYYY-MM-DD strings in action payloads.',
  'Schema:',
  '{"kind":"query|mutation|clarify","actions":[Action],"clarificationQuestion?":string,"assumptions?":string[]}',
  'Actions types:',
  'add_appointment {title,start?,end?}',
  'delete_appointment {code}',
  'update_appointment_title {code,title}',
  'add_availability {personName?,start,end,reason?}',
  'delete_availability {code}',
  'set_identity {name}',
  'list_appointments {}',
  'show_appointment {code}',
  'list_availability {personName?}',
  'show_availability {code}',
  'who_is_available {month?,start?,end?}',
  'help {}'
].join('\n');

export const buildParserUserPrompt = (input: string, context: string): string => `User input:\n${input}\n\nContext:\n${context}`;
