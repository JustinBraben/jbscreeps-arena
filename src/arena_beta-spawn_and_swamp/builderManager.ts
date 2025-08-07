import { getObjectsByPrototype, getObjectById, getObjects, findPath, getCpuTime, getTicks, createConstructionSite } from 'game/utils';
import { ATTACK, MOVE, CARRY, RANGED_ATTACK, HEAL, TOUGH, WORK, RESOURCE_ENERGY, ERR_NOT_IN_RANGE, ERR_FULL } from 'game/constants';
import { StructureSpawn, StructureContainer, Creep, StructureWall, Id, Position, Source, StructureExtension, ConstructionSite } from 'game/prototypes';
import { Visual } from 'game/visual';

// Define the assignment structure
export interface BuilderAssignment {
    builder: Creep;
    constructionSite: ConstructionSite;
    assignedTick: number;
}

// Main manager class for miner assignments
export class BuilderManager {
    private assignments: Map<Id<Creep>, BuilderAssignment>;
    private constructionSiteAssignments: Map<Id<ConstructionSite>, Set<Id<Creep>>>; // container.id -> Set of miner.ids
    private readonly MAX_BUILDERS_PER_CONSTRUCTION_SITE = 2;

    constructor() {
        this.assignments = new Map();
        this.constructionSiteAssignments = new Map();
    }

    /**
     * Main update function to be called each tick
     */
    update(builders: Creep[], currentTick: number): void {
        // Clean up dead miners
        this.cleanupDeadBuilders(builders);

        this.cleanupFinishedBuilders(builders);

        // Get available constructionSites
        const constructionSites = getObjectsByPrototype(ConstructionSite).filter(c => c.my && c.progress < c.progressTotal);

        // Assign unassigned builders
        const unassignedBuilders = builders.filter(b => !this.assignments.has(b.id));
        for (const builder of unassignedBuilders) {
            this.assignBuilderToConstructionSite(builder, constructionSites, currentTick);
        }

        // Optional: Reassign miners if better containers become available
        this.optimizeAssignments(builders, constructionSites, currentTick);
    }

    /**
     * Remove assignments for dead builders
     */
    private cleanupDeadBuilders(activeBuilders: Creep[]): void {
        const activeBuilderIds = new Set(activeBuilders.map(m => m.id));

        for (const [builderId, assignment] of this.assignments) {
            if (!activeBuilderIds.has(builderId)) {
                // Remove from container assignments
                const containerMiners = this.constructionSiteAssignments.get(assignment.constructionSite.id);
                if (containerMiners) {
                    containerMiners.delete(builderId);
                    if (containerMiners.size === 0) {
                        this.constructionSiteAssignments.delete(assignment.constructionSite.id);
                    }
                }
                // Remove from main assignments
                this.assignments.delete(builderId);
            }
        }
    }

    /**
     * Remove assignments for finished builders
     */
    private cleanupFinishedBuilders(activeBuilders: Creep[]): void {
      for (const [builderId, assignment] of this.assignments) {
          const constructionSiteExists = assignment.constructionSite.exists;

          if (
            !constructionSiteExists
          ) {
            this.assignments.delete(builderId);
          }
      }
    }

    /**
     * Assign a builder to an available container
     */
    private assignBuilderToConstructionSite(
        builder: Creep,
        constructionSites: ConstructionSite[],
        currentTick: number
    ): boolean {
        // Find containers with available slots
        const availableContainers = constructionSites.filter(constructionSite => {
            const assignedMiners = this.constructionSiteAssignments.get(constructionSite.id);
            return !assignedMiners || assignedMiners.size < this.MAX_BUILDERS_PER_CONSTRUCTION_SITE;
        });

        if (availableContainers.length === 0) {
            return false; // No available containers
        }

        // Sort by distance (you might want to use pathfinding cost instead)
        availableContainers.sort((a, b) => {
            const distA = this.getDistance(builder, a);
            const distB = this.getDistance(builder, b);
            return distA - distB;
        });

        // Prefer containers with fewer miners
        const bestContainer = availableContainers.reduce((best, container) => {
            const bestCount = this.constructionSiteAssignments.get(best.id)?.size || 0;
            const containerCount = this.constructionSiteAssignments.get(container.id)?.size || 0;

            // If this container has fewer miners, prefer it
            if (containerCount < bestCount) {
                return container;
            }
            // If same number of miners, prefer closer one
            if (containerCount === bestCount) {
                const distBest = this.getDistance(builder, best);
                const distContainer = this.getDistance(builder, container);
                return distContainer < distBest ? container : best;
            }
            return best;
        });

        // Create assignment
        this.assignments.set(builder.id, {
            builder: builder,
            constructionSite: bestContainer,
            assignedTick: currentTick
        });

        // Update container assignments
        if (!this.constructionSiteAssignments.has(bestContainer.id)) {
            this.constructionSiteAssignments.set(bestContainer.id, new Set());
        }
        this.constructionSiteAssignments.get(bestContainer.id)!.add(builder.id);

        return true;
    }

    /**
     * Optional: Reassign miners if better options become available
     */
    private optimizeAssignments(
        builders: Creep[],
        containers: ConstructionSite[],
        currentTick: number
    ): void {
        // Only optimize every N ticks to save CPU
        if (currentTick % 10 !== 0) return;

        for (const builder of builders) {
            const currentAssignment = this.assignments.get(builder.id);
            if (!currentAssignment) continue;

            // Check if there's a significantly closer available container
            const currentDistance = this.getDistance(builder, currentAssignment.constructionSite);

            for (const container of containers) {
                const assignedCount = this.constructionSiteAssignments.get(container.id)?.size || 0;
                if (assignedCount >= this.MAX_BUILDERS_PER_CONSTRUCTION_SITE) continue;

                const newDistance = this.getDistance(builder, container);

                // Only reassign if significantly closer (e.g., 50% closer)
                if (newDistance < currentDistance * 0.5) {
                    this.unassignBuilder(builder.id);
                    this.assignBuilderToConstructionSite(builder, containers, currentTick);
                    break;
                }
            }
        }
    }

    /**
     * Unassign a miner from their container
     */
    private unassignBuilder(buildId: Id<Creep>): void {
        const assignment = this.assignments.get(buildId);
        if (!assignment) return;

        const containerMiners = this.constructionSiteAssignments.get(assignment.constructionSite.id);
        if (containerMiners) {
            containerMiners.delete(buildId);
            if (containerMiners.size === 0) {
                this.constructionSiteAssignments.delete(assignment.constructionSite.id);
            }
        }

        this.assignments.delete(buildId);
    }

    /**
     * Get the assignment for a specific miner
     */
    getAssignment(builder: Creep): ConstructionSite | null {
        const assignment = this.assignments.get(builder.id);
        return assignment ? assignment.constructionSite : null;
    }

    /**
     * Get all miners assigned to a specific container
     */
    getMinersForContainer(constructionSite: ConstructionSite): Creep[] {
        const builderIds = this.constructionSiteAssignments.get(constructionSite.id);
        if (!builderIds) return [];

        return Array.from(builderIds)
            .map(id => this.assignments.get(id)?.builder)
            .filter(miner => miner !== undefined) as Creep[];
    }

    /**
     * Check if a container has available slots
     */
    isContainerAvailable(constructionSite: ConstructionSite): boolean {
        const assignedCount = this.constructionSiteAssignments.get(constructionSite.id)?.size || 0;
        return assignedCount < this.MAX_BUILDERS_PER_CONSTRUCTION_SITE;
    }

    /**
     * Simple distance calculation (you might want to use pathfinding)
     */
    private getDistance(creep: Creep, container: ConstructionSite): number {
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
        const containersInUse = this.constructionSiteAssignments.size;

        let totalMinersOnContainers = 0;
        for (const miners of this.constructionSiteAssignments.values()) {
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
