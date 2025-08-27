import { Core as CommonCore } from 'common/core';
import { getContainersInSwamp } from 'common/filterContainers';
import { RESOURCE_ENERGY } from 'game/constants';
import {
  ConstructionSite,
  StructureContainer,
  StructureExtension,
  StructureRampart,
  StructureSpawn,
  StructureTower,
  StructureWall,
} from 'game/prototypes';
import { getObjectsByPrototype } from 'game/utils';

/**
 * Spawn and Swamp Core class.
 *
 * Provides access to the Spawn and Swamp game objects and game state.
 *
 * @extends CommonCore
 */
export class Core extends CommonCore {
  private static instance: Core;
  public mySpawn!: StructureSpawn;
  public myTowers: StructureTower[] = [];
  public myExts: StructureExtension[] = [];
  public myRamparts: StructureRampart[] = [];
  public myConstrSites: ConstructionSite[] = [];
  public enemySpawn!: StructureSpawn;
  public enemyTowers: StructureTower[] = [];
  public enemyExts: StructureExtension[] = [];
  public enemyRamparts: StructureRampart[] = [];
  public enemyConstrSites: ConstructionSite[] = [];
  public containers: StructureContainer[] = [];
  public swampContainers: StructureContainer[] = [];
  public walls: StructureWall[] = [];

  public override run() {
    super.run();

    const spawns = getObjectsByPrototype(StructureSpawn);
    this.mySpawn = spawns.find(s => s.my)!;
    this.enemySpawn = spawns.find(s => !s.my)!;

    const towers = getObjectsByPrototype(StructureTower);
    this.myTowers = towers.filter(s => s.my);
    this.enemyTowers = towers.filter(s => !s.my);

    const exts = getObjectsByPrototype(StructureExtension);
    this.myExts = exts.filter(s => s.my);
    this.enemyExts = exts.filter(s => !s.my);

    const ramps = getObjectsByPrototype(StructureRampart);
    this.myRamparts = ramps.filter(s => s.my);
    this.enemyRamparts = ramps.filter(s => !s.my);

    const constrSites = getObjectsByPrototype(ConstructionSite);
    this.myConstrSites = constrSites.filter(s => s.my && s.progress < s.progressTotal);
    this.enemyConstrSites = constrSites.filter(s => !s.my);

    this.containers = getObjectsByPrototype(StructureContainer).filter(c => c.store.energy > 0);
    this.swampContainers = getContainersInSwamp(this.containers);

    this.walls = getObjectsByPrototype(StructureWall).filter(w => w.hits > 0);
  }

  public static getInstance() {
    if (!Core.instance) {
      Core.instance = new Core();
    }
    return Core.instance;
  }

  public getSpawnEnergyAvailable(): number {
    let totalEnergy = 0;
    const mySpawnEnergy = this.mySpawn?.store.energy || 0;
    this.myExts.forEach(extension => {
      totalEnergy += extension.store.energy || 0;
    });
    return totalEnergy + mySpawnEnergy;
  }

  public getSpawnEnergyCapacity(): number {
    return this.mySpawn?.store.getCapacity(RESOURCE_ENERGY) || 0;
  }
}

/**
 * @returns The Core instance.
 */
export function getCore(): Core {
  return Core.getInstance();
}
