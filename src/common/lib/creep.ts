import { BodyPartConstant } from 'game/constants';
import { Creep } from 'game/prototypes';
import { Core } from '../core';

export function setCreepState(creep: Creep, state: number) {
  if (!creep._states) {
    creep._states = [];
  }
  creep._states.push(state);
  creep._state = state;
}

export function creepHadState(creep: Creep, state: number) {
  if (!creep._states) {
    creep._states = [];
  }
  return creep._states.includes(state);
}

export function setCreepStateAndRun<TCore extends Core>(
  core: TCore,
  creep: Creep,
  state: number,
  runFunction: (creep: Creep, core: TCore, ...args: unknown[]) => void,
  ...args: unknown[]
) {
  const canRunFunction = !creepHadState(creep, state);
  setCreepState(creep, state);
  if (canRunFunction) {
    runFunction(creep, core, args);
  }
}

export function creepHasPart(creep: Creep, part: BodyPartConstant): boolean {
  return creep.body.some(p => p.type === part);
}
