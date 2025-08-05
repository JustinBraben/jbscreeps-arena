import { StructureSpawn, StructureContainer, Creep, StructureWall, Id, Position } from 'game/prototypes';

/**
 * Tracks and records Visuals
 */
export class VisualManager {
  personalSpawn: StructureSpawn | undefined;
  enemySpawn: StructureSpawn | undefined;
  miners: Array<Creep>;
  wallbreakers: Array<Creep>;
  melees: Array<Creep>;
  healers: Array<Creep>;
  ranged: Array<Creep>;

  constructor() {
    this.personalSpawn = undefined;
    this.enemySpawn = undefined;
    this.miners = new Array<Creep>;
    this.wallbreakers = new Array<Creep>;
    this.melees = new Array<Creep>;
    this.healers = new Array<Creep>;
    this.ranged = new Array<Creep>;
  }

  public cleanupDeadCreeps(): void {
    // Filter out undefined, null, and dead creeps
    this.miners = this.miners.filter(c => c && c.hits > 0);
    this.wallbreakers = this.wallbreakers.filter(c => c && c.hits > 0);
    this.melees = this.melees.filter(c => c && c.hits > 0);
    this.healers = this.healers.filter(c => c && c.hits > 0);
    this.ranged = this.ranged.filter(c => c && c.hits > 0);
  }
}
