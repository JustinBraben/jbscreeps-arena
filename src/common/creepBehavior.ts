import { ConstructionSite, Creep, Resource, StructureContainer, StructureExtension, StructureRampart, StructureSpawn } from "game/prototypes";
import { flee, moveWithinRange } from "./creepMovementUtils";
import { /*ERR_INVALID_TARGET,*/ CreepWithdrawResult, ERR_NOT_IN_RANGE, OK, RESOURCE_ENERGY } from "game/constants";
import { DefaultFindPathOptions } from "./constants";
import { findConstructionSiteToBuild } from "./filterConstructionSites";
import { getCreepsWithinRangeOfCreep } from "./filterCreeps";
import { createConstructionSite } from "game/utils";

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
  if (allySpawnContainers) {}
  let res = false;

  let targetWithdraw: Resource | StructureContainer | null | undefined = creep.findInRange(droppedEnergy, 1).find(c => c);
  // if (!targetWithdraw) targetWithdraw = creep.findClosestByPath(allySpawnContainers);
  // if (!targetWithdraw || targetWithdraw) targetWithdraw = creep.findClosestByRange(swampContainers);
  if (!targetWithdraw) targetWithdraw = creep.findClosestByRange(swampContainers);
  if (!targetWithdraw) targetWithdraw = creep.findClosestByRange(containers);
  if (!targetWithdraw) targetWithdraw = creep.findClosestByRange(droppedEnergy);
  if (!targetWithdraw) return res;

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

    const site = findConstructionSiteToBuild(creep, allySpawn, allyConstructionSites);

    if (site) {
      if (creep.getRangeTo(targetWithdraw) > 1) {
        creep.drop(RESOURCE_ENERGY);

        res = res || moveWithinRange(creep, targetWithdraw, 1);
      }
      else if (creep.getRangeTo(site) >= 3) {
        creep.drop(RESOURCE_ENERGY);

        res = res || moveWithinRange(creep, site, 3);
      } else if (creep.getRangeTo(site) < 3) {
        if (creep.x === site.x && creep.y === site.y && !(site.structure instanceof(StructureRampart))) res = res || moveWithinRange(creep, allySpawn, 3);
        const buildResult = creep.build(site);
        res = true;
        console.log(`Builder ${creep.id}, buildOtherConstructionSites, build result: ${buildResult}`);

        // const existingSite = allyConstructionSites.find(s => s.x === creep.x && s.y === creep.y);
        // // let outsideSite = null;
        // if (existingSite === undefined) {
        //   // outsideSite = createConstructionSite(pos, StructureExtension).object;
        //   const createSiteResult = createConstructionSite({ x: creep.x, y: creep.y }, StructureRampart);
        //   if (createSiteResult.object) {
        //     // console.log(`Site created: ${createSiteResult.object.id}`);
        //   } else if (createSiteResult.error) {
        //     console.log(`Site creation failed with error: ${createSiteResult.error}`);
        //   }
        // }
      }
    }
  }

  return res;
}

// If swamp container nearby that will decay
// withdraw from it and drop energy
// Returns true if there was a swampcontainer nearby that it withdrew from successfully
// otherwise returns false
export function tryDrainSwampContainer(
  creep: Creep,
  allyConstructionSites: ConstructionSite[],
  swampContainers: StructureContainer[],
): boolean {
  const closestSwampContainer = creep.findClosestByRange(swampContainers.filter(container => {
    return container.store.energy > 0 && container.ticksToDecay && container.ticksToDecay > 0
  }));
  const creepStore = creep.store;
  const creepStoreFreeCapacity = creepStore.getFreeCapacity(RESOURCE_ENERGY);
  if (closestSwampContainer && creepStore && creepStoreFreeCapacity && creepStoreFreeCapacity > 0) {
    const rangeToClosestSwampContainer = creep.getRangeTo(closestSwampContainer);
    if (rangeToClosestSwampContainer < 2) {
      const existingRampartSite = allyConstructionSites.find(site => site.x === creep.x && site.y === creep.y && site.structure instanceof(StructureRampart));
      if (!existingRampartSite) {
        createConstructionSite({x: creep.x, y: creep.y}, StructureRampart);
      }
      const res = creep.withdraw(closestSwampContainer, RESOURCE_ENERGY);
      if (res === OK) return true;
    }
  }

  return false;
}

export function tryDropNearSwampContainer(
  creep: Creep,
  droppedEnergy: Resource[],
): boolean {
  const closestDroppedEnergy = creep.findClosestByRange(droppedEnergy.filter(energy => energy.amount > 1000));
  if (!closestDroppedEnergy && creep.store.energy > 0) {
    creep.drop(RESOURCE_ENERGY);
    return true;
  }

  return false;
}
