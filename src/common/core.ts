import { Role, RoleSpawnAndSWamp } from 'common/enums/role';
import { arenaInfo } from 'game';
import { Creep } from 'game/prototypes';
import { applyMixin } from 'common/prototype/applyMixin';
import { getObjectsByPrototype, getTicks } from 'game/utils';

export class RoleMixin extends Creep {
  role: Role = RoleSpawnAndSWamp.Miner;
}
applyMixin(Creep, RoleMixin);

/**
 * Common Core class.
 *
 * Provides access to common game objects and game state.
 */
export class Core {
  public tick: number = 0;
  public myCreeps: Array<Creep> = new Array<Creep>();
  public myCreepsByRole: Map<Role, Array<Creep>> = new Map<Role, Array<Creep>>();
  public enemyCreeps: Array<Creep> = new Array<Creep>();

  public run() {
    this.tick = getTicks();

    if (this.tick === 1) {
      const { name, level } = arenaInfo;
      console.log(`✨Arena: ${name} [${level}]`);
    }

    this.myCreeps = new Array<Creep>();
    this.enemyCreeps = new Array<Creep>();
    this.myCreepsByRole = new Map<Role, Array<Creep>>();

    const creeps = getObjectsByPrototype(Creep).filter(c => c.hits);

    // Go throuugh all creeps
    // Add them to your creeps if they are yours
    // otherwise add them to enemyCreeps
    for (const c of creeps) {
      if (c.my) {
        this.myCreeps.push(c);
      } else {
        this.enemyCreeps.push(c);
      }
    }
  }

  public getAllOfRole(role: Role): Array<Creep> {
    if (this.myCreepsByRole.has(role)) {
      let arr = this.myCreepsByRole.get(role);
      if (arr !== undefined) {
        return arr;
      }
    }
    let newArr = new Array<Creep>();
    this.myCreepsByRole.set(role, newArr);
    return newArr;
  }

  public getCreeps(role?: Role): Array<Creep> {
    return role !== undefined ? this.getAllOfRole(role) : this.myCreeps;
  }

  public runCreeps<TCore extends Core>(role: number, runRole: (creep: Creep, core: TCore) => void) {
    for (const creep of this.getAllOfRole(role)) {
      if (this.creepShouldRun(creep)) {
        runRole(creep, this as unknown as TCore);
      }
    }
  }

  public creepShouldRun(creep: Creep) {
    if (!creep.exists) {
      return false;
    }

    // Reset creep states before running creep role logic

    return true;
  }
}
