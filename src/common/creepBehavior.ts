import { ConstructionSite, Creep, StructureContainer, StructureExtension, StructureRampart, StructureSpawn } from "game/prototypes";
import { flee, moveWithinRange } from "./creepMovementUtils";
import { ERR_INVALID_TARGET, OK, RESOURCE_ENERGY } from "game/constants";
import { DefaultFindPathOptions } from "./constants";
import { findConstructionSiteToBuild } from "./filterConstructionSites";
import { getCreepsWithinRangeOfCreep } from "./filterCreeps";

// export function moveWithinRange(creep: Creep, otherPos: Position, idealRange: number): void {
//   if (getRange(creep, otherPos) > idealRange) {
//     creep.moveTo(otherPos);
//   }
// }

export function moveWithinRangeOfContainer(creep: Creep, targetContainer: StructureContainer): void {
  moveWithinRange(creep, targetContainer, 1);
}

export function fleeWithinRange(
  creep: Creep,
  allySpawn: StructureSpawn,
  creepsToAvoid: Creep[],
  rangeFromAvoid: number,
  countToFlee: number,
): boolean {
  const nearbyEnemies = getCreepsWithinRangeOfCreep(creep, creepsToAvoid, rangeFromAvoid);
  if (nearbyEnemies.length >= countToFlee) {
    flee(creep, allySpawn, nearbyEnemies, 8);
    return true;
  }

  return false;
}

// Withdraw from container if creep within range
export function tryWithdrawContainer(creep: Creep, targetContainer: StructureContainer): void {
  if (creep.getRangeTo(targetContainer) == 1) {
    const withdrawResult = creep.withdraw(targetContainer, RESOURCE_ENERGY);
    if (withdrawResult === OK) {}
    // console.log(`creep: ${creep.id} Moved to container: ${targetContainer.id}, CreepWithdrawResult: ${withdrawResult}`);
  }
}

export function tryBuildSpawnRamparts(
  creep: Creep,
  allySpawn: StructureSpawn,
  allyConstructionSites: ConstructionSite[],
): void {
  const spawnRampart = allyConstructionSites.find(site =>
    site.structure instanceof StructureRampart &&
    site.x === allySpawn.x &&
    site.y === allySpawn.y
  );

  if (spawnRampart) {
    moveWithinRange(creep, spawnRampart, 2);
    if (creep.x === spawnRampart.x && creep.y === spawnRampart.y) moveWithinRange(creep, allySpawn, 1);
    creep.build(spawnRampart);
    return;
  }
}

export function tryTransferSwampExtension(
  creep: Creep,
  allySpawn: StructureSpawn,
  allyExtensionsToFill: StructureExtension[],
  swampContainers: StructureContainer[],
): void {
  const targetSwampWithdrawContainer = creep.findClosestByPath(swampContainers, DefaultFindPathOptions);
  if (targetSwampWithdrawContainer) {
    // First priority: Fill existing extensions near this container
    const nearbyExtension = allyExtensionsToFill
      .filter(extension => {
        extension.getRangeTo(targetSwampWithdrawContainer) <= 3
      })
      .find(extension => extension.exists && extension.store.energy < 100);

    if (nearbyExtension) {
      moveWithinRange(creep, nearbyExtension, 2);
      if (creep.x === nearbyExtension.x && creep.y === nearbyExtension.y) moveWithinRange(creep, allySpawn, 3);
      if (creep.getRangeTo(nearbyExtension) < 2) {
        const transferRes = creep.transfer(nearbyExtension, RESOURCE_ENERGY);
        console.log(`Builder Transfer result: ${transferRes}`);
        return;
      }
    }
  }
}

// Fallback to building any construction sites
export function tryBuildConstructionSite(
  creep: Creep,
  allySpawn: StructureSpawn,
  allyConstructionSites: ConstructionSite[],
): boolean {
  let res = false;

  if (creep.store.energy === 0) return res;

  const site = findConstructionSiteToBuild(creep, allySpawn, allyConstructionSites);
  if (site) {

    if (creep.x === site.x && creep.y === site.y) {
      res = res || moveWithinRange(creep, allySpawn, 1);
    }

    res = res || moveWithinRange(creep, site, 2);

    if (creep.getRangeTo(site) <= 2) {
      const buildResult = creep.build(site);
      res = true;
      console.log(`Builder ${creep.id}, buildOtherConstructionSites, build result: ${buildResult}`);
      if (buildResult == ERR_INVALID_TARGET) site.remove();
    }
  }

  return res;
}
