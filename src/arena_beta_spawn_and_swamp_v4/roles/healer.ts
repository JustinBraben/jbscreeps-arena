import { creepHasPart } from 'common/lib/creep';
import { HEAL } from 'game/constants';
import { Creep } from 'game/prototypes';
import { Core } from '../core';
import { Role } from 'common/enums/role';

export function run(creep: Creep, core: Core) {
  const healTargetMelee = creep.findClosestByRange(core.getCreeps(Role.MELEE).filter(c => c.hits < c.hitsMax && c.hits > 0));
  if (healTargetMelee) {
    creep.moveTo(healTargetMelee);
    heal(creep, healTargetMelee);
    return;
  }

  const healTargetRanged = creep.findClosestByRange(core.getCreeps(Role.RANGED).filter(c => c.hits < c.hitsMax && c.hits > 0));
  if (healTargetRanged) {
    creep.moveTo(healTargetRanged);
    heal(creep, healTargetRanged);
    return;
  }

  const healTargetHauler = creep.findClosestByRange(core.getCreeps(Role.HAULER).filter(c => c.hits < c.hitsMax && c.hits > 0));
  if (healTargetHauler) {
    creep.moveTo(healTargetHauler);
    heal(creep, healTargetHauler);
    return;
  }

  const targetFollow = core.enemySpawn.findClosestByRange(core.myCreeps);
  if (targetFollow) {
    creep.moveTo(targetFollow);
    heal(creep, targetFollow);
    return;
  }
}

function heal(creep: Creep, target: Creep) {
  if (creepHasPart(creep, HEAL)) {
    if (creep.getRangeTo(target) <= 3 && creep.getRangeTo(target) !== 1) {
      creep.rangedHeal(target);
    } else {
      creep.heal(target);
    }
  }
}
