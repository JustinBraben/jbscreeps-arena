import { MOVE, BodyPartConstant, CARRY, WORK, ATTACK, RANGED_ATTACK, HEAL, BODYPART_COST } from "game/constants";
import { Creep } from "game/prototypes";
import { getObjectsByPrototype } from "game/utils";

export function getMyCreeps(): Creep[] {
  return getObjectsByPrototype(Creep).filter(c => c.my && c.hits > 0);
}

export function getEnemyCreeps(): Creep[] {
  return getObjectsByPrototype(Creep).filter(c => !c.my && c.hits > 0);
}

// Helper function to check if creep has a specific body part
export function creepHasBodyPartConstant(
  creep: Creep,
  bodyPartConstant: BodyPartConstant
): boolean {
  return creep.body.some(part => part.type === bodyPartConstant);
}

export function creepHasNoEnergy(creep: Creep): boolean {
  return creep.store.energy === 0;
}

// Get Energy Cost for a given Creep
export function getCreepEnergyCost(creep: Creep): number {
  return creep.body.reduce(
    (sum, part) => sum + BODYPART_COST[part.type],
    0
  );
}

export function creepsCount(creeps: Creep[]): number {
  return creeps.length;
}

// Of given creeps get the total Energy Cost worth of given BodyPartConstant's
export function creepsWithBodyPartConstantTotalEnergySpawned(
  creeps: Creep[],
  bodyPartConstant: BodyPartConstant
): number {
  return creeps.reduce((totalCost, creep) => {
    // Count only ATTACK body parts for this creep
    const attackPartsCost = creep.body
      .filter(part => part.type === bodyPartConstant)
      .reduce((sum) => sum + BODYPART_COST[bodyPartConstant], 0);

    return totalCost + attackPartsCost;
  }, 0);
}

// Filter Creeps which have specified BodyPartConstant
export function getCreepsWithBodyPartConstant(
  creeps: Creep[],
  bodyPartConstant: BodyPartConstant
): Creep[] {
  return creeps.filter(creep =>
    creepHasBodyPartConstant(creep, bodyPartConstant)
  );
}

export function getAttackCreeps(creeps: Creep[]): Creep[] {
  return getCreepsWithBodyPartConstant(creeps, ATTACK);
}

export function getHaulers(creeps: Creep[]): Creep[] {
  return creeps.filter(creep =>
    creep.body.some(part => part.type === MOVE) &&
    creep.body.some(part => part.type === CARRY) &&
    !creep.body.some(part => part.type === WORK)
  );
}

export function getBuilders(creeps: Creep[]): Creep[] {
  return creeps.filter(creep =>
    creep.body.some(part => part.type === MOVE) &&
    creep.body.some(part => part.type === CARRY) &&
    creep.body.some(part => part.type === WORK)
  );
}

export function getMelees(creeps: Creep[]): Creep[] {
  return creeps.filter(creep =>
    creep.body.some(part => part.type === MOVE) &&
    creep.body.some(part => part.type === ATTACK)
  );
}

export function getRangers(creeps: Creep[]): Creep[] {
  return creeps.filter(creep =>
    creep.body.some(part => part.type === MOVE) &&
    creep.body.some(part => part.type === RANGED_ATTACK)
  );
}

export function getHealers(creeps: Creep[]): Creep[] {
  return creeps.filter(creep => creep.body.some(part => part.type === HEAL));
}

export function getCreepsWithinRangeOfCreep(creep: Creep, potentialCreeps: Creep[], range: number): Creep[] {
  return potentialCreeps.filter(maybeNearbyCreep => maybeNearbyCreep.getRangeTo(creep) < range);
}
