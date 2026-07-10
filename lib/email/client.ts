import { Resend } from "resend";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

let client: Resend | null = null;

function getClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY must be set to send email.");
  }

  if (!client) {
    client = new Resend(apiKey);
  }

  return client;
}

export async function sendEmail(input: SendEmailInput) {
  const from = process.env.EMAIL_FROM;

  if (!from) {
    throw new Error("EMAIL_FROM must be set to send email.");
  }

  const result = await getClient().emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });

  if (result.error) {
    throw new Error(`Failed to send email: ${result.error.message}`);
  }
}
