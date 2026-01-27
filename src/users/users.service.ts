import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @Inject(forwardRef(() => WalletsService))
    private readonly walletsService: WalletsService,
  ) {}

  async create(data: {
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<User> {
    const user = this.usersRepo.create(data);
    const savedUser = await this.usersRepo.save(user);

    try {
      await this.walletsService.createUserWallet(savedUser.id);
      this.logger.log(`Wallet created for user ${savedUser.id}`);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Wallet creation failed for user ${savedUser.id}: ${error.message}`,
        );
      }
    }

    return savedUser;
  }

  async findAuthUserByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({
      where: { email },
      select: ['id', 'email', 'displayName', 'passwordHash', 'emailVerifiedAt'],
    });
  }

  findAll(): Promise<User[]> {
    return this.usersRepo.find({
      select: ['id', 'email', 'displayName', 'status', 'kycLevel'],
    });
  }

  findOne(id: string): Promise<User | null> {
    return this.usersRepo.findOneBy({ id });
  }

  async updateResetToken(
    id: string,
    resetToken: string,
    resetTokenExpiry: Date,
  ): Promise<void> {
    await this.usersRepo.update(id, { resetToken, resetTokenExpiry });
  }

  async findByResetToken(resetToken: string): Promise<User | null> {
    return this.usersRepo.findOne({
      where: { resetToken },
      select: ['id', 'email', 'resetToken', 'resetTokenExpiry'],
    });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.usersRepo.update(id, {
      passwordHash,
      resetToken: undefined,
      resetTokenExpiry: undefined,
    });
  }

  async updateEmailVerificationToken(
    id: string,
    emailVerificationToken: string,
  ): Promise<void> {
    await this.usersRepo.update(id, { emailVerificationToken });
  }

  async findByEmailVerificationToken(
    email: string,
    token: string,
  ): Promise<User | null> {
    return this.usersRepo.findOne({
      where: { email, emailVerificationToken: token },
      select: ['id', 'email', 'emailVerificationToken', 'emailVerifiedAt'],
    });
  }

  async verifyEmail(id: string): Promise<void> {
    await this.usersRepo.update(id, {
      emailVerifiedAt: new Date(),
      emailVerificationToken: undefined,
    });
  }

  async remove(id: string): Promise<void> {
    await this.usersRepo.delete(id);
  }
}
