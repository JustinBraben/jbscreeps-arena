import { ConstructionSite, Position, StructureContainer, StructureExtension, StructureRampart, StructureSpawn } from "game/prototypes";
import { createConstructionSite, getTicks } from "game/utils";


export function planConstructionSites(
  allySpawn: StructureSpawn,
  allyConstructionSites: ConstructionSite[],
  allyRamparts: StructureRampart[],
  swampContainers: StructureContainer[],
  extensionRange: number,
): void {
  if (allySpawn === null || allySpawn === undefined) return;

  // const existingSite1 = allyConstructionSites.find(s => allySpawn !== undefined && s.x === allySpawn.x && s.y === allySpawn.y + 2);
  // if (existingSite1 === undefined){
  //   createConstructionSite({x: allySpawn.x, y: allySpawn.y + 2}, StructureExtension).object;
  // }

  // const existingSite2 = allyConstructionSites.find(s => allySpawn !== undefined && s.x === allySpawn.x && s.y === allySpawn.y - 2);
  // if (existingSite2 === undefined){
  //   createConstructionSite({x: allySpawn.x, y: allySpawn.y - 2}, StructureExtension).object;
  // }

  createInitialSpawnRamparts(allySpawn, allyConstructionSites, allyRamparts);

  // const existingSite3 = constructionSites.find(s => allySpawn !== undefined && s.x === allySpawn.x && s.y === allySpawn.y + 5);
  // let constructSite3 = null;
  // if (existingSite3 === undefined){
  //   constructSite3 = createConstructionSite({x: allySpawn.x, y: allySpawn.y + 5}, StructureExtension).object;
  // }

  // const existingSite4 = constructionSites.find(s => allySpawn !== undefined && s.x === allySpawn.x && s.y === allySpawn.y - 5);
  // let constructSite4 = null;
  // if (existingSite4 === undefined){
  //   constructSite4 = createConstructionSite({x: allySpawn.x, y: allySpawn.y - 5}, StructureExtension).object;
  // }

  // Plan extensions near containers
  // When you do this, often no miner will get to it before it decays
  // So should only walk to inner swamp container, mine from it then create the Extensions to ensure
  // they actually get created
  createSwampExtensions(allySpawn, allyConstructionSites, swampContainers, extensionRange);

  planRemoveExtensionConstructionSites(allySpawn, allyConstructionSites, swampContainers, extensionRange);
}

export function createInitialSpawnRamparts(
  allySpawn: StructureSpawn,
  allyConstructionSites: ConstructionSite[],
  allyRamparts: StructureRampart[],
): void {
  const existingSpawnRampart = allyConstructionSites.find(s => allySpawn !== undefined && s.structure instanceof(StructureRampart) && s.x === allySpawn.x && s.y === allySpawn.y);
  if (!existingSpawnRampart) {
    // Check if rampart already exists
    // const ramparts = getObjectsByPrototype(StructureRampart).filter(r => r.my);
    const spawnRampartExists = allyRamparts.some(r =>
      r.x === allySpawn.x && r.y === allySpawn.y
    );

    if (!spawnRampartExists && getTicks() === 500) {
      createConstructionSite(
        { x: allySpawn.x, y: allySpawn.y },
        StructureRampart
      );
    }
  }
}

export function createSwampExtensions(
  allySpawn: StructureSpawn,
  allyConstructionSites: ConstructionSite[],
  swampContainers: StructureContainer[],
  extensionRange: number,
): void {
  for (const container of swampContainers) {
    // Only care about containers in the swamp area
    if (container.x < 13 || container.x > 86) continue;

    let offsetX: number = 0;

    // Extensions placed on either side depending on closest Spawn point
    if (allySpawn.x === 94) offsetX = extensionRange;
    if (allySpawn.x === 5) offsetX = -extensionRange;

    for (const offsetY of [-2, -1, 0, 1, 2]) {
      const pos: Position = { x: container.x + offsetX, y: container.y + offsetY };
      const existingSite = allyConstructionSites.find(s => allySpawn !== undefined && s.x === pos.x && s.y === pos.y);
      // let outsideSite = null;
      if (existingSite === undefined) {
        // outsideSite = createConstructionSite(pos, StructureExtension).object;
        const createSiteResult = createConstructionSite(pos, StructureExtension);
        if (createSiteResult.object) {
          // console.log(`Site created: ${createSiteResult.object.id}`);
        } else if (createSiteResult.error) {
          // console.log(`Site creation failed with error: ${createSiteResult.error}`);
        }
      } else {
        // DEBUG
        // console.log(`Site already exists existingSite: ${existingSite.id}`);
      }
    }
  }
}

// Remove ConstructionSites
export function planRemoveExtensionConstructionSites(
  allySpawn: StructureSpawn,
  allyConstructionSites: ConstructionSite[],
  swampContainers: StructureContainer[],
  extensionRange: number,
): void {
  for (let site of allyConstructionSites) {
    // Skip Removing sites that have been halfway built
    if (site.progress !== 0) continue;
    if (site.structure instanceof(StructureRampart)) continue;

    const containerNearSite = swampContainers.find(c => c.getRangeTo(site) <= extensionRange);
    if (!containerNearSite && allySpawn.getRangeTo(site) > 7) {
      site.remove();
    }
  }
}
