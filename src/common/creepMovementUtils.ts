import { OK } from "game/constants";
import { searchPath } from "game/path-finder";
import { Creep, GameObject, Position, StructureSpawn } from "game/prototypes";
import { getDirection, getRange } from "game/utils";

export function moveWithinRange(creep: Creep, otherPos: Position, idealRange: number, ignore?: GameObject[]): boolean {
  if (getRange(creep, otherPos) > idealRange) {
    let findPathOpts = undefined;
    if (ignore) findPathOpts = { ignore: ignore };
    const moveResult = creep.moveTo(otherPos, findPathOpts);
    if (moveResult === OK) return true;
  }

  return false;
}

export function flee(creep: Creep, spawn: StructureSpawn, threats: GameObject[], range: number): void {
  const result = searchPath(
    creep,
    threats.map(t => ({ pos: t, range })),
    { flee: true }
  );

  if (result.path.length > 0 && result.path[0] !== undefined) {
    const direction = getDirection(
      result.path[0].x - creep.x,
      result.path[0].y - creep.y
    );
    if (direction) {}
    // creep.move(direction);
    creep.moveTo(spawn);
  }
}
