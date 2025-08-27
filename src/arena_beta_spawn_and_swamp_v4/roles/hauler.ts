import { creepHadState, setCreepStateAndRun } from 'common/lib/creep';
import { RESOURCE_ENERGY } from 'game/constants';
import { Creep } from 'game/prototypes';
import { Core } from '../core';

enum State {
  HarvestEnergy = 1,
  TransferEnergy = 2,
}

export function run(creep: Creep, core: Core) {
  switch (creep._state) {
    case State.HarvestEnergy: {
      runHarvestEnergy(creep, core);
      break;
    }
    case State.TransferEnergy: {
      runTransferEnergy(creep, core);
      break;
    }
    default: {
      setCreepStateAndRun(core, creep, State.HarvestEnergy, runHarvestEnergy);
      break;
    }
  }
}

export function runHarvestEnergy(creep: Creep, core: Core) {
  if (!creepHadState(creep, State.TransferEnergy) && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    setCreepStateAndRun(core, creep, State.TransferEnergy, runTransferEnergy);
    return;
  }

  const container = creep.findClosestByPath(core.containers);
  if (container && creep.getRangeTo(container) > 1) {
    creep.moveTo(container);
    creep.withdraw(container, RESOURCE_ENERGY);
  } else if (container && creep.getRangeTo(container) === 1) {
    creep.withdraw(container, RESOURCE_ENERGY);
    creep.moveTo(core.mySpawn);
  }
}

export function runTransferEnergy(creep: Creep, core: Core) {
  if (!creepHadState(creep, State.HarvestEnergy) && !creep.store.energy) {
    setCreepStateAndRun(core, creep, State.HarvestEnergy, runHarvestEnergy);
    return;
  }

  const container = creep.findClosestByPath(core.containers);

  if (core.mySpawn.store.getFreeCapacity(RESOURCE_ENERGY)) {
    if (creep.getRangeTo(core.mySpawn) > 1) {
      creep.moveTo(core.mySpawn);
      creep.transfer(core.mySpawn, RESOURCE_ENERGY);
    } else if (creep.getRangeTo(core.mySpawn) === 1 && container) {
      creep.transfer(core.mySpawn, RESOURCE_ENERGY);
      creep.moveTo(container);
    }
  }
}
