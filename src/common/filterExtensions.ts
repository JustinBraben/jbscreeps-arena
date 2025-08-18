import { StructureExtension } from "game/prototypes";
import { getObjectsByPrototype } from "game/utils";

export function getMyExtensionsToFill(): StructureExtension[] {
  return getObjectsByPrototype(StructureExtension).filter(extension => extension.my && extension.store.energy < 100);
}
