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

// Body templates for different roles
const BODIES: Record<Role, BodyPartConstant[]> = {
  [Role.HARVESTER]: [WORK, WORK, MOVE],
  [Role.HAULER]: [CARRY, CARRY, MOVE, MOVE],
  [Role.BUILDER]: [WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE,],
  [Role.MELEE]: [TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK],
  [Role.RANGED]: [MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK],
  [Role.HEALER]: [MOVE, MOVE, MOVE, MOVE, HEAL]
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
}

function displayVisuals(): void {
  const visual = new Visual();

  // Display creep roles and health
  myCreeps.forEach(creep => {
    visual.text(
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

  // Display spawn energy
  if (mySpawn) {
    visual.text(
      `Energy: ${mySpawn.store.energy}`,
      { x: mySpawn.x, y: mySpawn.y - 1 },
      {
        font: "0.5",
        opacity: 0.8,
        backgroundColor: "#FFD700",
        backgroundPadding: 0.05
      }
    );

    debugExtensionPlaceholders(visual, containers, mySpawn);
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
    { role: Role.HAULER, max: 2 },
    { role: Role.BUILDER, max: 1 },
    { role: Role.MELEE, max: 5 },
    { role: Role.HAULER, max: 4 },
    { role: Role.BUILDER, max: 2 },
    { role: Role.MELEE, max: 10 },
    { role: Role.RANGED, max: 2 },
    { role: Role.HEALER, max: 2 },
    { role: Role.HAULER, max: 6 },
    { role: Role.BUILDER, max: 4 },
    { role: Role.MELEE, max: 15 },
    { role: Role.RANGED, max: 5 },
    { role: Role.HEALER, max: 5 },
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
      creep.withdraw(targetContainer, 'energy');
    }
  } else {
    // Deliver energy - Prioritize spawn, then extensions
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
      creep.transfer(myClosestExtension, 'energy');
    } else {
      const mySpawnFreeCapacity = mySpawn.store.getFreeCapacity('energy');
      if (mySpawnFreeCapacity !== null && mySpawnFreeCapacity !== undefined && mySpawnFreeCapacity > 0){
        moveWithinRange(creep, mySpawn, 1);
        creep.transfer(mySpawn, 'energy');
      }
    }
  }
}

function runBuilder(creep: Creep): void {
  // Toggle working state
  if (creep.working && creep.store.energy === 0) {
    creep.working = false;
  } else if (!creep.working && creep.store.getFreeCapacity() === 0) {
    creep.working = true;
  }

  if (creep.working) {
    // Build construction sites
    const site = constructionSites
      .sort((a, b) => getRange(a, creep) - getRange(b, creep)).find(c => c.my);

    if (site !== undefined) {
      // // DEBUG
      // console.log(`Builder ${creep.id} building ${site.id}`);
      const buildRes = creep.build(site);
      if (buildRes !== OK) {
        creep.moveTo(site);
      }
    } else {
      // No construction sites, help with energy collection
      runHauler(creep);
    }
  } else {
    runHauler(creep);
    // // Get energy from spawn or haulers
    // if (mySpawn && mySpawn.store.energy >= 50) {
    //   if (creep.withdraw(mySpawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
    //     creep.moveTo(mySpawn);
    //   }
    // } else {
    //   // Pick up dropped energy
    //   const droppedEnergy = getObjectsByPrototype(Resource)
    //     .sort((a, b) => getRange(a, creep) - getRange(b, creep)).find(e => e);

    //   if (droppedEnergy) {
    //     if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
    //       creep.moveTo(droppedEnergy);
    //     }
    //   } else {
    //     // No droppedEnergy, help with energy collection
    //     runHauler(creep);
    //   }
    // }
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
    creep.attack(target);
  } else if (nearestEnemyRampart && creep.getRangeTo(nearestEnemyRampart) < 5) {
    moveWithinRange(creep, nearestEnemyRampart, 1);
    creep.attack(nearestEnemyRampart);
  } else if (creep.getRangeTo(enemySpawn) < 5) {
    moveWithinRange(creep, enemySpawn, 1);
    creep.attack(enemySpawn);
  } else if (nearestWall) {
    moveWithinRange(creep, nearestWall, 1);
    creep.attack(nearestWall);
  } else if (creep.initialPos) {
    // Return to initial position if no targets
    moveWithinRange(creep, creep.initialPos, 3);
  } else {
    moveWithinRange(creep, enemySpawn, 1);
    creep.attack(enemySpawn);
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

  // for (let site of constructionSites) {
  //   const containerNearSite = containers.filter(c => c.x > 13 && c.x < 86).find(c => getRange(c, site) <= 1);
  //   if (!containerNearSite) {
  //     site.remove();
  //   }
  // }
}
