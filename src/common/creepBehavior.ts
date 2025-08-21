import { ConstructionSite, Creep, Resource, StructureContainer, StructureExtension, StructureRampart, StructureSpawn } from "game/prototypes";
import { flee, moveWithinRange } from "./creepMovementUtils";
import { /*ERR_INVALID_TARGET,*/ CreepWithdrawResult, ERR_NOT_IN_RANGE, OK, RESOURCE_ENERGY } from "game/constants";
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
  rangeAvoid: number,
  countAvoid: number,
): boolean {
  const nearbyEnemies = getCreepsWithinRangeOfCreep(creep, creepsToAvoid, rangeAvoid);
  if (nearbyEnemies.length >= countAvoid) {
    flee(creep, allySpawn, nearbyEnemies, rangeAvoid);
    return true;
  }

  return false;
}

// Withdraw from container if creep within range
export function tryWithdrawContainer(creep: Creep, targetContainer: StructureContainer | Resource): CreepWithdrawResult {
  if (creep.getRangeTo(targetContainer) == 1 && targetContainer instanceof(StructureContainer)) {
    return creep.withdraw(targetContainer, RESOURCE_ENERGY);
    // if (withdrawResult === OK) {}
    // console.log(`creep: ${creep.id} Moved to container: ${targetContainer.id}, CreepWithdrawResult: ${withdrawResult}`);
  }

  return ERR_NOT_IN_RANGE;
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
    moveWithinRange(creep, spawnRampart, 3);
    // if (creep.x === spawnRampart.x && creep.y === spawnRampart.y) moveWithinRange(creep, allySpawn, 1);
    if (creep.getRangeTo(spawnRampart) < 4) creep.build(spawnRampart);
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
  allySpawnContainers: StructureContainer[],
  swampContainers: StructureContainer[],
  containers: StructureContainer[],
  droppedEnergy: Resource[],
): boolean {
  let res = false;

  let targetWithdraw: Resource | StructureContainer | null | undefined = creep.findInRange(droppedEnergy, 1).find(c => c);
  if (!targetWithdraw) targetWithdraw = creep.findClosestByPath(allySpawnContainers);
  if (!targetWithdraw) targetWithdraw = creep.findClosestByPath(swampContainers);
  if (!targetWithdraw) targetWithdraw = creep.findClosestByPath(containers);
  if (!targetWithdraw) return res;

  // let targetTransfer: StructureSpawn | StructureExtension = mySpawn;
  // const pathToMySpawn = hauler.findPathTo(mySpawn);
  // const targetExtension = hauler.findClosestByPath(myExtensionsToFill);
  // let pathToMyExtension: Position[] | null = null;
  // if (targetExtension) pathToMyExtension = hauler.findPathTo(targetExtension);
  // if (targetExtension && pathToMyExtension && pathToMyExtension.length < pathToMySpawn.length) targetTransfer = targetExtension;
  // if (targetExtension && targetExtension.store.energy !== 100 && mySpawn.store.energy === 1000) targetTransfer = targetExtension;

  const site = findConstructionSiteToBuild(creep, allySpawn, allyConstructionSites);

  // if (hauler.store.energy === 0) {
  //   if (hauler.getRangeTo(targetWithdraw) > 1) {

  //     moveWithinRange(hauler, targetWithdraw, 1);

  //     if (targetWithdraw instanceof(Resource) && hauler.getRangeTo(targetWithdraw) < 2) {
  //       hauler.pickup(targetWithdraw);
  //     } else if (targetWithdraw instanceof(StructureContainer)) {
  //       const withdrawResult = tryWithdrawContainer(hauler, targetWithdraw);
  //       if (withdrawResult === OK) {
  //         // hauler.drop(RESOURCE_ENERGY);
  //       }
  //     }

  //   } else if (hauler.getRangeTo(targetWithdraw) < 2) {

  //     if (targetWithdraw instanceof(Resource)) {
  //       hauler.pickup(targetWithdraw);
  //     } else if (targetWithdraw instanceof(StructureContainer)) {
  //       const withdrawResult = tryWithdrawContainer(hauler, targetWithdraw);
  //       if (withdrawResult === OK) {
  //         // hauler.drop(RESOURCE_ENERGY);
  //       }
  //     }
  //   }

  // }

  if (creep.store.energy === 0) {
    if (creep.getRangeTo(targetWithdraw) > 1) {

      moveWithinRange(creep, targetWithdraw, 1);

      if (targetWithdraw instanceof(Resource) && creep.getRangeTo(targetWithdraw) < 2) {
        creep.pickup(targetWithdraw);
      } else if (targetWithdraw instanceof(StructureContainer)) {
        const withdrawResult = tryWithdrawContainer(creep, targetWithdraw);
        if (withdrawResult === OK) {
          // creep.drop(RESOURCE_ENERGY);
        }
      }

    } else if (creep.getRangeTo(targetWithdraw) < 2) {

      if (targetWithdraw instanceof(Resource)) {
        creep.pickup(targetWithdraw);
      } else if (targetWithdraw instanceof(StructureContainer)) {
        const withdrawResult = tryWithdrawContainer(creep, targetWithdraw);
        if (withdrawResult === OK) {
          // creep.drop(RESOURCE_ENERGY);
        }
      }
    }
    return res;
  } else {

    if (site) {
      if (creep.getRangeTo(site) > 3) {
        creep.drop(RESOURCE_ENERGY);
        res = res || moveWithinRange(creep, site, 3);
      } else if (creep.getRangeTo(site) < 4) {
        const buildResult = creep.build(site);
        res = true;
        console.log(`Builder ${creep.id}, buildOtherConstructionSites, build result: ${buildResult}`);
      }
    }
  }

  // if (site) {

  //   if (creep.x === site.x && creep.y === site.y) {
  //     res = res || moveWithinRange(creep, allySpawn, 1);
  //   }

  //   res = res || moveWithinRange(creep, site, 2);

  //   if (creep.getRangeTo(site) < 4) {
  //     const buildResult = creep.build(site);
  //     res = true;
  //     console.log(`Builder ${creep.id}, buildOtherConstructionSites, build result: ${buildResult}`);
  //     // if (buildResult == ERR_INVALID_TARGET) site.remove();
  //   }
  // }

  return res;
}
