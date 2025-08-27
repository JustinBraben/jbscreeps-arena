import { BodyPartConstant } from 'game/constants';
import { Priority } from '../enums/priority';
import type { Role } from '../enums/role';

export class Order {
  public role!: Role;
  public body: BodyPartConstant[] = [];
  public priority: Priority = Priority.Normal;
  public level: number = 0;
}
