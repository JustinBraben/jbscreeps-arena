import { StructureContainer, StructureSpawn } from "game/prototypes";
import { getObjectsByPrototype } from "game/utils";

export function getContainers(): StructureContainer[] {
  return getObjectsByPrototype(StructureContainer).filter(container => container.store.energy > 0);
}

export function getContainersNearSpawn(containers: StructureContainer[], spawn: StructureSpawn): StructureContainer[] {
  return containers.filter(container => container.store.energy > 0 && container.getRangeTo(spawn) < 12);
}

export function getContainersInSwamp(containers: StructureContainer[]): StructureContainer[] {
  return containers.filter(container => container.x > 13 && container.x < 86 && container.ticksToDecay !== undefined)
}
