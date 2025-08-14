import { getObjectsByPrototype, getTicks, getRange, findPath, findClosestByPath, createConstructionSite } from 'game/utils';
import { Creep, StructureSpawn, StructureTower, StructureContainer, StructureRampart, Source, ConstructionSite, StructureExtension, StructureWall, Position } from 'game/prototypes';
import { WORK, CARRY, MOVE, ATTACK, RANGED_ATTACK, HEAL, TOUGH, RESOURCE_ENERGY, ERR_NOT_IN_RANGE } from 'game/constants';
import { Visual } from 'game/visual';

// Define Role enum for better organization
enum Role {
  BUILDER = "\u2692",
  MELEE = "\u270A",
  RANGED = "\u2197",
  HEALER = "\u26D1",
  HARVESTER = "\u26CF"
}

// Extend the Creep interface with our custom properties
declare module "game/prototypes" {
  interface Creep {
    initialPos: Position;
    role: Role;
    working: boolean;
    targetBuilder?: string; // ID of the builder this harvester is supporting
  }
}

// Strategy state
interface StrategyState {
    phase: 'init' | 'harvesting' | 'building_rush' | 'defending' | 'attacking';
    harvesters: Creep[];
    builders: Creep[];
    rushPosition: Position | null;
    tower: StructureTower | null;
    container: StructureContainer | null;
    rampart: StructureRampart | null;
}

let state: StrategyState = {
    phase: 'init',
    harvesters: [],
    builders: [],
    rushPosition: null,
    tower: null,
    container: null,
    rampart: null
};

// Global variables for game state
let mySpawn: StructureSpawn;
let enemySpawn: StructureSpawn;
let myCreeps: Creep[];
let enemyCreeps: Creep[];
let containers: StructureContainer[];
let towers: StructureTower[];
let swampContainers: StructureContainer[];
let myExtensions: StructureExtension[];
let constructionSites: ConstructionSite[];
let walls: StructureWall[];
let ramparts: StructureRampart[];
let globalVisual: Visual = new Visual(10, true);
let roleCounts = new Map<Role, number>();

export function loop(): void {
    const tick = getTicks();

    // Get all game objects
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
    towers = getObjectsByPrototype(StructureTower).filter(t => t.my);
    containers = getObjectsByPrototype(StructureContainer);
    myExtensions = getObjectsByPrototype(StructureExtension).filter(c => c.my);
    constructionSites = getObjectsByPrototype(ConstructionSite).filter(c => c.my && c.exists && c.progress < c.progressTotal);
    ramparts = getObjectsByPrototype(StructureRampart).filter(r => r.my);

    globalVisual.clear();

    if (!mySpawn || !enemySpawn) return;

    // Set rush position closer to enemy spawn
    state.rushPosition = { x: enemySpawn.x, y: enemySpawn.y - 4 };

    // Create tower construction site if it doesn't exist and we don't have a tower yet
    if (!state.tower && towers.length === 0) {
        const existingSite = constructionSites.find(s =>
            s.my &&
            state.rushPosition &&
            s.x === state.rushPosition.x &&
            s.y === state.rushPosition.y &&
            s.structure instanceof StructureTower
        );

        if (!existingSite) {
            const towerSite = createConstructionSite(state.rushPosition, StructureTower);
            if (towerSite.object) {
                console.log(`Created tower construction site at ${state.rushPosition.x}, ${state.rushPosition.y}`);
            }
        }
    }

    // Update state with existing structures
    if (towers.length > 0 && !state.tower) {
        state.tower = towers[0];
        console.log(`Tower completed at ${state.tower.x}, ${state.tower.y}`);
    }
    if (containers.length > 0 && !state.container) {
        state.container = containers.find(c => c.my) || null;
    }
    if (ramparts.length > 0 && !state.rampart) {
        state.rampart = ramparts[0];
    }

    const harvesters = myCreeps.filter(c => c.role === Role.HARVESTER);
    const builders = myCreeps.filter(c => c.role === Role.BUILDER);

    // Update state arrays
    state.harvesters = harvesters;
    state.builders = builders;

    // Phase 1: Initial setup and spawning
    if (state.phase === 'init') {
        // Spawn harvesters first
        if (harvesters.length < 4) {
            const harvesterBody = [CARRY, CARRY, CARRY, MOVE, MOVE];
            const result = mySpawn.spawnCreep(harvesterBody);
            if (result.object) {
                result.object.role = Role.HARVESTER;
                result.object.initialPos = { x: mySpawn.x, y: mySpawn.y };
                console.log(`Spawning ${result.object.role}`);
            }
        }
        // Then spawn builders
        else if (builders.length < 2) {
            const builderBody = [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
            const result = mySpawn.spawnCreep(builderBody);
            if (result.object) {
                result.object.role = Role.BUILDER;
                result.object.initialPos = { x: mySpawn.x, y: mySpawn.y };
                console.log(`Spawning ${result.object.role}`);
            }
        }
        // Move to next phase
        else {
            state.phase = 'building_rush';
            console.log("Moving to building_rush phase");

            // Assign harvesters to builders (2 harvesters per builder)
            builders.forEach((builder, index) => {
                const assignedHarvesters = harvesters.slice(index * 2, (index + 1) * 2);
                assignedHarvesters.forEach(harvester => {
                    harvester.targetBuilder = builder.id;
                    console.log(`Assigned harvester ${harvester.id} to builder ${builder.id}`);
                });
            });
        }
    }

    // Run creep logic
    myCreeps.forEach(creep => {
        switch (creep.role) {
            case Role.HARVESTER:
                runHarvester(creep);
                break;
            case Role.BUILDER:
                runBuilder(creep);
                break;
        }
    });

    // Tower attack logic
    if (state.tower && state.tower.store.energy > 0) {
        // Priority: enemy creeps > enemy spawn
        let target: any = null;

        // Find closest enemy creep in range
        const enemyCreepsInRange = enemyCreeps.filter(c => getRange(state.tower!, c) <= 10);
        if (enemyCreepsInRange.length > 0) {
            target = enemyCreepsInRange.reduce((closest, creep) =>
                getRange(state.tower!, creep) < getRange(state.tower!, closest) ? creep : closest
            );
        }
        // Attack enemy spawn if in range and no creeps
        else if (enemySpawn && getRange(state.tower, enemySpawn) <= 10) {
            target = enemySpawn;
        }

        if (target) {
            state.tower.attack(target);
        }
    }

    // Visual indicators
    if (state.rushPosition) {
        globalVisual.circle(state.rushPosition, { radius: 2, fill: '#ff0000', opacity: 0.3 });
        globalVisual.text('RUSH POINT', state.rushPosition, { color: '#ff0000', font: '0.5' });
    }
    if (state.tower) {
        globalVisual.circle(state.tower, { radius: 10, fill: '#ffaa00', opacity: 0.1 });
    }

    // Visual lines showing harvester-builder assignments
    harvesters.forEach(harvester => {
        if (harvester.targetBuilder) {
            const builder = builders.find(b => b.id === harvester.targetBuilder);
            if (builder) {
                globalVisual.line(harvester, builder, { color: '#00ff00', opacity: 0.3 });
            }
        }
    });
}

function runHarvester(creep: Creep): void {
    if (!mySpawn) return;

    // Check if tower is complete - if so, switch to normal harvesting
    if (state.tower) {
        creep.targetBuilder = undefined; // Clear builder assignment
        runNormalHarvester(creep);
        return;
    }

    // If assigned to a builder and tower not complete, support the builder
    if (creep.targetBuilder && !state.tower) {
        const targetBuilder = state.builders.find(b => b.id === creep.targetBuilder);

        if (!targetBuilder || targetBuilder.hits <= 0) {
            // Builder is dead or missing, revert to normal harvesting
            creep.targetBuilder = undefined;
            runNormalHarvester(creep);
            return;
        }

        // Toggle working state based on energy
        if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
            creep.working = true;
        } else if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
            creep.working = false;
        }

        if (!creep.working) {
            // Get energy from containers or spawn
            const targetContainer = creep.findClosestByPath(containers.filter(c => c.store.energy > 0));

            if (targetContainer) {
                if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetContainer);
                }
            } else if (mySpawn.store.energy >= 50) {
                if (creep.withdraw(mySpawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(mySpawn);
                }
            }
        } else {
            // Follow the builder and transfer energy when close
            const targetBuilderStore = targetBuilder.store;
            const targetBuilderStoreFreeCapacity = targetBuilderStore.getFreeCapacity(RESOURCE_ENERGY);
            if (!targetBuilder || !targetBuilderStore || !targetBuilderStoreFreeCapacity) return;

            const builderNeedsEnergy = targetBuilderStoreFreeCapacity > 0;

            if (builderNeedsEnergy) {
                // Move to builder and transfer energy
                if (getRange(creep, targetBuilder) > 1) {
                    creep.moveTo(targetBuilder);
                } else {
                    creep.transfer(targetBuilder, RESOURCE_ENERGY);
                    console.log(`Harvester ${creep.id} transferred energy to builder ${targetBuilder.id}`);
                }
            } else {
                // Builder is full, stay close but out of the way
                if (getRange(creep, targetBuilder) > 3) {
                    creep.moveTo(targetBuilder);
                }
            }
        }
    } else {
        // No builder assigned or tower complete, run normal harvesting
        runNormalHarvester(creep);
    }
}

function runNormalHarvester(creep: Creep): void {
    if (!mySpawn) return;

    // Toggle working state based on energy
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        creep.working = true;
    } else if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        creep.working = false;
    }

    if (!creep.working) {
        // Collect energy from containers
        const targetContainer = creep.findClosestByPath(containers.filter(c => c.store.energy > 0));

        if (targetContainer) {
            if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(targetContainer);
            }
        }
    } else {
        // Deliver energy - Priority: Tower > Spawn
        let target: any = null;

        const towerStore = state.tower?.store;
        const towerStoreFreeCapacity = towerStore?.getFreeCapacity(RESOURCE_ENERGY);
        const spawnStoreFreeCapacity = mySpawn.store.getFreeCapacity(RESOURCE_ENERGY);

        // Fill tower if it exists and needs energy
        if (state.tower && towerStoreFreeCapacity && towerStoreFreeCapacity > 0) {
            target = state.tower;
        }
        // Otherwise fill spawn
        else if (spawnStoreFreeCapacity && spawnStoreFreeCapacity > 0) {
            target = mySpawn;
        }

        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target);
            }
        }
    }
}

function runBuilder(creep: Creep): void {
    if (!mySpawn || !state.rushPosition) return;

    // Toggle working state based on energy
    if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
        creep.working = true;
    } else if (creep.store.getUsedCapacity(RESOURCE_ENERGY) === 0) {
        creep.working = false;
    }

    if (creep.working) {
        // Find the tower construction site at rush position
        const rushTowerSite = constructionSites.find(site =>
            site.my &&
            state.rushPosition &&
            site.structure instanceof StructureTower &&
            site.x === state.rushPosition.x &&
            site.y === state.rushPosition.y
        );

        if (rushTowerSite) {
            // Move to construction site and build
            if (getRange(creep, rushTowerSite) > 3) {
                creep.moveTo(rushTowerSite);
            } else {
                const result = creep.build(rushTowerSite);
                if (result === 0) {
                    console.log(`Builder building tower: ${rushTowerSite.progress}/${rushTowerSite.progressTotal}`);
                }
            }
        }
        // Build rampart on tower after tower is complete
        else if (state.tower && !state.rampart) {
            const rampartSite = constructionSites.find(site =>
                site.my &&
                site.structure instanceof StructureRampart &&
                site.x === state.tower!.x &&
                site.y === state.tower!.y
            );

            if (!rampartSite) {
                // Create rampart construction site on tower
                const result = createConstructionSite(state.tower, StructureRampart);
                if (result.object) {
                    console.log(`Created rampart construction site on tower`);
                }
            } else {
                // Build the rampart
                if (getRange(creep, rampartSite) > 3) {
                    creep.moveTo(rampartSite);
                } else {
                    creep.build(rampartSite);
                }
            }
        }
        // Build container near tower
        else if (state.tower && !state.container) {
            const containerPos = { x: state.tower.x + 1, y: state.tower.y };
            const containerSite = constructionSites.find(site =>
                site.my &&
                site.structure instanceof StructureContainer &&
                site.x === containerPos.x &&
                site.y === containerPos.y
            );

            if (!containerSite) {
                // Create container construction site
                const result = createConstructionSite(containerPos, StructureContainer);
                if (result.object) {
                    console.log(`Created container construction site near tower`);
                }
            } else {
                // Build the container
                if (getRange(creep, containerSite) > 3) {
                    creep.moveTo(containerSite);
                } else {
                    creep.build(containerSite);
                }
            }
        }
        // If all structures are built, help harvest
        else {
            runHarvester(creep);
        }
    } else {
        // Need energy - get from spawn or containers
        if (mySpawn.store.energy >= 50) {
            if (creep.withdraw(mySpawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(mySpawn);
            }
        } else {
            // Try to get from container if spawn is low
            const targetContainer = creep.findClosestByPath(containers.filter(c => c.store.energy > 0));
            if (targetContainer) {
                if (creep.withdraw(targetContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetContainer);
                }
            }
        }
    }
}

function moveWithinRange(creep: Creep, otherPos: Position, idealRange: number): void {
    if (getRange(creep, otherPos) > idealRange) {
        creep.moveTo(otherPos);
    }
}
