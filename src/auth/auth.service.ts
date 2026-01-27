import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailService } from '../common/email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Register a new user
   */
  async register(dto: RegisterDto) {
    // Check if the email is already registered
    const existingUser = await this.usersService.findAuthUserByEmail(dto.email);
    if (existingUser) {
      throw new BadRequestException('Email already in use');
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Generate email verification token
    const emailVerificationToken = Math.floor(100000 + Math.random() * 900000).toString();

    // Create the new user
    const user = await this.usersService.create({
      email: dto.email,
      displayName: dto.displayName,
      passwordHash,
    });

    // Set verification token
    await this.usersService.updateEmailVerificationToken(user.id, emailVerificationToken);

    // Send verification email
    try {
      await this.emailService.sendEmailVerification(dto.email, emailVerificationToken);
      console.log(`Verification email sent to: ${dto.email}`);
    } catch (error) {
      console.error('Failed to send verification email:', error);
    }

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    };
  }

  /**
   * Login a user
   */
  async login(email: string, password: string) {
    const user = await this.usersService.findAuthUserByEmail(email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if email is verified
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // JWT payload
    const payload = { sub: user.id, email: user.email };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    };
  }

  /**
   * Initiate forgot password process
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findAuthUserByEmail(dto.email);

    if (!user) {
      // Don't reveal if email exists
      return { message: 'If email exists, reset instructions have been sent' };
    }

    // Generate reset token (6-digit code)
    const resetToken = Math.floor(100000 + Math.random() * 900000).toString();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await this.usersService.updateResetToken(
      user.id,
      resetToken,
      resetTokenExpiry,
    );

    // Send reset email
    try {
      await this.emailService.sendPasswordResetEmail(user.email!, resetToken);
      console.log(`Password reset email sent to: ${user.email}`);
    } catch (error) {
      console.error('Failed to send reset email:', error);
      // Log the specific error for debugging
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    }

    return { message: 'If email exists, reset instructions have been sent' };
  }

  /**
   * Reset password using token
   */
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByResetToken(dto.token);

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Update password and clear reset token
    await this.usersService.updatePassword(user.id, passwordHash);

    return { message: 'Password reset successfully' };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.usersService.findByEmailVerificationToken(dto.email, dto.token);
    
    if (!user) {
      throw new BadRequestException('Invalid email or verification token');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email already verified');
    }

    // Verify email
    await this.usersService.verifyEmail(user.id);

    return { message: 'Email verified successfully' };
  }
}
