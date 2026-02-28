declare module '@azure/communication-email' {
  export type EmailSendResponse = { id?: string; status?: string };

  export class EmailClient {
    constructor(connectionString: string);
    beginSend(message: {
      senderAddress: string;
      content: { subject: string; plainText?: string; html?: string };
      recipients: { to: Array<{ address: string }> };
      replyTo?: Array<{ address: string }>;
      headers?: Record<string, string>;
    }): Promise<{ pollUntilDone(): Promise<EmailSendResponse> }>;
  }
}
