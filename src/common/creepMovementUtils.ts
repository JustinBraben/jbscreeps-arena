import { Creep, Position } from "game/prototypes";
import { getRange } from "game/utils";

export function moveWithinRange(creep: Creep, otherPos: Position, idealRange: number): void {
  if (getRange(creep, otherPos) > idealRange) {
    creep.moveTo(otherPos);
  }
}
