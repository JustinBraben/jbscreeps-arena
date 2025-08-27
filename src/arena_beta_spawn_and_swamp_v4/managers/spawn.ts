import { OrderQueue } from 'common/classes/orderQueue';
import { BODYPART_COST, WORK } from 'game/constants';
import { Core } from '../core';

export function runSpawn(core: Core) {
  if (spawnShouldRun(core)) {
    processQueue(core);
  }
}

function spawnShouldRun(core: Core): boolean {
  return core.mySpawn.store.energy >= BODYPART_COST[WORK];
}

function processQueue(core: Core) {
  if (!OrderQueue.hasOrder()) return;

  OrderQueue.sortByPriority();
  const order = OrderQueue.getFirst()!;
  const { body, level, role } = order;
  const { object: creep } = core.mySpawn.spawnCreep(body);

  if (creep) {
    console.log(`Spawn: ${role} [${level}]`);
    creep._role = role;
    creep._level = level;
    OrderQueue.remove(order);
  }
}
