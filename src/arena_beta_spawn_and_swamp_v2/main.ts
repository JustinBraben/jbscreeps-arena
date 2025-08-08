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
  BodyPartConstant
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
  findPath
} from "game/utils";
import { searchPath } from "game/path-finder";
import { Visual } from "game/visual";
import { debugExtensionPlaceholders } from "common/visual/debugVisual";

// Define Role enum for better organization
enum Role {
  HARVESTER = "harvester",
  BUILDER = "builder",
  MELEE = "melee",
  RANGED = "ranged",
  HEALER = "healer",
  HAULER = "hauler"
}

// Extend the Creep interface with our custom properties
declare module "game/prototypes" {
  interface Creep {
    initialPos: Position;
    role: Role;
    targetId: string;
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
let sources: Source[];
let containers: StructureContainer[];
let myExtensions: StructureExtension[];
let constructionSites: ConstructionSite[];
let walls: StructureWall[];
let enemyRamparts: StructureRampart[];
let globalVisual: Visual = new Visual(10, true);

// Body templates for different roles
const BODIES: Record<Role, BodyPartConstant[]> = {
  [Role.HARVESTER]: [WORK, WORK, MOVE],
  [Role.HAULER]: [CARRY, CARRY, MOVE],
  [Role.BUILDER]: [
    WORK, CARRY, MOVE,     // 200 energy
    WORK, CARRY, MOVE,     // 200 energy
    WORK, CARRY, MOVE,     // 200 energy
    MOVE, CARRY, MOVE      // 200 energy
  ],  // Total: 800 energy cost, 200 carry capacity
  // [Role.MELEE]: [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK],
  // [Role.MELEE]: [TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE,],
  [Role.MELEE]: [TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE],
  [Role.RANGED]: [
    TOUGH, MOVE, MOVE,
    MOVE, MOVE, MOVE,     // 150 energy
    RANGED_ATTACK, MOVE
  ],
  [Role.HEALER]: [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL]
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
      case Role.HARVESTER:
        runHarvester(creep);
        break;
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
  sources = getObjectsByPrototype(Source);
  containers = getObjectsByPrototype(StructureContainer);
  myExtensions = getObjectsByPrototype(StructureExtension).filter(c => c.my);
  constructionSites = getObjectsByPrototype(ConstructionSite).filter(c => c.my && c.exists && c.progress < c.progressTotal);
  walls = getObjectsByPrototype(StructureWall);
  enemyRamparts = getObjectsByPrototype(StructureRampart).filter(c => !c.my);

  globalVisual.clear();
}

// Use the globalVisual to display
// Avoids needless new Visual() every frame
function displayVisuals(): void {
  // Display creep roles and health
  myCreeps.forEach(creep => {
    globalVisual.text(
      `${creep.role?.substring(0, 3).toUpperCase()} ${creep.hits}/${creep.hitsMax}`,
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
  if (mySpawn) {
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
}

function getRoleColor(role?: Role): string {
  switch (role) {
    case Role.HARVESTER: return "#FFFF00";
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
  } else if (creep.body.filter(p => p.type === WORK).length >= 2) {
    creep.role = Role.HARVESTER;
  } else if (creep.body.filter(p => p.type === CARRY).length >= 2) {
    creep.role = Role.HAULER;
  } else if (creep.body.some(p => p.type === WORK)) {
    creep.role = Role.BUILDER;
  }
}

// Add this helper function to calculate total available energy for spawning
function getTotalSpawnEnergy(): number {
  if (!mySpawn) return 0;

  // Spawn's energy + all extensions' energy
  let total = mySpawn.store.energy || 0;

  myExtensions.forEach(ext => {
    total += ext.store.energy || 0;
  });

  return total;
}

function handleSpawning(): void {
  if (!mySpawn || mySpawn.spawning) return;

  // Count creeps by role
  const roleCounts = new Map<Role, number>();
  for (const role of Object.values(Role)) {
    roleCounts.set(role as Role, 0);
  }
  myCreeps.forEach(c => {
    if (c.role) roleCounts.set(c.role, (roleCounts.get(c.role) || 0) + 1);
  });

  // Get total available energy (spawn + extensions)
  const totalEnergy = getTotalSpawnEnergy();

  // Spawning priorities
  const spawnPriorities: Array<{ role: Role; max: number }> = [
    // { role: Role.HARVESTER, max: Math.min(sources.length, 2) },
    { role: Role.HAULER, max: 1 },
    { role: Role.BUILDER, max: 1 },
    { role: Role.MELEE, max: 5 },
    { role: Role.RANGED, max: 5 },
    { role: Role.HEALER, max: 5 },
    { role: Role.HAULER, max: 3 },
    { role: Role.BUILDER, max: 2 },
    { role: Role.RANGED, max: 20 },
    { role: Role.HEALER, max: 20 },
    { role: Role.MELEE, max: 10 },
    { role: Role.HAULER, max: 6 },
    { role: Role.BUILDER, max: 4 },
    { role: Role.RANGED, max: 30 },
    { role: Role.HEALER, max: 30 },
    { role: Role.MELEE, max: 30 },
  ];

  for (const priority of spawnPriorities) {
    const currentCount = roleCounts.get(priority.role) || 0;
    if (currentCount < priority.max) {
      const body = BODIES[priority.role];
      const cost = body.reduce((sum, part) => sum + BODYPART_COST[part], 0);

      if (totalEnergy >= cost) {
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

// TODO: Remove, not used
// Must refactor to get rid of harvester role, only need hauler
function runHarvester(creep: Creep): void {
  // Find closest source without a harvester or the one assigned
  if (!creep.targetId || !sources.find(s => s.id === creep.targetId)) {
    const availableSources = sources.filter(source => {
      const harvestersOnSource = myCreeps.filter(c =>
        c.role === Role.HARVESTER &&
        c.targetId === source.id &&
        c.id !== creep.id
      );
      return harvestersOnSource.length === 0;
    });

    const target = availableSources.sort((a, b) =>
      getRange(a, creep) - getRange(b, creep)
    )[0] || sources[0];

    if (target) {
      creep.targetId = target.id;
    }
  }

  const source = sources.find(s => s.id === creep.targetId);
  if (source) {
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveTo(source);
    }
  }
}

function runHauler(creep: Creep): void {
  if (mySpawn === null || mySpawn === undefined) return;

  // Toggle working state
  if (creep.working && creep.store.energy === 0) {
    creep.working = false;
  } else if (!creep.working && creep.store.getFreeCapacity() === 0) {
    creep.working = true;
  }

  const targetContainer = creep.findClosestByRange(
    containers.filter(c => c.store.energy > 0)
  );
  const haulerFreeCapacity = creep.store.getFreeCapacity();

  if (!creep.working) {
    // // Pick up energy from containers or dropped resources
    // const droppedEnergy = getObjectsByPrototype(Resource)
    //   .sort((a, b) => getRange(a, creep) - getRange(b, creep))[0];

    const targetContainer = creep.findClosestByPath(
      containers.filter(c => c.store.energy > 0)
    );
    const haulerFreeCapacity = creep.store.getFreeCapacity();

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
    const haulerRange = creep.getRangeTo(mySpawn);
    const mySpawnStoreFreeCapacity = mySpawn.store.getFreeCapacity('energy');

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

    if (myClosestExtension !== null) {
      moveWithinRange(creep, myClosestExtension, 1);
      if (creep.getRangeTo(myClosestExtension) < 2) creep.transfer(myClosestExtension, 'energy');
    } else {
      const mySpawnFreeCapacity = mySpawn.store.getFreeCapacity('energy');
      if (mySpawnFreeCapacity !== null && mySpawnFreeCapacity !== undefined && mySpawnFreeCapacity > 0){
        moveWithinRange(creep, mySpawn, 1);
        if (creep.getRangeTo(mySpawn) < 2) creep.transfer(mySpawn, 'energy');
      }
    }
  }
}

function runBuilder(creep: Creep): void {
  // Check if we're in swamp extension building mode
  if (creep.buildingSwampExtensions) {
    runSwampExtensionBuilder(creep);
    return;
  }

  // Check if initial extensions near spawn are built
  const initialExtensionsBuilt = checkInitialExtensionsBuilt();

  // If initial extensions are done and we have no energy, look for swamp containers
  if (initialExtensionsBuilt && creep.store.energy === 0) {
    const swampContainer = findSwampContainerWithEnergy(creep);
    if (swampContainer && !hasNearbyExtensions(swampContainer)) {
      // Switch to swamp building mode
      creep.buildingSwampExtensions = true;
      creep.swampContainerId = swampContainer.id;
      creep.working = false;
      runSwampExtensionBuilder(creep);
      return;
    }
  }

  // Toggle working state
  if (creep.working && creep.store.energy === 0) {
    creep.working = false;
  } else if (!creep.working && creep.store.getFreeCapacity() === 0) {
    // Not considered working but full of energy, should set working
    // to start constructing
    creep.working = true;
  }

  if (creep.working) {
    // Build construction sites
    // TODO: Prioritize construction sites with more progress towards building
    const site = constructionSites
      .sort((a, b) => {
        // Prioritize sites near spawn
        const aDist = mySpawn ? getRange(a, mySpawn) : 100;
        const bDist = mySpawn ? getRange(b, mySpawn) : 100;

        // If both are close to spawn, prioritize by progress
        if (aDist < 10 && bDist < 10) {
          return (b.progress / b.progressTotal) - (a.progress / a.progressTotal);
        }

        // Otherwise prioritize by distance to spawn, then to creep
        if (aDist !== bDist) return aDist - bDist;
        return getRange(a, creep) - getRange(b, creep);
      })
      .find(c => c.my);

    if (site !== undefined) {
      // // DEBUG
      // console.log(`Builder ${creep.id} building ${site.id}`);
      moveWithinRange(creep, site, 3);
      if (creep.getRangeTo(site) < 4) creep.build(site);
    } else {
      // No construction sites, help with energy collection
      runHauler(creep);
    }
  } else {
    // Should harvest energy when not working
    // not working means it was working and ran out of energy to build
    // Get energy - prioritize spawn/extensions for initial building
    if (!initialExtensionsBuilt) {
      getEnergyFromSpawnOrExtensions(creep);
    } else {
      runHauler(creep);
    }
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

  // Calculate energy needed for 3 extensions (3 * 50 = 150)
  const energyNeededForExtensions = 150;

  // Phase 1: Gather energy from container
  if (creep.store.energy < energyNeededForExtensions) {
    if (getRange(creep, targetContainer) > 1) {
      creep.moveTo(targetContainer);
    } else {
      // Withdraw enough energy for 3 extensions
      const withdrawAmount = Math.min(
        energyNeededForExtensions - creep.store.energy,
        targetContainer.store.energy,
        creep.store.getFreeCapacity()!
      );
      creep.withdraw(targetContainer, RESOURCE_ENERGY, withdrawAmount);
    }
    return;
  }

  // Phase 2: Build extensions near this container
  const nearbyConstructionSites = constructionSites.filter(site =>
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

// Helper function to check if initial extensions are built
function checkInitialExtensionsBuilt(): boolean {
  if (!mySpawn) return false;

  // Check if the 2 initial extension sites near spawn are built
  const initialSites = constructionSites.filter(site =>
    getRange(site, mySpawn) <= 3
  );

  // Also check if extensions exist at those positions
  const extensionsNearSpawn = myExtensions.filter(ext =>
    getRange(ext, mySpawn) <= 3
  );

  // If we have at least 2 extensions near spawn and no construction sites, initial build is done
  return extensionsNearSpawn.length >= 2 && initialSites.length === 0;
}

// Helper function to find a swamp container with energy
function findSwampContainerWithEnergy(creep: Creep): StructureContainer | null {
  // Containers in swamp area (13 < x < 86) with enough energy
  const swampContainers = containers.filter(c =>
    c.x > 13 && c.x < 86 &&
    c.store.energy >= 150  // Enough for 3 extensions
  );

  if (swampContainers.length === 0) return null;

  // Find closest one that doesn't already have extensions being built
  return creep.findClosestByPath(swampContainers.filter(c =>
    !hasNearbyExtensions(c) && !hasNearbyConstructionSites(c)
  ));
}

// Helper function to check if a container already has nearby extensions
function hasNearbyExtensions(container: StructureContainer): boolean {
  return myExtensions.some(ext => getRange(ext, container) <= 2);
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

  if (targets.length > 0) {
    const target = targets[0];
    const range = getRange(target, creep);

    if (range <= 3) {
      creep.rangedAttack(target);
    }

    // Kite: maintain distance of 3
    if (range < 3) {
      flee(creep, [target], 3);
    } else if (range > 3) {
      creep.moveTo(target);
    }
  } else if (enemySpawn) {
    const range = getRange(enemySpawn, creep);
    if (range <= 3) {
      creep.rangedAttack(enemySpawn);
    } else {
      creep.moveTo(enemySpawn);
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
      .filter(c => c.role === Role.MELEE || c.role === Role.RANGED)
      .sort((a, b) => getRange(a, creep) - getRange(b, creep))[0];

    if (attacker && getRange(attacker, creep) > 2) {
      creep.moveTo(attacker);
    }
  }

  // Stay away from enemies
  const nearbyEnemies = enemyCreeps.filter(e => getRange(e, creep) < 5);
  if (nearbyEnemies.length > 0) {
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

  const existingSite1 = constructionSites.find(s => mySpawn !== undefined && s.x === mySpawn.x && s.y === mySpawn.y + 2);
  let constructSite1 = null;
  if (existingSite1 === undefined){
    constructSite1 = createConstructionSite({x: mySpawn.x, y: mySpawn.y + 2}, StructureExtension).object;
  }

  const existingSite2 = constructionSites.find(s => mySpawn !== undefined && s.x === mySpawn.x && s.y === mySpawn.y - 2);
  let constructSite2 = null;
  if (existingSite2 === undefined){
    constructSite2 = createConstructionSite({x: mySpawn.x, y: mySpawn.y - 2}, StructureExtension).object;
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

  // Plan containers near sources
  // When you do this, often no miner will get to it before it decays
  // So should only walk to inner swamp container, mine from it then create the Extensions to ensure
  // they actually get created
  for (const container of containers) {
    // Only care about containers in the swamp area
    if (container.x < 13 || container.x > 86) continue;

    let offsetX: number = 0;

    // Extensions placed on either side depending on closest Spawn point
    if (mySpawn.x === 94) offsetX = 1;
    if (mySpawn.x === 5) offsetX = -1;

    for (const offsetY of [-1, 0, 1]){
      const pos: Position = { x: container.x + offsetX, y: container.y + offsetY };
      const existingSite = constructionSites.find(s => mySpawn !== undefined && s.x === pos.x && s.y === pos.y);
      let outsideSite = null;
      if (existingSite === undefined) {
        outsideSite = createConstructionSite(pos, StructureExtension).object;
      } else {
        // DEBUG
        console.log(`existingSite: ${outsideSite}`);
      }
    }
  }

  // // TODO: Remove construction site if
  // // no resource container is beside it anymore
  // for (let site of constructionSites) {
  //   const containerNearSite = containers.filter(c => c.x > 13 && c.x < 86).find(c => getRange(c, site) <= 1);
  //   if (!containerNearSite) {
  //     site.remove();
  //   }
  // }
}
