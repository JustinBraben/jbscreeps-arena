import { getObjectsByPrototype, getObjectById, getObjects } from 'game/utils';
import { ATTACK, MOVE, CARRY, RANGED_ATTACK, HEAL, TOUGH, WORK } from 'game/constants';
import { StructureSpawn, StructureContainer, Creep, StructureWall, Id, Position } from 'game/prototypes';
import { JBCreep } from 'common/lib/jbCreep';
import { Role } from 'common/enums/role';
import { DefaultFindPathOptions, DefaultFleeFindPathOptions } from 'common/constants';

/**
 * Tracks and records Creeps
 */
export class CreepManager {
  personalSpawn: StructureSpawn | undefined;
  enemySpawn: StructureSpawn | undefined;
  mainBaseContainers: Array<StructureContainer> | undefined;
  nextMinerContainer: number = 0;
  miners: Array<Creep>;
  wallbreakers: Array<Creep>;
  melees: Array<Creep>;
  healers: Array<Creep>;
  ranged: Array<Creep>;
  private jbCreeps: Map<string, JBCreep> = new Map<string, JBCreep>();

  constructor() {
    this.personalSpawn = undefined;
    this.enemySpawn = undefined;
    this.mainBaseContainers = undefined;
    this.nextMinerContainer = 0;
    this.miners = new Array<Creep>();
    this.wallbreakers = new Array<Creep>();
    this.melees = new Array<Creep>();
    this.healers = new Array<Creep>();
    this.ranged = new Array<Creep>();
    this.jbCreeps = new Map<string, JBCreep>();
  }

  public cleanupDeadCreeps(): void {
    // Filter out undefined, null, and dead creeps
    this.miners = this.miners.filter(c => c && c.hits > 0);
    this.wallbreakers = this.wallbreakers.filter(c => c && c.hits > 0);
    this.melees = this.melees.filter(c => c && c.hits > 0);
    this.healers = this.healers.filter(c => c && c.hits > 0);
    this.ranged = this.ranged.filter(c => c && c.hits > 0);
  }

  public updateCreeps(): void {
    // Get our spawn
    if (this.personalSpawn === undefined) {
      const mySpawn = getObjectsByPrototype(StructureSpawn).find(i => i.my);
      if (mySpawn !== undefined){
        this.personalSpawn = mySpawn;
      }
    }

    // Get enemy spawn
    if (this.enemySpawn === undefined) {
      const enemySpawn = getObjectsByPrototype(StructureSpawn).find(i => !i.my);
      if (enemySpawn !== undefined){
        this.enemySpawn = enemySpawn;
      }
    }

    // Get main base containers to harvest from
    if (this.mainBaseContainers === undefined && this.personalSpawn !== undefined) {
      let mainBaseContainers: Array<StructureContainer> | undefined = undefined;

      if (this.personalSpawn.x === 5) {
        mainBaseContainers = getObjectsByPrototype(StructureContainer).filter(c => c.x < 13);
      }

      if (this.personalSpawn.x === 94) {
        mainBaseContainers = getObjectsByPrototype(StructureContainer).filter(c => c.x > 86);
      }

      if (mainBaseContainers !== undefined){
        this.mainBaseContainers = mainBaseContainers;
      }
    }

    // Find all enemy creeps
    const enemies = getObjectsByPrototype(Creep).filter(c => !c.my);

    // Get all containers
    const containers = getObjectsByPrototype(StructureContainer);
    // console.log(`containers.length: #${containers.length}`);
    const walls = getObjectsByPrototype(StructureWall).filter(c =>
        c.id == "6"  ||
        c.id == "11" ||
        c.id == "21" ||
        c.id == "26"
    );

    // for (const wall of walls) {
    //   console.log(`Constructed wall id #${wall.id}`);
    // }

    this.runMiners(containers, this.personalSpawn);
    this.runWallBreakers(walls, this.personalSpawn);
    this.runMelees(enemies, this.enemySpawn);
    this.runHealers();
    this.runRanged(this.enemySpawn);

    // // TODO: fix
    // this.runAll(containers);
  }

  public spawnCreepByRole(role: string): boolean {
    let newCreep = null;
    let creepCreated = false;

    if (this.personalSpawn === undefined) {
      return false;
    }

    switch (role) {
      case 'miner':
        newCreep = this.personalSpawn.spawnCreep([MOVE, MOVE, CARRY, CARRY]).object;
        if (newCreep) {
          this.miners.push(newCreep);
          this.initializeCreep(newCreep, Role.HAULER);
          console.log(`Spawned miner #${this.miners.length}`);
          creepCreated = true;
        }
        break;

      case 'wallbreaker':
        newCreep = this.personalSpawn.spawnCreep([MOVE, ATTACK, ATTACK, ATTACK]).object;
        if (newCreep) {
          this.wallbreakers.push(newCreep);
          this.initializeCreep(newCreep, Role.MELEE);
          console.log(`Spawned wallbreaker #${this.wallbreakers.length}`);
          creepCreated = true;
        }
        break;

      case 'melee':
        newCreep = this.personalSpawn.spawnCreep([TOUGH, TOUGH, MOVE, ATTACK, MOVE, ATTACK, MOVE, ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE]).object;
        if (newCreep) {
          this.melees.push(newCreep);
          this.initializeCreep(newCreep, Role.MELEE);
          console.log(`Spawned melee #${this.melees.length}`);
          creepCreated = true;
        }
        break;

      case 'healer':
        newCreep = this.personalSpawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, HEAL]).object;
        if (newCreep) {
          this.healers.push(newCreep);
          this.initializeCreep(newCreep, Role.HEALER);
          console.log(`Spawned healer #${this.healers.length}`);
          creepCreated = true;
        }
        break;

      case 'ranged':
        newCreep = this.personalSpawn.spawnCreep([MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK]).object;
        if (newCreep) {
          this.ranged.push(newCreep);
          this.initializeCreep(newCreep, Role.RANGED);
          console.log(`Spawned ranged #${this.ranged.length}`);
          creepCreated = true;
        }
        break;
    }

    return creepCreated;
  }

  public runMiners(containers: StructureContainer[], spawn: StructureSpawn | undefined): void {
    if (spawn === undefined) {
      return;
    }

    this.miners.forEach((miner, index) => {
      // Skip if miner is invalid
      if (miner === null || miner.store === null || miner.store === undefined || miner.spawning) {
        return;
      }

      // console.log(`Miner index #${index}`);

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

            // // DEBUG PATH
            // let path: Position[] = miner.findPathTo(targetContainer);
            // debugPath(miner, path);
          }

          miner.withdraw(targetContainer, 'energy');
        }
      } else {
        const minerRange = miner.getRangeTo(spawn);
        if (minerRange > 1) {
          // Return to spawn and transfer energy
          miner.moveTo(spawn);

          // // DEBUG PATH
          // let path: Position[] = miner.findPathTo(spawn);
          // debugPath(miner, path);
        }

        miner.transfer(spawn, 'energy');
      }
    });
  }

  public runWallBreakers(walls: StructureWall[], spawn: StructureSpawn| undefined): void {
    if (spawn === undefined) {
      return;
    }

    this.wallbreakers.forEach((wallbreaker, index) => {
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
          wallbreaker.moveTo(targetEnemy, DefaultFindPathOptions);

          // // DEBUG PATH
          // const path = wallbreaker.findPathTo(targetEnemy);
          // debugPath(wallbreaker, path);
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
          wallbreaker.moveTo(targetWall, DefaultFindPathOptions);

          // // DEBUG PATH
          // const path = wallbreaker.findPathTo(targetWall);
          // debugPath(wallbreaker, path);
        }
        wallbreaker.attack(targetWall);
        wallbreaker.rangedAttack(targetWall);
      }
    });
  }

  public runMelees(enemies: Creep[], enemySpawn: StructureSpawn | undefined) {
    if (enemySpawn === undefined) {
      return;
    }

    this.melees.forEach((melee) => {
      if (enemies.length > 0) {
        // Fight nearest enemy
        const target = melee.findClosestByRange(enemies);

        if (target === null) {
          return;
        }

        if (melee.getRangeTo(target) > 1) {
          melee.moveTo(target, DefaultFindPathOptions);
        }

        melee.attack(target);

        if (melee.getRangeTo(target) > 1) {
          melee.moveTo(target, DefaultFindPathOptions);
        }
      } else {
        // No enemies, attack enemy base
        if (melee.getRangeTo(enemySpawn) > 1) {
          melee.moveTo(enemySpawn, DefaultFindPathOptions);
        }

        melee.attack(enemySpawn);

        if (melee.getRangeTo(enemySpawn) > 1) {
          melee.moveTo(enemySpawn, DefaultFindPathOptions);
        }
      }
    });
  }

  public runHealers(): void {
    this.healers.forEach((healer) => {

      // Skip if ranged is invalid
      if (healer === null || healer.spawning) {
        return;
      }

      // Find wounded allies, prioritizing melee fighters
      const woundedMelees = this.melees.filter(m => m.hits < m.hitsMax);
      const woundedRanged = this.ranged.filter(r => r.hits < r.hitsMax);
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
        const meleeToFollow = healer.findClosestByRange(this.melees);
        const rangedToFollow = healer.findClosestByRange(this.ranged);
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

  public runRanged(enemySpawn: StructureSpawn | undefined) {
    if (enemySpawn === undefined) {
      return;
    }

    this.ranged.forEach((ranged) => {
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
          ranged.moveTo(target, DefaultFindPathOptions);
        } else if (range < 3) {
          // Move away to maintain distance
          const flee = {
            x: ranged.x + (ranged.x - target.x),
            y: ranged.y + (ranged.y - target.y)
          };
          ranged.moveTo(flee, DefaultFindPathOptions);
        }

        ranged.rangedAttack(target);

        if (range > 3) {
          ranged.moveTo(target, DefaultFindPathOptions);
        } else if (range < 3) {
          // Move away to maintain distance
          const flee = {
            x: ranged.x + (ranged.x - target.x),
            y: ranged.y + (ranged.y - target.y)
          };
          ranged.moveTo(flee, DefaultFindPathOptions);
        }
      } else if (enemySpawn) {
        // No enemies, attack enemy base
        const range = ranged.getRangeTo(enemySpawn);
        ranged.rangedAttack(enemySpawn);
        if (range > 3) {
          ranged.moveTo(enemySpawn, DefaultFindPathOptions);
        }
      }
    });
  }

  initializeCreep(creep: Creep, role: Role, initialPos?: Position, targetPos?: Position): JBCreep {
    const jbCreep = new JBCreep(creep, role, initialPos, targetPos);
    this.jbCreeps.set(creep.id, jbCreep);
    return jbCreep;
  }

  getJBCreep(creep: Creep): JBCreep | undefined {
    return this.jbCreeps.get(creep.id);
  }

  getAllJBCreeps(): JBCreep[] {
    return Array.from(this.jbCreeps.values());
  }

  runAll(containers: StructureContainer[]): void {
    for (let jbCreep of this.jbCreeps.values()) {
      jbCreep.performRole(containers, this.personalSpawn);
    }
  }

  public debugPath(creep: Creep, path: Position[]): void {
    // creep.pathVisual.clear().poly(
    //   path,
    //   {
    //     lineStyle: 'dashed',
    //     stroke: '#0358ebff',
    //   }
    // );
  }
}
