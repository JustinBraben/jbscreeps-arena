import { OK, RESOURCE_ENERGY } from "game/constants";
import { ConstructionSite, Creep, Position, Resource, StructureContainer, StructureExtension, StructureRampart, StructureSpawn, StructureWall, _Constructor, _ConstructorById } from "game/prototypes";
import { getObjectsByPrototype, getTicks } from "game/utils";
import { getBuilders, getEnemyCreeps, getHaulers, getHealers, getMelees, getMyCreeps, getRangers } from 'common/filterCreeps';
import { getMyExtensions, getMyExtensionsToFill, getTotalSpawnEnergy } from "common/filterExtensions";
import { getContainers, getContainersInSwamp, getContainersNearSpawn } from "common/filterContainers";
import { flee, moveWithinRange } from "common/creepMovementUtils";
import { fleeWithinRange, tryBuildConstructionSite, tryBuildSpawnRamparts, /*tryTransferSwampExtension,*/ tryWithdrawContainer } from "common/creepBehavior";
import { planConstructionSites } from "common/constructionPlan";
import { getConstructionSites, getMyConstructionSites } from "common/filterConstructionSites";
import { getBuilderParts, getHaulerParts, getHealerParts, getMeleeParts, getRangerParts } from "common/spawnPlan";
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

// This example shows how to import shared functionality that can be used across arenas
export function loop(): void {
  // Update global game state
  updateGameState();

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

  if (myExtensionsToFill.length > 0) {}

  planConstructionSites(mySpawn, myConstructionSites, myRamparts, swampContainers, 2);
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
  myRamparts = ramparts.filter(r => r.my);
  mySpawnContainers = getContainersNearSpawn(containers, mySpawn);
  swampContainers = getContainersInSwamp(containers);

  // Consider only update containers if we have Haulers or Builders
}

function runHauler(hauler: Creep, idx?: number): void {
  // Stay away from enemies
  // const nearbyEnemies = enemyCreeps.filter(e => e.getRangeTo(hauler) < 8);
  const nearbyAllies = myCreeps.filter(a => a.getRangeTo(hauler) < 3);
  if (fleeWithinRange(hauler, mySpawn, enemyCreeps, nearbyAllies.length, 3)) {
    return;
  }

  let targetWithdraw: Resource | StructureContainer | null | undefined = hauler.findInRange(droppedEnergy, 1).find(c => c);
  const closestSpawnContainer = hauler.findClosestByPath(mySpawnContainers);
  const closestSwampContainer = hauler.findClosestByPath(swampContainers);
  const closestContainer = hauler.findClosestByPath(containers);
  const closestDroppedEnergy = hauler.findClosestByRange(droppedEnergy.filter(e => e.amount > 1000));
  if (!targetWithdraw && closestSpawnContainer && idx && idx % 2 === 1) targetWithdraw = closestSpawnContainer;
  if (!targetWithdraw && closestSwampContainer && idx && idx % 2 === 0) targetWithdraw = closestSwampContainer;
  if (!targetWithdraw && closestContainer) targetWithdraw = closestContainer;
  if (closestDroppedEnergy) { targetWithdraw = closestDroppedEnergy; }
  if (!targetWithdraw) return;

  let targetTransfer: StructureSpawn | StructureExtension = mySpawn;
  const pathToMySpawn = hauler.findPathTo(mySpawn);
  let targetExtension = hauler.findClosestByPath(myExtensionsToFill.filter(e => e.my && e.store.energy < 100 && e.exists));
  let pathToMyExtension: Position[] | null = null;
  if (targetExtension) pathToMyExtension = hauler.findPathTo(targetExtension);
  if (targetExtension && pathToMyExtension && pathToMyExtension.length < pathToMySpawn.length) targetTransfer = targetExtension;
  if (targetExtension && targetExtension.store.energy < 100 && mySpawn.store.energy === 1000) targetTransfer = targetExtension;
  if (!targetTransfer) targetTransfer = mySpawn;

  if (hauler.store.energy === 0) {
    if (hauler.getRangeTo(targetWithdraw) > 1) {

      moveWithinRange(hauler, targetWithdraw, 1, /*myExtensions*/);

      if (targetWithdraw instanceof(Resource) && hauler.getRangeTo(targetWithdraw) < 2) {
        hauler.pickup(targetWithdraw);
      } else if (targetWithdraw instanceof(StructureContainer)) {
        const withdrawResult = tryWithdrawContainer(hauler, targetWithdraw);
        if (withdrawResult === OK) {
          // hauler.drop(RESOURCE_ENERGY);
        }
      }

    } else if (hauler.getRangeTo(targetWithdraw) < 2) {

      if (targetWithdraw instanceof(Resource)) {
        hauler.pickup(targetWithdraw);
      } else if (targetWithdraw instanceof(StructureContainer)) {
        const withdrawResult = tryWithdrawContainer(hauler, targetWithdraw);
        if (withdrawResult === OK) {
          // hauler.drop(RESOURCE_ENERGY);
        }
      }
    }

  } else {

    if (targetTransfer.store.energy !== 100 && hauler.getRangeTo(targetTransfer) < 2) {
      const transferResult = hauler.transfer(targetTransfer, RESOURCE_ENERGY);
      if (transferResult !== OK) moveWithinRange(hauler, mySpawn, 1);
    } else {
      hauler.drop(RESOURCE_ENERGY);
      moveWithinRange(hauler, targetTransfer, 1);
    }

  }
}

function runBuilder(creep: Creep): void {
  const nearbyAllies = myCreeps.filter(a => a.getRangeTo(creep) < 3);
  if (fleeWithinRange(creep, mySpawn, enemyCreeps, nearbyAllies.length, 3)) {
    creep.drop(RESOURCE_ENERGY);
    return;
  }

  if (mySpawnContainers.filter(c => c.store.energy > 0)){
    runHauler(creep);
  }

  // Try and build unfinished construction sites
  // Phase 1: Build spawn rampart if it doesn't exist
  tryBuildSpawnRamparts(creep, mySpawn, myConstructionSites);

  if (myExtensionsToFill.length > 1) {
    runHauler(creep);
    return;
  }

  // Fallback to building any construction sites
  if (tryBuildConstructionSite(creep, mySpawn, myConstructionSites, mySpawnContainers, swampContainers, containers, droppedEnergy)) {
    return;
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
  let wallRange = null;
  if (closestWall) wallRange = creep.getRangeTo(closestWall!);
  const closestEnemyToCreep = creep.findClosestByRange(enemyCreeps);
  // const closestHealer = creep.findClosestByRange(myHealers);
  let attTarget: Creep | StructureSpawn | StructureWall | null | undefined = null;

  if (closestWall) attTarget = closestWall;
  if (closestWall && closestEnemyToCreep && wallRange && wallRange > creep.getRangeTo(closestEnemyToCreep)) attTarget = closestEnemyToCreep;
  if (creep.getRangeTo(enemySpawn) < 8) attTarget = enemySpawn;
  if (!attTarget) attTarget = enemySpawn;

  const nearbyEnemyMelees = enemyMelees.filter(e => e.getRangeTo(creep) < 4);
  const nearbyEnemyRangers = enemyRangers.filter(e => e.getRangeTo(creep) < 4);
  const nearbyAllies = myCreeps.filter(a => a.getRangeTo(creep) < 3);
  const totalEnemyThreats = nearbyEnemyMelees.length + nearbyEnemyRangers.length;
  // totalEnemyThreats = closestEnemyToCreep;

  if (totalEnemyThreats > nearbyAllies.length + 1) {
    // if (creep.getRangeTo(enemySpawn) < 2 && enemySpawn.spawning === undefined) {
    //   const res = creep.attack(enemySpawn);
    //   console.log(`Melee attack result: ${res}`);
    // } else if (attTarget && creep.getRangeTo(attTarget) < 2) {
    //   const res = creep.attack(attTarget);
    //   console.log(`Melee attack result: ${res}`);
    // }
    // flee(creep, mySpawn, enemyCreeps, 8);
    // return;
  }

  if (mySpawn.findInRange(enemyCreeps, 10).length > 0) {
    const enemyCreepNearSpawn = mySpawn.findClosestByRange(enemyCreeps);
    if (enemyCreepNearSpawn) attTarget = enemyCreepNearSpawn;
  }

  if (creep.getRangeTo(attTarget) < 2) {
    res = creep.attack(attTarget);
    if (attTarget !== closestWall) moveWithinRange(creep, mySpawn, 1);
  } else {
    moveWithinRange(creep, attTarget, 1);
    if (creep.getRangeTo(attTarget) < 2) res = creep.attack(attTarget);
  }

  console.log(`Melee attack result: ${res}`);
}

function runHealer(creep: Creep): void {
  if (creep.hits < creep.hitsMax) {
    creep.heal(creep);
    flee(creep, mySpawn, enemyCreeps, 5);
    return;
  }

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

  // Stay away from enemies
  const nearbyEnemy = creep.findClosestByRange(enemyCreeps);
  if (nearbyEnemy && creep.getRangeTo(nearbyEnemy) < 2) {
    if (healTarget && creep.getRangeTo(healTarget) < 4) creep.rangedHeal(healTarget);
    flee(creep, mySpawn, enemyCreeps, 5);
    return;
  }

  if (!healTarget) healTarget = attacker;
  if (!healTarget) healTarget = ranger;
  if (!healTarget) healTarget = healer;


  // if (healTarget) {
  //   const range = creep.getRangeTo(healTarget);
  //   moveWithinRange(creep, healTarget, 3);

  //   if (range == 1) {
  //     creep.heal(healTarget);
  //   } else if (range <= 3) {
  //     creep.rangedHeal(healTarget);
  //     // creep.moveTo(healTarget);
  //   } else {
  //     // creep.moveTo(healTarget);
  //   }
  // } else if (attacker) {
  //   // Follow attackers
  //   moveWithinRange(creep, attacker, 2);
  //   creep.rangedHeal(attacker);
  // } else if (ranger) {
  //   // Follow attackers
  //   moveWithinRange(creep, ranger, 2);
  //   creep.rangedHeal(ranger);
  // } else if (healer) {
  //   moveWithinRange(creep, healer, 2);
  //   creep.rangedHeal(healer);
  // } else if (creep.hits < creep.hitsMax) {
  //   creep.heal(creep);
  //   return;
  // }

  if (healTarget && creep.getRangeTo(healTarget) < 4) {
    creep.rangedHeal(healTarget);
    moveWithinRange(creep, mySpawn, 1);
  } else if (healTarget) {
    moveWithinRange(creep, healTarget, 1);
    if (creep.getRangeTo(healTarget) < 4) creep.rangedHeal(healTarget);
  }

  // // Stay away from enemies
  // const nearbyEnemies = enemyCreeps.filter(e => e.getRangeTo(creep) < 5);
  // const nearbyAllies = myCreeps.filter(a => a.getRangeTo(creep) < 5);
  // if (nearbyEnemies.length > nearbyAllies.length) {
  //   flee(creep, mySpawn, nearbyEnemies, 5);
  // }
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
  const closestEnemyToCreep = creep.findClosestByRange(enemyCreeps);
  const closestEnemyToSpawn = mySpawn.findClosestByRange(enemyMelees) || mySpawn.findClosestByRange(enemyRangers) || mySpawn.findClosestByRange(enemyHealers) || mySpawn.findClosestByRange(enemyCreeps);
  const closestEnemyToSpawnRange = mySpawn.getRangeTo(closestEnemyToSpawn!);
  let attTarget: Creep | StructureSpawn | StructureWall | null | undefined = null;

  // if (closestWall) attTarget = closestWall;
  if (closestWall && wallRange && wallRange > 20 && closestEnemyToCreep) attTarget = closestEnemyToCreep;
  if (closestEnemyToCreep && creep.getRangeTo(closestEnemyToCreep) < 10) attTarget = closestEnemyToCreep;
  if (closestEnemyToSpawn && closestEnemyToSpawnRange && mySpawn.getRangeTo(closestEnemyToSpawn) < 18) attTarget = closestEnemyToSpawn;
  if (!attTarget) attTarget = targets.find(c => c);
  if (!attTarget) attTarget = enemySpawn;

  if (totalEnemyThreats > nearbyAllies.length) {
    // flee(creep, mySpawn, nearbyEnemyMelees, 8);
    // if (target && creep.getRangeTo(target) <= 5)
    if (attTarget && creep.getRangeTo(attTarget) <= 3) creep.rangedAttack(attTarget);
    if (closestAllyBuilder && creep.getRangeTo(closestAllyBuilder) > 6) {
      moveWithinRange(creep, closestAllyBuilder, 2);
    } else {
      moveWithinRange(creep, mySpawn, 3);
    }
    return;
  }

  // Wait for heal if no enemies nearby
  if (myHealers.length > 0 && totalEnemyThreats === 0 && creep.hits !== creep.hitsMax) {
    // return;
  }

  if (totalEnemyThreats >= nearbyAllies.length) {
    if (creep.getRangeTo(enemySpawn) <= 3 && enemySpawn.spawning === undefined) {
      const res = creep.rangedAttack(enemySpawn);
      console.log(`Melee attack result: ${res}`);
    } else if (attTarget && creep.getRangeTo(attTarget) <= 3) {
      const res = creep.rangedAttack(attTarget);
      console.log(`Melee attack result: ${res}`);
    }
    // flee(creep, mySpawn, nearbyEnemyMelees, 8);
    if (closestAllyBuilder) {
      moveWithinRange(creep, closestAllyBuilder, 2);
    } else {
      moveWithinRange(creep, mySpawn, 3);
    }
    return;
  }

  if (attTarget) {
    const range = creep.getRangeTo(attTarget);

    if (range <= 3) {
      creep.rangedAttack(attTarget);
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
      creep.rangedAttack(enemySpawn);
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

    if (getTicks() > 100 && getTotalSpawnEnergy(mySpawn, myExtensions) < 500) {
      return;
    }

    // if (getTicks() > 500 && getTotalSpawnEnergy(mySpawn, myExtensions) < 500) {
    //   return;
    // }

    // if (getTicks() > 1000 && getTotalSpawnEnergy(mySpawn, myExtensions) < 800) {
    //   return;
    // }

    if (myHaulers.length < 2) {
      const parts = getHaulerParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      if (result.object) {
        console.log(`Spawning Hauler: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Hauler ${result.error}`);
      }
    } else if (myRangers.length < 1) {
      const parts = getRangerParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      // const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
    else if (myBuilders.length < 1) {
      const parts = getBuilderParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      // const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    } else if (myMelees.length < 2) {
      const parts = getMeleeParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      // const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
    else if (myHealers.length < myMelees.length + myRangers.length) {
      const parts = getHealerParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      // const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
    else if (myMelees.length < enemyMelees.length) {
      const parts = getMeleeParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      // const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
    else if (myRangers.length < enemyRangers.length) {
      const parts = getRangerParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      // const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
    else if (myBuilders.length <= enemyBuilders.length) {
      const parts = getBuilderParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      // const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    } else if (myHaulers.length <= enemyHaulers.length && myBuilders.length < 5) {
      const parts = getHaulerParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      // const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    } else if (myBuilders.length < 5) {
      const parts = getBuilderParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      // const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
    else {
      const parts = getRangerParts(mySpawn, myExtensions);
      const result = mySpawn.spawnCreep(parts);
      // const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
  }
}
