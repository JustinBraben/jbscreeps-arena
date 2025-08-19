import { ATTACK, CARRY, HEAL, MOVE, OK, RANGED_ATTACK, RESOURCE_ENERGY, /*TOUGH,*/ WORK } from "game/constants";
import { ConstructionSite, Creep, Position, StructureContainer, StructureExtension, StructureRampart, StructureSpawn, StructureWall, _Constructor, _ConstructorById } from "game/prototypes";
import { getObjectsByPrototype } from "game/utils";
import { getBuilders, getEnemyCreeps, getHaulers, getHealers, getMelees, getMyCreeps, getRangers } from 'common/filterCreeps';
import { getMyExtensionsToFill } from "common/filterExtensions";
import { getContainers, getContainersInSwamp, getContainersNearSpawn } from "common/filterContainers";
import { flee, moveWithinRange } from "common/creepMovementUtils";
import { fleeWithinRange, tryBuildConstructionSite, tryBuildSpawnRamparts, /*tryTransferSwampExtension,*/ tryWithdrawContainer } from "common/creepBehavior";
import { planConstructionSites } from "common/constructionPlan";
import { getConstructionSites, getMyConstructionSites } from "common/filterConstructionSites";
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
let myExtensionsToFill: StructureExtension[];
let myConstructionSites: ConstructionSite[];
let myRamparts: StructureRampart[];

let constructionSites: ConstructionSite[];
let containers: StructureContainer[];
let swampContainers: StructureContainer[];
let walls: StructureWall[];
let ramparts: StructureRampart[];

let enemySpawn: StructureSpawn;
let enemyCreeps: Creep[];
let enemyMelees: Creep[];
let enemyRangers: Creep[];

// This example shows how to import shared functionality that can be used across arenas
export function loop(): void {
  // Update global game state
  updateGameState();

  // Spawn logic
  handleSpawning();

  if (!mySpawn || !enemySpawn) return;

  for (let hauler of myHaulers) {
    runHauler(hauler);
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

function runHauler(hauler: Creep): void {
  // Stay away from enemies
  // const nearbyEnemies = enemyCreeps.filter(e => e.getRangeTo(hauler) < 8);
  if (fleeWithinRange(hauler, mySpawn, enemyCreeps, 8, 2)) {
    return;
  }

  // let hasMoved = false;
  // let hasWithdran = false;
  // let hasTransferred = false;

  if (hauler.store.energy === 0) {
    // Consider fallback containers
    let targetContainer = hauler.findClosestByPath(mySpawnContainers);
    if (targetContainer === null) targetContainer = hauler.findClosestByPath(containers);
    if (targetContainer === null) return;

    // Determine destination to transfer energy into
    let targetTransfer = null;
    targetTransfer = mySpawn;

    if (hauler.getRangeTo(targetContainer) > 1) {
      moveWithinRange(hauler, targetContainer, 1);
      tryWithdrawContainer(hauler, targetContainer);
    } else if (hauler.getRangeTo(targetContainer) == 1) {
      const withdrawResult = hauler.withdraw(targetContainer, RESOURCE_ENERGY);
      if (withdrawResult === OK) {
        console.log(`hauler: ${hauler.id} CreepWithdrawResult: ${withdrawResult}, then moved to mySpawn`);
        const targetExtension = hauler.findClosestByPath(myExtensionsToFill);
        if (targetExtension) targetTransfer = targetExtension;
        moveWithinRange(hauler, targetTransfer, 1);
      }
    }
  } else {
    const pathToMySpawn = hauler.findPathTo(mySpawn);
    const targetExtension = hauler.findClosestByPath(myExtensionsToFill);
    const targetExtensionExists = targetExtension !== null;
    let pathToMyExtension: Position[];
    if (targetExtension) pathToMyExtension = hauler.findPathTo(targetExtension);

    if ((mySpawn.store.energy < 1000 && !targetExtensionExists) || (mySpawn.store.energy < 1000 && targetExtensionExists && pathToMySpawn.length < pathToMyExtension!.length)) {
      moveWithinRange(hauler, mySpawn, 1);
      if (hauler.getRangeTo(mySpawn) == 1) {
        const transferResult = hauler.transfer(mySpawn, RESOURCE_ENERGY);
        console.log(`hauler: ${hauler.id} Moved to spawn: ${mySpawn.id}, CreepTransferResult: ${transferResult}`);
      }
    } else if (mySpawn.store.energy < 1000 && hauler.getRangeTo(mySpawn) == 1) {
      const transferResult = hauler.transfer(mySpawn, RESOURCE_ENERGY);
      if (transferResult === OK) {

        let targetContainer = hauler.findClosestByPath(mySpawnContainers);
        if (!targetContainer) targetContainer = hauler.findClosestByPath(containers);
        if (!targetContainer) return;

        moveWithinRange(hauler, targetContainer, 1);
        console.log(`hauler: ${hauler.id} CreepTransferResult: ${transferResult}, then moved to targetContainer: ${targetContainer.id}`);
      }
    } else if (targetExtension && targetExtension.store.energy < 100 && pathToMyExtension!.length < pathToMySpawn.length) {
      moveWithinRange(hauler, targetExtension!, 1);
      if (hauler.getRangeTo(targetExtension!) == 1) {
        const transferResult = hauler.transfer(targetExtension!, RESOURCE_ENERGY);
        console.log(`hauler: ${hauler.id} Moved to targetExtension: ${targetExtension!.id}, CreepTransferResult: ${transferResult}`);
      }
    }
  }
}

function runBuilder(creep: Creep): void {
  if (fleeWithinRange(creep, mySpawn, enemyCreeps, 15, 1)) {
    creep.drop(RESOURCE_ENERGY);
    return;
  }

  // Try fill up empty extensions

  // Try and build unfinished construction sites
  // Phase 1: Build spawn rampart if it doesn't exist
  tryBuildSpawnRamparts(creep, mySpawn, myConstructionSites);

  // tryTransferSwampExtension(creep, mySpawn, myExtensionsToFill, swampContainers);

  // Fallback to building any construction sites
  if (tryBuildConstructionSite(creep, mySpawn, myConstructionSites)) {
    return;
  }

  // Otherwise just hauling
  runHauler(creep);
}

function runMelee(creep: Creep): void {
  const enemyCreepTarget = creep.findClosestByPath(enemyCreeps);

  const nearestWall = creep.findClosestByPath(walls);

  // Start grouping if far enemies are grouped
  const nearbyEnemyMelees = enemyMelees.filter(e => e.getRangeTo(creep) < 7);
  const nearbyEnemyRangers = enemyRangers.filter(e => e.getRangeTo(creep) < 7);
  const nearbyAllies = myCreeps.filter(a => a.getRangeTo(creep) < 2);
  const totalEnemyThreats = nearbyEnemyMelees.length + nearbyEnemyRangers.length;
  const attTarget = creep.findClosestByRange(enemyCreeps);
  // Wait for heal if no enemies nearby
  if (myHealers.length > 0 && totalEnemyThreats === 0 && creep.hits !== creep.hitsMax) {
    if (creep.getRangeTo(enemySpawn) < 2 && enemySpawn.spawning === undefined) {
      const res = creep.attack(enemySpawn);
      console.log(`Melee attack result: ${res}`);
    } else if (attTarget && creep.getRangeTo(attTarget) < 2) {
      const res = creep.attack(attTarget);
      console.log(`Melee attack result: ${res}`);
    }
    flee(creep, mySpawn, nearbyEnemyMelees, 8);
    return;
  }

  if (totalEnemyThreats >= nearbyAllies.length) {
    if (creep.getRangeTo(enemySpawn) < 2 && enemySpawn.spawning === undefined) {
      const res = creep.attack(enemySpawn);
      console.log(`Melee attack result: ${res}`);
    } else if (attTarget && creep.getRangeTo(attTarget) < 2) {
      const res = creep.attack(attTarget);
      console.log(`Melee attack result: ${res}`);
    }
    flee(creep, mySpawn, nearbyEnemyMelees, 8);
    return;
  }

  // // Wait for heal if no enemies nearby
  // if (myHealers.length > 0 && creep.hits !== creep.hitsMax) {
  //   return;
  // }

  let res;

  if (enemyCreepTarget !== null && enemyCreepTarget !== undefined && creep.getRangeTo(enemyCreepTarget) < 10) {
    moveWithinRange(creep, enemyCreepTarget, 1);
    if (creep.getRangeTo(enemyCreepTarget) < 2) res = creep.attack(enemyCreepTarget);
  } else if (creep.getRangeTo(enemySpawn) < 5) {
    moveWithinRange(creep, enemySpawn, 1);
    if (creep.getRangeTo(enemySpawn) < 2) res = creep.attack(enemySpawn);
  } else if (nearestWall) {
    moveWithinRange(creep, nearestWall, 1);
    if (creep.getRangeTo(nearestWall) < 2) res = creep.attack(nearestWall);
  } else {
    moveWithinRange(creep, enemySpawn, 1);
    if (creep.getRangeTo(enemySpawn) < 2) res = creep.attack(enemySpawn);
  }

  console.log(`Melee attack result: ${res}`);
}

function runHealer(creep: Creep): void {
  if (creep.hits < creep.hitsMax) {
    creep.heal(creep);
    return;
  }

  // Stay away from enemies
  const nearbyEnemy = creep.findClosestByRange(enemyCreeps);
  if (nearbyEnemy && creep.getRangeTo(nearbyEnemy) < 2) {
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
  // const healTarget = creep.findClosestByPath(healTargets);
  // const healTarget = creep.findClosestByRange(healTargets);
  const healTarget = healTargets.find(c => c);

  const attacker = myMelees
      .sort((a, b) => a.getRangeTo(creep) - b.getRangeTo(creep)).find(c => c.hits !== 0);

  const ranger = creep.findClosestByPath(myRangers.filter(c => c.hits !== 0));

  const healer = creep.findClosestByPath(myHealers.filter(c => c.hits !== 0));


  if (healTarget) {
    const range = creep.getRangeTo(healTarget);
    moveWithinRange(creep, healTarget, 3);

    if (range == 1) {
      creep.heal(healTarget);
    } else if (range <= 3) {
      creep.rangedHeal(healTarget);
      // creep.moveTo(healTarget);
    } else {
      // creep.moveTo(healTarget);
    }
  } else if (attacker) {
    // Follow attackers
    moveWithinRange(creep, attacker, 2);
    creep.rangedHeal(attacker);
  } else if (ranger) {
    // Follow attackers
    moveWithinRange(creep, ranger, 2);
    creep.rangedHeal(ranger);
  } else if (healer) {
    moveWithinRange(creep, healer, 2);
    creep.rangedHeal(healer);
  } else if (creep.hits < creep.hitsMax) {
    creep.heal(creep);
    return;
  }

  // // Stay away from enemies
  // const nearbyEnemies = enemyCreeps.filter(e => e.getRangeTo(creep) < 5);
  // const nearbyAllies = myCreeps.filter(a => a.getRangeTo(creep) < 5);
  // if (nearbyEnemies.length > nearbyAllies.length) {
  //   flee(creep, mySpawn, nearbyEnemies, 5);
  // }
}

function runRanger(creep: Creep): void {
  // Start grouping if far enemies are grouped
  const nearbyEnemyMelees = enemyMelees.filter(e => e.getRangeTo(creep) < 10);
  const nearbyEnemyRangers = enemyRangers.filter(e => e.getRangeTo(creep) < 10);
  const nearbyAllies = myCreeps.filter(a => a.getRangeTo(creep) < 4);
  const totalEnemyThreats = nearbyEnemyMelees.length + nearbyEnemyRangers.length;
  if (totalEnemyThreats > nearbyAllies.length) {
    flee(creep, mySpawn, nearbyEnemyMelees, 8);
    return;
  }

  // Wait for heal if no enemies nearby
  if (myHealers.length > 0 && totalEnemyThreats === 0 && creep.hits !== creep.hitsMax) {
    return;
  }

  const targets = enemyCreeps.sort((a, b) => a.getRangeTo(creep) - b.getRangeTo(creep));

  if (targets.length > 0 && targets[0] !== undefined) {
    const target = targets[0];
    const range = creep.getRangeTo(target);

    if (range <= 3) {
      creep.rangedAttack(target);
    }

    // moveWithinRange(creep, target, 3);
    // const fleePath = searchPath(creep, targets, DefaultFleeFindPathOptions);

    // Kite: maintain distance of 3
    if (range < 3) {
      // if (getRange(creep, target) > 3) {
      //   creep.moveTo(target, DefaultFleeFindPathOptions);
      // }
      // creep.moveTo(target, DefaultFleeFindPathOptions);
      flee(creep, mySpawn, targets, 3);
    } else if (range > 3) {
      moveWithinRange(creep, target, 3);
    }
  } else if (enemySpawn) {
    const range = creep.getRangeTo(enemySpawn);
    if (range <= 3) {
      creep.rangedAttack(enemySpawn);
    } else {
      moveWithinRange(creep, enemySpawn, 3);
    }
  }

  // const enemyCreepTarget = creep.findClosestByPath(enemyCreeps);

  // const nearestWall = creep.findClosestByPath(walls);

  // if (enemyCreepTarget !== null && enemyCreepTarget !== undefined && creep.getRangeTo(enemyCreepTarget) < 10) {
  //   moveWithinRange(creep, enemyCreepTarget, 3);
  //   if (creep.getRangeTo(enemyCreepTarget) < 4) creep.rangedAttack(enemyCreepTarget);
  // } else if (creep.getRangeTo(enemySpawn) < 5) {
  //   moveWithinRange(creep, enemySpawn, 3);
  //   if (creep.getRangeTo(enemySpawn) < 4) creep.rangedAttack(enemySpawn);
  // } else if (nearestWall) {
  //   moveWithinRange(creep, nearestWall, 3);
  //   if (creep.getRangeTo(nearestWall) < 4) creep.rangedAttack(nearestWall);
  // } else if (creep.initialPos) {
  //   // Return to initial position if no targets
  //   moveWithinRange(creep, creep.initialPos, 3);
  // } else {
  //   moveWithinRange(creep, enemySpawn, 3);
  //   if (creep.getRangeTo(enemySpawn) < 4) creep.rangedAttack(enemySpawn);
  // }
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
  enemyMelees = getMelees(enemyCreeps);
  enemyRangers = getRangers(enemyCreeps);
  myCreeps = getMyCreeps();
  myHaulers = getHaulers(myCreeps);
  myBuilders = getBuilders(myCreeps);
  myMelees = getMelees(myCreeps);
  myHealers = getHealers(myCreeps);
  myRangers = getRangers(myCreeps);
  myExtensionsToFill = getMyExtensionsToFill();
  constructionSites = getConstructionSites();
  myConstructionSites = getMyConstructionSites(constructionSites);
  containers = getContainers();
  walls = getObjectsByPrototype(StructureWall);
  ramparts = getObjectsByPrototype(StructureRampart);
  myRamparts = ramparts.filter(r => r.my);
  mySpawnContainers = getContainersNearSpawn(containers, mySpawn);
  swampContainers = getContainersInSwamp(containers);

  // Consider only update containers if we have Haulers or Builders
}

function handleSpawning(): void {
  if (!mySpawn.spawning) {
    if (myHaulers.length < 1) {
      const result = mySpawn.spawnCreep([CARRY, CARRY, MOVE, MOVE]);
      if (result.object) {
        console.log(`Spawning Hauler: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Hauler ${result.error}`);
      }
    } else if (myMelees.length < 4) {
      const result = mySpawn.spawnCreep([ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
    else if (myHaulers.length < 2) {
      const result = mySpawn.spawnCreep([CARRY, CARRY, MOVE, MOVE]);
      if (result.object) {
        console.log(`Spawning Hauler: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Hauler ${result.error}`);
      }
    } else if (myRangers.length < 2) {
      const result = mySpawn.spawnCreep([RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]);
      if (result.object) {
        console.log(`Spawning ranger: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn ranger ${result.error}`);
      }
    } else if (myHealers.length < 3) {
      const result = mySpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL]);
      if (result.object) {
        console.log(`Spawning Healer: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        // console.log(`Failed to spawn Healer ${result.error}`);
      }
    }
    else if (myBuilders.length < 4) {
      const result = mySpawn.spawnCreep([WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE]);
      if (result.object) {
        console.log(`Spawning Builder: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        console.log(`Failed to spawn Builder ${result.error}`);
      }
    } else if (myHaulers.length < 6) {
      const result = mySpawn.spawnCreep([CARRY, CARRY, MOVE, MOVE]);
      if (result.object) {
        console.log(`Spawning Hauler: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        console.log(`Failed to spawn Hauler ${result.error}`);
      }
    } else if (myMelees.length < 5) {
      const result = mySpawn.spawnCreep([ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        console.log(`Failed to spawn Melee ${result.error}`);
      }
    } else if (myRangers.length < 10) {
      const result = mySpawn.spawnCreep([RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]);
      if (result.object) {
        console.log(`Spawning ranger: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        console.log(`Failed to spawn ranger ${result.error}`);
      }
    }
    else if (myMelees.length < 40) {
      const result = mySpawn.spawnCreep([ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
  }
}
