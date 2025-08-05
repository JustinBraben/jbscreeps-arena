import { getObjectsByPrototype, getObjectById, getObjects } from 'game/utils';
import { ATTACK, MOVE, CARRY, RANGED_ATTACK, HEAL, TOUGH, WORK } from 'game/constants';
import { StructureSpawn, StructureContainer, Creep, StructureWall, Id, Position } from 'game/prototypes';
import { Visual } from 'game/visual';
import { CreepManager } from './creepManager';
import { RoleSpawnAndSwamp } from 'common/enums/role';

const manager = new CreepManager();

let miner: Creep | undefined = undefined;

export function loop() {
  const creeps = getObjectsByPrototype(Creep).filter(c => c.my);
  const mySpawn = getObjectsByPrototype(StructureSpawn).find(c => c !== undefined && c.my);

  if (miner === null) {
    let spawnResult = mySpawn?.spawnCreep([MOVE, CARRY]);
    if (spawnResult?.error === undefined) {
      miner = spawnResult?.object;
    }
  }

  creeps.forEach(creep => {
    let jbCreep = manager.getJBCreep(creep);
    if (!jbCreep) {
      jbCreep = manager.initializeCreep(creep, RoleSpawnAndSwamp.Miner);
    }
  });

  manager.runAll();
}
