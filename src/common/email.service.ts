import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendPasswordResetEmail(email: string, resetToken: string) {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    try {
      const result = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'noreply@gideon-buba.me',
        to: email,
        subject: 'Reset Your Password',
        html: `
          <h2>Password Reset Request</h2>
          <p>You requested a password reset. Use the code below:</p>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin: 0; font-size: 24px; letter-spacing: 3px;">${resetToken}</h3>
          </div>
          <p>This code will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `,
      });
      console.log('Email sent successfully:', result);
      return result;
    } catch (error) {
      console.error('Resend email error:', error);
      throw error;
    }
  }

  async sendEmailVerification(email: string, verificationToken: string) {
    try {
      const result = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'noreply@gideon-buba.me',
        to: email,
        subject: 'Verify Your Email Address',
        html: `
          <h2>Welcome! Please verify your email</h2>
          <p>Thank you for signing up. Please use the code below to verify your email address:</p>
          <div style="background: #f8f9fa; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin: 0; font-size: 24px; letter-spacing: 3px;">${verificationToken}</h3>
          </div>
          <p>This code will expire in 24 hours.</p>
        `,
      });
      console.log('Verification email sent successfully:', result);
      return result;
    } catch (error) {
      console.error('Resend verification email error:', error);
      throw error;
    }
  }
}
