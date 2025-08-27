import { creepHasPart } from 'common/lib/creep';
import { ATTACK, RANGED_ATTACK } from 'game/constants';
import { Creep, StructureSpawn, StructureWall } from 'game/prototypes';
import { Core } from '../core';

export function run(creep: Creep, core: Core) {
  const cornerWall = creep.findClosestByRange(core.walls.filter(w => core.mySpawn.y === w.y));
  if (cornerWall) {
    if (creepHasPart(creep, RANGED_ATTACK) && creep.getRangeTo(cornerWall) >= 4) {
      creep.moveTo(cornerWall);
    } else if (creepHasPart(creep, ATTACK)) {
      creep.moveTo(cornerWall);
    }
    attack(creep, cornerWall);
    return;
  }

  const target = creep.findClosestByRange(core.enemyCreeps);
  if (target) {
    if (creepHasPart(creep, RANGED_ATTACK)) {

      if (creep.findInRange(core.enemyCreeps, 2).length > 2) {
        creep.rangedMassAttack();
        creep.moveTo(core.mySpawn);
        return;
      }

      if (creep.getRangeTo(target) > 3) {
        creep.moveTo(target);
        attack(creep, target);
      } else {
        attack(creep, target);
        creep.moveTo(core.mySpawn);
      }

    } else if (creepHasPart(creep, ATTACK)) {
      creep.moveTo(target);
      attack(creep, target);
    }
    return;
  }

  if (core.enemySpawn) {
    creep.moveTo(core.enemySpawn);
    attack(creep, core.enemySpawn);
  }
}

function attack(creep: Creep, target: Creep | StructureWall | StructureSpawn) {
  if (creepHasPart(creep, RANGED_ATTACK)) {
    if (creep.getRangeTo(target) <= 3) {
      creep.rangedAttack(target);
    }
  }
  if (creepHasPart(creep, ATTACK)) {
    if (creep.getRangeTo(target) <= 1) {
      creep.attack(target);
    }
  }
}
