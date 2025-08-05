import { Creep } from 'game/prototypes';
import { applyMixin } from 'common/prototype/applyMixin';
import { Role, RoleSpawnAndSWamp } from 'common/enums/role';
import { Core } from 'common/core';

export class RoleMixin extends Creep {
  role: Role = RoleSpawnAndSWamp.Miner;
}
