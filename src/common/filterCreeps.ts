import { MOVE, BodyPartConstant, CARRY, WORK } from "game/constants";
import { Creep } from "game/prototypes";

export function getHaulers(myCreeps: Creep[]): Creep[] {
  return myCreeps.filter(creep =>
    creepHasBodyPartConstant(creep, MOVE) &&
    creepHasBodyPartConstant(creep, CARRY) &&
    !creepHasBodyPartConstant(creep, WORK)
  );
}

export function creepHasBodyPartConstant(
  creep: Creep, bodyPartConstant: BodyPartConstant) : boolean {
  return creep.body.find(body => body.type === bodyPartConstant) !== undefined;
}
