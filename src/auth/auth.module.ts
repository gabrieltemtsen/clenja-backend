import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { EmailService } from '../common/email.service';

type StringValue = '15m' | '1h' | '1d' | '7d';

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET must be set in environment');
        }

        let expiresIn = configService.get<string>('JWT_EXPIRES_IN') ?? '15m';

        // Make sure it matches our allowed StringValue
        const allowedExpiries: StringValue[] = ['15m', '1h', '1d', '7d'];
        if (!allowedExpiries.includes(expiresIn as StringValue)) {
          expiresIn = '15m'; // fallback to default
        }

        return {
          secret,
          signOptions: {
            expiresIn: expiresIn as StringValue,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, EmailService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
