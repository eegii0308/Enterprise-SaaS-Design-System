import { escapeHtml } from "../html.ts";

export type PasswordResetEmailInput = {
  fullName: string;
  resetUrl: string;
  expiresAt: Date;
};

export function buildPasswordResetEmail(input: PasswordResetEmailInput) {
  const subject = "Reset your password";
  const expiresLabel = input.expiresAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const text = [
    `Hi ${input.fullName},`,
    "",
    "We received a request to reset your password.",
    "",
    `Reset your password: ${input.resetUrl}`,
    "",
    `This link expires at ${expiresLabel} and can only be used once.`,
    "",
    "If you didn't request this, you can safely ignore this email -- your password will not be changed.",
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <h2 style="font-size: 18px;">Reset your password</h2>
      <p style="font-size: 14px; line-height: 1.5;">
        Hi ${escapeHtml(input.fullName)}, we received a request to reset your password.
      </p>
      <p>
        <a href="${input.resetUrl}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: #ffffff; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
          Reset password
        </a>
      </p>
      <p style="color: #64748b; font-size: 12px;">
        This link expires at ${expiresLabel} and can only be used once. If you didn't request this, you can safely
        ignore this email -- your password will not be changed.
      </p>
    </div>
  `;

  return { subject, text, html };
}
