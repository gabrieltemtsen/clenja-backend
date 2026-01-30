import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllocationsController } from './allocations.controller';
import { AllocationsService } from './allocations.service';
import { Allocation } from '../entities/allocation.entity';
import { AllocationRule } from '../entities/allocation-rule.entity';
import { Wallet } from '../entities/wallet.entity';
import { OrgMember } from '../entities/org-member.entity';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Allocation, AllocationRule, Wallet, OrgMember]),
    LedgerModule,
  ],
  controllers: [AllocationsController],
  providers: [AllocationsService],
  exports: [AllocationsService],
})
export class AllocationsModule {}
