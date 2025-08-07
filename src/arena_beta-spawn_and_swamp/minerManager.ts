import { getObjectsByPrototype, getObjectById, getObjects, findPath, getCpuTime, getTicks, createConstructionSite } from 'game/utils';
import { ATTACK, MOVE, CARRY, RANGED_ATTACK, HEAL, TOUGH, WORK, RESOURCE_ENERGY, ERR_NOT_IN_RANGE, ERR_FULL } from 'game/constants';
import { StructureSpawn, StructureContainer, Creep, StructureWall, Id, Position, Source, StructureExtension, ConstructionSite } from 'game/prototypes';
import { Visual } from 'game/visual';

// Define the assignment structure
export interface MinerAssignment {
    miner: Creep;
    container: StructureContainer;
    assignedTick: number;
}

// Main manager class for miner assignments
export class MinerManager {
    private assignments: Map<Id<Creep>, MinerAssignment>;
    private containerAssignments: Map<Id<StructureContainer>, Set<Id<Creep>>>; // container.id -> Set of miner.ids
    private readonly MAX_MINERS_PER_CONTAINER = 2;

    constructor() {
        this.assignments = new Map();
        this.containerAssignments = new Map();
    }

    /**
     * Main update function to be called each tick
     */
    update(miners: Creep[], currentTick: number): void {
        // Clean up dead miners
        this.cleanupDeadMiners(miners);

        this.cleanupFinishedMiners(miners);

        // Get available containers
        const containers = getObjectsByPrototype(StructureContainer).filter(
          // Don't give containers surrounded by a wall
            container => {
              const walls = getObjectsByPrototype(StructureWall);
              let count = 0;
              for (let wall of walls) {
                if (wall === null || wall === undefined) continue;

                if (wall.getRangeTo(container) < 2) {
                  count += 1;
                }
              }
              return count < 5;
          }
        );

        // Assign unassigned miners
        const unassignedMiners = miners.filter(m => !this.assignments.has(m.id));
        for (const miner of unassignedMiners) {
            this.assignMinerToContainer(miner, containers, currentTick);
        }

        // Optional: Reassign miners if better containers become available
        this.optimizeAssignments(miners, containers, currentTick);
    }

    /**
     * Remove assignments for dead miners
     */
    private cleanupDeadMiners(activeMiners: Creep[]): void {
      const activeMinerIds = new Set(activeMiners.map(m => m.id));

      for (const [minerId, assignment] of this.assignments) {
          if (!activeMinerIds.has(minerId)) {
              // Remove from container assignments
              const containerMiners = this.containerAssignments.get(assignment.container.id);
              if (containerMiners) {
                  containerMiners.delete(minerId);
                  if (containerMiners.size === 0) {
                      this.containerAssignments.delete(assignment.container.id);
                  }
              }
              // Remove from main assignments
              this.assignments.delete(minerId);
          }
      }
    }

    /**
     * Remove assignments for finished miners
     */
    private cleanupFinishedMiners(activeMiners: Creep[]): void {
      for (const [minerId, assignment] of this.assignments) {
        if (assignment === null || assignment === undefined) {
          this.assignments.delete(minerId);
        }

          // const containerStore = assignment.container.store;
          // const containerStoreCapacacity = containerStore.getFreeCapacity(RESOURCE_ENERGY);

          // if (
          //   containerStore !== null ||
          //   containerStoreCapacacity !== null ||
          //   containerStoreCapacacity === 0
          // ) {
          //   this.assignments.delete(minerId);
          // }
      }
    }

    /**
     * Assign a miner to an available container
     */
    private assignMinerToContainer(
        miner: Creep,
        containers: StructureContainer[],
        currentTick: number
    ): boolean {
        // Find containers with available slots
        const availableContainers = containers.filter(container => {
            const assignedMiners = this.containerAssignments.get(container.id);
            return !assignedMiners || assignedMiners.size < this.MAX_MINERS_PER_CONTAINER;
        });

        if (availableContainers.length === 0) {
            return false; // No available containers
        }

        // Sort by distance (you might want to use pathfinding cost instead)
        availableContainers.sort((a, b) => {
            const distA = this.getDistance(miner, a);
            const distB = this.getDistance(miner, b);
            return distA - distB;
        });

        // Prefer containers with fewer miners
        const bestContainer = availableContainers.reduce((best, container) => {
            const bestCount = this.containerAssignments.get(best.id)?.size || 0;
            const containerCount = this.containerAssignments.get(container.id)?.size || 0;

            // If this container has fewer miners, prefer it
            if (containerCount < bestCount) {
                return container;
            }
            // If same number of miners, prefer closer one
            if (containerCount === bestCount) {
                const distBest = this.getDistance(miner, best);
                const distContainer = this.getDistance(miner, container);
                return distContainer < distBest ? container : best;
            }
            return best;
        });

        // Create assignment
        this.assignments.set(miner.id, {
            miner,
            container: bestContainer,
            assignedTick: currentTick
        });

        // Update container assignments
        if (!this.containerAssignments.has(bestContainer.id)) {
            this.containerAssignments.set(bestContainer.id, new Set());
        }
        this.containerAssignments.get(bestContainer.id)!.add(miner.id);

        return true;
    }

    /**
     * Optional: Reassign miners if better options become available
     */
    private optimizeAssignments(
        miners: Creep[],
        containers: StructureContainer[],
        currentTick: number
    ): void {
        // Only optimize every N ticks to save CPU
        if (currentTick % 10 !== 0) return;

        for (const miner of miners) {
            const currentAssignment = this.assignments.get(miner.id);
            if (!currentAssignment) continue;

            // Check if there's a significantly closer available container
            const currentDistance = this.getDistance(miner, currentAssignment.container);

            for (const container of containers) {
                const assignedCount = this.containerAssignments.get(container.id)?.size || 0;
                if (assignedCount >= this.MAX_MINERS_PER_CONTAINER) continue;

                const newDistance = this.getDistance(miner, container);

                // Only reassign if significantly closer (e.g., 50% closer)
                if (newDistance < currentDistance * 0.5) {
                    this.unassignMiner(miner.id);
                    this.assignMinerToContainer(miner, containers, currentTick);
                    break;
                }
            }
        }
    }

    /**
     * Unassign a miner from their container
     */
    private unassignMiner(minerId: Id<Creep>): void {
        const assignment = this.assignments.get(minerId);
        if (!assignment) return;

        const containerMiners = this.containerAssignments.get(assignment.container.id);
        if (containerMiners) {
            containerMiners.delete(minerId);
            if (containerMiners.size === 0) {
                this.containerAssignments.delete(assignment.container.id);
            }
        }

        this.assignments.delete(minerId);
    }

    /**
     * Get the assignment for a specific miner
     */
    getAssignment(miner: Creep): StructureContainer | null {
        const assignment = this.assignments.get(miner.id);
        return assignment ? assignment.container : null;
    }

    /**
     * Get all miners assigned to a specific container
     */
    getMinersForContainer(container: StructureContainer): Creep[] {
        const minerIds = this.containerAssignments.get(container.id);
        if (!minerIds) return [];

        return Array.from(minerIds)
            .map(id => this.assignments.get(id)?.miner)
            .filter(miner => miner !== undefined) as Creep[];
    }

    /**
     * Check if a container has available slots
     */
    isContainerAvailable(container: StructureContainer): boolean {
        const assignedCount = this.containerAssignments.get(container.id)?.size || 0;
        return assignedCount < this.MAX_MINERS_PER_CONTAINER;
    }

    /**
     * Simple distance calculation (you might want to use pathfinding)
     */
    private getDistance(creep: Creep, container: StructureContainer): number {
        const dx = creep.x - container.x;
        const dy = creep.y - container.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get statistics about current assignments
     */
    getStats(): {
        totalMiners: number;
        assignedMiners: number;
        containersInUse: number;
        averageMinersPerContainer: number;
    } {
        const assignedMiners = this.assignments.size;
        const containersInUse = this.containerAssignments.size;

        let totalMinersOnContainers = 0;
        for (const miners of this.containerAssignments.values()) {
            totalMinersOnContainers += miners.size;
        }

        return {
            totalMiners: 0, // You'd pass this in
            assignedMiners,
            containersInUse,
            averageMinersPerContainer: containersInUse > 0
                ? totalMinersOnContainers / containersInUse
                : 0
        };
    }
}
