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
  xpath,
} from "kolmafia";
import { $item, get, set, sumNumbers } from "libram";
import * as STRATEGIES from "./strategies";
import { args } from "./args";
import { sampleBeta, sampleNormal } from "./distributions";

// So we have to reorder them to the rules page
export const activeMinis = xpath(
  visitUrl("peevpee.php?place=fight"),
  "//select[@name='stance']/option/text()"
)
  .splice(3)
  .map((s) => s.replace(/option value="([0-9]+)"(.*?)>/g, "").replace(/<\/option/g, ""));
export const activeMinisSorted = xpath(
  visitUrl("peevpee.php?place=rules"),
  "//tr[@class='small']/td[@nowrap]/text()"
);
export const pvpIDs = Array.from(Array(activeMinis.length).keys());
export let sortedPvpIDs = pvpIDs; // Just a "declaration"; initialization to be delayed

export function initializeSortedPvpIDs(): void {
  sortedPvpIDs = activeMinisSorted.map((mini) =>
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
}

export const verbose = !get("PVP_MAB_reduced_verbosity", false);

export function getFightRecords(): number[][] {
  return pvpIDs.map((i) => {
    const wins = get(`myCurrentPVPWins_${i}`, 0);
    const losses = get(`myCurrentPVPLosses_${i}`, 0);
    return [wins, losses];
  });
}

export type Strategy = keyof typeof STRATEGIES;
export function getBestMini(): number {
  return STRATEGIES[args.strategy]();
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

export function printStrategiesEstimates(): void {
  const fightRecords = getFightRecords();
  const t = Math.max(1, sumNumbers(fightRecords.map(([wins, losses]) => wins + losses)));
  const gamma = 1 / Math.pow(t, 0.2);
  const K = activeMinis.length;
  const logConst = 2 * Math.log(t);
  const weights = pvpIDs.map((i) => get(`myCurrentPVPMiniExp3Weight_${i}`, 1.0));
  const weightSum = sumNumbers(weights);

  pvpIDs.forEach((i) => {
    const [wins, losses] = fightRecords[i];
    const n = wins + losses;

    // payoffs
    const UCBPayoff = n > 0 ? wins / n + Math.sqrt(logConst / n) : 10;
    const gaussianThompsonPayoff =
      n > 0 ? sampleNormal(wins / n, 1.0 / Math.sqrt(n)) : sampleNormal(0.5, 1e-2);
    const bernoulliThompsonPayoff = sampleBeta(wins, losses);
    const epsilonGreedyPayoff = wins / (wins + losses);
    const Exp3Payoff = ((1 - gamma) * weights[i]) / weightSum + gamma / K;

    const stats = [
      UCBPayoff,
      gaussianThompsonPayoff,
      bernoulliThompsonPayoff,
      epsilonGreedyPayoff,
      Exp3Payoff,
    ]
      .map((val) => val.toFixed(3))
      .join(" | ");

    print(`${activeMinisSorted[i]}: ${stats}`, "blue");
  });
  print();
}

export function updateExp3Weights(): void {
  const fightRecords = getFightRecords();
  const t = Math.max(1, sumNumbers(fightRecords.map(([wins, losses]) => wins + losses)));
  const gamma = 1 / Math.pow(t, 0.2);
  const K = activeMinis.length;

  const weights = pvpIDs.map((i) => get(`myCurrentPVPMiniExp3Weight_${i}`, 1.0));
  const weightSum = sumNumbers(weights);
  const Pr = pvpIDs.map((i) => ((1 - gamma) * weights[i]) / weightSum + gamma / K);
  print("Updating Exp3 Weights...");
  set("logPreferenceChange", false);
  pvpIDs.map((i) => {
    const [wins, losses] = fightRecords[i];
    const n = wins + losses;
    const weightNew = weights[i] * Math.exp((gamma * wins) / (n * Pr[i] * K));
    set(`myCurrentPVPMiniExp3Weight_${i}`, weightNew);
  });
  set("logPreferenceChange", true);
}
