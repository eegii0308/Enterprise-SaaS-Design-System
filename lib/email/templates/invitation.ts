import { escapeHtml } from "../html.ts";

export type InvitationEmailInput = {
  organizationName: string;
  roleLabel: string;
  inviterName: string;
  acceptUrl: string;
  expiresAt: Date;
};

export function buildInvitationEmail(input: InvitationEmailInput) {
  const subject = `${input.inviterName} invited you to join ${input.organizationName}`;
  const expiresLabel = input.expiresAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const text = [
    `${input.inviterName} has invited you to join ${input.organizationName} as ${input.roleLabel}.`,
    "",
    `Accept your invitation: ${input.acceptUrl}`,
    "",
    `This link expires on ${expiresLabel}.`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
      <h2 style="font-size: 18px;">You've been invited to ${escapeHtml(input.organizationName)}</h2>
      <p style="font-size: 14px; line-height: 1.5;">
        ${escapeHtml(input.inviterName)} has invited you to join
        <strong>${escapeHtml(input.organizationName)}</strong> as
        <strong>${escapeHtml(input.roleLabel)}</strong>.
      </p>
      <p>
        <a href="${input.acceptUrl}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: #ffffff; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 600;">
          Accept invitation
        </a>
      </p>
      <p style="color: #64748b; font-size: 12px;">
        This link expires on ${expiresLabel}. If you weren't expecting this invitation, you can ignore this email.
      </p>
    </div>
  `;

  return { subject, text, html };
}
