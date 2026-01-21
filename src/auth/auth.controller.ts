import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({
    description: 'Payload to register a new user',
    type: RegisterDto,
    examples: {
      example1: {
        summary: 'Valid registration payload',
        description: 'Creates a user with email, display name, and password',
        value: {
          email: 'gideon@example.com',
          displayName: 'Gideon Buba',
          password: 'StrongPassword123',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiBody({
    description: 'Payload to login',
    type: LoginDto,
    examples: {
      example1: {
        summary: 'Valid login payload',
        description: 'Login with email and password',
        value: {
          email: 'gideon@example.com',
          password: 'StrongPassword123',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }
}
