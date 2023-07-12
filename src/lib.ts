// The fight page does not sort the minis by alphabetical order

import {
  abort,
  buy,
  cliExecute,
  hippyStoneBroken,
  itemAmount,
  print,
  todayToString,
  use,
  visitUrl,
} from "kolmafia";
import { $item, get, set } from "libram";
import { bernoulliThompson, epsilonGreedy, Exp3, gaussianThompson, UCB } from "./strategies";
import { args } from "./args";

// So we have to reorder them to the rules page
export const activeMinis =
  visitUrl("peevpee.php?place=fight")
    .match(RegExp(/option value="\d+"(.*?)>(.*?)<\/option/g))
    ?.splice(3)
    .map((s) => s.replace(/option value="([0-9]+)"(.*?)>/g, "").replace(/<\/option/g, "")) ?? [];
export const activeMinisSorted =
  visitUrl("peevpee.php?place=rules")
    .match(RegExp(/nowrap><b>(.*?)\\*?<\/b>/g))
    ?.map((s) =>
      s
        .replace("nowrap>", "")
        .replace("*", "")
        .replace("arrr", "ar")
        .replace("<b>", "")
        .replace("</b>", "")
    ) ?? [];
export const pvpIDs = Array.from(Array(activeMinis.length).keys());
export const sortedPvpIDs = activeMinisSorted.map((mini) =>
  activeMinis.findIndex((sortedMini) => sortedMini === mini)
);

if (
  !sortedPvpIDs.every(
    (id, i) => id >= 0 && id < activeMinis.length && sortedPvpIDs.indexOf(id) === i
  )
)
  throw new Error(`Error with sortedPvpIDs: ${sortedPvpIDs}!`);
if (!pvpIDs.every((i) => activeMinisSorted[i] === activeMinis[sortedPvpIDs[i]]))
  throw new Error(`Error with mapping!`);

export const verbose = !get("PVP_MAB_reduced_verbosity", false);

export function getFightRecords(): number[][] {
  return pvpIDs.map((i) => {
    const wins = get(`myCurrentPVPWins_${i}`, 0);
    const losses = get(`myCurrentPVPLosses_${i}`, 0);
    return [wins, losses];
  });
}

export function getBestMini(): number {
  const strategy = get("PVP_MAB_strategy", "UCB").toLowerCase();
  if (strategy === "gaussianthompson") return gaussianThompson();
  else if (strategy === "bernoullithompson") return bernoulliThompson();
  else if (strategy === "epsilongreedy") return epsilonGreedy();
  else if (strategy === "exp3") return Exp3();
  else return UCB(); // default
}

export function useMeteoriteade(): void {
  if (!get("PVP_MAB_use_meteoriteade", false)) return;

  const potionsToUse = 3 - get("_meteoriteAdesUsed");
  if (potionsToUse <= 0) return;

  const potionsToBuy = potionsToUse - itemAmount($item`Meteorite-Ade`);
  if (potionsToBuy > 0) buy($item`Meteorite-Ade`, potionsToBuy, 10000);

  use($item`Meteorite-Ade`, potionsToUse);
}

export function breakStone(): void {
  if (!args.breakStone && hippyStoneBroken())
    abort("Your stone is unbroken, and you won't let us do it!");

  const buffer = visitUrl("peevpee.php?confirm=on&action=smashstone&pwd");
  if (buffer.includes("Pledge allegiance to"))
    visitUrl("peevpee.php?action=pledge&place=fight&pwd");
}

export function updateSeason(): void {
  const currentSeason = Array.from(
    visitUrl("peevpee.php?place=rules").match(
      RegExp(/<b>Current Season: <\/b>(.*?)( \\(Post-Season\\))?<br \/>/)
    ) ?? ["", "0"]
  )[1];

  if (get("myCurrentPVPSeason", "") === currentSeason) return;

  // Reset wins and losses (pad all at 7 wins 7 losses [prime numbers good])
  pvpIDs.forEach((i) => {
    set(`myCurrentPVPWins_${i}`, 7);
    set(`myCurrentPVPLosses_${i}`, 7);
    set(`myCurrentPVPMini_${i}`, "");
    set(`myCurrentPVPMini_${i}`, activeMinisSorted[i]);
  });

  pvpIDs.forEach((i) => {
    set(`myCurrentPVPMiniExp3Weight_${i}`, 1.0);
  });

  // The rules page simply sorts the minis by alphabetical order
  // We can always see this (even if we don't have any fites left)

  // Reset our season's wins and losses
  set("totalSeasonPVPWins", 0);
  set("totalSeasonPVPLosses", 0);

  // save pvp season as current pvp season
  set("myCurrentPVPSeason", currentSeason);
}

export function updateWinRate(): void {
  if (get("todaysPVPDate") !== todayToString()) {
    set("todaysPVPWins", 0);
    set("todaysPVPLosses", 0);
    set("todaysPVPDate", todayToString());
  }
}

export function equipPVPOutfit(): void {
  // Can we find a better way to determine if we are already wearing a PVP-optimal outfit?
  cliExecute("unequip all");
  cliExecute("UberPvPOptimizer");
}

export function pvpAttack(attackType: string): string {
  const pvpChoice = getBestMini();

  print("");
  print(`Chose mini: ${activeMinis[pvpChoice]}`, "green");

  return visitUrl(
    `peevpee.php?action=fight&place=fight&ranked=1&stance=${pvpChoice}&attacktype=${attackType}&pwd`
  );
}

export function printStats(): void {
  print("");
  print(`Season ${get("myCurrentPVPSeason", "")} minigame statistics:`, "blue");
  pvpIDs.forEach((i) => {
    const wins = get(`myCurrentPVPWins_${i}`, 0);
    const losses = get(`myCurrentPVPLosses_${i}`, 0);
    const mini = get(`myCurrentPVPMini_${i}`, "");
    if (wins + losses === 0) print(`- ${mini}: 0/0 (0.0%)`, "blue");
    else
      print(
        `- ${mini}: ${wins}/${wins + losses} (${
          Math.round((1000 * wins) / (wins + losses)) / 10
        }%)`,
        "blue"
      );
  });
}
