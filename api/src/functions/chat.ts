import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

type ChatRequest = {
  message?: unknown;
};

type Person = {
  id: string;
  name: string;
};

type Appointment = {
  id: string;
  code: string;
  title: string;
  start: string;
  end: string;
  assigned: string[];
};

type AvailabilityBlock = {
  id: string;
  code: string;
  personId: string;
  start: string;
  end: string;
  reason?: string;
};

type ProposalAction =
  | {
      type: 'add_appointment';
      title: string;
    }
  | {
      type: 'delete_appointment';
      code: string;
    }
  | {
      type: 'update_appointment_title';
      code: string;
      title: string;
    }
  | {
      type: 'add_availability';
      personId: string;
      start: string;
      end: string;
      reason?: string;
    }
  | {
      type: 'delete_availability';
      code: string;
    };

type PendingProposal = {
  id: string;
  actions: [ProposalAction];
};

type ParsedDateTime = {
  date: string;
  startTime: string;
  endTime: string;
  startIso: string;
  endIso: string;
};

const state: { appointments: Appointment[]; people: Person[]; availability: AvailabilityBlock[] } = {
  appointments: [],
  people: [
    { id: 'person-joe', name: 'Joe' },
    { id: 'person-sam', name: 'Sam' }
  ],
  availability: []
};

let appointmentCodeCounter = 0;
let pendingProposal: PendingProposal | null = null;
let activePersonId: string | null = null;

const availabilityCodeCounters: Record<string, number> = {};

const badRequest = (message: string): HttpResponseInit => ({
  status: 400,
  jsonBody: {
    kind: 'error',
    message
  }
});

const normalizeCode = (value: string): string => value.trim().toUpperCase();

const normalizeName = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();

const findAppointmentByCode = (inputCode: string): Appointment | undefined => {
  const normalizedCode = normalizeCode(inputCode);
  return state.appointments.find((item) => normalizeCode(item.code) === normalizedCode);
};

const findAvailabilityByCode = (inputCode: string): AvailabilityBlock | undefined => {
  const normalizedCode = normalizeCode(inputCode);
  return state.availability.find((item) => normalizeCode(item.code) === normalizedCode);
};

const findPersonByName = (name: string): Person | undefined => state.people.find((person) => normalizeName(person.name) === normalizeName(name));

const ensurePersonByName = (name: string): Person => {
  const existing = findPersonByName(name);

  if (existing) {
    return existing;
  }

  const idToken = normalizeName(name).replace(/\s+/g, '-');
  const created: Person = {
    id: `person-${idToken}`,
    name: name.trim().replace(/\s+/g, ' ')
  };

  state.people.push(created);
  return created;
};

const getPersonDisplayName = (personId: string): string => state.people.find((person) => person.id === personId)?.name ?? personId;

const parseStoredDateTime = (value: string): Date => new Date(value);

const formatDate = (value: string): string => {
  const date = parseStoredDateTime(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
};

const formatTime = (value: string): string => {
  const date = parseStoredDateTime(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const formatDateTimeRange = (start: string, end: string): string => `${formatDate(start)} ${formatTime(start)}–${formatTime(end)}`;

const buildAppointmentsSnapshot = (): string => {
  if (state.appointments.length === 0) {
    return 'Upcoming appointments:\n(none)';
  }

  const lines = state.appointments
    .slice(0, 5)
    .map((appointment) => `${appointment.code} — ${appointment.title}`);

  return `Upcoming appointments:\n${lines.join('\n')}`;
};

const buildAvailabilitySnapshot = (): string => {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

  const upcoming = state.availability
    .filter((block) => {
      const blockStart = parseStoredDateTime(block.start);
      return !Number.isNaN(blockStart.getTime()) && blockStart >= now && blockStart <= sevenDaysFromNow;
    })
    .sort((a, b) => parseStoredDateTime(a.start).getTime() - parseStoredDateTime(b.start).getTime());

  if (upcoming.length === 0) {
    return 'Availability blocks (next 7 days):\n(none)';
  }

  const lines = upcoming.map((block) => {
    const reason = block.reason ? ` (${block.reason})` : '';
    return `${block.code} — ${getPersonDisplayName(block.personId)} ${formatDateTimeRange(block.start, block.end)}${reason}`;
  });

  return `Availability blocks (next 7 days):\n${lines.join('\n')}`;
};

const formatAppointmentDetails = (appointment: Appointment): string => {
  const assigned = appointment.assigned.length > 0 ? appointment.assigned.join(', ') : '(none)';

  return [
    `${appointment.code} — ${appointment.title}`,
    `id: ${appointment.id}`,
    `start: ${appointment.start}`,
    `end: ${appointment.end}`,
    `assigned: ${assigned}`
  ].join('\n');
};

const formatAvailabilityDetails = (block: AvailabilityBlock): string => {
  const reason = block.reason ?? '(none)';

  return [
    `${block.code} — ${getPersonDisplayName(block.personId)}`,
    `id: ${block.id}`,
    `start: ${block.start}`,
    `end: ${block.end}`,
    `reason: ${reason}`
  ].join('\n');
};

const parseDeleteCommand = (message: string): { code: string } | null => {
  const match = message.match(/^delete\s+([a-z]+-[a-z0-9-]+)$/i);

  if (!match) {
    return null;
  }

  return {
    code: normalizeCode(match[1])
  };
};

const parseUpdateTitleCommand = (message: string): { code: string; title: string } | null => {
  const match = message.match(/^update\s+(appt-\d+)\s+title\s*(.*)$/i);

  if (!match) {
    return null;
  }

  return {
    code: normalizeCode(match[1]),
    title: match[2].trim()
  };
};

const parseAddAppointmentCommand = (message: string): { title: string } | null => {
  const match = message.match(/^add\s+appt\s+(.+)$/i);

  if (!match) {
    return null;
  }

  return {
    title: match[1].trim()
  };
};

const parseIAmCommand = (message: string): { name: string } | null => {
  const match = message.match(/^i\s+am\s+(.+)$/i);

  if (!match) {
    return null;
  }

  return { name: match[1].trim() };
};

const parse12HourTime = (value: string): string | null => {
  const match = value.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/i);

  if (!match) {
    return null;
  }

  const hourValue = Number(match[1]);
  const minuteValue = Number(match[2] ?? '0');

  if (hourValue < 1 || hourValue > 12 || minuteValue < 0 || minuteValue > 59) {
    return null;
  }

  let hours24 = hourValue % 12;

  if (match[3].toLowerCase() === 'pm') {
    hours24 += 12;
  }

  return `${hours24.toString().padStart(2, '0')}:${minuteValue.toString().padStart(2, '0')}`;
};

const parse24HourTime = (value: string): string | null => {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) {
    return null;
  }

  const hourValue = Number(match[1]);
  const minuteValue = Number(match[2]);

  if (hourValue < 0 || hourValue > 23 || minuteValue < 0 || minuteValue > 59) {
    return null;
  }

  return `${hourValue.toString().padStart(2, '0')}:${match[2]}`;
};

const parseTimeToken = (value: string): string | null => parse24HourTime(value) ?? parse12HourTime(value);

const toIsoString = (date: string, time: string): string => `${date}T${time}:00-08:00`;

const parseDateAndRange = (dateToken: string, rangeToken: string): ParsedDateTime | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateToken)) {
    return null;
  }

  const [rawStart, rawEnd] = rangeToken.split('-');

  if (!rawStart || !rawEnd) {
    return null;
  }

  const startTime = parseTimeToken(rawStart.toLowerCase());
  const endTime = parseTimeToken(rawEnd.toLowerCase());

  if (!startTime || !endTime) {
    return null;
  }

  const startIso = toIsoString(dateToken, startTime);
  const endIso = toIsoString(dateToken, endTime);

  if (parseStoredDateTime(startIso) >= parseStoredDateTime(endIso)) {
    return null;
  }

  return {
    date: dateToken,
    startTime,
    endTime,
    startIso,
    endIso
  };
};

const parseMarkUnavailableCommand = (
  message: string
): { target: string; parsedDateTime: ParsedDateTime; reason?: string; isMe: boolean } | null => {
  const match = message.match(/^mark\s+(.+?)\s+unavailable\s+(\d{4}-\d{2}-\d{2})\s+([^\s]+)(?:\s+(.+))?$/i);

  if (!match) {
    return null;
  }

  const parsedDateTime = parseDateAndRange(match[2], match[3]);

  if (!parsedDateTime) {
    return null;
  }

  const target = match[1].trim();
  const isMe = normalizeName(target) === 'me';

  return {
    target,
    parsedDateTime,
    reason: match[4]?.trim() || undefined,
    isMe
  };
};

const createAvailabilityCode = (name: string): string => {
  const nameToken = name.toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const counterKey = nameToken || 'PERSON';
  const nextValue = (availabilityCodeCounters[counterKey] ?? 0) + 1;
  availabilityCodeCounters[counterKey] = nextValue;
  return `AVL-${counterKey}-${nextValue}`;
};

const parseMonthRangeQuery = (message: string): { start: Date; end: Date } | null => {
  const trimmed = message.trim().toLowerCase();
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

  const monthMatch = trimmed.match(/^who\s+is\s+available\s+in\s+([a-z]+)$/i);

  if (monthMatch) {
    const monthIndex = monthNames.indexOf(monthMatch[1].toLowerCase());

    if (monthIndex === -1) {
      return null;
    }

    const year = new Date().getUTCFullYear();
    const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59));
    return { start, end };
  }

  const yearMonthMatch = trimmed.match(/^who\s+is\s+available\s+in\s+(\d{4})-(\d{2})$/i);

  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1]);
    const month = Number(yearMonthMatch[2]);

    if (month < 1 || month > 12) {
      return null;
    }

    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
    return { start, end };
  }

  const explicitRangeMatch = trimmed.match(/^who\s+is\s+available\s+(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/i);

  if (!explicitRangeMatch) {
    return null;
  }

  const start = new Date(`${explicitRangeMatch[1]}T00:00:00-08:00`);
  const end = new Date(`${explicitRangeMatch[2]}T23:59:59-08:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return null;
  }

  return { start, end };
};

const overlaps = (startA: Date, endA: Date, startB: Date, endB: Date): boolean => startA < endB && endA > startB;

const formatAvailabilityList = (blocks: AvailabilityBlock[]): string => {
  if (blocks.length === 0) {
    return '(none)';
  }

  return blocks
    .sort((a, b) => parseStoredDateTime(a.start).getTime() - parseStoredDateTime(b.start).getTime())
    .map((block) => {
      const reasonSuffix = block.reason ? ` (${block.reason})` : '';
      return `${block.code} — ${getPersonDisplayName(block.personId)} ${formatDateTimeRange(block.start, block.end)}${reasonSuffix}`;
    })
    .join('\n');
};

export async function chat(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  let body: ChatRequest;

  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return badRequest('message is required');
  }

  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    return badRequest('message is required');
  }

  const message = body.message.trim();
  const normalizedMessage = message.toLowerCase();

  const iAmCommand = parseIAmCommand(message);

  if (iAmCommand) {
    if (!iAmCommand.name) {
      return {
        status: 200,
        jsonBody: {
          kind: 'clarify',
          question: 'Missing name. Usage: I am Joe'
        }
      };
    }

    const person = ensurePersonByName(iAmCommand.name);
    activePersonId = person.id;

    return {
      status: 200,
      jsonBody: {
        kind: 'reply',
        assistantText: `Got it. You are ${person.name}.`
      }
    };
  }

  if (normalizedMessage === 'confirm') {
    if (!pendingProposal) {
      return {
        status: 200,
        jsonBody: {
          kind: 'reply',
          assistantText: 'No pending change.'
        }
      };
    }

    const proposalToApply = pendingProposal;
    pendingProposal = null;
    const action = proposalToApply.actions[0];

    if (action.type === 'add_appointment') {
      appointmentCodeCounter += 1;
      const code = `APPT-${appointmentCodeCounter}`;
      const appointment: Appointment = {
        id: `${Date.now()}-${appointmentCodeCounter}`,
        code,
        title: action.title,
        start: '',
        end: '',
        assigned: []
      };

      state.appointments.push(appointment);

      return {
        status: 200,
        jsonBody: {
          kind: 'applied',
          assistantText: `Added ${appointment.code} — ${appointment.title}\n${buildAppointmentsSnapshot()}`
        }
      };
    }

    if (action.type === 'delete_appointment') {
      const appointmentIndex = state.appointments.findIndex((item) => normalizeCode(item.code) === action.code);

      if (appointmentIndex === -1) {
        return {
          status: 200,
          jsonBody: {
            kind: 'reply',
            assistantText: `Not found: ${action.code}`
          }
        };
      }

      const [removed] = state.appointments.splice(appointmentIndex, 1);

      return {
        status: 200,
        jsonBody: {
          kind: 'applied',
          assistantText: `Deleted ${removed.code} — ${removed.title}\n${buildAppointmentsSnapshot()}`
        }
      };
    }

    if (action.type === 'update_appointment_title') {
      const appointment = findAppointmentByCode(action.code);

      if (!appointment) {
        return {
          status: 200,
          jsonBody: {
            kind: 'reply',
            assistantText: `Not found: ${action.code}`
          }
        };
      }

      appointment.title = action.title;

      return {
        status: 200,
        jsonBody: {
          kind: 'applied',
          assistantText: `Updated ${appointment.code} — ${appointment.title}\n${buildAppointmentsSnapshot()}`
        }
      };
    }

    if (action.type === 'add_availability') {
      const personName = getPersonDisplayName(action.personId);
      const code = createAvailabilityCode(personName);
      const block: AvailabilityBlock = {
        id: `${Date.now()}-${code}`,
        code,
        personId: action.personId,
        start: action.start,
        end: action.end,
        reason: action.reason
      };

      state.availability.push(block);

      const reasonSuffix = block.reason ? ` (${block.reason})` : '';

      return {
        status: 200,
        jsonBody: {
          kind: 'applied',
          assistantText: `Added ${block.code} — Unavailable ${formatDateTimeRange(block.start, block.end)}${reasonSuffix}\n${buildAppointmentsSnapshot()}\n${buildAvailabilitySnapshot()}`
        }
      };
    }

    const availabilityIndex = state.availability.findIndex((item) => normalizeCode(item.code) === action.code);

    if (availabilityIndex === -1) {
      return {
        status: 200,
        jsonBody: {
          kind: 'reply',
          assistantText: `Not found: ${action.code}`
        }
      };
    }

    const [removed] = state.availability.splice(availabilityIndex, 1);

    return {
      status: 200,
      jsonBody: {
        kind: 'applied',
        assistantText: `Deleted ${removed.code} — ${getPersonDisplayName(removed.personId)} ${formatDateTimeRange(removed.start, removed.end)}\n${buildAvailabilitySnapshot()}`
      }
    };
  }

  if (normalizedMessage === 'cancel') {
    pendingProposal = null;

    return {
      status: 200,
      jsonBody: {
        kind: 'reply',
        assistantText: 'Cancelled pending change.'
      }
    };
  }

  const addCommand = parseAddAppointmentCommand(message);

  if (addCommand) {
    if (addCommand.title.length === 0) {
      return badRequest('appointment title is required');
    }

    const proposalId = Date.now().toString();
    pendingProposal = {
      id: proposalId,
      actions: [
        {
          type: 'add_appointment',
          title: addCommand.title
        }
      ]
    };

    return {
      status: 200,
      jsonBody: {
        kind: 'proposal',
        proposalId,
        assistantText: `Please confirm you want to add appointment: ${addCommand.title}`
      }
    };
  }

  const markUnavailableCommand = parseMarkUnavailableCommand(message);

  if (markUnavailableCommand) {
    let person: Person | undefined;

    if (markUnavailableCommand.isMe) {
      if (!activePersonId) {
        return {
          status: 200,
          jsonBody: {
            kind: 'clarify',
            question: 'Who are you? Reply: I am Joe'
          }
        };
      }

      person = state.people.find((item) => item.id === activePersonId);
    } else {
      person = findPersonByName(markUnavailableCommand.target);
    }

    if (!person) {
      return {
        status: 200,
        jsonBody: {
          kind: 'clarify',
          question: `Unknown person '${markUnavailableCommand.target}'. Try: I am ${markUnavailableCommand.target}`
        }
      };
    }

    const proposalId = Date.now().toString();
    pendingProposal = {
      id: proposalId,
      actions: [
        {
          type: 'add_availability',
          personId: person.id,
          start: markUnavailableCommand.parsedDateTime.startIso,
          end: markUnavailableCommand.parsedDateTime.endIso,
          reason: markUnavailableCommand.reason
        }
      ]
    };

    const reasonText = markUnavailableCommand.reason ? ` (reason: ${markUnavailableCommand.reason})` : '';

    return {
      status: 200,
      jsonBody: {
        kind: 'proposal',
        proposalId,
        assistantText: `Please confirm you want to mark ${person.name} unavailable on ${markUnavailableCommand.parsedDateTime.date} ${markUnavailableCommand.parsedDateTime.startTime}-${markUnavailableCommand.parsedDateTime.endTime}${reasonText}. Reply confirm/cancel.`
      }
    };
  }

  if (normalizedMessage.startsWith('mark ') && normalizedMessage.includes(' unavailable ')) {
    return {
      status: 200,
      jsonBody: {
        kind: 'clarify',
        question: 'Usage examples:\n- mark me unavailable 2026-03-10 09:00-13:00 out of town\n- mark me unavailable 2026-03-10 9am-1pm out of town\n- mark Joe unavailable 2026-03-10 09:00-13:00 out of town'
      }
    };
  }

  const deleteCommand = parseDeleteCommand(message);

  if (deleteCommand) {
    if (deleteCommand.code.startsWith('AVL-')) {
      const block = findAvailabilityByCode(deleteCommand.code);

      if (!block) {
        return {
          status: 200,
          jsonBody: {
            kind: 'reply',
            assistantText: `Not found: ${deleteCommand.code}`
          }
        };
      }

      const proposalId = Date.now().toString();
      pendingProposal = {
        id: proposalId,
        actions: [
          {
            type: 'delete_availability',
            code: block.code
          }
        ]
      };

      return {
        status: 200,
        jsonBody: {
          kind: 'proposal',
          proposalId,
          assistantText: `Please confirm you want to delete ${block.code} — ${getPersonDisplayName(block.personId)} ${formatDateTimeRange(block.start, block.end)}. Reply 'confirm' or 'cancel'.`
        }
      };
    }

    const appointment = findAppointmentByCode(deleteCommand.code);

    if (!appointment) {
      return {
        status: 200,
        jsonBody: {
          kind: 'reply',
          assistantText: `Not found: ${deleteCommand.code}`
        }
      };
    }

    const proposalId = Date.now().toString();
    pendingProposal = {
      id: proposalId,
      actions: [
        {
          type: 'delete_appointment',
          code: appointment.code
        }
      ]
    };

    return {
      status: 200,
      jsonBody: {
        kind: 'proposal',
        proposalId,
        assistantText: `Please confirm you want to delete ${appointment.code} — ${appointment.title}. Reply 'confirm' or 'cancel'.`
      }
    };
  }

  const updateCommand = parseUpdateTitleCommand(message);

  if (updateCommand) {
    if (updateCommand.title.length === 0) {
      return {
        status: 200,
        jsonBody: {
          kind: 'clarify',
          question: 'Missing new title. Usage: update APPT-1 title <new title>'
        }
      };
    }

    const appointment = findAppointmentByCode(updateCommand.code);

    if (!appointment) {
      return {
        status: 200,
        jsonBody: {
          kind: 'reply',
          assistantText: `Not found: ${updateCommand.code}`
        }
      };
    }

    const proposalId = Date.now().toString();
    pendingProposal = {
      id: proposalId,
      actions: [
        {
          type: 'update_appointment_title',
          code: appointment.code,
          title: updateCommand.title
        }
      ]
    };

    return {
      status: 200,
      jsonBody: {
        kind: 'proposal',
        proposalId,
        assistantText: `Please confirm you want to update ${appointment.code} title from '${appointment.title}' to '${updateCommand.title}'. Reply 'confirm' or 'cancel'.`
      }
    };
  }

  if (normalizedMessage === 'list appointments') {
    const assistantText = state.appointments.length > 0
      ? state.appointments.map((appointment) => `${appointment.code} — ${appointment.title}`).join('\n')
      : '(none)';

    return {
      status: 200,
      jsonBody: {
        kind: 'reply',
        assistantText
      }
    };
  }

  if (normalizedMessage === 'list availability') {
    return {
      status: 200,
      jsonBody: {
        kind: 'reply',
        assistantText: formatAvailabilityList(state.availability)
      }
    };
  }

  const listForMatch = message.match(/^list\s+availability\s+for\s+(.+)$/i);

  if (listForMatch) {
    const person = findPersonByName(listForMatch[1]);

    if (!person) {
      return {
        status: 200,
        jsonBody: {
          kind: 'reply',
          assistantText: `Not found: ${listForMatch[1].trim()}`
        }
      };
    }

    const blocks = state.availability.filter((block) => block.personId === person.id);

    return {
      status: 200,
      jsonBody: {
        kind: 'reply',
        assistantText: formatAvailabilityList(blocks)
      }
    };
  }

  if (normalizedMessage === 'check conflicts') {
    const lines: string[] = [];

    state.appointments.forEach((appointment) => {
      if (!appointment.start || !appointment.end) {
        return;
      }

      const appointmentStart = parseStoredDateTime(appointment.start);
      const appointmentEnd = parseStoredDateTime(appointment.end);

      if (Number.isNaN(appointmentStart.getTime()) || Number.isNaN(appointmentEnd.getTime())) {
        return;
      }

      appointment.assigned.forEach((assignedPersonName) => {
        const person = findPersonByName(assignedPersonName);

        if (!person) {
          return;
        }

        state.availability
          .filter((block) => block.personId === person.id)
          .forEach((block) => {
            const blockStart = parseStoredDateTime(block.start);
            const blockEnd = parseStoredDateTime(block.end);

            if (overlaps(appointmentStart, appointmentEnd, blockStart, blockEnd)) {
              lines.push(`${appointment.code} conflicts with ${block.code} for ${person.name}`);
            }
          });
      });
    });

    return {
      status: 200,
      jsonBody: {
        kind: 'reply',
        assistantText: lines.length > 0 ? lines.join('\n') : 'No conflicts found.'
      }
    };
  }

  const monthQuery = parseMonthRangeQuery(message);

  if (monthQuery) {
    const lines: string[] = [];
    const summaryParts: string[] = [];

    state.people.forEach((person) => {
      const blocks = state.availability
        .filter((block) => block.personId === person.id)
        .filter((block) => overlaps(parseStoredDateTime(block.start), parseStoredDateTime(block.end), monthQuery.start, monthQuery.end));

      lines.push(`${person.name}: ${blocks.length} unavailable block(s)`);

      if (blocks.length > 0) {
        blocks.forEach((block) => {
          const reasonSuffix = block.reason ? ` (${block.reason})` : '';
          lines.push(`- ${block.code} ${formatDateTimeRange(block.start, block.end)}${reasonSuffix}`);
        });
      }

      summaryParts.push(`${person.name} has ${blocks.length} blocked times`);
    });

    lines.push(`Availability summary: ${summaryParts.join('; ')}.`);

    return {
      status: 200,
      jsonBody: {
        kind: 'reply',
        assistantText: lines.join('\n')
      }
    };
  }

  if (normalizedMessage.startsWith('show ')) {
    const requestedCode = normalizeCode(message.slice('show '.length));

    if (requestedCode.startsWith('AVL-')) {
      const block = findAvailabilityByCode(requestedCode);

      return {
        status: 200,
        jsonBody: {
          kind: 'reply',
          assistantText: block
            ? formatAvailabilityDetails(block)
            : `Not found: ${requestedCode}`
        }
      };
    }

    const appointment = findAppointmentByCode(requestedCode);

    return {
      status: 200,
      jsonBody: {
        kind: 'reply',
        assistantText: appointment
          ? formatAppointmentDetails(appointment)
          : `Not found: ${requestedCode}`
      }
    };
  }

  return {
    status: 200,
    jsonBody: {
      kind: 'reply',
      assistantText: `You asked: ${message}`
    }
  };
}
