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

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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

    // Create the new user
    const user = await this.usersService.create({
      email: dto.email,
      displayName: dto.displayName,
      passwordHash,
    });

    // Automatically log in after registration
    return this.login(dto.email, dto.password);
  }

  /**
   * Login a user
   */
  async login(email: string, password: string) {
    const user = await this.usersService.findAuthUserByEmail(email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
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

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await this.usersService.updateResetToken(
      user.id,
      resetToken,
      resetTokenExpiry,
    );

    // TODO: Send email with reset token
    // For now, return token (remove in production)
    return {
      message: 'If email exists, reset instructions have been sent',
      resetToken, // Remove this in production
    };
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
}
