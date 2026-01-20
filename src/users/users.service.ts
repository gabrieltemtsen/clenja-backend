import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from '../entities/user.entity';
import { WalletsService } from '../wallets/wallets.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @Inject(forwardRef(() => WalletsService))
    private readonly walletsService: WalletsService,
  ) { }

  async create(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepo.create({
      email: dto.email,
      displayName: dto.fullName,
      passwordHash,
    });

    const savedUser = await this.usersRepo.save(user);

    // Auto-create wallet for new user
    try {
      await this.walletsService.createUserWallet(savedUser.id);
      this.logger.log(`Wallet created for user ${savedUser.id}`);
    } catch (error) {
      this.logger.error(`Failed to create wallet for user ${savedUser.id}: ${error.message}`);
      // Don't fail user creation if wallet creation fails
    }

    return savedUser;
  }

  findAll() {
    return this.usersRepo.find({
      select: ['id', 'email', 'displayName', 'status', 'kycLevel'],
    });
  }

  findOne(id: string) {
    return this.usersRepo.findOneBy({ id });
  }

  findByEmail(email: string) {
    return this.usersRepo.findOneBy({ email });
  }
}
