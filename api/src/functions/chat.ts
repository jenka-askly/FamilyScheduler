import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

type ChatRequest = {
  message?: unknown;
};

type Appointment = {
  id: string;
  code: string;
  title: string;
  start: string;
  end: string;
  assigned: string[];
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
    };

type PendingProposal = {
  id: string;
  actions: [ProposalAction];
};

const state: { appointments: Appointment[] } = {
  appointments: []
};

let appointmentCodeCounter = 0;
let pendingProposal: PendingProposal | null = null;

const badRequest = (message: string): HttpResponseInit => ({
  status: 400,
  jsonBody: {
    kind: 'error',
    message
  }
});

const normalizeCode = (value: string): string => value.trim().toUpperCase();

const findAppointmentByCode = (inputCode: string): Appointment | undefined => {
  const normalizedCode = normalizeCode(inputCode);
  return state.appointments.find((item) => normalizeCode(item.code) === normalizedCode);
};

const buildAppointmentsSnapshot = (): string => {
  if (state.appointments.length === 0) {
    return 'Upcoming appointments:\n(none)';
  }

  const lines = state.appointments
    .slice(0, 5)
    .map((appointment) => `${appointment.code} — ${appointment.title}`);

  return `Upcoming appointments:\n${lines.join('\n')}`;
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

const parseDeleteCommand = (message: string): { code: string } | null => {
  const match = message.match(/^delete\s+(appt-\d+)$/i);

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

  const deleteCommand = parseDeleteCommand(message);

  if (deleteCommand) {
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

  if (normalizedMessage.startsWith('show ')) {
    const requestedCode = normalizeCode(message.slice('show '.length));
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
