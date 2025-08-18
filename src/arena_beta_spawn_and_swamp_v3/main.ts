import { ATTACK, CARRY, MOVE, OK, RESOURCE_ENERGY, TOUGH, WORK } from "game/constants";
import { Creep, Position, StructureContainer, StructureExtension, StructureSpawn, StructureWall, _Constructor, _ConstructorById } from "game/prototypes";
import { getObjectsByPrototype } from "game/utils";
import { getBuilders, getEnemyCreeps, getHaulers, getMelees, getMyCreeps } from 'common/filterCreeps';
import { getMyExtensionsToFill } from "common/filterExtensions";
import { getContainers, getContainersNearSpawn } from "common/filterContainers";
import { moveWithinRange } from "common/creepMovementUtils";

// Global variables for game state
let mySpawn: StructureSpawn;
let myCreeps: Creep[];
let myHaulers: Creep[];
let myBuilders: Creep[];
let myMelees: Creep[];
let containers: StructureContainer[];
let walls: StructureWall[];
let mySpawnContainers: StructureContainer[];
let myExtensionsToFill: StructureExtension[];
let enemySpawn: StructureSpawn;
let enemyCreeps: Creep[];

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

  if (myExtensionsToFill.length > 0) {}
}

function runHauler(hauler: Creep): void {
  // console.log(`hauler: ${hauler.id} (Health: ${hauler.hits}/${hauler.hitsMax})`);
  if (hauler.store.energy === 0) {
    // Consider fallback containers
    let targetContainer = hauler.findClosestByPath(mySpawnContainers);
    if (targetContainer === null) targetContainer = hauler.findClosestByPath(containers);
    if (targetContainer === null) return;

    if (hauler.getRangeTo(targetContainer) > 1) {
      moveWithinRange(hauler, targetContainer, 1);
      if (hauler.getRangeTo(targetContainer) == 1) {
        const withdrawResult = hauler.withdraw(targetContainer, RESOURCE_ENERGY);
        console.log(`hauler: ${hauler.id} Moved to container: ${targetContainer.id}, CreepWithdrawResult: ${withdrawResult}`);
      }
    } else if (hauler.getRangeTo(targetContainer) == 1) {
      const withdrawResult = hauler.withdraw(targetContainer, RESOURCE_ENERGY);
      if (withdrawResult === OK) {
        console.log(`hauler: ${hauler.id} CreepWithdrawResult: ${withdrawResult}, then moved to mySpawn`);
        moveWithinRange(hauler, mySpawn, 1);
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
  // Try fill up empty extensions

  // Try and build unfinished construction sites

  // Otherwise just hauling
  runHauler(creep);
}

function runMelee(creep: Creep): void {
  const enemyCreepTarget = creep.findClosestByPath(enemyCreeps);

  const nearestWall = creep.findClosestByPath(walls);

  if (enemyCreepTarget !== null && enemyCreepTarget !== undefined && creep.getRangeTo(enemyCreepTarget) < 10) {
    moveWithinRange(creep, enemyCreepTarget, 1);
    if (creep.getRangeTo(enemyCreepTarget) < 2) creep.attack(enemyCreepTarget);
  } else if (creep.getRangeTo(enemySpawn) < 5) {
    moveWithinRange(creep, enemySpawn, 1);
    if (creep.getRangeTo(enemySpawn) < 2) creep.attack(enemySpawn);
  } else if (nearestWall) {
    moveWithinRange(creep, nearestWall, 1);
    if (creep.getRangeTo(nearestWall) < 2) creep.attack(nearestWall);
  } else if (creep.initialPos) {
    // Return to initial position if no targets
    moveWithinRange(creep, creep.initialPos, 3);
  } else {
    moveWithinRange(creep, enemySpawn, 1);
    if (creep.getRangeTo(enemySpawn) < 2) creep.attack(enemySpawn);
  }
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
  myCreeps = getMyCreeps();
  myHaulers = getHaulers(myCreeps);
  myBuilders = getBuilders(myCreeps);
  myMelees = getMelees(myCreeps);
  myExtensionsToFill = getMyExtensionsToFill();
  containers = getContainers();
  walls = getObjectsByPrototype(StructureWall);
  mySpawnContainers = getContainersNearSpawn(containers, mySpawn);

  // Consider only update containers if we have Haulers or Builders
}

function handleSpawning(): void {
  if (!mySpawn.spawning) {
    if (myHaulers.length < 2) {
      const result = mySpawn.spawnCreep([CARRY, CARRY, MOVE, MOVE]);
      if (result.object) {
        console.log(`Spawning Hauler: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        console.log(`Failed to spawn Hauler ${result.error}`);
      }
    } else if (myBuilders.length < 2) {
      const result = mySpawn.spawnCreep([WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE]);
      if (result.object) {
        console.log(`Spawning Builder: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        console.log(`Failed to spawn Builder ${result.error}`);
      }
    } else if (myMelees.length < 40) {
      const result = mySpawn.spawnCreep([
        TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
        ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
        MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
      ]);
      if (result.object) {
        console.log(`Spawning Melee: ${result.object.id} (Health: ${result.object.hits}/${result.object.hitsMax})`);
      } else if(result.error) {
        console.log(`Failed to spawn Melee ${result.error}`);
      }
    }
  }
}
