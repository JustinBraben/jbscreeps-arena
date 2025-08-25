import { findPath, getTerrainAt } from 'game/utils';
import { StructureSpawn, StructureContainer, Position } from 'game/prototypes';
import { Visual } from 'game/visual';
import { TERRAIN_WALL, TERRAIN_PLAIN, TerrainConstant } from 'game/constants';
import { DefaultFindPathOptions } from 'common/constants';

export function debugContainerPathsToSpawn(
  gameVisual: Visual,
  containers: StructureContainer[],
  mySpawn: StructureSpawn | undefined
): void {
  if (mySpawn === undefined) return;

  for (const container of containers) {

    // Ignore containers in enemy base
    if (container.x < 13 && mySpawn.x === 94) continue;
    if (container.x > 86 && mySpawn.x === 5) continue;

    const path = findPath(mySpawn, container, DefaultFindPathOptions);

    gameVisual.poly(
      path,
      {
        lineStyle: 'dashed',
        stroke: '#0358ebff',
      }
    );
  }
}

export function debugExtensionPlaceholders(
  gameVisual: Visual,
  containers: StructureContainer[],
  mySpawn: StructureSpawn | undefined
): void {
  if (mySpawn === undefined) return;

  for (const container of containers) {
    // Only care about containers in the swamp area
    if (container.x < 13 || container.x > 86) continue;

    let offsetX: number = 0;

    // Extensions placed on either side depending on closest Spawn point
    if (mySpawn.x === 94) offsetX = 1;
    if (mySpawn.x === 5) offsetX = -1;

    for (const offsetY of [-1, 0, 1]){
      gameVisual.circle(
        { x: container.x + offsetX, y: container.y + offsetY },
        {
          radius: 0.15,
          stroke: '#d9c000ff',
        }
      );
    }
  }
}

export function debugTileCost(
  gameVisual: Visual,
  boundsTopLeft: Position,
  boundsBottomRightY: Position,
): void {
  // let xArr: Array<number> = new Array<number>();
  // for (let x = boundsTopLeft.x; x < boundsBottomRightY.x; x += 1) {
  //   xArr.push(x);
  // }

  // let yArr: Array<number> = new Array<number>();
  // for (let y = boundsTopLeft.y; y < boundsBottomRightY.y; y += 1) {
  //   yArr.push(y);
  // }

  // for (let x of xArr) {
  //   for (let y of yArr) {
  //     const tileTerrain = getTerrainAt({ x: x, y: y });
  //     if (tileTerrain === TERRAIN_WALL) continue;

  //     if (tileTerrain === TERRAIN_PLAIN) {
  //       gameVisual.text(
  //         "0",
  //         { x: x, y: y },
  //         {
  //           font: 0.5
  //         }
  //       );
  //     } else {
  //       gameVisual.text(
  //         "2",
  //         { x: x, y: y },
  //         {
  //           font: 0.5
  //         }
  //       );
  //     }
  //   }
  // }

  for (let x = boundsTopLeft.x; x < boundsBottomRightY.x; x += 1) {
    for (let y = boundsTopLeft.y; y < boundsBottomRightY.y; y += 1) {
      const tileTerrain = getTerrainAt({ x: x, y: y });
      if (tileTerrain === TERRAIN_WALL) continue;

      if (tileTerrain === TERRAIN_PLAIN) {
        gameVisual.text(
          "0",
          { x: x, y: y },
          {
            font: 0.5
          }
        );
      } else {
        gameVisual.text(
          "2",
          { x: x, y: y },
          {
            font: 0.5
          }
        );
      }
    }
  }
}

export function debugSpawnExits(
  gameVisual: Visual,
  allySpawnTopPath: Position[],
  allySpawnBottomPath: Position[],
  enemySpawnTopPath: Position[],
  enemySpawnBottomPath: Position[],
): void {
 gameVisual.poly(
  allySpawnTopPath,
    {
      lineStyle: 'dashed',
      stroke: '#0dff00ff',
    }
 );

  gameVisual.poly(
  allySpawnBottomPath,
    {
      lineStyle: 'dashed',
      stroke: '#0dff00ff',
    }
 );

  gameVisual.poly(
  enemySpawnTopPath,
    {
      lineStyle: 'dashed',
      stroke: '#ff1900ff',
    }
 );

  gameVisual.poly(
  enemySpawnBottomPath,
    {
      lineStyle: 'dashed',
      stroke: '#ff1900ff',
    }
 );
}

export function makeSpawnBottomExitPosition(
  spawn: StructureSpawn,
): Position[] {
  let exit: Position[] = [];

   if (spawn.x === 94) {

  // (13, 45)

  let currX = 13;
  let currY = 45;

  let currentBlock: TerrainConstant = TERRAIN_WALL;

  while (currY < 99) {
    currentBlock = getTerrainAt({ x: currX, y: currY});

    if (currentBlock !== TERRAIN_WALL) {
      exit.push({ x: currX, y: currY });
    }

    currY += 1;
  }

 } else if (spawn.x === 5) {
  // (86, 54)

  let currX = 86;
  let currY = 54;

  let currentBlock: TerrainConstant = TERRAIN_WALL;

  while (currY < 99) {
    currentBlock = getTerrainAt({ x: currX, y: currY});

    if (currentBlock !== TERRAIN_WALL) {
      exit.push({ x: currX, y: currY });
    }

    currY += 1;
  }
 }

 return exit;
}

export function makeSpawnTopExitPosition(
  spawn: StructureSpawn,
): Position[] {
  let exit: Position[] = [];

   if (spawn.x === 94) {

  // (13, 45)

  let currX = 13;
  let currY = 45;

  let currentBlock: TerrainConstant = TERRAIN_WALL;

  while (currY > 0) {
    currentBlock = getTerrainAt({ x: currX, y: currY});

    if (currentBlock !== TERRAIN_WALL) {
      exit.push({ x: currX, y: currY });
    }

    currY -= 1;
  }

 } else if (spawn.x === 5) {
  // (86, 54)

  let currX = 86;
  let currY = 54;

  let currentBlock: TerrainConstant = TERRAIN_WALL;

  while (currY > 0) {
    currentBlock = getTerrainAt({ x: currX, y: currY});

    if (currentBlock !== TERRAIN_WALL) {
      exit.push({ x: currX, y: currY });
    }

    currY -= 1;
  }
 }

 return exit;
}
