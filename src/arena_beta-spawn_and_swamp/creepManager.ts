import { getObjectsByPrototype, getObjectById, getObjects } from 'game/utils';
import { ATTACK, MOVE, CARRY, RANGED_ATTACK, HEAL, TOUGH, WORK } from 'game/constants';
import { StructureSpawn, StructureContainer, Creep, StructureWall, Id, Position } from 'game/prototypes';
import { Visual } from 'game/visual';
import { Role, RoleSpawnAndSwamp } from 'common/enums/role';
import { JBCreep } from 'common/lib/jbCreep';

// Manager class to handle JBCreep instances
export class CreepManager {
  private jbCreeps: Map<string, JBCreep> = new Map();

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

  runAll(): void {
    for (const jbCreep of this.jbCreeps.values()) {
      jbCreep.performRole();
    }
  }
}
