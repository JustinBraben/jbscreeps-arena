import { Order } from 'common/classes/order';
import { Priority } from 'common/enums/priority';
import { Role } from 'common/enums/role';
import { getBuilderBody, getMaxLevelBuilder } from 'common/lib/bodyParts';
import { Core } from '../core';
import { run as runBuilder } from '../roles/builder';
import { getCreepsInQueue, orderCreep } from '../libs/orders';

// const MAX_LEVEL = 4;

let lastRun = 0;

export function runBuild(core: Core) {
  core.runCreeps(Role.BUILDER, runBuilder);

  if (!lastRun || lastRun + 10 <= core.tick) {
    if (shouldOrderBuilder(core)) {
      orderBuilder(core);
    }
    lastRun = core.tick;
  }
}

function shouldOrderBuilder(core: Core) {
  if (core.getCreeps(Role.HAULER).length === 0) {
    return false;
  }

  const active = core.getCreeps(Role.BUILDER).length;
  const ordered = getCreepsInQueue(Role.BUILDER);
  return (active < core.getCreeps(Role.MELEE).length && !ordered);
}

function orderBuilder(core: Core, priority: Priority = Priority.Normal) {
  const order = new Order();
  order.role = Role.BUILDER;
  order.level = getMaxLevelBuilder(core.getSpawnEnergyAvailable());
  order.body = getBuilderBody(order.level);
  order.priority = priority;

  orderCreep(order, core);
}
