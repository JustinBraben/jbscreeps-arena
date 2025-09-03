import { ERR_INVALID_TARGET, ERR_NOT_IN_RANGE, MOVE, OK, RESOURCE_ENERGY } from "game/constants";
import { ConstructionSite, Creep, Position, Resource, StructureContainer, StructureExtension, StructureRampart, StructureSpawn, StructureWall, _Constructor, _ConstructorById } from "game/prototypes";
import { getObjectsByPrototype, getTicks } from "game/utils";
import { getBuilders, getEnemyCreeps, getHaulers, getHealers, getMelees, getMyCreeps, getRangers } from 'common/filterCreeps';
import { getMyExtensions, getMyExtensionsToFill, getTotalSpawnEnergy } from "common/filterExtensions";
import { getContainers, getContainersInSwamp, getContainersNearSpawn } from "common/filterContainers";
import { flee, moveWithinRange } from "common/creepMovementUtils";
import { /*fleeWithinRange,*/ /*tryBuildSpawnRamparts,*/ /*tryTransferSwampExtension,*/ tryWithdrawContainer } from "common/creepBehavior";
import { planConstructionSites, planExtensions, planRamparts } from "common/constructionPlan";
import { findConstructionSiteToBuild, getConstructionSites, getMyConstructionSites } from "common/filterConstructionSites";
import { getBuilderParts, getHaulerParts, getHealerParts, getMeleeParts, getRangerParts } from "common/spawnPlan";
import { findClosestAvailableRampart } from "common/filterRamparts";
import { Visual } from "game/visual";
import { debugSpawnExits, makeSpawnBottomExitPosition, makeSpawnTopExitPosition } from "common/visual/debugVisual";
// import { DefaultFindPathOptions } from "common/constants";

// Global variables for game state
let mySpawn: StructureSpawn;
let myCreeps: Creep[];
let myHaulers: Creep[];
let myBuilders: Creep[];
let myMelees: Creep[];
let myHealers: Creep[];
let myRangers: Creep[];
let mySpawnContainers: StructureContainer[];
let myExtensions: StructureExtension[];
let myExtensionsToFill: StructureExtension[];
let myConstructionSites: ConstructionSite[];
let myRamparts: StructureRampart[];
let mySpawnTopExit: Position[];
let mySpawnBottomExit: Position[];

let constructionSites: ConstructionSite[];
let droppedEnergy: Resource[];
let containers: StructureContainer[];
let swampContainers: StructureContainer[];
let walls: StructureWall[];
let ramparts: StructureRampart[];

let enemySpawn: StructureSpawn;
let enemyCreeps: Creep[];
let enemyHaulers: Creep[];
let enemyBuilders: Creep[];
let enemyMelees: Creep[];
let enemyRangers: Creep[];
let enemyHealers: Creep[];
let enemySpawnTopExit: Position[];
let enemySpawnBottomExit: Position[];

let globalVisual: Visual = new Visual(10, true);

// This example shows how to import shared functionality that can be used across arenas
export function loop(): void {
  // Update global game state
  updateGameState();

  // Display visual information
  displayVisuals();

  // Spawn logic
  handleSpawning();

  if (!mySpawn || !enemySpawn) return;

  let count = 0;
  for (let hauler of myHaulers) {
    count += 1;
    runHauler(hauler, count);
  }

  for (let builder of myBuilders) {
    runBuilder(builder);
  }

  for (let melee of myMelees) {
    runMelee(melee);
  }

  for (let healer of myHealers) {
    runHealer(healer);
  }

  for (let ranger of myRangers) {
    runRanger(ranger);
  }

  if (myExtensionsToFill.length > 0 && enemyHaulers && enemyBuilders) {}

  if (getTicks() === 800) planConstructionSites(mySpawn, myConstructionSites, swampContainers, 2);

  planSmallestExit();
}

// All things we want to get every tick should be saved here
function updateGameState(): void {
  let personalSpawn = getObjectsByPrototype(StructureSpawn).find(s => s.my);
  if (personalSpawn !== undefined) {
    mySpawn = personalSpawn;
  }
  let otherSpawn = getObjectsByPrototype(StructureSpawn).find(s => !s.my);
  if (otherSpawn !== undefined) {
    enemySpawn = otherSpawn;
  }
  enemyCreeps = getEnemyCreeps();
  enemyHaulers = getHaulers(enemyCreeps);
  enemyBuilders = getBuilders(enemyCreeps);
  enemyMelees = getMelees(enemyCreeps);
  enemyRangers = getRangers(enemyCreeps);
  enemyHealers = getHealers(enemyCreeps);
  myCreeps = getMyCreeps();
  myHaulers = getHaulers(myCreeps);
  myBuilders = getBuilders(myCreeps);
  myMelees = getMelees(myCreeps);
  myHealers = getHealers(myCreeps);
  myRangers = getRangers(myCreeps);
  myExtensions = getMyExtensions();
  myExtensionsToFill = getMyExtensionsToFill();
  constructionSites = getConstructionSites();
  myConstructionSites = getMyConstructionSites(constructionSites);
  droppedEnergy = getObjectsByPrototype(Resource).filter(r => r.resourceType === RESOURCE_ENERGY);
  containers = getContainers();
  walls = getObjectsByPrototype(StructureWall);
  ramparts = getObjectsByPrototype(StructureRampart);
  myRamparts = ramparts.filter(r => r.my && r.hits > 0);
  mySpawnContainers = getContainersNearSpawn(containers, mySpawn);
  swampContainers = getContainersInSwamp(containers);

  // Consider only update containers if we have Haulers or Builders\

  globalVisual.clear();
}

function runHauler(creep: Creep, idx?: number): void {
  if (!creep.body.find(p => p.type === MOVE && p.hits > 0)) return;
  // Stay away from enemies
  const nearbyMelees = creep.findInRange(enemyMelees, 10);
  const nearbyRangers = creep.findInRange(enemyRangers, 10);
  const totalNearbyThreats = nearbyMelees.length + nearbyRangers.length;
  // const closestRamparts = creep.findClosestByRange(myRamparts);

  let targetWithdraw: Resource | StructureContainer | null | undefined = creep.findInRange(droppedEnergy, 1).find(c => c);
  const closestSpawnContainer = creep.findClosestByPath(mySpawnContainers);
  const closestSwampContainer = creep.findClosestByPath(swampContainers);
  const closestContainer = creep.findClosestByPath(containers);
  const closestDroppedEnergy = creep.findClosestByPath(droppedEnergy.filter(e => e.amount > 150));
  if (!targetWithdraw && closestSpawnContainer && idx && idx % 2 === 1) targetWithdraw = closestSpawnContainer;
  if (!targetWithdraw && closestSwampContainer && idx && idx % 2 === 0) targetWithdraw = closestSwampContainer;
  if (!targetWithdraw && closestContainer) targetWithdraw = closestContainer;
  if (closestDroppedEnergy && creep.getRangeTo(closestDroppedEnergy) < 15) { targetWithdraw = closestDroppedEnergy; }
  if (!targetWithdraw) return;

  let targetTransfer: StructureSpawn | StructureExtension = mySpawn;
  const pathToMySpawn = creep.findPathTo(mySpawn);
  let targetExtension = creep.findClosestByPath(myExtensionsToFill.filter(e => e.my && e.store.energy < 100 && e.exists));
  let pathToMyExtension: Position[] | null = null;
  if (targetExtension) pathToMyExtension = creep.findPathTo(targetExtension);
  if (targetExtension && pathToMyExtension && pathToMyExtension.length < pathToMySpawn.length) targetTransfer = targetExtension;
  if (targetExtension && targetExtension.store.energy < 100 && mySpawn.store.energy === 1000) targetTransfer = targetExtension;
  if (!targetTransfer) targetTransfer = mySpawn;

  if (totalNearbyThreats > 0) {
    const closestAvailableRampart = findClosestAvailableRampart(creep, myRamparts, myCreeps);

    if (closestAvailableRampart) {
      // If not already on the rampart, move to it
      if (creep.x !== closestAvailableRampart.x || creep.y !== closestAvailableRampart.y) {
        moveWithinRange(creep, closestAvailableRampart, 0, undefined);
      }
      // If already on rampart, can continue with building logic
    } else {
      // No available ramparts, use existing flee logic
      flee(creep, mySpawn, [...nearbyMelees, ...nearbyRangers], 5);
      return;
    }

    creep.transfer(targetTransfer, RESOURCE_ENERGY);
    return;
  }

  if (creep.store.energy === 0) {
    if (creep.getRangeTo(targetWithdraw) > 1) {

      moveWithinRange(creep, targetWithdraw, 1, undefined);

      if (targetWithdraw instanceof(Resource) && creep.getRangeTo(targetWithdraw) < 2) {
        creep.pickup(targetWithdraw);
      } else if (targetWithdraw instanceof(StructureContainer)) {
        const withdrawResult = tryWithdrawContainer(creep, targetWithdraw);
        if (withdrawResult === OK) {
          // hauler.drop(RESOURCE_ENERGY);
        }
      }

    } else if (creep.getRangeTo(targetWithdraw) < 2) {

      if (targetWithdraw instanceof(Resource)) {
        creep.pickup(targetWithdraw);
      } else if (targetWithdraw instanceof(StructureContainer)) {
        const withdrawResult = tryWithdrawContainer(creep, targetWithdraw);
        if (withdrawResult === OK) {
          // hauler.drop(RESOURCE_ENERGY);
        }
      }
    }

  } else {

    if (targetTransfer.store.energy !== 100 && creep.getRangeTo(targetTransfer) < 2) {
      const transferResult = creep.transfer(targetTransfer, RESOURCE_ENERGY);
      if (transferResult !== OK) {
        moveWithinRange(creep, mySpawn, 1, undefined);
      } else {
        myExtensionsToFill = getMyExtensionsToFill();
        moveWithinRange(creep, targetWithdraw, 1, undefined);
      }
      myExtensionsToFill = getMyExtensionsToFill();
    } else {
      creep.drop(RESOURCE_ENERGY);
      moveWithinRange(creep, targetTransfer, 1, undefined);
    }

  }
}

function runBuilder(creep: Creep): void {
  // Stay away from enemies
  const nearbyMelees = creep.findInRange(enemyMelees, 10);
  const nearbyRangers = creep.findInRange(enemyRangers, 10);
  const totalNearbyThreats = nearbyMelees.length + nearbyRangers.length;

  droppedEnergy = getObjectsByPrototype(Resource).filter(r => r.resourceType === RESOURCE_ENERGY);
  const closestSwampContainer = creep.findClosestByPath(swampContainers.filter(container => container.store.energy > 0));
  const closestDroppedEnergy = creep.findClosestByRange(droppedEnergy.filter(energy => energy.amount > 0));

  // Threat handling (keeping your existing logic)
  if (totalNearbyThreats > creep.findInRange(myCreeps, 10).length) {
    // Your existing threat response logic here
  }

  // Special logic after 9 extensions (keeping your existing logic)
  if (myExtensions.length > 31) {
    planExits();
  }

  // Main builder logic - IMPROVED SECTION
  if (creep.store.energy === 0) {
    // When empty, go get energy
    if (closestSwampContainer) {
      const rangeToSwampContainer = creep.getRangeTo(closestSwampContainer);
      if (rangeToSwampContainer === 0) {
        creep.withdraw(closestSwampContainer, RESOURCE_ENERGY);
        const site = findConstructionSiteToBuild(creep, mySpawn, myConstructionSites);
        if (site && creep.getRangeTo(site) >= 3) {
          moveWithinRange(creep, site, 3, undefined);
        }
      } else if (closestDroppedEnergy && creep.getRangeTo(closestDroppedEnergy) === 0 && creep.findInRange(myConstructionSites, 1).length > 0) {
        creep.pickup(closestDroppedEnergy);
        const site = findConstructionSiteToBuild(creep, mySpawn, myConstructionSites);
        if (site && creep.getRangeTo(site) >= 3) {
          moveWithinRange(creep, site, 3, undefined);
          const res = creep.build(site);
          if (res === ERR_INVALID_TARGET) site.remove();
        }
      } else {
        moveWithinRange(creep, closestSwampContainer, 0, undefined);
      }
    }
  } else {


    if (closestSwampContainer) {
      const rangeToSwampContainer = creep.getRangeTo(closestSwampContainer);
      if (rangeToSwampContainer === 0) {
        creep.drop(RESOURCE_ENERGY);
        // Check if standing on a rampart or rampart construction site
        const rampartAtPosition = myRamparts.find(r => r.x === creep.x && r.y === creep.y);
        const rampartSiteAtPosition = myConstructionSites.find(s =>
          s.x === creep.x &&
          s.y === creep.y &&
          s.structure instanceof(StructureRampart)
        );

        if (rampartAtPosition || rampartSiteAtPosition) {
          // Standing on rampart/rampart site - create extension nearby
          planExtensions(creep, myConstructionSites);
        } else {
          // Not on rampart - create rampart at current position
          planRamparts(creep, myConstructionSites);
        }

        myConstructionSites = getMyConstructionSites(constructionSites);
        return;
      }
    }

    // After creating sites, also try to build if there's something nearby
    const site = findConstructionSiteToBuild(creep, mySpawn, myConstructionSites);

    if (site && site.exists) {
      const res = creep.build(site);
      if (res === ERR_NOT_IN_RANGE) {
        moveWithinRange(creep, site, 3, undefined);
      } else if (res !== OK) {
        if (res === ERR_INVALID_TARGET) site.remove();

        creep.drop(RESOURCE_ENERGY);

        // if (closestDroppedEnergy) moveWithinRange(creep, closestDroppedEnergy, 3, undefined);
        // else moveWithinRange(creep, mySpawn, 3, undefined);
      }
    } else {
      if (closestSwampContainer) moveWithinRange(creep, closestSwampContainer, 0, undefined);
    }
  }
}

function runMelee(creep: Creep): void {
  let res;

  const closestWall = creep.findClosestByRange(walls.filter(c =>
        c.id == "6"  ||
        c.id == "11" ||
        c.id == "21" ||
        c.id == "26"
  ));
  const closestEnemyToCreep = creep.findClosestByRange(enemyCreeps);
  // const closestHealer = creep.findClosestByRange(myHealers);
  let attTarget: Creep | StructureSpawn | StructureWall | null | undefined = null;

  const closestEnemyExtension: StructureExtension | undefined = getObjectsByPrototype(StructureExtension).filter(e => !e.my && e.exists).find(e => e);

  if (!attTarget && closestEnemyToCreep && creep.getRangeTo(closestEnemyToCreep) > 5) attTarget = closestWall;
  if (!attTarget && closestEnemyExtension && creep.getRangeTo(closestEnemyExtension) < 5) attTarget = closestEnemyExtension;
  if (!attTarget && closestEnemyToCreep && creep.getRangeTo(closestEnemyToCreep) < 5) attTarget = closestEnemyToCreep;
  if (attTarget === closestEnemyToCreep && creep.getRangeTo(enemySpawn) < 5) attTarget = enemySpawn;
  if (!attTarget) attTarget = enemySpawn;

  const nearbyEnemyMelees = enemyMelees.filter(e => e.getRangeTo(creep) < 5);
  const nearbyEnemyRangers = enemyRangers.filter(e => e.getRangeTo(creep) < 5);
  const nearbyAllies = myCreeps.filter(a => a.getRangeTo(creep) < 3);
  const totalEnemyThreats = nearbyEnemyMelees.length + nearbyEnemyRangers.length;
  // totalEnemyThreats = closestEnemyToCreep;

  const closestAvailableRampart = findClosestAvailableRampart(creep, myRamparts, myCreeps);
  if (closestAvailableRampart && myRamparts.length > 4) {
    // moveWithinRange(creep, closestAvailableRampart, 0);
    // creep.attack(attTarget);
    // return;
  }

  if (mySpawn.findInRange(enemyCreeps, 10).length > 0) {
    const enemyCreepNearSpawn = mySpawn.findClosestByRange(enemyCreeps);
    if (enemyCreepNearSpawn) attTarget = enemyCreepNearSpawn;
  }

  if (creep.getRangeTo(attTarget) < 2) {
    res = creep.attack(attTarget);
    // if (attTarget !== closestWall) moveWithinRange(creep, mySpawn, 1);
  } else {
    if (totalEnemyThreats <= nearbyAllies.length) {} // moveWithinRange(creep, attTarget, 1);
    // if (creep.getRangeTo(attTarget) < 2) res = creep.attack(attTarget);

    moveWithinRange(creep, attTarget, 1, undefined);
    res = creep.attack(attTarget);
  }

  console.log(`Melee attack result: ${res}`);
}

function runHealer(creep: Creep): void {
  const healTargets = myCreeps
    .filter(c => c.hits < c.hitsMax)
    .sort((a, b) => {
      // Prioritize low health
      const healthRatio = (a.hits / a.hitsMax) - (b.hits / b.hitsMax);
      if (Math.abs(healthRatio) > 0.1) return healthRatio;
      // Then by distance
      return a.getRangeTo(creep) - b.getRangeTo(creep);
    });
  let healTarget: Creep | null | undefined = healTargets.find(c => c);

  const attacker = myMelees
      .sort((a, b) => a.getRangeTo(creep) - b.getRangeTo(creep)).find(c => c.hits !== 0);

  const ranger = creep.findClosestByPath(myRangers.filter(c => c.hits !== 0));

  const healer = creep.findClosestByPath(myHealers.filter(c => c.hits !== 0));

  const closestAlly = creep.findClosestByRange(myCreeps);

  if (!healTarget) healTarget = attacker;
  if (!healTarget) healTarget = ranger;
  if (!healTarget) healTarget = healer;

  if (creep.hits < creep.hitsMax) {
    creep.heal(creep);
    if (closestAlly) moveWithinRange(creep, closestAlly, 1);
    return;
  }


  if (healTarget && creep.getRangeTo(healTarget) < 4) {
    creep.rangedHeal(healTarget);
    // moveWithinRange(creep, mySpawn, 1);
  } else if (healTarget) {
    moveWithinRange(creep, healTarget, 1);
    if (creep.getRangeTo(healTarget) < 4) creep.rangedHeal(healTarget);
  }

}

function runRanger(creep: Creep): void {
  const closestWall = creep.findClosestByRange(walls);
  let wallRange = null;
  if (closestWall) wallRange = creep.getRangeTo(closestWall!);
  const nearbyEnemyMelees = enemyMelees.filter(e => e.getRangeTo(creep) < 10);
  const nearbyEnemyRangers = enemyRangers.filter(e => e.getRangeTo(creep) < 10);
  const nearbyAllies = myCreeps.filter(a => a.getRangeTo(creep) < 3);
  const totalEnemyThreats = nearbyEnemyMelees.length + nearbyEnemyRangers.length;
  const targets = enemyCreeps.sort((a, b) => a.getRangeTo(creep) - b.getRangeTo(creep));
  const closestAllyBuilder = creep.findClosestByRange(myBuilders);
  const closestAlly = creep.findClosestByRange(myCreeps);
  const closestEnemyToCreep = creep.findClosestByRange(enemyCreeps);
  const closestEnemyToSpawn = mySpawn.findClosestByRange(enemyMelees) || mySpawn.findClosestByRange(enemyRangers) || mySpawn.findClosestByRange(enemyHealers) || mySpawn.findClosestByRange(enemyCreeps);
  const closestEnemyToSpawnRange = mySpawn.getRangeTo(closestEnemyToSpawn!);
  let attTarget: Creep | StructureSpawn | StructureWall | null | undefined = null;

  // if (closestWall) attTarget = closestWall;
  if (closestWall && wallRange && wallRange > 20 && closestEnemyToCreep) attTarget = closestEnemyToCreep;
  if (closestEnemyToCreep && creep.getRangeTo(closestEnemyToCreep) < 10) attTarget = closestEnemyToCreep;
  if (closestEnemyToSpawn && closestEnemyToSpawnRange && mySpawn.getRangeTo(closestEnemyToSpawn) < 18) {}// { attTarget = closestEnemyToSpawn; }
  if (!attTarget && enemyCreeps && enemyCreeps.length > 0) attTarget = targets.find(c => c);
  if (!attTarget || (enemyMelees.length === 0 && enemyRangers.length === 0)) attTarget = enemySpawn;

  const closestAvailableRampart = findClosestAvailableRampart(creep, myRamparts, myCreeps);

  // if (closestAvailableRampart) {
  //   moveWithinRange(creep, closestAvailableRampart, 0);

  //   if (attTarget && creep.getRangeTo(attTarget) <= 3) {
  //     if (totalEnemyThreats > 2) {
  //       const res = creep.rangedMassAttack();
  //       console.log(`Ranger mass attack result: ${res}`);
  //     } else {
  //       const res = creep.rangedAttack(attTarget);
  //       console.log(`Ranger attack result: ${res}`);
  //     }
  //   }

  //   return;
  // }

  // Handle fleeing to ramparts when outnumbered
  if (totalEnemyThreats > nearbyAllies.length) {
    // Attack if in range
    if (attTarget && creep.getRangeTo(attTarget) < 3) {
      if (totalEnemyThreats > 2) {
        const res = creep.rangedMassAttack();
        console.log(`Ranger mass attack result: ${res}`);
      } else {
        const res = creep.rangedAttack(attTarget);
        console.log(`Ranger attack result: ${res}`);
      }
    } else if (attTarget) {
      creep.rangedAttack(attTarget);
    }

    if (closestAvailableRampart) {
      moveWithinRange(creep, closestAvailableRampart, 0);
    } else if (closestAllyBuilder) {
      moveWithinRange(creep, closestAllyBuilder, 2);
    } else {
       if (closestAlly) moveWithinRange(creep, closestAlly, 3);
    }
    return;
  }

  // Wait for heal if no enemies nearby
  if (myHealers.length > 0 && totalEnemyThreats === 0 && creep.hits !== creep.hitsMax) {
    // return;
  }

  if (attTarget) {
    const range = creep.getRangeTo(attTarget);

    if (range <= 3) {
      if (totalEnemyThreats > 2) {
        const res = creep.rangedMassAttack();
        console.log(`Ranger mass attack result: ${res}`);
      } else {
        const res = creep.rangedAttack(attTarget);
        console.log(`Ranger attack result: ${res}`);
      }
    }

    // moveWithinRange(creep, attTarget, 3);
    // const fleePath = searchPath(creep, attTargets, DefaultFleeFindPathOptions);

    // Kite: maintain distance of 3
    if (range < 3) {
      // if (getRange(creep, attTarget) > 3) {
      //   creep.moveTo(attTarget, DefaultFleeFindPathOptions);
      // }
      // creep.moveTo(attTarget, DefaultFleeFindPathOptions);
      flee(creep, mySpawn, targets, 3);
    } else if (range > 3) {
      moveWithinRange(creep, attTarget, 3);
    }
  } else if (enemySpawn) {
    const range = creep.getRangeTo(enemySpawn);
    if (range <= 3) {
      if (totalEnemyThreats > 2) {
        const res = creep.rangedMassAttack();
        console.log(`Ranger mass attack result: ${res}`);
      } else {
        const res = creep.rangedAttack(attTarget);
        console.log(`Ranger attack result: ${res}`);
      }
    } else {
      moveWithinRange(creep, enemySpawn, 3);
    }
  }
}

function handleSpawning(): void {
  if (!mySpawn.spawning) {

    if (getTotalSpawnEnergy(mySpawn, myExtensions) < 300) {
      return;
    }

    if (getTicks() > 300 && getTotalSpawnEnergy(mySpawn, myExtensions) < 1000) {
      return;
    }

    // if (getTicks() > 500 && getTotalSpawnEnergy(mySpawn, myExtensions) < 500) {
    //   return;
    // }

    // if (getTicks() > 1000 && getTotalSpawnEnergy(mySpawn, myExtensions) < 800) {
    //   return;
    // }

    if (myHaulers.length < myHealers.length + 2) {
      const parts = getHaulerParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      if (result.object) {
        console.log(`Spawning Hauler: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Hauler ${result.error}`);
      }
    }
    else if (myBuilders.length < myHaulers.length - 1) {
      const parts = getBuilderParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      if (result.object) {
        console.log(`Spawning Builder: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
    else if (myRangers.length < myBuilders.length) {
      const parts = getRangerParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      // const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK]);
      if (result.object) {
        console.log(`Spawning Ranger: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
    else if (myMelees.length < myRangers.length) {
      const parts = getMeleeParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      // const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
    else if (myHealers.length < myMelees.length) {
      const parts = getHealerParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      // const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK]);
      if (result.object) {
        console.log(`Spawning Healer: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
  }
}

function displayVisuals(): void {
  if (!mySpawn) return;

  // Display spawn energy AND total energy
  const totalEnergy = getTotalSpawnEnergy(mySpawn, myExtensions);
  globalVisual.text(
    `Energy: ${mySpawn.store.energy}/${totalEnergy}`,
    { x: mySpawn.x, y: mySpawn.y - 1 },
    {
      font: "0.5",
      opacity: 0.8,
      backgroundColor: "#FFD700",
      backgroundPadding: 0.05
    }
  );

  // debugExtensionPlaceholders(globalVisual, containers, mySpawn);

  debugSpawnExits(globalVisual, mySpawnTopExit, mySpawnBottomExit, enemySpawnTopExit, enemySpawnBottomExit);
}

function planSmallestExit(): void {
  if (!mySpawnTopExit) {
    mySpawnTopExit = makeSpawnTopExitPosition(mySpawn);
  }

  if (!mySpawnBottomExit) {
    mySpawnBottomExit = makeSpawnBottomExitPosition(mySpawn);
  }

  if (!enemySpawnTopExit) {
    enemySpawnTopExit = makeSpawnTopExitPosition(enemySpawn);
  }

  if (!enemySpawnBottomExit) {
    enemySpawnBottomExit = makeSpawnBottomExitPosition(enemySpawn);
  }

  let shortestExit: number = 10;
  if (mySpawnTopExit.length < shortestExit) shortestExit = mySpawnTopExit.length;
  if (mySpawnBottomExit.length < shortestExit) shortestExit = mySpawnBottomExit.length;
  if (enemySpawnTopExit.length < shortestExit) shortestExit = enemySpawnTopExit.length;
  if (enemySpawnBottomExit.length < shortestExit) shortestExit = enemySpawnBottomExit.length;

  // for (const pos of enemySpawnTopExit) {
  //   if (enemySpawnTopExit.length === shortestExit) planRamparts(pos, myConstructionSites);
  // }

  // for (const pos of enemySpawnBottomExit) {
  //   if (enemySpawnBottomExit.length === shortestExit) planRamparts(pos, myConstructionSites);
  // }

  // for (const pos of mySpawnTopExit) {
  //   if (mySpawnTopExit.length === shortestExit) planRamparts(pos, myConstructionSites);
  // }

  // for (const pos of mySpawnBottomExit) {
  //   if (mySpawnBottomExit.length === shortestExit) planRamparts(pos, myConstructionSites);
  // }
}

function planExits(): void {
  if (!mySpawnTopExit) {
    mySpawnTopExit = makeSpawnTopExitPosition(mySpawn);
  }

  if (!mySpawnBottomExit) {
    mySpawnBottomExit = makeSpawnBottomExitPosition(mySpawn);
  }

  if (!enemySpawnTopExit) {
    enemySpawnTopExit = makeSpawnTopExitPosition(enemySpawn);
  }

  if (!enemySpawnBottomExit) {
    enemySpawnBottomExit = makeSpawnBottomExitPosition(enemySpawn);
  }

  for (const pos of enemySpawnTopExit) {
    planRamparts(pos, myConstructionSites);
  }

  for (const pos of enemySpawnBottomExit) {
    planRamparts(pos, myConstructionSites);
  }

  for (const pos of mySpawnTopExit) {
    planRamparts(pos, myConstructionSites);
  }

  for (const pos of mySpawnBottomExit) {
    planRamparts(pos, myConstructionSites);
  }
}
