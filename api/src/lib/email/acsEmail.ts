import { EmailClient, EmailSendResponse } from '@azure/communication-email';

type SendEmailInput = {
  to: string;
  subject: string;
  plainText: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

const getEmailConfig = (): { connectionString: string; senderAddress: string } => {
  const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
  const senderAddress = process.env.EMAIL_SENDER_ADDRESS;

  if (!connectionString || !senderAddress) {
    throw new Error('missing_email_env');
  }

  return { connectionString, senderAddress };
};

const getClient = (connectionString: string): EmailClient => new EmailClient(connectionString);

export async function sendEmail({ to, subject, plainText, html, replyTo, headers }: SendEmailInput): Promise<EmailSendResponse> {
  const { connectionString, senderAddress } = getEmailConfig();
  const client = getClient(connectionString);
  const replyToAddress = (replyTo ?? process.env.EMAIL_REPLY_TO_ADDRESS ?? '').trim();
  const shouldApplySuppressHeaders = (process.env.EMAIL_SUPPRESS_HEADERS ?? '').trim().toLowerCase() === 'true';

  const message: {
    senderAddress: string;
    content: { subject: string; plainText: string; html: string };
    recipients: { to: Array<{ address: string }> };
    replyTo?: Array<{ address: string }>;
    headers?: Record<string, string>;
  } = {
    senderAddress,
    content: {
      subject,
      plainText,
      html,
    },
    recipients: {
      to: [{ address: to }],
    },
  };

  if (replyToAddress) {
    message.replyTo = [{ address: replyToAddress }];
  }

  if (shouldApplySuppressHeaders || headers) {
    message.headers = {
      ...(shouldApplySuppressHeaders
        ? {
            'X-Auto-Response-Suppress': 'All',
            AutoSubmitted: 'auto-generated',
            Precedence: 'bulk',
          }
        : {}),
      ...(headers ?? {}),
    };
  }

  const poller = await client.beginSend(message);

  return poller.pollUntilDone();
}
