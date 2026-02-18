import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

type ChatRequest = {
  message?: unknown;
};

type PendingProposal = {
  id: string;
  type: 'addAppointment';
  title: string;
};

type Appointment = {
  id: string;
  code: string;
  title: string;
  start: string;
  end: string;
  assigned: string[];
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

const classifyMessage = (message: string): 'addAppointment' | 'confirm' | 'listAppointments' | 'showAppointment' | 'query' => {
  const normalized = message.toLowerCase();

  if (normalized === 'confirm') {
    return 'confirm';
  }

  if (normalized.startsWith('add appt ')) {
    return 'addAppointment';
  }

  if (normalized === 'list appointments') {
    return 'listAppointments';
  }

  if (normalized.startsWith('show ')) {
    return 'showAppointment';
  }

  return 'query';
};

const buildAppointmentsSnapshot = (): string => {
  if (state.appointments.length === 0) {
    return 'Upcoming appointments:\n(none)';
  }

  const lines = state.appointments.map((appointment) => `${appointment.code} — ${appointment.title}`);
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
  const messageType = classifyMessage(message);

  if (messageType === 'addAppointment') {
    const title = message.slice('add appt '.length).trim();

    if (title.length === 0) {
      return badRequest('appointment title is required');
    }

    const proposalId = Date.now().toString();
    pendingProposal = {
      id: proposalId,
      type: 'addAppointment',
      title
    };

    return {
      status: 200,
      jsonBody: {
        kind: 'proposal',
        proposalId,
        assistantText: `Please confirm you want to add appointment: ${title}`
      }
    };
  }

  if (messageType === 'confirm') {
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

    if (proposalToApply.type === 'addAppointment') {
      appointmentCodeCounter += 1;
      const code = `APPT-${appointmentCodeCounter}`;
      const appointment: Appointment = {
        id: `${Date.now()}-${appointmentCodeCounter}`,
        code,
        title: proposalToApply.title,
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
  }

  if (messageType === 'listAppointments') {
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

  if (messageType === 'showAppointment') {
    const requestedCode = message.slice('show '.length).trim();
    const requestedCodeNormalized = requestedCode.toUpperCase();
    const appointment = state.appointments.find((item) => item.code.toUpperCase() === requestedCodeNormalized);

    return {
      status: 200,
      jsonBody: {
        kind: 'reply',
        assistantText: appointment
          ? formatAppointmentDetails(appointment)
          : `Appointment ${requestedCode} was not found.`
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
