import { getTicks } from "game/utils";
import { getCore } from "./core";
import { runHaul } from "./managers/haul";
import { runMilitary } from "./managers/military";
import { runSpawn } from './managers/spawn';

export function loop(): void {
  console.log(`The time is ${getTicks()}`);

  const core = getCore();
  core.run();

  runHaul(core);
  runMilitary(core);
  runSpawn(core);
}
