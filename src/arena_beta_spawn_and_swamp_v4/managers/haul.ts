import { Order } from 'common/classes/order';
import { Priority } from 'common/enums/priority';
import { Role } from 'common/enums/role';
import { getHaulerBody, getMaxLevelHauler } from 'common/lib/bodyParts';
import { Core } from '../core';
import { run as runHauler } from '../roles/hauler';
import { getCreepsInQueue, orderCreep } from '../libs/orders';

// const MAX_LEVEL = 4;

let lastRun = 0;

export function runHaul(core: Core) {
  core.runCreeps(Role.HAULER, runHauler);

  if (!lastRun || lastRun + 10 <= core.tick) {
    if (shouldOrderHauler(core)) {
      orderHauler(core);
    }
    lastRun = core.tick;
  }
}

function shouldOrderHauler(core: Core) {
  const active = core.getCreeps(Role.HAULER).length;
  const ordered = getCreepsInQueue(Role.HAULER);
  if (core.myCreeps.length === 0) return true;
  return (active <= core.getCreeps(Role.HEALER).length && !ordered);
}

function orderHauler(core: Core, priority: Priority = Priority.Normal) {
  const order = new Order();
  order.role = Role.HAULER;
  order.level = getMaxLevelHauler(core.getSpawnEnergyAvailable());
  order.body = getHaulerBody(order.level);
  order.priority = priority;

  orderCreep(order, core);
}
