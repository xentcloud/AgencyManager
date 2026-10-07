"use node";
// Outbound email. Default transport is plain SMTP (nodemailer), which works with Resend's SMTP
// credentials or any other provider. Configure with Convex env vars:
//   SMTP_HOST, SMTP_PORT (465), SMTP_USER, SMTP_PASS, EMAIL_FROM
// e.g. Resend: SMTP_HOST=smtp.resend.com SMTP_USER=resend SMTP_PASS=<api key>
import nodemailer from "nodemailer";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

function getTransport() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT = "465", SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) throw new Error("SMTP_HOST is not configured");
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter;
}

export const send = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    replyTo: v.optional(v.string()),
    from: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const info = await getTransport().sendMail({
      from: args.from ?? process.env.EMAIL_FROM,
      to: args.to,
      replyTo: args.replyTo,
      subject: args.subject,
      text: args.text,
    });
    return info.messageId as string;
  },
});
