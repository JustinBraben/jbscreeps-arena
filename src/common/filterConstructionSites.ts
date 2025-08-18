import { ConstructionSite, StructureSpawn } from "game/prototypes";
import { getObjectsByPrototype } from "game/utils";

export function getConstructionSites(): ConstructionSite[] {
  return getObjectsByPrototype(ConstructionSite);
}

export function getMyConstructionSitesNearSpawn(sites: ConstructionSite[], spawn: StructureSpawn): ConstructionSite[] {
  return sites.filter(site => site.my && site.exists && site.getRangeTo(spawn) < 12);
}

export function getMyConstructionSitesInSwamp(sites: ConstructionSite[]): ConstructionSite[] {
  return sites.filter(site => site.my && site.exists && site.x > 13 && site.x < 86)
}
