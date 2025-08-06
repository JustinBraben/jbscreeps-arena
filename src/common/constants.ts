import { Position } from 'game/prototypes';
import { FindPathOptions } from 'game/path-finder';

export const DefaultFindPathOptions: FindPathOptions = {
  maxOps: 10000,
  maxCost: 10000
};
export const DefaultFleeFindPathOptions: FindPathOptions = {
  maxOps: 10000,
  maxCost: 10000,
  flee: true
};

export const SpawnAndSwampLeftSpawn: Position = { x: 5, y: 45 };
export const SpawnAndSwampRightSpawn: Position = { x: 94, y: 54 };
