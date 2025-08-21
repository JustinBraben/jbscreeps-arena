import { StructureExtension, StructureSpawn } from "game/prototypes";
import { getObjectsByPrototype } from "game/utils";

export function getMyExtensions(): StructureExtension[] {
  return getObjectsByPrototype(StructureExtension).filter(extension => extension.my && extension.hits > 0);
}

export function getMyExtensionsToFill(): StructureExtension[] {
  return getObjectsByPrototype(StructureExtension).filter(extension => extension.my && extension.hits > 0 && extension.store.energy < 100 && extension.exists);
}

// Helper function to calculate total available energy for spawning
export function getTotalSpawnEnergy(
  allySpawn: StructureSpawn,
  allyExtensions: StructureExtension[],
): number {
  if (!allySpawn) return 0;

  // Spawn's energy + all extensions' energy
  let total = allySpawn.store.energy || 0;

  allyExtensions.forEach(extension => {
    total += extension.store.energy || 0;
  });

  return total;
}
