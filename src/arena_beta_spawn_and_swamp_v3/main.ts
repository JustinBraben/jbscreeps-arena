import { ATTACK, WORK, CARRY, MOVE, RANGED_ATTACK, TOUGH, HEAL, RESOURCE_ENERGY, ERR_NOT_IN_RANGE, OK, BODYPART_COST, BodyPartConstant } from "game/constants";
import { Creep, GameObject, Position, StructureSpawn, _Constructor, _ConstructorById } from "game/prototypes";
import { getDirection,
  getObjectsByPrototype,
  getRange,
  getTicks,
  createConstructionSite,
  findPath
} from "game/utils";

// Define Role enum for better organization
enum Role {
  BUILDER = "\u2692",
  MELEE = "\u270A",
  RANGED = "\u2197",
  HEALER = "\u26D1",
  HAULER = "\u26CF"
}

interface ExtendedCreep extends Creep {
  initialPos: Position;
  role: Role;
  target: GameObject;
  customMethod?(): void;
}

interface ExtendedCreepConstructor
    extends _Constructor<ExtendedCreep>,
      _ConstructorById<ExtendedCreep> {}

// const ExtendedCreep: ExtendedCreepConstructor;

// Global variables for game state
let mySpawn: StructureSpawn;
let enemySpawn: StructureSpawn;
let myCreeps: ExtendedCreep[];

// This example shows how to import shared functionality that can be used across arenas
export function loop(): void {
  // Update global game state
  updateGameState();

  // Spawn logic
  handleSpawning();
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
  myCreeps = getObjectsByPrototype(Creep).filter(c => c.my) as ExtendedCreep[];
}

function handleSpawning(): void {
  if (myCreeps.length < 10 && !mySpawn.spawning) {
    const result = mySpawn.spawnCreep([CARRY, CARRY, MOVE]);
      if (result.object) {
        // result.object.role = priority.role;
        // result.object.initialPos = { x: mySpawn.x, y: mySpawn.y };
        // console.log(`Spawning ${priority.role} (Energy: ${totalEnergy}/${cost})`);
      }
  }
}
