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
import { $item, get, have, set, sumNumbers } from "libram";
import * as STRATEGIES from "./strategies";
import { args } from "./args";
import { sampleBeta, sampleNormal } from "./distributions";
import { ratio } from "fuzzball";

export const prefChangeSettings = get("logPreferenceChange");

// So we have to reorder them to the rules page
// This will be empty if we haven't broken the stone or have 0 fites left
export let activeMinis = xpath(
  visitUrl("peevpee.php?place=fight"),
  "//select[@name='stance']/option/text()"
);

export const activeMinisSorted = xpath(
  visitUrl("peevpee.php?place=rules"),
  "//tr[@class='small']/td[@nowrap]/text()"
).map((sortedMini) => (sortedMini.slice(-1) === "*" ? sortedMini.slice(0, -1) : sortedMini));

export const pvpIDs = Array.from(Array(activeMinisSorted.length).keys());
export let sortedPvpIDs = pvpIDs; // Just a "declaration"; initialization to be delayed

export function initializeSortedPvpIDs(): void {
  sortedPvpIDs = activeMinisSorted.map((sortedMini) =>
    activeMinis.indexOf(
      activeMinis.reduce((a, b) => (ratio(a, sortedMini) > ratio(b, sortedMini) ? a : b))
    )
  );

  if (
    !sortedPvpIDs.every(
      (id, i) => id >= 0 && id < activeMinis.length && sortedPvpIDs.indexOf(id) === i
    )
  ) {
    sortedPvpIDs.forEach((sortedID, id) =>
      print(`Mapping ${activeMinis[sortedID]} to ${activeMinisSorted[id]}`)
    );
    throw new Error(`Error with sortedPvpIDs: ${sortedPvpIDs}!`);
  }

  if (
    sortedPvpIDs.filter((id, i) => sortedPvpIDs.indexOf(id) === i).length !== sortedPvpIDs.length
  ) {
    sortedPvpIDs.forEach((sortedId, id) =>
      print(`Mapping ${activeMinis[sortedId]} to ${activeMinisSorted[id]}`)
    );
    throw new Error(`Error with mapping!`);
  }
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

export function usePunchingMirror(): void {
  // eslint-disable-next-line libram/verify-constants
  if (!have($item`punching mirror`) || get("_punchingMirrorUsed", false)) return;
  // eslint-disable-next-line libram/verify-constants
  use($item`punching mirror`);
}

export function useDiploma(): void {
  if (!have($item`School of Hard Knocks Diploma`) || get("_hardKnocksDiplomaUsed")) return;
  use($item`School of Hard Knocks Diploma`);
}

export function breakStone(): void {
  if (!args.breakStone && !hippyStoneBroken()) {
    abort("Your stone is unbroken, and you won't let us do it!");
  }

  const buffer = visitUrl("peevpee.php?confirm=on&action=smashstone&pwd");
  if (buffer.includes("Pledge allegiance to"))
    visitUrl("peevpee.php?action=pledge&place=fight&pwd");

  // Update activeMinis if we just broke the stone
  activeMinis = xpath(
    visitUrl("peevpee.php?place=fight"),
    "//select[@name='stance']/option/text()"
  );
}

export function updateSeason(): void {
  const currentSeason = Array.from(
    visitUrl("peevpee.php?place=rules").match(
      RegExp(/<b>Current Season: <\/b>(.*?)( \\(Post-Season\\))?<br \/>/)
    ) ?? ["", "0"]
  )[1];

  if (
    get("myCurrentPVPSeason", "") === currentSeason &&
    get("totalSeasonPVPWins", 0) + get("totalSeasonPVPLosses", 0) > 0
  )
    return;
  if (!hippyStoneBroken())
    throw new Error("We cannot update the season until you've broken your stone!");
  if (pvpIDs.length === 0) throw new Error("There are current no valid PVP minis!");

  // Reset wins and losses (pad all at 7 wins 7 losses [prime numbers good])
  pvpIDs.forEach((i) => {
    set(`myCurrentPVPWins_${i}`, 7);
    set(`myCurrentPVPLosses_${i}`, 7);
    set(`myCurrentPVPMini_${i}`, "");
    set(`myCurrentPVPMini_${i}`, activeMinisSorted[i]);
  });

  /*
  pvpIDs.forEach((i) => {
    set(`myCurrentPVPMiniExp3Weight_${i}`, 1.0);
    set(`myCurrentPVPMiniExp3IXWeight_${i}`, 0.0);
  });
  */

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
  if (args.no_optimize) return;

  // Can we find a better way to determine if we are already wearing a PVP-optimal outfit?
  cliExecute("unequip all");
  cliExecute("UberPvPOptimizer");
}

export function pvpAttack(attackType: string): string {
  const pvpChoice = getBestMini();

  print("");
  print(`Chose mini: ${activeMinis[pvpChoice]}`, "green");

  const beforePVPScriptName = get("beforePVPScript");
  if (beforePVPScriptName.length > 0) cliExecute(beforePVPScriptName);
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
  const logConst = 2 * Math.log(t);
  // const Exp3Ls = pvpIDs.map((i) => get(`myCurrentPVPMiniExp3Weight_${i}`, 1.0));
  // const Exp3Ps = getExp3Probabilities(Exp3Ls);
  // const Exp3IXLs = pvpIDs.map((i) => get(`myCurrentPVPMiniExp3IXWeight_${i}`, 1.0));
  // const Exp3IXPs = getExp3IXProbabilities(Exp3IXLs);

  pvpIDs.forEach((i) => {
    const [wins, losses] = fightRecords[i];
    const n = wins + losses;

    // payoffs
    const UCBPayoff = n > 0 ? wins / n + Math.sqrt(logConst / n) : 10;
    const gaussianThompsonPayoff =
      n > 0 ? sampleNormal(wins / n, 1.0 / Math.sqrt(n)) : sampleNormal(0.5, 1e-2);
    const bernoulliThompsonPayoff = sampleBeta(wins, losses);
    const epsilonGreedyPayoff = wins / (wins + losses);
    // const Exp3Payoff = Exp3Ps[i];
    // const Exp3IXPayoff = Exp3IXPs[i];

    const stats = [
      UCBPayoff,
      gaussianThompsonPayoff,
      bernoulliThompsonPayoff,
      epsilonGreedyPayoff,
      // Exp3Payoff,
      // Exp3IXPayoff,
    ]
      .map((val) => val.toFixed(3))
      .join(" | ");

    print(`${activeMinisSorted[i]}: ${stats}`, "blue");
  });
  print();
}

export function sampleProbabilitiesIdx(Ps: number[]): number {
  let carry = 0.0;
  const PCumSum = Ps.map((P) => {
    carry += P;
    return carry;
  });

  const rnd = Math.random() * carry;
  return PCumSum.findIndex((v) => v >= rnd);
}

/*
const Exp3Gamma = 0.05;
export function getExp3Probabilities(Ls: number[]): number[] {
  const K = activeMinis.length;

  const LSum = sumNumbers(Ls);
  return Ls.map((L) => ((1 - Exp3Gamma) * L) / LSum + Exp3Gamma / K);
}

const Exp3IXHorizon = 1000;
export function getExp3IXProbabilities(Ls: number[]): number[] {
  const K = activeMinis.length;

  const eta = Math.sqrt((2.0 * Math.log(K + 1)) / (Exp3IXHorizon * K));

  const Es = Ls.map((L) => Math.exp(-eta * L));
  const ESum = sumNumbers(Es);
  return Es.map((E) => E / ESum);
}

export function updateExpBandits(miniID: number, result: boolean): void {
  updateExp3Weights(miniID, result);
  updateExp3IXWeights(miniID, result);
}

function updateExp3Weights(miniID: number, result: boolean): void {
  const K = activeMinis.length;

  const Ls = pvpIDs.map((i) => {
    const L = Number(get(`myCurrentPVPMiniExp3Weight_${i}`));
    return L === 0.0 ? 1.0 : L;
  });
  const Ps = getExp3Probabilities(Ls);
  const reward = result ? 1.0 / Ps[miniID] : 0.0;

  set(`myCurrentPVPMiniExp3Weight_${miniID}`, Ls[miniID] * Math.exp((reward * Exp3Gamma) / K));
}

function updateExp3IXWeights(miniID: number, result: boolean): void {
  const K = activeMinis.length;

  const eta = Math.sqrt((2.0 * Math.log(K + 1)) / (Exp3IXHorizon * K));
  const gamma = eta / 2.0;

  const Ls = pvpIDs.map((i) => Number(get(`myCurrentPVPMiniExp3IXWeight_${i}`)));
  const Ps = getExp3IXProbabilities(Ls);

  const reward = result ? 1.0 : 0.0;

  set(`myCurrentPVPMiniExp3IXWeight_${miniID}`, Ls[miniID] + (1.0 - reward) / (Ps[miniID] + gamma));
}
*/
