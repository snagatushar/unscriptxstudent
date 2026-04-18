import { Resend } from 'resend';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
// In Resend, untik your domain is verified, you can only send FROM onboarding@resend.dev TO your verified email.
// Once verified, set process.env.RESEND_SENDER to your domain email (e.g. support@unscriptx.com).
const RESEND_SENDER = (process.env.RESEND_SENDER || 'onboarding@resend.dev').replace(/^["']|["']$/g, '').trim();

const resend = new Resend(RESEND_API_KEY);

export async function sendResetEmail(email: string, resetLink: string) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not set. Simulating reset email in development mode:");
    console.log(`[SIMULATED EMAIL TO: ${email}] Reset Link: ${resetLink}`);
    return { id: 'simulated-id' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_SENDER,
      to: [email],
      subject: "Reset Your Unscriptx Password",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>You requested to reset your password for your Unscriptx account. Click the button below to set a new one. This link will expire in 1 hour.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #666; font-size: 12px; word-break: break-all;">${resetLink}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (error) {
       console.error("Resend Send Error:", error);
       throw new Error(error.message || "Failed to send email via Resend");
    }

    return data;
  } catch (error) {
    console.error("Resend Catch Error:", error);
    throw error;
  }
}
