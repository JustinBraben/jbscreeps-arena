// common/lib/jbCreep.ts
import { Creep, Position, Structure, Source } from 'game/prototypes';
import { Role, RoleSpawnAndSwamp } from 'common/enums/role';
import { Core } from 'common/core';
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
  performRole(): void {
    switch (this.role) {
      case RoleSpawnAndSwamp.Miner:
        this.performMinerRole();
        break;
      case RoleSpawnAndSwamp.Wallbreaker:
        this.performWallbreakerRole();
        break;
      case RoleSpawnAndSwamp.Melee:
        this.performMeleeRole();
        break;
      case RoleSpawnAndSwamp.Healer:
        this.performHealerRole();
        break;
      case RoleSpawnAndSwamp.Ranged:
        this.performRangedRole();
        break;
    }
  }

  private performMinerRole(): void {
    // Implement miner logic
    if (this.targetPosition) {
      this.moveTo(this.targetPosition);
    }
    // Add harvesting logic here
  }

  private performWallbreakerRole(): void {
    // Implement wallbreaker logic
  }

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
