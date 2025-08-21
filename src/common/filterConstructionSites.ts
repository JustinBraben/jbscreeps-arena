import { BuildableStructure } from "game/constants";
import { ConstructionSite, Creep, StructureContainer, StructureSpawn } from "game/prototypes";
import { getObjectsByPrototype } from "game/utils";

export function getConstructionSites(): ConstructionSite[] {
  return getObjectsByPrototype(ConstructionSite);
}

export function getMyConstructionSites(sites: ConstructionSite[]): ConstructionSite[] {
  return sites.filter(site => site.my && site.exists);
}

export function getMyConstructionSitesNearSpawn(sites: ConstructionSite[], spawn: StructureSpawn): ConstructionSite[] {
  return sites.filter(site => site.my && site.exists && site.getRangeTo(spawn) < 12);
}

export function getMyConstructionSitesInSwamp(sites: ConstructionSite[]): ConstructionSite[] {
  return sites.filter(site => site.my && site.exists && site.x > 13 && site.x < 86)
}

// Return sites within range
export function getConstructionSitesNotWithinRangeOfContainers(
  sites: ConstructionSite[],
  containers: StructureContainer[],
  range: number,
): ConstructionSite[] {
  return sites.filter(site => {
    return (containers.find(c => c.getRangeTo(site) < range) !== undefined);
  });
}

export function getNoProgressConstructionSites(
  sites: ConstructionSite[],
): ConstructionSite[] {
  return sites.filter(site => site.progress === 0);
}

export function findConstructionSiteToBuild(
  creep: Creep,
  allySpawn: StructureSpawn,
  allyConstructionSites: ConstructionSite[],
): ConstructionSite<BuildableStructure> | undefined | null {
  if (allySpawn) {}
  return creep.findClosestByRange(allyConstructionSites.filter(site => site.my && site.exists && site.progress < site.progressTotal));
  // // Fallback to building any construction sites
  //   return allyConstructionSites
  //   .sort((a, b) => {
  //     // Prioritize sites near spawn
  //     const aDist = allySpawn ? a.getRangeTo(allySpawn) : 100;
  //     const bDist = allySpawn ? b.getRangeTo(allySpawn) : 100;

  //     // If both are close to spawn, prioritize by progress
  //     if (aDist < 10 && bDist < 10) {
  //       return (b.progress / b.progressTotal) - (a.progress / a.progressTotal);
  //     }

  //     // Otherwise prioritize by distance
  //     if (aDist !== bDist) return aDist - bDist;
  //     return a.getRangeTo(creep) - b.getRangeTo(creep);
  //   })
  //   .find(s => s.exists);
}
