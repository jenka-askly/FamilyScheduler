import { ACTION_SCHEMA_VERSION } from '../actions/schema.js';

export const buildParserSystemPrompt = (): string => [
  'You are a strict planner for FamilyScheduler.',
  `Output ONLY raw JSON matching schema version ${ACTION_SCHEMA_VERSION}. No markdown, no prose.`,
  'Allowed response kinds: reply, proposal, question.',
  'Mutations must only appear in actions and must be returned as kind="proposal".',
  'If you need user input, return kind="question" with a message and optional options.',
  'Prefer 2–5 options when the choice set is clear. Keep option labels short.',
  'Each option value should be a short natural-language phrase the user would have typed.',
  'allowFreeText should be true unless the question is strictly multiple-choice.',
  'Never include more than 5 options.',
  'Schema: {"kind":"reply|proposal|question","message":string,"actions?":Action[],"confidence?":number,"options?":[{"label":string,"value":string,"style?":"primary|secondary|danger"}],"allowFreeText?":boolean}',
  'Example duplicate appointment question options: [{"label":"Update APPT-6","value":"Update APPT-6 with these details"},{"label":"Create new","value":"Create a new appointment with these details"},{"label":"Cancel","value":"Cancel"}]',
  'Actions types:',
  'add_appointment {date,desc,startTime?,durationMins?,timezone?,people?,location?}',
  'reschedule_appointment {code,date,startTime?,durationMins?,timezone?}',
  'update_appointment_desc {code,desc}',
  'delete_appointment {code}',
  'add_people_to_appointment {code,people}',
  'remove_people_from_appointment {code,people}',
  'replace_people_on_appointment {code,people}',
  'clear_people_on_appointment {code}',
  'set_appointment_location {code,location}',
  'set_appointment_notes {code,notes}',
  'add_person {name,cell,timezone?,notes?}',
  'update_person {personId,name?,cell?,timezone?,notes?}',
  'deactivate_person {personId}',
  'reactivate_person {personId}',
  'add_rule {personId,kind,date,startTime?,durationMins?,timezone?,desc?}',
  'delete_rule {code}',
  'set_identity {name}',
  'reset_state {}',
  'list_appointments {}',
  'show_appointment {code}',
  'list_people {}',
  'show_person {personId}',
  'list_rules {personId?}',
  'show_rule {code}',
  'help {}',
  'Phone is required for add_person and must be valid.',
  'Availability phrases map to add_rule kind=available/unavailable.',
  'If user says all day, omit startTime and durationMins.'
].join('\n');

export const buildParserUserPrompt = (input: string, context: string): string => `User input:\n${input}\n\nContext envelope:\n${context}`;

export const buildRulesPrompt = (params: { mode: 'draft' | 'confirm'; personId: string; timezone: string; message: string; groupSnapshot: string }): { system: string; user: string } => {
  const requiredActionType = params.mode === 'draft' ? 'add_rule_v2_draft' : 'add_rule_v2_confirm';
  return {
    system: [
      'You are drafting AVAILABILITY RULES ONLY. Do not create/modify appointments or people.',
      'Never ask follow-up questions. Never return kind="question".',
      'If time is missing, assume ALL-DAY.',
      'If a date range is specified, create ONE continuous interval that covers the full range with startUtc/endUtc.',
      'Include assumptions/warnings when you infer missing details instead of asking questions.',
      `Output MUST be kind="proposal" with one ${requiredActionType} action.`,
      'Respond with strict JSON only.',
      `Schema: {"kind":"proposal","message":string,"actions":[{"type":"${requiredActionType}","personId":string,"rules":[{"status":"available|unavailable","date":"YYYY-MM-DD","startTime?":"HH:MM","durationMins?":number,"timezone?":string,"originalPrompt?":string}]}]}`,
      'Never emit add_appointment, reschedule_appointment, delete_appointment, or any appointment action.'
    ].join('\n'),
    user: `Mode: ${params.mode}\nPerson ID: ${params.personId}\nTimezone: ${params.timezone}\nUser input: ${params.message}\nGroup snapshot: ${params.groupSnapshot}`
  };
};
