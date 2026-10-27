export interface DispatchedEmail {
  to: string;
  subject: string;
  token: string;
  actionUrl: string;
  sentAt: Date;
}

export interface IEmailDispatcher {
  sendVerificationEmail(toEmail: string, rawVerifyToken: string, recipientName: string): Promise<void>;
  sendPasswordResetEmail(toEmail: string, rawResetToken: string, recipientName: string): Promise<void>;
}

/**
 * In-memory email dispatcher for testing and local development.
 * Captures sent emails for assertions and displays them cleanly.
 */
export class InMemoryEmailDispatcher implements IEmailDispatcher {
  public dispatchedEmails: DispatchedEmail[] = [];

  async sendVerificationEmail(toEmail: string, rawVerifyToken: string, recipientName: string): Promise<void> {
    const actionUrl = `https://app.boxinn.in/verify-email?token=${rawVerifyToken}`;
    this.dispatchedEmails.push({
      to: toEmail,
      subject: `Verify your email for BOX INN Member Companion, ${recipientName}`,
      token: rawVerifyToken,
      actionUrl,
      sentAt: new Date(),
    });
  }

  async sendPasswordResetEmail(toEmail: string, rawResetToken: string, recipientName: string): Promise<void> {
    const actionUrl = `https://app.boxinn.in/reset-password?token=${rawResetToken}`;
    this.dispatchedEmails.push({
      to: toEmail,
      subject: `Password Reset for BOX INN Member Companion, ${recipientName}`,
      token: rawResetToken,
      actionUrl,
      sentAt: new Date(),
    });
  }

  getLastEmailFor(email: string): DispatchedEmail | undefined {
    return this.dispatchedEmails
      .slice()
      .reverse()
      .find((e) => e.to.toLowerCase() === email.toLowerCase());
  }

  clear(): void {
    this.dispatchedEmails = [];
  }
}

export const defaultEmailDispatcher = new InMemoryEmailDispatcher();
