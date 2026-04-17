import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const rawSender = process.env.SES_FROM_EMAIL || 'noreply@unscriptx.com';
const SES_SENDER = rawSender.replace(/^["']|["']$/g, '').trim(); 
const AWS_REGION = (process.env.AWS_REGION || 'ap-south-1').replace(/^["']|["']$/g, '').trim();

const sesClient = new SESClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function sendResetEmail(email: string, resetLink: string) {
  const params = {
    Source: SES_SENDER,
    Destination: {
      ToAddresses: [email],
    },
    Message: {
      Subject: {
        Data: "Reset Your Unscriptx Password",
      },
      Body: {
        Html: {
          Data: `
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
        },
      },
    },
  };

  try {
    const command = new SendEmailCommand(params);
    const result = await sesClient.send(command);
    return result;
  } catch (error) {
    console.error("SES Send Error:", error);
    throw error;
  }
}
