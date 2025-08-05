import { getObjectsByPrototype, getObjectById, getObjects, findPath } from 'game/utils';
import { ATTACK, MOVE, CARRY, RANGED_ATTACK, HEAL, TOUGH, WORK } from 'game/constants';
import { StructureSpawn, StructureContainer, Creep, StructureWall, Id, Position, Source } from 'game/prototypes';
import { Visual } from 'game/visual';
import { CreepManager } from './creepManager';

let creepManager = new CreepManager();

// Track build order
let buildQueue: Array<string> = [];

// let pathVisualSet: Set<Visual> = new Set<Visual>();
let gameVisual = new Visual(2, true);

export function loop(): void {
  // remove all visuals from gameVisual
  gameVisual.clear();

  // Get our spawn
  const mySpawn = getObjectsByPrototype(StructureSpawn).find(i => i.my);
  const enemySpawn = getObjectsByPrototype(StructureSpawn).find(i => !i.my);

  // Find all enemy creeps
  const enemies = getObjectsByPrototype(Creep).filter(c => !c.my);

  // Get all containers
  let containers = getObjectsByPrototype(StructureContainer);
  // console.log(`containers.length: #${containers.length}`);
  let sources = getObjectsByPrototype(Source);
  // console.log(`sources.length: #${sources.length}`);
  const walls = getObjectsByPrototype(StructureWall).filter(c =>
      c.id == "6"  ||
      c.id == "11" ||
      c.id == "21" ||
      c.id == "26"
  );

  // for (const wall of walls) {
  //   console.log(`Constructed wall id #${wall.id}`);
  // }

  if (creepManager.personalSpawn === undefined && mySpawn !== undefined) {
    creepManager.personalSpawn = mySpawn;
  }

  // Clean up dead creeps from our tracking
  // Filters to only creeps that have health
  creepManager.cleanupDeadCreeps();

  // Initialize build queue if empty
  if (buildQueue.length === 0) {
    resetBuildQueue();
  }

  // Spawn logic - follow the build order
  if (mySpawn !== undefined && mySpawn.store.energy >= 200 && buildQueue.length > 0) {
    // console.log(`Current buildQueue: ${buildQueue}`);

    const nextRole = buildQueue[0];
    if (spawnCreepByRole(mySpawn, nextRole)) {
      buildQueue.shift(); // Remove from queue if successfully spawned
    }
  }

  // Run creep logic
  creepManager.updateCreeps(containers, mySpawn, enemySpawn, walls, enemies);

  debugContainerPathsToSpawn(containers, mySpawn);
}

function resetBuildQueue(): void {
  // Reset to our standard build order
  // buildQueue = ['miner', 'miner', 'miner', 'melee', 'healer', 'ranged'];
  // buildQueue = ['miner', 'miner', 'wallbreaker', 'wallbreaker', 'melee', 'healer', 'ranged']
  // buildQueue.push('miner', 'ranged', 'healer', 'ranged', 'ranged', 'wallbreaker', 'healer', 'ranged');
  buildQueue.push('miner', 'miner', 'wallbreaker', 'melee', 'melee', 'melee', 'healer', 'ranged');
}

function spawnCreepByRole(spawn: StructureSpawn, role: string): boolean {
  let newCreep = null;
  let creepCreated = false;

  switch (role) {
    case 'miner':
      newCreep = spawn.spawnCreep([MOVE, MOVE, MOVE, CARRY, CARRY]).object;
      if (newCreep) {
        creepManager.miners.push(newCreep);
        console.log(`Spawned miner #${creepManager.miners.length}`);
        creepCreated = true;
      }
      break;

    case 'wallbreaker':
      newCreep = spawn.spawnCreep([MOVE, ATTACK, ATTACK, ATTACK]).object;
      if (newCreep) {
        creepManager.wallbreakers.push(newCreep);
        console.log(`Spawned wallbreaker #${creepManager.wallbreakers.length}`);
        creepCreated = true;
      }
      break;

    case 'melee':
      newCreep = spawn.spawnCreep([TOUGH, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK]).object;
      if (newCreep) {
        creepManager.melees.push(newCreep);
        console.log(`Spawned melee #${creepManager.melees.length}`);
        creepCreated = true;
      }
      break;

    case 'healer':
      newCreep = spawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, HEAL]).object;
      if (newCreep) {
        creepManager.healers.push(newCreep);
        console.log(`Spawned healer #${creepManager.healers.length}`);
        creepCreated = true;
      }
      break;

    case 'ranged':
      newCreep = spawn.spawnCreep([MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK]).object;
      if (newCreep) {
        creepManager.ranged.push(newCreep);
        console.log(`Spawned ranged #${creepManager.ranged.length}`);
        creepCreated = true;
      }
      break;
  }

  return creepCreated;
}

function debugContainerPathsToSpawn(
  containers: StructureContainer[],
  mySpawn: StructureSpawn | undefined
): void {
  for (const container of containers) {
    if (mySpawn === undefined) return;

    const path = findPath(mySpawn, container);

    gameVisual.poly(
      path,
      {
        lineStyle: 'dashed',
        stroke: '#0358ebff',
      }
    );
  }
}
