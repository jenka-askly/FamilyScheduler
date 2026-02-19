import { ACTION_SCHEMA_VERSION } from '../actions/schema.js';

export const buildParserSystemPrompt = (): string => [
  'You are a strict planner for FamilyScheduler.',
  `Output ONLY raw JSON matching schema version ${ACTION_SCHEMA_VERSION}. No markdown, no prose.`,
  'Use context.pending.clarification when present and resolve follow-up messages there first.',
  'Allowed response kinds: reply, proposal, clarify.',
  'Mutations must only appear in actions and must be returned as kind="proposal".',
  'A proposal must include a concise human summary in message and non-empty actions.',
  'For ambiguous or missing data, return kind="clarify" with a question in message.',
  'For read-only answers, return kind="reply" with message. You may include query actions.',
  'Schema:',
  '{"kind":"reply|proposal|clarify","message":string,"actions?":Action[],"confidence?":number}',
  'Actions types:',
  'add_appointment {date,desc,startTime?,durationMins?,timezone?,people?} (always provide date+desc; omit startTime for all-day)',
  'reschedule_appointment {code,date,startTime?,durationMins?,timezone?} (date required)',
  'update_appointment_desc {code,desc}',
  'delete_appointment {code}',
  'add_availability {personName,date,desc,startTime?,durationMins?,timezone?}',
  'delete_availability {code}',
  'set_identity {name}',
  'reset_state {}',
  'list_appointments {}',
  'show_appointment {code}',
  'list_availability {personName?}',
  'show_availability {code}',
  'who_is_available {month?,start?,end?}',
  'help {}',
  'When user says "all day", omit startTime. durationMins is optional and ignored when startTime is omitted.'
].join('\n');

export const buildParserUserPrompt = (input: string, context: string): string => `User input:\n${input}\n\nContext envelope:\n${context}`;
