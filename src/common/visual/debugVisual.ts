import { findPath, getTerrainAt } from 'game/utils';
import { StructureSpawn, StructureContainer, Position } from 'game/prototypes';
import { Visual } from 'game/visual';
import { TERRAIN_WALL, TERRAIN_PLAIN } from 'game/constants';
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
