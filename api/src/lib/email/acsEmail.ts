import { EmailClient, EmailSendResponse } from '@azure/communication-email';

type SendEmailInput = {
  to: string;
  subject: string;
  plainText: string;
  html: string;
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

export async function sendEmail({ to, subject, plainText, html }: SendEmailInput): Promise<EmailSendResponse> {
  const { connectionString, senderAddress } = getEmailConfig();
  const client = getClient(connectionString);

  const poller = await client.beginSend({
    senderAddress,
    content: {
      subject,
      plainText,
      html,
    },
    recipients: {
      to: [{ address: to }],
    },
  });

  return poller.pollUntilDone();
}
