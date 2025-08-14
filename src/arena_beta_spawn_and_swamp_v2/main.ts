import {
  ATTACK,
  WORK,
  CARRY,
  MOVE,
  RANGED_ATTACK,
  TOUGH,
  HEAL,
  RESOURCE_ENERGY,
  ERR_NOT_IN_RANGE,
  OK,
  BODYPART_COST,
  BodyPartConstant,
  TERRAIN_WALL,
  ERR_INVALID_ARGS,
  ERR_INVALID_TARGET
} from "game/constants";
import {
  Creep,
  GameObject,
  StructureSpawn,
  StructureContainer,
  Source,
  ConstructionSite,
  Position,
  Resource,
  StructureExtension,
  StructureWall,
  StructureRampart
} from "game/prototypes";
import {
  getDirection,
  getObjectsByPrototype,
  getRange,
  getTicks,
  createConstructionSite,
  getTerrainAt,
  findPath
} from "game/utils";
import { searchPath } from "game/path-finder";
import { Visual } from "game/visual";
import { Role } from 'common/enums/role';
import { debugExtensionPlaceholders } from "common/visual/debugVisual";
import { DefaultFindPathOptions, DefaultFleeFindPathOptions } from "common/constants";

// Extend the Creep interface with our custom properties
declare module "game/prototypes" {
  interface Creep {
    initialPos: Position;
    role: Role;
    targetId: Id<StructureContainer> | undefined;
    working: boolean;
    buildingSwampExtensions?: boolean;  // New flag for swamp building mode
    swampContainerId?: string;          // Track which container we're working with
  }
}

// Global variables for game state
let mySpawn: StructureSpawn;
let enemySpawn: StructureSpawn;
let myCreeps: Creep[];
let enemyCreeps: Creep[];
let containers: StructureContainer[];
let swampContainers: StructureContainer[];
let myExtensions: StructureExtension[];
let constructionSites: ConstructionSite[];
let walls: StructureWall[];
let enemyRamparts: StructureRampart[];
let globalVisual: Visual = new Visual(10, true);
let roleCounts = new Map<Role, number>();

// Body templates for different roles
const BODIES: Record<Role, BodyPartConstant[]> = {
  [Role.HAULER]: [CARRY, CARRY, MOVE],
  [Role.BUILDER]: [
    WORK, CARRY, MOVE,     // 200 energy
    WORK, CARRY, MOVE,     // 200 energy
    MOVE, MOVE, MOVE,     // 200 energy
    // WORK, CARRY, MOVE,      // 200 energy
    // MOVE, MOVE, MOVE,
  ],  // Total: 800 energy cost, 200 carry capacity
  // [Role.MELEE]: [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK],
  // [Role.MELEE]: [TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE,],
  [Role.MELEE]: [TOUGH, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, MOVE],
  [Role.RANGED]: [
    TOUGH, MOVE, MOVE,
    MOVE, RANGED_ATTACK, RANGED_ATTACK,     // 150 energy
    RANGED_ATTACK, MOVE
  ],
  [Role.HEALER]: [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL]
};

// Main game loop
export function loop(): void {
  // Update global game state
  updateGameState();

  // Display visual information
  displayVisuals();

  // Spawn logic
  handleSpawning();

  // Run creep logic based on roles
  myCreeps.forEach(creep => {
    if (!creep.role) {
      assignRole(creep);
    }

    switch (creep.role) {
      case Role.HAULER:
        runHauler(creep);
        break;
      case Role.BUILDER:
        runBuilder(creep);
        break;
      case Role.MELEE:
        runMeleeAttacker(creep);
        break;
      case Role.RANGED:
        runRangedAttacker(creep);
        break;
      case Role.HEALER:
        runHealer(creep);
        break;
    }
  });

  // Construction site planning
  if (getTicks() % 50 === 0) {
    planConstructionSites();
  }
}

// All things we want to get every tick should be saved here
function updateGameState(): void {
  let personalSpawn = getObjectsByPrototype(StructureSpawn).find(s => s.my);
  if (personalSpawn !== undefined) {
    mySpawn = personalSpawn;
  }
  let otherSpawn = getObjectsByPrototype(StructureSpawn).find(s => !s.my);
  if (otherSpawn !== undefined) {
    enemySpawn = otherSpawn;
  }
  myCreeps = getObjectsByPrototype(Creep).filter(c => c.my);
  enemyCreeps = getObjectsByPrototype(Creep).filter(c => !c.my);
  containers = getObjectsByPrototype(StructureContainer);
  swampContainers = containers.filter(c =>
    c.x > 13 && c.x < 86 && hasWorkToDo(c) && mySpawn.getRangeTo(c) <= enemySpawn.getRangeTo(c)
  );
  myExtensions = getObjectsByPrototype(StructureExtension).filter(c => c.my);
  constructionSites = getObjectsByPrototype(ConstructionSite).filter(c => c.my && c.exists && c.progress < c.progressTotal);
  walls = getObjectsByPrototype(StructureWall);
  enemyRamparts = getObjectsByPrototype(StructureRampart).filter(c => !c.my);

  globalVisual.clear();
}

// Use the globalVisual to display
// Avoids needless new Visual() every frame
function displayVisuals(): void {
  if (!mySpawn) return;

  // Display creep roles and health
  myCreeps.forEach(creep => {
    globalVisual.text(
      `${creep.role} ${creep.hits}/${creep.hitsMax}`,
      { x: creep.x, y: creep.y - 0.5 },
      {
        font: "0.4",
        opacity: 0.7,
        backgroundColor: getRoleColor(creep.role),
        backgroundPadding: 0.03
      }
    );
  });

  // Display spawn energy AND total energy
  const totalEnergy = getTotalSpawnEnergy();
  globalVisual.text(
    `Energy: ${mySpawn.store.energy}/${totalEnergy}`,
    { x: mySpawn.x, y: mySpawn.y - 1 },
    {
      font: "0.5",
      opacity: 0.8,
      backgroundColor: "#FFD700",
      backgroundPadding: 0.05
    }
  );

  debugExtensionPlaceholders(globalVisual, containers, mySpawn);
}

function getRoleColor(role: Role): string {
  switch (role) {
    case Role.HAULER: return "#FFA500";
    case Role.BUILDER: return "#8B4513";
    case Role.MELEE: return "#FF0000";
    case Role.RANGED: return "#FF69B4";
    case Role.HEALER: return "#00FF00";
    default: return "#808080";
  }
}

function assignRole(creep: Creep): void {
  // Assign role based on body parts
  if (!creep.initialPos) {
    creep.initialPos = { x: creep.x, y: creep.y };
  }

  if (creep.body.some(p => p.type === HEAL)) {
    creep.role = Role.HEALER;
  } else if (creep.body.some(p => p.type === RANGED_ATTACK)) {
    creep.role = Role.RANGED;
  } else if (creep.body.some(p => p.type === ATTACK)) {
    creep.role = Role.MELEE;
  } else if (creep.body.filter(p => p.type === CARRY).length >= 2) {
    creep.role = Role.HAULER;
  } else if (creep.body.some(p => p.type === WORK)) {
    creep.role = Role.BUILDER;
  }
}

function handleSpawning(): void {
  let builderCount = 0;
  let meleeCount = 0;
  let rangedCount = 0;
  let healerCount = 0;
  let haulerCount = 0;

  myCreeps.forEach(c => {
    switch (c.role) {
      case Role.BUILDER:
        builderCount += 1;
        break;
      case Role.MELEE:
        meleeCount += 1;
        break;
      case Role.RANGED:
        rangedCount += 1;
        break;
      case Role.HEALER:
        healerCount += 1;
        break;
      case Role.HAULER:
        haulerCount += 1;
        break;
      default:
        break;
    }
  });

  roleCounts.set(Role.BUILDER, builderCount);
  roleCounts.set(Role.MELEE, meleeCount);
  roleCounts.set(Role.RANGED, rangedCount);
  roleCounts.set(Role.HEALER, healerCount);
  roleCounts.set(Role.HAULER, haulerCount);

  // Get total available energy (spawn + extensions)
  const totalEnergy = getTotalSpawnEnergy();

  // // Spawning priorities
  // const spawnPriorities: Array<{ role: Role; max: number }> = [
  //   { role: Role.HAULER, max: 2 },
  //   { role: Role.MELEE, max: 5 },
  //   { role: Role.RANGED, max: 1 },
  //   { role: Role.HEALER, max: 1 },
  //   { role: Role.RANGED, max: 2 },
  //   { role: Role.HEALER, max: 2 },
  //   { role: Role.RANGED, max: 5 },
  //   { role: Role.HEALER, max: 5 },
  //   { role: Role.BUILDER, max: 1 },
  //   { role: Role.HAULER, max: 3 },
  //   { role: Role.RANGED, max: 20 },
  //   { role: Role.HEALER, max: 20 },
  //   { role: Role.MELEE, max: 10 },
  //   { role: Role.HAULER, max: 6 },
  //   { role: Role.BUILDER, max: 4 },
  //   { role: Role.RANGED, max: 30 },
  //   { role: Role.HEALER, max: 30 },
  //   { role: Role.MELEE, max: 30 },
  // ];

  // Spawning priorities
  const spawnPriorities: Array<{ role: Role; max: number }> = [
    { role: Role.HAULER, max: 2 },
    { role: Role.BUILDER, max: 1 },
    { role: Role.MELEE, max: 4 },
    { role: Role.HEALER, max: 5 },
    { role: Role.RANGED, max: 30 },
    { role: Role.HEALER, max: 30 },
    { role: Role.RANGED, max: 30 },
    { role: Role.HEALER, max: 30 },
    { role: Role.BUILDER, max: 4 },
    { role: Role.MELEE, max: 30 },
    { role: Role.HAULER, max: 4 },
  ];

  if (!mySpawn || mySpawn.spawning) return;

  for (const priority of spawnPriorities) {
    const currentCount = roleCounts.get(priority.role) || 0;
    if (currentCount < priority.max) {
      const cost = getCreepRoleEnergyCost(priority.role);

      if (totalEnergy >= cost) {
        const body = BODIES[priority.role];
        const result = mySpawn.spawnCreep(body);
        if (result.object) {
          result.object.role = priority.role;
          result.object.initialPos = { x: mySpawn.x, y: mySpawn.y };
          console.log(`Spawning ${priority.role} (Energy: ${totalEnergy}/${cost})`);
        }
        break;
      }
    }
  }
}

function runHauler(creep: Creep): void {
  if (mySpawn === null || mySpawn === undefined) return;

  // Toggle working state
  if (creep.working && creep.store.energy === 0) {
    creep.working = false;
  } else if (!creep.working && creep.store.getFreeCapacity('energy') === 0) {
    creep.working = true;
  }

  // Stay away from enemies
  const nearbyEnemies = enemyCreeps.filter(e => getRange(e, creep) < 8);
  if (nearbyEnemies.length >= 2) {
    flee(creep, nearbyEnemies, 8);
    return;
  }

  if (!creep.working) {
    // // Pick up energy from containers or dropped resources
    // const droppedEnergy = getObjectsByPrototype(Resource)
    //   .sort((a, b) => getRange(a, creep) - getRange(b, creep))[0];

    const targetContainer = creep.findClosestByPath(
      containers.filter(c => c.store.energy > 0)
    );
    const haulerFreeCapacity = creep.store.getFreeCapacity('energy');

    if (haulerFreeCapacity !== null && haulerFreeCapacity > 0 && targetContainer) {
      moveWithinRange(creep, targetContainer, 1);
      if (creep.getRangeTo(targetContainer) < 2) creep.withdraw(targetContainer, 'energy');
    }
  } else {
    // Deliver energy - Prioritize closest extension with free capacity
    // otherwise attempt to deliver to spawn
    // At the start of the game the spawn fills up quickly, then once starting
    // containers are depleted haulers shouldn't be transferring energy to the spawn anymore ideally
    // as the spawning containers and my extensions will be in the middle swamp area

    // Find the closest structure that needs energy
    const myNotFullExtensions = myExtensions
      .filter(extension => {
        const extensionStore = extension.store;
        const extensionStoreFreeCapacity = extensionStore.getFreeCapacity('energy');
        return extensionStore !== null && extensionStore !== undefined && extensionStoreFreeCapacity !== null && extensionStoreFreeCapacity > 0;
      }
    );
    const myClosestExtension = creep.findClosestByPath(myNotFullExtensions);
    // DEBUG
    // console.log(`myExtensions.length: ${myExtensions.length}`);
    // console.log(`myNotFullExtensions.length: ${myNotFullExtensions.length}`);
    // console.log(`myExtensionFreeCapacity: ${myExtensionFreeCapacity}`);
    // console.log(`mySpawnStoreFreeCapacity: ${mySpawnStoreFreeCapacity}`);

    const mySpawnFreeCapacity = mySpawn.store.getFreeCapacity('energy');

    if (mySpawnFreeCapacity !== null && mySpawnFreeCapacity !== undefined && mySpawnFreeCapacity > 0) {
      moveWithinRange(creep, mySpawn, 1);
      if (creep.getRangeTo(mySpawn) < 2) creep.transfer(mySpawn, 'energy');
    } else if(myClosestExtension !== null) {
      moveWithinRange(creep, myClosestExtension, 1);
      if (creep.getRangeTo(myClosestExtension) < 2) creep.transfer(myClosestExtension, 'energy');
    }

    // if (myClosestExtension !== null) {
    //   moveWithinRange(creep, myClosestExtension, 1);
    //   if (creep.getRangeTo(myClosestExtension) < 2) creep.transfer(myClosestExtension, 'energy');
    // } else {
    //   const mySpawnFreeCapacity = mySpawn.store.getFreeCapacity('energy');
    //   if (mySpawnFreeCapacity !== null && mySpawnFreeCapacity !== undefined && mySpawnFreeCapacity > 0){
    //     moveWithinRange(creep, mySpawn, 1);
    //     if (creep.getRangeTo(mySpawn) < 2) creep.transfer(mySpawn, 'energy');
    //   }
    // }
  }
}

function runBuilder(creep: Creep): void {
  // Toggle working state based on energy
  if (creep.working && creep.store.energy === 0) {
    creep.working = false;
    creep.targetId = undefined; // Clear target when empty
  } else if (!creep.working && creep.store.getFreeCapacity('energy') === 0) {
    creep.working = true;
  }

  if (creep.working) {
    // Phase 1: Build spawn rampart if it doesn't exist
    const spawnRampart = constructionSites.find(site =>
      site.structure instanceof StructureRampart &&
      site.x === mySpawn.x &&
      site.y === mySpawn.y
    );

    if (spawnRampart) {
      moveWithinRange(creep, spawnRampart, 2);
      if (creep.x === spawnRampart.x && creep.y === spawnRampart.y) moveWithinRange(creep, mySpawn, 1);
      creep.build(spawnRampart);
      return;
    }

    // Phase 2: Work on swamp container extensions
    handleSwampExtensionBuilding(creep);

  } else {
    // Harvest energy
    harvestEnergy(creep);
  }
}

function handleSwampExtensionBuilding(creep: Creep): void {
  // Stay away from enemies
  const nearbyEnemies = enemyCreeps.filter(e => getRange(e, creep) < 8);
  if (nearbyEnemies.length >= 1) {
    // flee(creep, nearbyEnemies, 8);
    moveWithinRange(creep, mySpawn, 2);
    return;
  }

  // Find target container (either previously selected or find new one)
  let targetContainer: StructureContainer | undefined;

  if (creep.targetId) {
    targetContainer = containers.find(c => c.exists && c.id === creep.targetId);
  }

  // If no target or target is depleted, find a new swamp container
  if (!targetContainer || !hasWorkToDo(targetContainer)) {
    targetContainer = findBestSwampContainer(creep) || undefined;
    if (targetContainer) {
      creep.targetId = targetContainer.id;
    }
  }

  // First priority: Fill existing extensions near this container
  const nearbyExtensions = myExtensions.filter(ext => {
    const extStore = ext.store;
    const extStoreFreeCapacity = extStore.getFreeCapacity('energy');
    return targetContainer !== undefined && getRange(ext, targetContainer) <= 2 && extStore !== null && extStore !== undefined && extStoreFreeCapacity !== null && extStoreFreeCapacity > 0
  });

  if (nearbyExtensions.length > 0) {
    const extension = nearbyExtensions[0];
    moveWithinRange(creep, extension, 2);
    if (creep.x === extension.x && creep.y === extension.y) moveWithinRange(creep, mySpawn, 3);
    if (creep.getRangeTo(extension) < 2) {
      let transferRes = creep.transfer(extension, 'energy');
      console.log(`Builder Transfer result: ${transferRes}`);
      return;
    }
  }

  if (!targetContainer) {
    // No swamp containers need work, help with other construction
    console.log(`No target container, building other sites...`)
    buildOtherConstructionSites(creep);
    return;
  }

  // Second priority: Build construction sites near this container
  const nearbyConstructionSites = constructionSites.filter(site =>
    targetContainer !== undefined && getRange(site, targetContainer) <= 2
  );

  if (nearbyConstructionSites.length > 0) {
    const site = nearbyConstructionSites[0];
    moveWithinRange(creep, site, 2);
    if (creep.x === site.x && creep.y === site.y) moveWithinRange(creep, mySpawn, 3);
    if (creep.getRangeTo(site) <= 2) {
      const buildResult = creep.build(site);
      console.log(`Builder ${creep.id}, nearbyConstructionSites, build result: ${buildResult}`);
      if (buildResult == ERR_INVALID_TARGET) site.remove();
    }
    return;
  }

  // Third priority: Create new extension construction sites if needed
  if (countNearbyExtensionsAndSites(targetContainer) < 3) {
    createExtensionSites(targetContainer);
  }
}

function harvestEnergy(creep: Creep): void {
  // Stay away from enemies
  const nearbyEnemies = enemyCreeps.filter(e => getRange(e, creep) < 8);
  if (nearbyEnemies.length >= 1) {
    // flee(creep, nearbyEnemies, 8);
    moveWithinRange(creep, mySpawn, 2);
    return;
  }

  // If we have a target container, harvest from it
  if (creep.targetId) {
    const targetContainer = containers.find(c => c.id === creep.targetId);
    if (targetContainer && targetContainer.store.energy > 0) {
      moveWithinRange(creep, targetContainer, 1);
      if (creep.x === targetContainer.x && creep.y === targetContainer.y) moveWithinRange(creep, mySpawn, 1);
      if (creep.getRangeTo(targetContainer) < 2) creep.withdraw(targetContainer, 'energy');
      // if (creep.withdraw(targetContainer, 'energy') === ERR_NOT_IN_RANGE) {
      //   creep.moveTo(targetContainer);
      // }
      // return;
    }
  }

  // Otherwise, find closest container with energy
  const containerWithEnergy = creep.findClosestByPath(
    containers.filter(c => c.store.energy > 0)
  );

  if (containerWithEnergy) {
    moveWithinRange(creep, containerWithEnergy, 1);
    if (creep.x === containerWithEnergy.x && creep.y === containerWithEnergy.y) moveWithinRange(creep, mySpawn, 1);
    if (creep.getRangeTo(containerWithEnergy) < 2) creep.withdraw(containerWithEnergy, 'energy');
  }
}

function findBestSwampContainer(creep: Creep): StructureContainer | null {
  // Find swamp containers that need work (either need extensions built or filled)
  // const swampContainers = containers.filter(c =>
  //   c.x > 13 && c.x < 86 && hasWorkToDo(c) && mySpawn.getRangeTo(c) <= enemySpawn.getRangeTo(c)
  // );

  // Sort by closest
  return creep.findClosestByPath(swampContainers, DefaultFindPathOptions);
}

function hasWorkToDo(container: StructureContainer): boolean {
  // Check if container area needs work:
  // 1. Has unfilled extensions
  // 2. Has construction sites
  // 3. Needs more extensions (< 3 total)

  const nearbyExtensions = myExtensions.filter(ext =>
    getRange(ext, container) <= 2
  );

  const hasUnfilledExtensions = nearbyExtensions.some(ext => {
    const extStore = ext.store;
    const extStoreFreeCapacity = extStore.getFreeCapacity('energy');
    return extStore !== null && extStore !== undefined && extStoreFreeCapacity !== null && extStoreFreeCapacity > 0
  });

  const nearbyConstructionSites = constructionSites.filter(site =>
    getRange(site, container) <= 2
  );

  const totalExtensionsAndSites = nearbyExtensions.length + nearbyConstructionSites.length;

  return hasUnfilledExtensions ||
         nearbyConstructionSites.length > 0 ||
         totalExtensionsAndSites < 3;
}

function countNearbyExtensionsAndSites(container: StructureContainer): number {
  const nearbyExtensions = myExtensions.filter(ext =>
    getRange(ext, container) <= 2
  );

  const nearbyConstructionSites = constructionSites.filter(site =>
    getRange(site, container) <= 2
  );

  return nearbyExtensions.length + nearbyConstructionSites.length;
}

function createExtensionSites(container: StructureContainer): void {
  if (!mySpawn) return;

  let offsetX: number = 0;
  // Extensions placed on either side depending on closest Spawn point
  if (mySpawn.x === 94) offsetX = 1;
  if (mySpawn.x === 5) offsetX = -1;

  for (const offsetY of [-1, 0, 1]) {
    const pos: Position = {
      x: container.x + offsetX,
      y: container.y + offsetY
    };

    // Check if site already exists at this position
    const existingSite = constructionSites.find(s =>
      s.x === pos.x && s.y === pos.y
    );

    // Check if extension already exists at this position
    const existingExtension = myExtensions.find(ext =>
      ext.x === pos.x && ext.y === pos.y
    );

    const terrainTile = getTerrainAt(pos);

    if (!existingSite && !existingExtension && terrainTile !== TERRAIN_WALL) {
      createConstructionSite(pos, StructureExtension);
      break; // Only create one at a time
    }
  }

  // TODO: Remove construction site if
  // no resource container is beside it anymore
  for (let site of constructionSites) {
    const containerNearSite = containers.filter(c => c.x > 13 && c.x < 86).find(c => getRange(c, site) <= 1);
    if (!containerNearSite && site.progress === 0) {
      site.remove();
    }
  }
}

function buildOtherConstructionSites(creep: Creep): void {
  // Fallback to building any construction sites
  const site = constructionSites
    .sort((a, b) => {
      // Prioritize sites near spawn
      const aDist = mySpawn ? getRange(a, mySpawn) : 100;
      const bDist = mySpawn ? getRange(b, mySpawn) : 100;

      // If both are close to spawn, prioritize by progress
      if (aDist < 10 && bDist < 10) {
        return (b.progress / b.progressTotal) - (a.progress / a.progressTotal);
      }

      // Otherwise prioritize by distance
      if (aDist !== bDist) return aDist - bDist;
      return getRange(a, creep) - getRange(b, creep);
    })[0];

  if (site) {
    if (creep.x === site.x && creep.y === site.y) moveWithinRange(creep, mySpawn, 1);
    moveWithinRange(creep, site, 2);
    if (creep.getRangeTo(site) <= 2) {
      const buildResult = creep.build(site);
      console.log(`Builder ${creep.id}, buildOtherConstructionSites, build result: ${buildResult}`);
      if (buildResult == ERR_INVALID_TARGET) site.remove();
    }

    // if (creep.build(site) === ERR_NOT_IN_RANGE) {
    //   creep.moveTo(site);
    // }
  }
}


// New function to handle swamp extension building
function runSwampExtensionBuilder(creep: Creep): void {
  const targetContainer = containers.find(c => c.id === creep.swampContainerId);

  if (!targetContainer) {
    // Container no longer exists, exit this mode
    creep.buildingSwampExtensions = false;
    creep.swampContainerId = undefined;
    return;
  }

  // Calculate energy needed for 1 extensions (4 * 50 = 200)
  const energyNeededForExtensions = 200;

  // Phase 1: Gather energy from container
  if (creep.store.energy < energyNeededForExtensions) {
    if (getRange(creep, targetContainer) > 1) {
      creep.moveTo(targetContainer);
    } else {
      // Withdraw enough energy for 3 extensions
      const withdrawAmount = Math.min(
        energyNeededForExtensions - creep.store.energy,
        targetContainer.store.energy,
        creep.store.getFreeCapacity('energy')!
      );
      creep.withdraw(targetContainer, RESOURCE_ENERGY, withdrawAmount);
    }
    return;
  }

  // Phase 2: Build extensions near this container
  let nearbyConstructionSites = constructionSites.filter(site =>
    getRange(site, targetContainer) <= 2
  );

  if (nearbyConstructionSites.length === 0) {
    let offsetX: number = 0;

    // Extensions placed on either side depending on closest Spawn point
    if (mySpawn.x === 94) offsetX = 1;
    if (mySpawn.x === 5) offsetX = -1;

    for (const offsetY of [-1, 0, 1]){
      const pos: Position = { x: targetContainer.x + offsetX, y: targetContainer.y + offsetY };
      const existingSite = constructionSites.find(s => mySpawn !== undefined && s.x === pos.x && s.y === pos.y);
      let outsideSite = null;
      if (existingSite === undefined) {
        outsideSite = createConstructionSite(pos, StructureExtension).object;
      } else {
        // DEBUG
        console.log(`Site already exists existingSite: ${existingSite.id}`);
      }
    }
  }

  nearbyConstructionSites = constructionSites.filter(site =>
    getRange(site, targetContainer) <= 2
  );

  if (nearbyConstructionSites.length > 0) {
    // Build the closest construction site
    const site = nearbyConstructionSites[0];
    if (creep.build(site) === ERR_NOT_IN_RANGE) {
      creep.moveTo(site);
    }

    // If we run out of energy, go back to gathering
    if (creep.store.energy === 0) {
      // Check if there's still energy in the container
      if (targetContainer.store.energy < 50) {
        // Container is depleted, exit swamp building mode
        creep.buildingSwampExtensions = false;
        creep.swampContainerId = undefined;
      }
    }
  } else {
    // No more construction sites near this container, exit mode
    creep.buildingSwampExtensions = false;
    creep.swampContainerId = undefined;
  }
}

function runMeleeAttacker(creep: Creep): void {
  if (creep === null || creep === undefined) return;

  const target = enemyCreeps
    .sort((a, b) => getRange(a, creep) - getRange(b, creep)).find(e => e);

  const nearestWall = creep.findClosestByPath(walls);
  const nearestEnemyRampart = creep.findClosestByPath(enemyRamparts);

  if (target !== null && target !== undefined && creep.getRangeTo(target) < 10) {
    moveWithinRange(creep, target, 1);
    if (creep.getRangeTo(target) < 2) creep.attack(target);
  } else if (nearestEnemyRampart && creep.getRangeTo(nearestEnemyRampart) < 5) {
    moveWithinRange(creep, nearestEnemyRampart, 1);
    if (creep.getRangeTo(nearestEnemyRampart) < 2) creep.attack(nearestEnemyRampart);
  } else if (creep.getRangeTo(enemySpawn) < 5) {
    moveWithinRange(creep, enemySpawn, 1);
    if (creep.getRangeTo(enemySpawn) < 2) creep.attack(enemySpawn);
  } else if (nearestWall) {
    moveWithinRange(creep, nearestWall, 1);
    if (creep.getRangeTo(nearestWall) < 2) creep.attack(nearestWall);
  } else if (creep.initialPos) {
    // Return to initial position if no targets
    moveWithinRange(creep, creep.initialPos, 3);
  } else {
    moveWithinRange(creep, enemySpawn, 1);
    if (creep.getRangeTo(enemySpawn) < 2) creep.attack(enemySpawn);
  }
}

function runRangedAttacker(creep: Creep): void {
  const targets = enemyCreeps.sort((a, b) => getRange(a, creep) - getRange(b, creep));
  // const myRanged = myCreeps.filter(c => c.role === Role.RANGED && c !== creep);

  if (targets.length > 0) {
    const target = targets[0];
    const range = getRange(target, creep);

    if (range <= 3) {
      creep.rangedAttack(target);
    }

    // moveWithinRange(creep, target, 3);
    // const fleePath = searchPath(creep, targets, DefaultFleeFindPathOptions);

    // Kite: maintain distance of 3
    if (range < 3) {
      // if (getRange(creep, target) > 3) {
      //   creep.moveTo(target, DefaultFleeFindPathOptions);
      // }
      creep.moveTo(target, DefaultFleeFindPathOptions);
    } else if (range > 3) {
      moveWithinRange(creep, target, 3);
    }
  } else if (enemySpawn) {
    const range = getRange(enemySpawn, creep);
    if (range <= 3) {
      creep.rangedAttack(enemySpawn);
    } else {
      moveWithinRange(creep, enemySpawn, 3);
    }
  }
}

function runHealer(creep: Creep): void {
  // Find damaged allies
  const healTargets = myCreeps
    .filter(c => c.hits < c.hitsMax)
    .sort((a, b) => {
      // Prioritize low health
      const healthRatio = (a.hits / a.hitsMax) - (b.hits / b.hitsMax);
      if (Math.abs(healthRatio) > 0.1) return healthRatio;
      // Then by distance
      return getRange(a, creep) - getRange(b, creep);
    });

  if (healTargets.length > 0) {
    const target = healTargets[0];
    const range = getRange(target, creep);



    if (range <= 1) {
      creep.heal(target);
    } else if (range <= 3) {
      creep.rangedHeal(target);
      creep.moveTo(target);
    } else {
      creep.moveTo(target);
    }
  } else {
    // Follow attackers
    const attacker = myCreeps
      .filter(c => c.role === Role.RANGED || c.role === Role.MELEE)
      .sort((a, b) => getRange(a, creep) - getRange(b, creep))[0];

    if (attacker && getRange(attacker, creep) > 2) {
      creep.moveTo(attacker);
    }
  }

  // Stay away from enemies
  const nearbyEnemies = enemyCreeps.filter(e => getRange(e, creep) < 5);
  if (nearbyEnemies.length > 3) {
    flee(creep, nearbyEnemies, 5);
  }
}

function flee(creep: Creep, threats: GameObject[], range: number): void {
  const result = searchPath(
    creep,
    threats.map(t => ({ pos: t, range })),
    { flee: true }
  );

  if (result.path.length > 0) {
    const direction = getDirection(
      result.path[0].x - creep.x,
      result.path[0].y - creep.y
    );
    creep.move(direction);
  }
}

function moveWithinRange(creep: Creep, otherPos: Position, idealRange: number): void {
  if (getRange(creep, otherPos) > idealRange) {
    creep.moveTo(otherPos);
  }
}

// First few construction sites are hardcoded
// Then it looks at containers in the swamp area to build construction sites next for quicker mining
function planConstructionSites(): void {
  if (mySpawn === null || mySpawn === undefined) return;

  // const existingSite1 = constructionSites.find(s => mySpawn !== undefined && s.x === mySpawn.x && s.y === mySpawn.y + 2);
  // let constructSite1 = null;
  // if (existingSite1 === undefined){
  //   constructSite1 = createConstructionSite({x: mySpawn.x, y: mySpawn.y + 2}, StructureExtension).object;
  // }

  // const existingSite2 = constructionSites.find(s => mySpawn !== undefined && s.x === mySpawn.x && s.y === mySpawn.y - 2);
  // let constructSite2 = null;
  // if (existingSite2 === undefined){
  //   constructSite2 = createConstructionSite({x: mySpawn.x, y: mySpawn.y - 2}, StructureExtension).object;
  // }

  const existingSpawnRampart = constructionSites.find(s => mySpawn !== undefined && s.structure instanceof(StructureRampart) && s.x === mySpawn.x && s.y === mySpawn.y);
  if (!existingSpawnRampart) {
    // Check if rampart already exists
    const ramparts = getObjectsByPrototype(StructureRampart).filter(r => r.my);
    const spawnRampartExists = ramparts.some(r =>
      r.x === mySpawn.x && r.y === mySpawn.y
    );

    if (!spawnRampartExists) {
      createConstructionSite(
        { x: mySpawn.x, y: mySpawn.y },
        StructureRampart
      );
    }
  }

  // const existingSite3 = constructionSites.find(s => mySpawn !== undefined && s.x === mySpawn.x && s.y === mySpawn.y + 5);
  // let constructSite3 = null;
  // if (existingSite3 === undefined){
  //   constructSite3 = createConstructionSite({x: mySpawn.x, y: mySpawn.y + 5}, StructureExtension).object;
  // }

  // const existingSite4 = constructionSites.find(s => mySpawn !== undefined && s.x === mySpawn.x && s.y === mySpawn.y - 5);
  // let constructSite4 = null;
  // if (existingSite4 === undefined){
  //   constructSite4 = createConstructionSite({x: mySpawn.x, y: mySpawn.y - 5}, StructureExtension).object;
  // }

  // Plan extensions near containers
  // When you do this, often no miner will get to it before it decays
  // So should only walk to inner swamp container, mine from it then create the Extensions to ensure
  // they actually get created
  // for (const container of swampContainers) {
  //   // Only care about containers in the swamp area
  //   if (container.x < 13 || container.x > 86) continue;

  //   let offsetX: number = 0;

  //   // Extensions placed on either side depending on closest Spawn point
  //   if (mySpawn.x === 94) offsetX = 1;
  //   if (mySpawn.x === 5) offsetX = -1;

  //   for (const offsetY of [-1, 0, 1]){
  //     const pos: Position = { x: container.x + offsetX, y: container.y + offsetY };
  //     const existingSite = constructionSites.find(s => mySpawn !== undefined && s.x === pos.x && s.y === pos.y);
  //     let outsideSite = null;
  //     if (existingSite === undefined) {
  //       outsideSite = createConstructionSite(pos, StructureExtension).object;
  //     } else {
  //       // DEBUG
  //       console.log(`Site already exists existingSite: ${existingSite.id}`);
  //     }
  //   }
  // }

  // // TODO: Remove construction site if
  // // no resource container is beside it anymore
  // for (let site of constructionSites) {
  //   const containerNearSite = containers.filter(c => c.x > 13 && c.x < 86).find(c => getRange(c, site) <= 1);
  //   if (!containerNearSite) {
  //     site.remove();
  //   }
  // }
}

// ============================================
// Helper Functions
// ============================================

// Helper function to calculate total available energy for spawning
function getTotalSpawnEnergy(): number {
  if (!mySpawn) return 0;

  // Spawn's energy + all extensions' energy
  let total = mySpawn.store.energy || 0;

  myExtensions.forEach(ext => {
    total += ext.store.energy || 0;
  });

  return total;
}

// Helper function to check if initial extensions are built
function checkInitialExtensionsBuilt(): boolean {
  if (!mySpawn) return false;

  // Check if the 2 initial extension sites near spawn are built
  const initialSites = constructionSites.filter(site =>
    getRange(site, mySpawn) <= 3
  );

  // // Also check if extensions exist at those positions
  // const extensionsNearSpawn = myExtensions.filter(ext =>
  //   getRange(ext, mySpawn) <= 3
  // );

  // // If we have at least 2 extensions near spawn and no construction sites, initial build is done
  // return extensionsNearSpawn.length >= 2 && initialSites.length === 0;

  return initialSites.length === 0;
}

// Helper function to find a swamp container with energy
function findSwampContainerWithEnergy(creep: Creep): StructureContainer | null {
  // Containers in swamp area (13 < x < 86) with enough energy
  const swampContainers = containers.filter(c =>
    c.x > 13 && c.x < 86
  );

  if (swampContainers.length === 0) return null;

  // Find closest one that doesn't already have extensions being built
  return creep.findClosestByRange(swampContainers.filter(c =>
    !hasNearbyExtensions(c) && !hasNearbyConstructionSites(c)
  ));
}

// Helper function to check if a container already has nearby extensions
function hasNearbyExtensions(container: StructureContainer): boolean {
  const nearbyExtensions = myExtensions.filter(ext =>
    getRange(ext, container) <= 2
  );
  return nearbyExtensions.length >= 3;
}

// Helper function to check if a container has nearby construction sites
function hasNearbyConstructionSites(container: StructureContainer): boolean {
  // Check if there are already 3 construction sites near this container
  const nearbySites = constructionSites.filter(site =>
    getRange(site, container) <= 2
  );
  return nearbySites.length >= 3;
}

// Helper function to get energy from spawn or extensions
function getEnergyFromSpawnOrExtensions(creep: Creep): void {
  if (!mySpawn) return;

  // Try spawn first
  if (mySpawn.store.energy >= 50) {
    if (creep.withdraw(mySpawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(mySpawn);
    }
    return;
  }

  // Try extensions with energy
  const extensionWithEnergy = myExtensions.find(ext => ext.store.energy >= 25);
  if (extensionWithEnergy) {
    if (creep.withdraw(extensionWithEnergy, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      creep.moveTo(extensionWithEnergy);
    }
    return;
  }

  // Fall back to hauler behavior
  runHauler(creep);
}

// Helper function to get energy cost to create creap
function getCreepRoleEnergyCost(role: Role): number {
  const body = BODIES[role];
  return body.reduce((sum, part) => sum + BODYPART_COST[part], 0);
}
