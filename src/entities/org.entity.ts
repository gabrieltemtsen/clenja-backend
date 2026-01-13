import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { OrgType } from '../common/enums';

@Entity('orgs')
export class Org extends BaseEntity {
  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: OrgType,
  })
  type: OrgType;

  @Column()
  ownerUserId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any> | null;
}
