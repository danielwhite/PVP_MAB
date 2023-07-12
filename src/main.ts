import { Args } from "grimoire-kolmafia";
import { print, pvpAttacksLeft, visitUrl } from "kolmafia";
import { get, set } from "libram";
import { args } from "./args";
import {
  breakStone,
  equipPVPOutfit,
  printStats,
  printStrategiesEstimates,
  pvpAttack,
  updateExp3Weights,
  updateSeason,
  updateWinRate,
  useMeteoriteade,
} from "./lib";
import { parseResult } from "./parsing";

export function main(argstring = ""): void {
  Args.fill(args, argstring);
  if (args.help) {
    Args.showHelp(args);
    return;
  }
  breakStone();
  useMeteoriteade();
  updateSeason();
  updateWinRate();

  let todaysWins = get("todaysPVPWins", 0),
    todaysLosses = get("todaysPVPLosses", 0);

  if (pvpAttacksLeft() > 0) {
    const attackType = args.target === "loot" ? "lootwhatever" : args.target;
    equipPVPOutfit();

    while (pvpAttacksLeft() > 0) {
      if (args.debug) printStrategiesEstimates();
      const result = pvpAttack(attackType);
      if (result.includes("Sorry, I couldn't find the player")) {
        print("Could not find anyone to fight!", "red");
        break;
      }
      parseResult(result)
        ? set("todaysPVPWins", (todaysWins += 1))
        : set("todaysPVPLosses", (todaysLosses += 1));
      updateExp3Weights();
    }
  } else {
    print("Out of PVP fights", "red");
  }

  printStats();
  visitUrl("peevpee.php?place=shop"); // update season swagger
  print("");

  if (todaysWins + todaysLosses > 0) {
    print(
      `This session's win rate: ${todaysWins}/${todaysWins + todaysLosses} (${
        Math.round((1000 * todaysWins) / (todaysWins + todaysLosses)) / 10
      }%)`,
      "blue"
    );
  }
}
