import { ATTACK, BODYPART_COST, BodyPartConstant, CARRY, HEAL, MOVE, RANGED_ATTACK, WORK } from "game/constants";
import { StructureExtension, StructureSpawn } from "game/prototypes";
import { getTotalSpawnEnergy } from "./filterExtensions";

export function getSpawnEnergy(spawn: StructureSpawn): number {
  return spawn.store.energy;
}

export function getPartsEnergy(parts: BodyPartConstant[]): number {
  return parts.reduce(
    (sum, part) => sum + BODYPART_COST[part],
    0
  );
}

export function getHaulerParts(spawn: StructureSpawn, extensions: StructureExtension[]): BodyPartConstant[] {
  let parts: BodyPartConstant[] = [MOVE, CARRY];
  let partsCost = getPartsEnergy(parts);
  const spawnEnergy = getTotalSpawnEnergy(spawn, extensions);
  while (partsCost < spawnEnergy) {
    if (BODYPART_COST[CARRY] + partsCost <= spawnEnergy) {
      parts.push(CARRY);
    }

    partsCost = getPartsEnergy(parts);

    if (spawnEnergy - partsCost <= 49) break;
  }

  return parts;
}

export function getBuilderParts(spawn: StructureSpawn, extensions: StructureExtension[]): BodyPartConstant[] {
  let parts: BodyPartConstant[] = [MOVE, CARRY, CARRY, WORK];
  let partsCost = getPartsEnergy(parts);
  const spawnEnergy = getTotalSpawnEnergy(spawn, extensions);
  while (partsCost < spawnEnergy) {
    if (BODYPART_COST[MOVE] + partsCost <= spawnEnergy) {
      parts.push(MOVE);
    }
    partsCost = getPartsEnergy(parts);

    if (BODYPART_COST[CARRY] + partsCost <= spawnEnergy) {
      parts.push(CARRY);
    }
    partsCost = getPartsEnergy(parts);

    if (BODYPART_COST[CARRY] + partsCost <= spawnEnergy) {
      parts.push(CARRY);
    }
    partsCost = getPartsEnergy(parts);

    if (BODYPART_COST[WORK] + partsCost <= spawnEnergy) {
      parts.push(WORK);
    }
    partsCost = getPartsEnergy(parts);

    if (spawnEnergy - partsCost <= 49) break;
  }

  return parts;
}

export function getMeleeParts(spawn: StructureSpawn, extensions: StructureExtension[]): BodyPartConstant[] {
  let parts: BodyPartConstant[] = [ATTACK, MOVE];
  let partsCost = getPartsEnergy(parts);
  const spawnEnergy = getTotalSpawnEnergy(spawn, extensions);
  while (partsCost < spawnEnergy) {
    if (BODYPART_COST[ATTACK] + partsCost <= spawnEnergy) {
      parts.push(ATTACK);
    }
    partsCost = getPartsEnergy(parts);

    if (BODYPART_COST[MOVE] + partsCost <= spawnEnergy) {
      parts.push(MOVE);
    }
    partsCost = getPartsEnergy(parts);

    if (spawnEnergy - partsCost <= 49) break;
  }

  return parts;
}

export function getRangerParts(spawn: StructureSpawn, extensions: StructureExtension[]): BodyPartConstant[] {
  let parts: BodyPartConstant[] = [RANGED_ATTACK, MOVE];
  let partsCost = getPartsEnergy(parts);
  const spawnEnergy = getTotalSpawnEnergy(spawn, extensions);
  while (partsCost < spawnEnergy) {
    if (BODYPART_COST[RANGED_ATTACK] + partsCost <= spawnEnergy) {
      parts.push(RANGED_ATTACK);
    }
    partsCost = getPartsEnergy(parts);

    if (BODYPART_COST[MOVE] + partsCost <= spawnEnergy) {
      parts.push(MOVE);
    }
    partsCost = getPartsEnergy(parts);

    if (spawnEnergy - partsCost <= 49) break;
  }

  return parts;
}

// TODO: FIX
export function getHealerParts(spawn: StructureSpawn, extensions: StructureExtension[]): BodyPartConstant[] {
  let parts: BodyPartConstant[] = [HEAL, MOVE];
  let partsCost = getPartsEnergy(parts);
  const spawnEnergy = getTotalSpawnEnergy(spawn, extensions);
  while (partsCost < spawnEnergy) {
    if (BODYPART_COST[HEAL] + partsCost <= spawnEnergy) {
      parts.push(HEAL);
    } else {
      break;
    }
    partsCost = getPartsEnergy(parts);

    if (BODYPART_COST[MOVE] + partsCost <= spawnEnergy) {
      parts.push(MOVE);
    }
    partsCost = getPartsEnergy(parts);

    if (spawnEnergy - partsCost <= 49) break;
  }

  return parts;
}
