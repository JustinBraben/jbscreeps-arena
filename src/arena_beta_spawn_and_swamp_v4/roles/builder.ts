import { creepHadState, creepHasPart, setCreepStateAndRun } from 'common/lib/creep';
import { RESOURCE_ENERGY, WORK } from 'game/constants';
import { ConstructionSite, Creep, StructureContainer, StructureExtension, StructureRampart } from 'game/prototypes';
import { Core } from '../core';
import { createConstructionSite } from 'game/utils';

enum State {
  HarvestEnergy = 1,
  BuildSite = 2,
}

export function run(creep: Creep, core: Core) {
  switch (creep._state) {
    case State.HarvestEnergy: {
      runHarvestEnergy(creep, core);
      break;
    }
    case State.BuildSite: {
      runBuildSite(creep, core);
      break;
    }
    default: {
      setCreepStateAndRun(core, creep, State.HarvestEnergy, runHarvestEnergy);
      break;
    }
  }
}

export function runHarvestEnergy(creep: Creep, core: Core) {
  if (!creepHadState(creep, State.BuildSite) && creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    setCreepStateAndRun(core, creep, State.BuildSite, runBuildSite);
    return;
  }

  if (core.mySpawn.store.energy > 0) {
    if (creep.getRangeTo(core.mySpawn) > 1) {
      creep.moveTo(core.mySpawn);
      creep.withdraw(core.mySpawn, RESOURCE_ENERGY);
    } else if (creep.getRangeTo(core.mySpawn) === 1) {
      creep.withdraw(core.mySpawn, RESOURCE_ENERGY);
      // creep.moveTo(container);
    }
  }
}

export function runBuildSite(creep: Creep, core: Core) {
  if (!creepHadState(creep, State.HarvestEnergy) && !creep.store.energy) {
    setCreepStateAndRun(core, creep, State.HarvestEnergy, runHarvestEnergy);
    return;
  }

  createSpawnRamparts(core);

  const site = creep.findClosestByPath(core.myConstrSites);

  if (site) {
    if (site.x === core.mySpawn.x && site.y === core.mySpawn.y) {

    }
    else if (creep.x === site.x && creep.y === site.y && !(site.structure instanceof(StructureRampart))){
      creep.moveTo(site, { flee: true });
    } else if (creep.getRangeTo(site) > 1) {
      creep.moveTo(site);
    }

    build(creep, site);
  } else {
    const closestSwampContainer = creep.findClosestByPath(core.swampContainers);
    if (closestSwampContainer) {
      createForwardBase(core, closestSwampContainer);
    }
  }
}

function build(creep: Creep, target: ConstructionSite) {
  if (creepHasPart(creep, WORK)) {
    if (creep.getRangeTo(target) <= 3) {
      creep.build(target);
    }
  }
}

function createSpawnRamparts(core: Core) {
  for (const x of [-1, 0, 1]) {
    for (const y of [-1, 0, 1]) {
      // if (x === 0 && y === 0) continue;
      const existingRampartSite = core.myConstrSites.find(site => site.x === core.mySpawn.x + x && site.y === core.mySpawn.y + y && site.structure instanceof(StructureRampart));
      if (!existingRampartSite) {
        const createSiteResult = createConstructionSite({ x: core.mySpawn.x + x, y: core.mySpawn.y + y }, StructureRampart);
        if (createSiteResult.object) {
          console.log(`Site created: ${createSiteResult.object.id}`);
        } else if (createSiteResult.error) {
          console.log(`Site creation failed with error: ${createSiteResult.error}`);
        }
      }
    }
  }
}

function createForwardBase(core: Core, container: StructureContainer) {
  const existingRampartSite = core.myConstrSites.find(site => site.x === container.x && site.y === container.y && site.structure instanceof(StructureRampart));
  if (!existingRampartSite) {
    const createSiteResult = createConstructionSite({ x: container.x, y: container.y }, StructureRampart);
    if (createSiteResult.object) {
      console.log(`Site created: ${createSiteResult.object.id}`);
    } else if (createSiteResult.error) {
      console.log(`Site creation failed with error: ${createSiteResult.error}`);
    }
  }

  const existingExtensionSite1 = core.myConstrSites.find(site => site.x === container.x && site.y === container.y - 1 && site.structure instanceof(StructureExtension));
  if (!existingExtensionSite1) {
    const createSiteResult = createConstructionSite({ x: container.x, y: container.y - 1 }, StructureExtension);
    if (createSiteResult.object) {
      console.log(`Site created: ${createSiteResult.object.id}`);
    } else if (createSiteResult.error) {
      console.log(`Site creation failed with error: ${createSiteResult.error}`);
    }
  }

  const existingExtensionSite2 = core.myConstrSites.find(site => site.x === container.x && site.y === container.y + 1 && site.structure instanceof(StructureExtension));
  if (!existingExtensionSite2) {
    const createSiteResult = createConstructionSite({ x: container.x, y: container.y + 1 }, StructureExtension);
    if (createSiteResult.object) {
      console.log(`Site created: ${createSiteResult.object.id}`);
    } else if (createSiteResult.error) {
      console.log(`Site creation failed with error: ${createSiteResult.error}`);
    }
  }
}
