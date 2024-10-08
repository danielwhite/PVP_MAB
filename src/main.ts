import { Args } from "grimoire-kolmafia";
import { print, pvpAttacksLeft, visitUrl } from "kolmafia";
import { get, set } from "libram";
import { args } from "./args";
import {
  breakStone,
  equipPVPOutfit,
  executeMood,
  initializeSortedPvpIDs,
  prefChangeSettings,
  printStats,
  printStrategiesEstimates,
  pvpAttack,
  updateSeason,
  updateWinRate,
  useDiploma,
  useMeteoriteade,
  usePunchingMirror,
} from "./lib";
import { parseResult } from "./parsing";

export function main(argstring = ""): void {
  Args.fill(args, argstring);
  if (args.help) {
    Args.showHelp(args);
    return;
  }
  if (args.reset) {
    print("Resetting the stats of the current season!");
    breakStone();
    updateSeason();
    return;
  }
  breakStone();
  useMeteoriteade();
  useDiploma();
  usePunchingMirror();
  updateSeason();
  updateWinRate();

  let todaysWins = get("todaysPVPWins", 0),
    todaysLosses = get("todaysPVPLosses", 0);

  let stopAt = 0;
  if (args.fights) {
    if (args.fights >= 0) {
      stopAt = Math.max(0, pvpAttacksLeft() - args.fights);
    } else {
      stopAt = Math.min(-args.fights, pvpAttacksLeft());
    }
  }

  if (pvpAttacksLeft() > stopAt) {
    initializeSortedPvpIDs();
    const attackType = args.target === "loot" ? "lootwhatever" : args.target;
    equipPVPOutfit();

    set("logPreferenceChange", false);
    while (pvpAttacksLeft() > stopAt) {
      executeMood();
      if (args.debug) printStrategiesEstimates();
      const result = pvpAttack(attackType);
      if (result.includes("Sorry, I couldn't find the player")) {
        print("Could not find anyone to fight!", "red");
        break;
      }
      parseResult(result)
        ? set("todaysPVPWins", (todaysWins += 1))
        : set("todaysPVPLosses", (todaysLosses += 1));
    }
    set("logPreferenceChange", prefChangeSettings);
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
