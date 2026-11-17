// Dev-mode mail sender. Logs the message body (including the plain reset link)
// to the server console. Replace sendResetEmail's implementation with a real
// nodemailer + SMTP transport when SMTP_* env vars are configured.
//
// Keeping the dev stub here (not nodemailer) avoids an extra dependency during
// development. The function signature matches what a real SMTP sender would use.

import { logger } from './log.js';

export type ResetMail = {
  to: string;
  username: string;
  resetUrl: string;
  expiresMinutes: number;
};

export async function sendResetEmail(msg: ResetMail): Promise<void> {
  if (process.env.SMTP_HOST) {
    // Hook point for a future real sender. Still log a warning so a misconfigured
    // production doesn't silently swallow resets.
    logger.warn(
      { to: msg.to },
      '[mailer] SMTP_HOST is set but the stub does not send real email yet. Configure a real transport.',
    );
  }
  logger.info(
    {
      to: msg.to,
      username: msg.username,
      resetUrl: msg.resetUrl,
      expiresMinutes: msg.expiresMinutes,
    },
    '[mailer:dev-stub] password reset link — copy this URL to the user',
  );
}
