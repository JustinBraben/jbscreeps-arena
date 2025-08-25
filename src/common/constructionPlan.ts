import { ConstructionSite, Position, StructureContainer, StructureExtension, StructureRampart, StructureSpawn } from "game/prototypes";
import { createConstructionSite } from "game/utils";


export function planConstructionSites(
  allySpawn: StructureSpawn,
  allyConstructionSites: ConstructionSite[],
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

  createInitialSpawnRamparts(allySpawn, allyConstructionSites);

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
): void {
  // planRamparts(allySpawn, allyConstructionSites);
  // planRamparts({ x: allySpawn.x, y: allySpawn.y - 1 }, allyConstructionSites);
  // planRamparts({ x: allySpawn.x, y: allySpawn.y + 1 }, allyConstructionSites);
  planRamparts({ x: allySpawn.x - 1, y: allySpawn.y }, allyConstructionSites);
  planRamparts({ x: allySpawn.x + 1, y: allySpawn.y }, allyConstructionSites);
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

    // for (const offsetY of [-2, -1, 0, 1, 2]) {
    for (const offsetY of [-1, 0, 1]) {
      const pos: Position = { x: container.x + offsetX, y: container.y + offsetY };
      const existingSite = allyConstructionSites.find(s => allySpawn !== undefined && s.x === pos.x && s.y === pos.y);
      // let outsideSite = null;
      if (existingSite === undefined) {
        // // outsideSite = createConstructionSite(pos, StructureExtension).object;
        // const createSiteResult = createConstructionSite(pos, StructureExtension);
        // if (createSiteResult.object) {
        //   // console.log(`Site created: ${createSiteResult.object.id}`);
        // } else if (createSiteResult.error) {
        //   // console.log(`Site creation failed with error: ${createSiteResult.error}`);
        // }
      } else {
        // DEBUG
        // console.log(`Site already exists existingSite: ${existingSite.id}`);
      }
    }

    // if (allySpawn.x === 94) offsetX = 1;
    // if (allySpawn.x === 5) offsetX = -1;

    // const existingRampartSite = allyConstructionSites.find(site => site.x === container.x + offsetX && site.y === container.y && site.structure instanceof(StructureRampart));
    // if (!existingRampartSite) {
    //   createConstructionSite({x: container.x + offsetX, y: container.y}, StructureRampart);
    // }
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
      // site.remove();
    }
  }
}

export function planRamparts(
  pos: Position,
  allyConstructionSites: ConstructionSite[],
): void {
  const existingRampartSite = allyConstructionSites.find(site => site.x === pos.x && site.y === pos.y && site.structure instanceof(StructureRampart));
  if (!existingRampartSite) {
    const createSiteResult = createConstructionSite({x: pos.x, y: pos.y}, StructureRampart);
    if (createSiteResult.object) {
        console.log(`Site created: ${createSiteResult.object.id}`);
      } else if (createSiteResult.error) {
        console.log(`Site creation failed with error: ${createSiteResult.error}`);
      }
  }

  const existingRampartSite2 = allyConstructionSites.find(site => site.x === pos.x + 1 && site.y === pos.y + 1 && site.structure instanceof(StructureRampart));
  if (!existingRampartSite2) {
    const createSiteResult = createConstructionSite({x: pos.x + 1, y: pos.y + 1}, StructureRampart);
    if (createSiteResult.object) {
        console.log(`Site created: ${createSiteResult.object.id}`);
      } else if (createSiteResult.error) {
        console.log(`Site creation failed with error: ${createSiteResult.error}`);
      }
  }

  const existingRampartSite3 = allyConstructionSites.find(site => site.x === pos.x - 1 && site.y === pos.y - 1 && site.structure instanceof(StructureRampart));
  if (!existingRampartSite3) {
    const createSiteResult = createConstructionSite({x: pos.x - 1, y: pos.y - 1}, StructureRampart);
    if (createSiteResult.object) {
        console.log(`Site created: ${createSiteResult.object.id}`);
      } else if (createSiteResult.error) {
        console.log(`Site creation failed with error: ${createSiteResult.error}`);
      }
  }
}

export function planExtensions(
  pos: Position,
  allyConstructionSites: ConstructionSite[],
): void {
  const existingExtensionSite = allyConstructionSites.find(site => site.x === pos.x && site.y === pos.y - 1 && site.structure instanceof(StructureExtension));
  if (!existingExtensionSite) {
    const createSiteResult = createConstructionSite({x: pos.x, y: pos.y - 1}, StructureExtension);
    if (createSiteResult.object) {
        console.log(`Site created: ${createSiteResult.object.id}`);
      } else if (createSiteResult.error) {
        console.log(`Site creation failed with error: ${createSiteResult.error}`);
      }
  }

  const existingExtensionSite2 = allyConstructionSites.find(site => site.x === pos.x && site.y === pos.y + 1 && site.structure instanceof(StructureExtension));
  if (!existingExtensionSite2) {
    const createSiteResult = createConstructionSite({x: pos.x, y: pos.y + 1}, StructureExtension);
    if (createSiteResult.object) {
        console.log(`Site created: ${createSiteResult.object.id}`);
      } else if (createSiteResult.error) {
        console.log(`Site creation failed with error: ${createSiteResult.error}`);
      }
  }

  const existingExtensionSite3 = allyConstructionSites.find(site => site.x + 1 === pos.x && site.y === pos.y && site.structure instanceof(StructureExtension));
  if (!existingExtensionSite3) {
    const createSiteResult = createConstructionSite({x: pos.x + 1, y: pos.y}, StructureExtension);
    if (createSiteResult.object) {
        console.log(`Site created: ${createSiteResult.object.id}`);
      } else if (createSiteResult.error) {
        console.log(`Site creation failed with error: ${createSiteResult.error}`);
      }
  }

  const existingExtensionSite4 = allyConstructionSites.find(site => site.x === pos.x - 1 && site.y === pos.y && site.structure instanceof(StructureExtension));
  if (!existingExtensionSite4) {
    const createSiteResult = createConstructionSite({x: pos.x - 1, y: pos.y}, StructureExtension);
    if (createSiteResult.object) {
        console.log(`Site created: ${createSiteResult.object.id}`);
      } else if (createSiteResult.error) {
        console.log(`Site creation failed with error: ${createSiteResult.error}`);
      }
  }

  // const existingExtensionSite = allyConstructionSites.filter(site => Math.abs(site.x - pos.x) < 2 && Math.abs(site.y - pos.y) && site.structure instanceof(StructureExtension));
  // if (!existingExtensionSite) {
  //   for (const xOffset of [-1, 1]) {
  //     for (const yOffset of [-1, 1]) {
  //       const createSiteResult = createConstructionSite({x: pos.x + xOffset, y: pos.y + yOffset}, StructureExtension);
  //       if (createSiteResult.object) {
  //         console.log(`Site created: ${createSiteResult.object.id}`);
  //         break;
  //       } else if (createSiteResult.error) {
  //         console.log(`Site creation failed with error: ${createSiteResult.error}`);
  //       }
  //     }
  //   }
  // }
}
