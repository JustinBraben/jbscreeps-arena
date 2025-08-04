import { getObjectsByPrototype, getObjectById, getObjects } from 'game/utils';
import { ATTACK, MOVE, CARRY, RANGED_ATTACK, HEAL, TOUGH, WORK } from 'game/constants';
import { StructureSpawn, StructureContainer, Creep, StructureWall, Id, Position } from 'game/prototypes';
import { Visual } from 'game/visual';
import { CreepManager } from './creepManager';

let creepManager = new CreepManager();

// Track build order
let buildQueue: Array<string> = [];

export function loop(): void {
  // Get our spawn
  const mySpawn = getObjectsByPrototype(StructureSpawn).find(i => i.my);
  const enemySpawn = getObjectsByPrototype(StructureSpawn).find(i => !i.my);

  // Find all enemy creeps
  const enemies = getObjectsByPrototype(Creep).filter(c => !c.my);

  // Get all containers
  const containers = getObjectsByPrototype(StructureContainer);
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
  runMiners(containers, mySpawn);
  runWallBreakers(walls, mySpawn);
  runMelees(enemies, enemySpawn);
  runHealers();
  runRanged(enemySpawn);
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

function runMiners(containers: StructureContainer[], spawn: StructureSpawn | undefined): void {
  if (spawn === undefined) {
    return;
  }

  creepManager.miners.forEach((miner, index) => {
    // Skip if miner is invalid
    if (miner === null || miner.store === null || miner.store === undefined || miner.spawning) {
      return;
    }

    // if (!miner.pathVisual) {
    //   miner.pathVisual = new Visual(10, true);
    // }

    // Assign miners to different containers to spread out
    const targetContainer = containers[index % containers.length];

    const minerFreeCapacity = miner.store.getFreeCapacity();

    if (minerFreeCapacity !== null && minerFreeCapacity > 0 && targetContainer) {
      // Find the closest container with energy
      const targetContainer = miner.findClosestByPath(containers.filter(c => c.store.energy > 0));

      if (targetContainer) {
        const minerRange = miner.getRangeTo(targetContainer);
        if (minerRange > 1) {
          // Go to closest container and withdraw energy
          miner.moveTo(targetContainer);

          // DEBUG PATH
          let path: Position[] = miner.findPathTo(targetContainer);
          debugPath(miner, path);
        }

        miner.withdraw(targetContainer, 'energy');
      }
    } else {
      const minerRange = miner.getRangeTo(spawn);
      if (minerRange > 1) {
        // Return to spawn and transfer energy
        miner.moveTo(spawn);

        // DEBUG PATH
        let path: Position[] = miner.findPathTo(spawn);
        debugPath(miner, path);
      }

      miner.transfer(spawn, 'energy');
    }
  });
}

function runWallBreakers(walls: StructureWall[], spawn: StructureSpawn| undefined): void {
  if (spawn === undefined) {
    return;
  }

  creepManager.wallbreakers.forEach((wallbreaker, index) => {
    // Skip if wallbreaker is invalid
    if (!wallbreaker || wallbreaker.spawning) {
      return;
    }

    // if (!wallbreaker.pathVisual) {
    //   wallbreaker.pathVisual = new Visual(10, true);
    // }

    // Find nearby enemies
    const nearbyEnemies = getObjectsByPrototype(Creep).filter(c =>
      !c.my && wallbreaker.getRangeTo(c) <= 5
    );

    // First priority will be fight nearby enemy
    if (nearbyEnemies.length > 0) {
      const targetEnemy = wallbreaker.findClosestByRange(nearbyEnemies);

      if (targetEnemy === null) {
        return;
      }

      const wallbreakerRange = wallbreaker.getRangeTo(targetEnemy);
      if (wallbreakerRange > 1) {
        // Go to closest container and withdraw energy
        wallbreaker.moveTo(targetEnemy);

        // DEBUG PATH
        const path = wallbreaker.findPathTo(targetEnemy);
        debugPath(wallbreaker, path);
      }
      wallbreaker.attack(targetEnemy);
    } else {
      // Next priority will be break wall

      // Assign wallbreaker to closest wall
      const targetWall = wallbreaker.findClosestByRange(walls);

      if (targetWall === null) {
        return;
      }

      const wallbreakerRange = wallbreaker.getRangeTo(targetWall);

      if (wallbreakerRange > 1) {
        wallbreaker.moveTo(targetWall);

        // DEBUG PATH
        const path = wallbreaker.findPathTo(targetWall);
        debugPath(wallbreaker, path);
      }
      wallbreaker.attack(targetWall);
      wallbreaker.rangedAttack(targetWall);
    }
  });
}

function runMelees(enemies: Creep[], enemySpawn: StructureSpawn | undefined) {
  if (enemySpawn === undefined) {
    return;
  }

  creepManager.melees.forEach((melee) => {
    if (enemies.length > 0) {
      // Fight nearest enemy
      const target = melee.findClosestByRange(enemies);

      if (target === null) {
        return;
      }

      if (melee.getRangeTo(target) > 1) {
        melee.moveTo(target);
      }
      melee.attack(target);
    } else {
      // No enemies, attack enemy base
      if (melee.getRangeTo(enemySpawn) > 1) {
        melee.moveTo(enemySpawn);
      }
      melee.attack(enemySpawn);
    }
  });
}

function runHealers(): void {
  creepManager.healers.forEach((healer) => {

    // Skip if ranged is invalid
    if (healer === null || healer.spawning) {
      return;
    }

    // Find wounded allies, prioritizing melee fighters
    const woundedMelees = creepManager.melees.filter(m => m.hits < m.hitsMax);
    const woundedRanged = creepManager.ranged.filter(r => r.hits < r.hitsMax);
    const allWounded = getObjectsByPrototype(Creep).filter(c =>
      c.my && c.hits < c.hitsMax
    );

    let healTarget = null;

    // Priority 1: Heal wounded melee fighters
    if (woundedMelees.length > 0) {
      healTarget = healer.findClosestByRange(woundedMelees);
    }
    // Priority 2: Heal wounded ranged fighters
    else if (woundedRanged.length > 0) {
      healTarget = healer.findClosestByRange(woundedRanged);
    }
    // Priority 3: Heal any wounded ally
    else if (allWounded.length > 0) {
      healTarget = healer.findClosestByRange(allWounded);
    }

    if (healTarget) {
      // Move to and heal the target
      if (healer.getRangeTo(healTarget) > 1) {
        healer.moveTo(healTarget);
      }
      healer.heal(healTarget);
      healer.rangedHeal(healTarget);
    } else {
      // No one to heal, follow closest melee or any ally
      const meleeToFollow = healer.findClosestByRange(creepManager.melees);
      const rangedToFollow = healer.findClosestByRange(creepManager.ranged);
      // const anyAlly = healer.findClosestByRange(
      //   getObjectsByPrototype(Creep).filter(c => c.my && c !== healer)
      // );
      const followTarget = meleeToFollow || rangedToFollow;

      if (followTarget && healer.getRangeTo(followTarget) > 2) {
        healer.moveTo(followTarget);
      }
    }
  });
}

function runRanged(enemySpawn: StructureSpawn | undefined) {
  if (enemySpawn === undefined) {
    return;
  }

  creepManager.ranged.forEach((ranged) => {
    // Skip if ranged is invalid
    if (!ranged || ranged.spawning) {
      return;
    }

    // Find all enemy creeps
    const enemies = getObjectsByPrototype(Creep).filter(c => !c.my);

    if (enemies.length > 0) {
      // Fight nearest enemy
      const target = ranged.findClosestByRange(enemies);

      if (target === null) return;

      // Try to maintain optimal range (3 tiles)
      const range = ranged.getRangeTo(target);
      if (range > 3) {
        ranged.moveTo(target);
      } else if (range < 3) {
        // Move away to maintain distance
        const flee = {
          x: ranged.x + (ranged.x - target.x),
          y: ranged.y + (ranged.y - target.y)
        };
        ranged.moveTo(flee);
      }

      ranged.rangedAttack(target);
    } else if (enemySpawn) {
      // No enemies, attack enemy base
      const range = ranged.getRangeTo(enemySpawn);
      if (range > 3) {
        ranged.moveTo(enemySpawn);
      }
      ranged.rangedAttack(enemySpawn);
    }
  });
}

function debugPath(creep: Creep, path: Position[]): void {
  // creep.pathVisual.clear().poly(
  //   path,
  //   {
  //     lineStyle: 'dashed',
  //     stroke: '#0358ebff',
  //   }
  // );
}
