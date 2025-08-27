import { Order } from 'common/classes/order';
import { Priority } from 'common/enums/priority';
import { Role } from 'common/enums/role';
import { getBuilderBody, getHealerBody, getMaxLevelBuilder, getMaxLevelHealer, getMaxLevelMelee, getMaxLevelRanger, getMeleeBody, getRangerBody } from 'common/lib/bodyParts';
import { Core } from '../core';
import { run as runAttacker } from '../roles/attacker';
import { run as runHealer } from '../roles/healer';
import { run as runBuilder } from '../roles/builder';
import { getCreepsInQueue, orderCreep } from '../libs/orders';

// const MAX_LEVEL = 4;

let lastRun = 0;

export function runMilitary(core: Core) {
  core.runCreeps(Role.MELEE, runAttacker);
  core.runCreeps(Role.RANGED, runAttacker);
  core.runCreeps(Role.BUILDER, runBuilder);
  core.runCreeps(Role.HEALER, runHealer);

  if (!lastRun || lastRun + 10 <= core.tick) {
    if (shouldOrderMeleeAttacker(core)) {
      orderMeleeAttacker(core);
    } else if (shouldOrderRangedAttacker(core)) {
      orderRangedAttacker(core);
    } else if (shouldOrderBuilder(core)) {
      orderBuilder(core);
    } else if (shouldOrderHealer(core)) {
      orderHealer(core);
    }
    lastRun = core.tick;
  }
}

function shouldOrderMeleeAttacker(core: Core): boolean {
  if (core.getCreeps(Role.HAULER).length === 0) {
    return false;
  }

  const active = core.getCreeps(Role.MELEE).length;
  const ordered = getCreepsInQueue(Role.MELEE);
  return (active <= core.getCreeps(Role.HAULER).length && !ordered);
}

function orderMeleeAttacker(core: Core) {
  const order = new Order();
  order.role = Role.MELEE;
  order.level = getMaxLevelMelee(core.getSpawnEnergyAvailable());
  order.body = getMeleeBody(order.level);
  order.priority = Priority.High;
  orderCreep(order, core);
}

function shouldOrderRangedAttacker(core: Core): boolean {
  if (core.getCreeps(Role.HAULER).length === 0) {
    return false;
  }

  const active = core.getCreeps(Role.RANGED).length;
  const ordered = getCreepsInQueue(Role.RANGED);
  return (active <= core.getCreeps(Role.MELEE).length && !ordered);
}

function orderRangedAttacker(core: Core) {
  const order = new Order();
  order.role = Role.RANGED;
  order.level = getMaxLevelRanger(core.getSpawnEnergyAvailable());
  order.body = getRangerBody(order.level);
  order.priority = Priority.High;
  orderCreep(order, core);
}

function shouldOrderBuilder(core: Core) {
  if (core.getCreeps(Role.HAULER).length === 0) {
    return false;
  }

  const active = core.getCreeps(Role.BUILDER).length;
  const ordered = getCreepsInQueue(Role.BUILDER);
  return (active < core.getCreeps(Role.RANGED).length && !ordered);
}

function orderBuilder(core: Core, priority: Priority = Priority.Normal) {
  const order = new Order();
  order.role = Role.BUILDER;
  order.level = getMaxLevelBuilder(core.getSpawnEnergyAvailable());
  order.body = getBuilderBody(order.level);
  order.priority = priority;

  orderCreep(order, core);
}

function shouldOrderHealer(core: Core): boolean {
  if (core.getCreeps(Role.HAULER).length === 0) {
    return false;
  }

  const active = core.getCreeps(Role.HEALER).length;
  const ordered = getCreepsInQueue(Role.HEALER);
  return active <= core.getCreeps(Role.BUILDER).length && !ordered;
}

function orderHealer(core: Core) {
  const order = new Order();
  order.role = Role.HEALER;
  order.level = getMaxLevelHealer(core.getSpawnEnergyAvailable());
  order.body = getHealerBody(order.level);
  order.priority = Priority.High;
  orderCreep(order, core);
}
