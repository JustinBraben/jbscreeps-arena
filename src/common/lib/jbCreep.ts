// common/lib/jbCreep.ts
import { Creep, Position, Structure, Source, StructureContainer, StructureSpawn } from 'game/prototypes';
import { Role } from 'common/enums/role';
import { DirectionConstant, ResourceConstant, CreepMoveResult, ERR_INVALID_ARGS } from 'game/constants'
import { FindPathOptions } from 'game/path-finder';
import { ScoreCollector } from "arena/season_beta/collect_and_control/basic/prototypes";

export class JBCreep {
  public readonly creep: Creep;
  public role: Role;
  public initialPosition: Position;
  public targetPosition: Position | undefined;

  constructor(creep: Creep, role: Role, initialPosition?: Position, targetPosition?: Position) {
    this.creep = creep;
    this.role = role;
    this.initialPosition = initialPosition || creep;
    this.targetPosition = targetPosition;
  }

  // Proxy common Creep methods for convenience
  get hits() { return this.creep.hits; }
  get hitsMax() { return this.creep.hitsMax; }
  get my() { return this.creep.my; }
  get fatigue() { return this.creep.fatigue; }
  get body() { return this.creep.body; }
  get store() { return this.creep.store; }
  get x() { return this.creep.x; }
  get y() { return this.creep.y; }
  get id() { return this.creep.id; }

  move(direction: DirectionConstant) {
    return this.creep.move(direction);
  }

  moveTo(target: Position, options?: FindPathOptions) {
    return this.creep.moveTo(target, options);
  }

  attack(target: Creep | Structure) {
    return this.creep.attack(target);
  }

  rangedAttack(target: Creep | Structure) {
    return this.creep.rangedAttack(target);
  }

  heal(target: Creep) {
    return this.creep.heal(target);
  }

  harvest(target: Source) {
    return this.creep.harvest(target);
  }

  transfer(target: Creep | Structure | ScoreCollector, resourceType: ResourceConstant, amount?: number) {
    return this.creep.transfer(target, resourceType, amount);
  }

  // Add custom methods specific to your bot
  moveToTarget(): CreepMoveResult {
    if (this.targetPosition) {
      return this.creep.moveTo(this.targetPosition);
    }
    return ERR_INVALID_ARGS;
  }

  returnToInitial(): CreepMoveResult {
    return this.creep.moveTo(this.initialPosition);
  }

  isAtTarget(): boolean {
    if (!this.targetPosition) return false;
    return this.creep.x === this.targetPosition.x &&
           this.creep.y === this.targetPosition.y;
  }

  // Role-specific behavior
  performRole(
    containers: StructureContainer[],
    spawn: StructureSpawn | undefined
  ): void {
    switch (this.role) {
      case Role.HAULER:
        this.performMinerRole(containers, spawn);
        break;
      // case RoleSpawnAndSwamp.Wallbreaker:
      //   this.performWallbreakerRole();
      //   break;
      case Role.MELEE:
        this.performMeleeRole();
        break;
      case Role.HEALER:
        this.performHealerRole();
        break;
      case Role.RANGED:
        this.performRangedRole();
        break;
    }
  }

  private performMinerRole(containers: StructureContainer[], spawn: StructureSpawn | undefined): void {
    if (spawn === undefined) return;

    // Skip invalid
    if (this.creep === null ||
        this.creep.store === null ||
        this.creep.store === undefined ||
        this.creep.spawning) {
      return;
    }

    // Find the closest container with energy
    const targetContainer = this.creep.findClosestByPath(containers.filter(c => c.store.energy > 0));

    const minerFreeCapacity = this.creep.store.getFreeCapacity();

    if (targetContainer && minerFreeCapacity !== null && minerFreeCapacity > 0) {
      if (targetContainer) {
        const minerRange = this.creep.getRangeTo(targetContainer);
        if (minerRange > 1) {
          // Go to closest container and withdraw energy
          this.creep.moveTo(targetContainer);

          // // DEBUG PATH
          // let path: Position[] = miner.findPathTo(targetContainer);
          // debugPath(miner, path);
        }

        this.creep.withdraw(targetContainer, 'energy');
      }
    } else {
      const minerRange = this.creep.getRangeTo(spawn);
      if (minerRange > 1) {
        // Return to spawn and transfer energy
        this.creep.moveTo(spawn);

        // // DEBUG PATH
        // let path: Position[] = miner.findPathTo(spawn);
        // debugPath(miner, path);
      }

      this.creep.transfer(spawn, 'energy');
    }
  }

  // private performWallbreakerRole(): void {
  //   // Implement wallbreaker logic
  // }

  private performMeleeRole(): void {
    // Implement melee combat logic
  }

  private performHealerRole(): void {
    // Implement healer logic
  }

  private performRangedRole(): void {
    // Implement ranged combat logic
  }
}
