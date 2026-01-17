import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from 'src/entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepo.create({
      email: dto.email,
      displayName: dto.fullName,
      passwordHash,
    });

    return this.usersRepo.save(user);
  }
  findAll() {
    return this.usersRepo.find({
      select: ['id', 'email', 'displayName', 'status', 'kycLevel'],
    });
  }

  findOne(id: string) {
    return this.usersRepo.findOneBy({ id });
  }
}
