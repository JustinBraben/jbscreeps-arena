import { ATTACK, BODYPART_COST, BodyPartConstant, CARRY, HEAL, MOVE, RANGED_ATTACK, WORK } from 'game/constants';

const addToBody = (body: BodyPartConstant[], count: number, parts: BodyPartConstant[]): BodyPartConstant[] => {
  for (let i = 0; i < count; i++) {
    for (const part of parts) {
      body.push(part);
    }
  }
  return body;
};

const getMaxLevel = (energy: number, bodyFunction: (i: number) => BodyPartConstant[], maxLevel: number): number => {
  let level = 0;
  let maxReached = false;
  for (let i = 1; !maxReached; i++) {
    const cost = getCostForBody(bodyFunction(i));
    if (cost > energy || i > maxLevel) {
      maxReached = true;
    } else {
      level = i;
    }
  }
  return level;
};

export function getCostForBody(body: BodyPartConstant[]): number {
  let cost = 0;
  for (const part of body) {
    cost += BODYPART_COST[part];
  }
  return cost;
}

export function getHealerBody(level: number): BodyPartConstant[] {
  if (level > 25) {
    level = 25;
  }
  let body: BodyPartConstant[] = [];
  body = addToBody(body, level, [MOVE, MOVE, HEAL]);
  return body;
}

export function getMaxLevelHealer(energy: number, maxLevel = 25): number {
  return getMaxLevel(energy, getHealerBody, maxLevel);
}

export function getRangerBody(level: number): BodyPartConstant[] {
  if (level > 25) {
    level = 25;
  }
  let body: BodyPartConstant[] = [];
  body = addToBody(body, level, [MOVE, MOVE, RANGED_ATTACK]);
  return body;
}

export function getMaxLevelRanger(energy: number, maxLevel = 25): number {
  return getMaxLevel(energy, getRangerBody, maxLevel);
}

export function getMeleeBody(level: number): BodyPartConstant[] {
  if (level > 25) {
    level = 25;
  }
  let body: BodyPartConstant[] = [];
  body = addToBody(body, level, [MOVE, MOVE, ATTACK]);
  return body;
}

export function getMaxLevelMelee(energy: number, maxLevel = 25): number {
  return getMaxLevel(energy, getMeleeBody, maxLevel);
}

export function getHaulerBody(level: number): BodyPartConstant[] {
  if (level > 25) {
    level = 25;
  }
  let body: BodyPartConstant[] = [];
  body = addToBody(body, level, [CARRY, MOVE]);
  return body;
}

export function getMaxLevelHauler(energy: number, maxLevel = 25): number {
  return getMaxLevel(energy, getHaulerBody, maxLevel);
}

export function getBuilderBody(level: number): BodyPartConstant[] {
  if (level > 12) {
    level = 12;
  }
  let body: BodyPartConstant[] = [];
  body = addToBody(body, level, [CARRY, MOVE, WORK, MOVE]);
  return body;
}

export function getMaxLevelBuilder(energy: number, maxLevel = 12): number {
  return getMaxLevel(energy, getBuilderBody, maxLevel);
}
