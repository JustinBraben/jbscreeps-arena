import { getObjectsByPrototype, getObjectById, getObjects, findPath, getCpuTime } from 'game/utils';
import { ATTACK, MOVE, CARRY, RANGED_ATTACK, HEAL, TOUGH, WORK } from 'game/constants';
import { StructureSpawn, StructureContainer, Creep, StructureWall, Id, Position, Source } from 'game/prototypes';
import { Visual } from 'game/visual';
import { CreepManager } from './creepManager';
import { debugContainerPathsToSpawn, debugExtensionPlaceholders, debugTileCost } from 'common/visual/debugVisual';
import { DefaultFindPathOptions } from "common/constants";

let creepManager = new CreepManager();

// Track build order
let buildQueue: Array<string> = [];

let gameVisual = new Visual(2, true);

export function loop(): void {
  // remove all visuals from gameVisual
  gameVisual.clear();

  // Clean up dead creeps from our tracking
  // Filters to only creeps that have health
  creepManager.cleanupDeadCreeps();

  // Initialize build queue if empty
  if (buildQueue.length === 0) {
    resetBuildQueue();
  }

  // Spawn logic - follow the build order
  if (creepManager.personalSpawn !== undefined &&
      creepManager.personalSpawn.store.energy >= 200 &&
      buildQueue.length > 0) {
    // console.log(`Current buildQueue: ${buildQueue}`);

    const nextRole = buildQueue[0];
    if (creepManager.spawnCreepByRole(nextRole)) {
      buildQueue.shift(); // Remove from queue if successfully spawned
    }
  }

  // Run creep logic
  creepManager.updateCreeps();

  // Get our spawn
  const mySpawn = getObjectsByPrototype(StructureSpawn).find(i => i.my);
  // Get all containers
  const containers = getObjectsByPrototype(StructureContainer);

  // // DEBUG INFO
  // debugContainerPathsToSpawn(gameVisual, containers, mySpawn);
  // debugExtensionPlaceholders(gameVisual, containers, mySpawn);
  // debugTileCost(gameVisual, { x: 0, y: 0 }, { x: 40, y: 40 });
  // console.log(`CPU nanoseconds current tick: ${getCpuTime()}`);
}

function resetBuildQueue(): void {
  // Reset to our standard build order
  // buildQueue = ['miner', 'miner', 'miner', 'melee', 'healer', 'ranged'];
  // buildQueue = ['miner', 'miner', 'wallbreaker', 'wallbreaker', 'melee', 'healer', 'ranged']
  // buildQueue.push('miner', 'ranged', 'healer', 'ranged', 'ranged', 'wallbreaker', 'healer', 'ranged');
  // buildQueue.push('miner', 'miner', 'wallbreaker', 'ranged', 'ranged', 'healer', 'melee', 'melee');
  buildQueue.push('miner', 'miner', 'wallbreaker', 'melee', 'melee', 'melee', 'healer', 'ranged');
}
