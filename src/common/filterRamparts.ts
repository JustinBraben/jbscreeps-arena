import { Creep, StructureRampart } from "game/prototypes";

export function getAvailableRamparts(self: Creep, myRamparts: StructureRampart[], allyCreeps: Creep[]): StructureRampart[] {
  return myRamparts.filter(rampart => {
    // Check if any of our creeps are already on this rampart
    const occupiedByAlly = allyCreeps.some(creep =>
      creep.x === rampart.x && creep.y === rampart.y && creep !== self
    );
    return !occupiedByAlly;
  });
}

// Alternative function that finds the closest available rampart for a specific creep
export function findClosestAvailableRampart(creep: Creep, myRamparts: StructureRampart[], myCreeps: Creep[]): StructureRampart | null {
  const availableRamparts = getAvailableRamparts(creep, myRamparts, myCreeps);

  if (availableRamparts.length === 0) {
    return null;
  }

  return creep.findClosestByRange(availableRamparts);
}
