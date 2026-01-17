/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';
import { User } from 'src/entities/user.entity';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Creates a user with email, full name, and password',
  })
  @ApiBody({
    description: 'Payload to create a new user',
    type: CreateUserDto,
    examples: {
      example1: {
        summary: 'Valid user payload',
        description: 'Standard user creation request',
        value: {
          email: 'gideon@example.com',
          fullName: 'Gideon Buba',
          password: 'StrongPassword123',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: User,
  })
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({
    status: 200,
    description: 'List of users',
    type: [User],
  })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the user',
    example: '8f14e45f-ea9c-4f10-ae7e-abc123def456',
  })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: User,
  })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}
