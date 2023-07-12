import { Args } from "grimoire-kolmafia";
import { canInteract } from "kolmafia";
import { abort, hippyStoneBroken } from "kolmafia";
import {
  buy,
  cliExecute,
  itemAmount,
  print,
  pvpAttacksLeft,
  todayToString,
  use,
  visitUrl,
} from "kolmafia";
import { $item, get, maxBy, set, sumNumbers } from "libram";

// The fight page does not sort the minis by alphabetical order
// So we have to reorder them to the rules page
const activeMinis =
  visitUrl("peevpee.php?place=fight")
    .match(RegExp(/option value="\d+"(.*?)>(.*?)<\/option/g))
    ?.splice(3)
    .map((s) => s.replace(/option value="([0-9]+)"(.*?)>/g, "").replace(/<\/option/g, "")) ?? [];
const activeMinisSorted =
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
const pvpIDs = Array.from(Array(activeMinis.length).keys());
const sortedPvpIDs = activeMinis.map((mini) =>
  activeMinisSorted.findIndex((sortedMini) => sortedMini === mini)
);

// activeMinis.forEach((mini, i) => print(`${mini} ${get(`myCurrentPVPMini_${sortedPvpIDs[i]}`)}`));

if (
  !sortedPvpIDs.every(
    (id, i) => id >= 0 && id < activeMinis.length && sortedPvpIDs.indexOf(id) === i
  )
)
  throw new Error(`Error with sortedPvpIDs: ${sortedPvpIDs}`);

const verbose = !get("PVP_MAB_reduced_verbosity", false);

function sampleNormal(mean = 0, stdev = 1): number {
  // Taken from https://stackoverflow.com/a/36481059
  const u = 1 - Math.random(); // Converting [0,1) to (0,1]
  const v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  // Transform to the desired mean and standard deviation:
  return z * stdev + mean;
}

function sampleGamma(a: number): number {
  // Adapted from https://dl.acm.org/doi/pdf/10.1145/358407.358414
  const d = a - 1.0 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    const x = sampleNormal();
    const v = Math.pow(1 + c * x, 3);
    const U = Math.random();
    if (U < 1 - 0.0331 * Math.pow(x, 4)) return d * v;
    else if (Math.log(U) < 0.5 * Math.pow(x, 2) < d * (1 - v + Math.log(v)))
      return d * v;
  }
}

function sampleBeta(a: number, b: number): number {
  const X = sampleGamma(a);
  const Y = sampleGamma(b);
  return X / (X + Y);
}

function getFightRecords(): number[][] {
  return pvpIDs.map((i) => {
    const wins = get(`myCurrentPVPWins_${i}`, 0);
    const losses = get(`myCurrentPVPLosses_${i}`, 0);
    return [wins, losses];
  });
}

export function UCB(): number {
  const fightRecords = getFightRecords();
  const t = Math.max(1, sumNumbers(fightRecords.map(([wins, losses]) => wins + losses)));
  const logConst = 2 * Math.log(t);
  const payoffs = pvpIDs.map((i) => {
    const [wins, losses] = fightRecords[i];
    const n = wins + losses;
    const payoff = n > 0 ? wins / n + Math.sqrt(logConst / n) : 10; // Try all at least once at the start
    // print(`${activeMinisSorted[i]}: ${payoff}`);
    return payoff;
  });
  return sortedPvpIDs[maxBy(pvpIDs, (i) => payoffs[i])];
}

export function gaussianThompson(): number {
  const fightRecords = getFightRecords();
  const payoffs = pvpIDs.map((i) => {
    const [wins, losses] = fightRecords[i];
    const n = wins + losses;
    const payoff = n > 0 ? sampleNormal(wins / n, Math.sqrt(n)) : sampleNormal(0.5, 1e-2);
    // print(`${activeMinisSorted[i]}: ${payoff}`);
    return payoff;
  });
  return sortedPvpIDs[maxBy(pvpIDs, (i) => payoffs[i])];
}

export function bernoulliThompson(): number {
  const fightRecords = getFightRecords();
  const payoffs = pvpIDs.map((i) => {
    const [wins, losses] = fightRecords[i];
    const payoff = sampleBeta(wins, losses);
    // print(`${activeMinisSorted[i]}: ${payoff}`);
    return payoff;
  });
  return sortedPvpIDs[maxBy(pvpIDs, (i) => payoffs[i])];
}

export function epsilonGreedy(): number {
  const fightRecords = getFightRecords();
  const t = Math.max(1, sumNumbers(fightRecords.map(([wins, losses]) => wins + losses)));
  const payoffs = pvpIDs.map((i) => {
    const [wins, losses] = fightRecords[i];
    const payoff = wins / (wins + losses);
    // print(`${activeMinisSorted[i]}: ${payoff}`);
    return payoff;
  });
  const idx = Math.random() <= 1.0 / Math.sqrt(t)
    ? Math.floor(Math.random() * activeMinis.length)
    : maxBy(pvpIDs, (i) => payoffs[i]);
  return sortedPvpIDs[idx];
}

export function Exp3(): number {
  const fightRecords = getFightRecords();
  let carry = 0;
  const t = Math.max(1, sumNumbers(fightRecords.map(([wins, losses]) => wins + losses)));
  const gamma = 1 / Math.sqrt(t);
  const K = activeMinis.length;

  const weights = pvpIDs.map((i) => {
    const [wins, losses] = fightRecords[i];
    const n = wins + losses;
    const w = get(`myCurrentPVPMiniExp3Weight_${i}`, 1.0) * Math.exp(gamma * (wins / n) / K);    
    set(`myCurrentPVPMiniExp3Weight_${i}`, w);
    return w;
  });
  const weightSum = sumNumbers(weights);
  
  const CDF = pvpIDs.map((i) => {
    const prob = (1 - gamma) * weights[i] / weightSum + gamma / K;
    carry += prob;
    // print(`${activeMinisSorted[i]}: ${prob}`);
    return carry;
  });
  const rnd = Math.random() * carry;
  const idx = CDF.findIndex((cdf) => cdf >= rnd);
    
  return sortedPvpIDs[idx];
}

function getBestMini(): number {
  const strategy = get("PVP_MAB_strategy", "UCB").toLowerCase();
  if (strategy === "gaussianthompson") return gaussianThompson();
  else if (strategy === "bernoullithompson") return bernoulliThompson();
  else if (strategy === "epsilongreedy") return epsilonGreedy();
  else if (strategy === "exp3") return Exp3();
  else return UCB(); // default
}

function useMeteoriteade(): void {
  if (!get("PVP_MAB_use_meteoriteade", false)) return;

  const potionsToUse = 3 - get("_meteoriteAdesUsed");
  if (potionsToUse <= 0) return;

  const potionsToBuy = potionsToUse - itemAmount($item`Meteorite-Ade`);
  if (potionsToBuy > 0) buy($item`Meteorite-Ade`, potionsToBuy, 10000);

  use($item`Meteorite-Ade`, potionsToUse);
}

function breakStone(): void {
  if (!args.breakStone && hippyStoneBroken())
    abort("Your stone is unbroken, and you won't let us do it!");

  const buffer = visitUrl("peevpee.php?confirm=on&action=smashstone&pwd");
  if (buffer.includes("Pledge allegiance to"))
    visitUrl("peevpee.php?action=pledge&place=fight&pwd");
}

function updateSeason(): void {
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
  })

  // The rules page simply sorts the minis by alphabetical order
  // We can always see this (even if we don't have any fites left)

  // Reset our season's wins and losses
  set("totalSeasonPVPWins", 0);
  set("totalSeasonPVPLosses", 0);

  // save pvp season as current pvp season
  set("myCurrentPVPSeason", currentSeason);
}

function updateWinRate(): void {
  if (get("todaysPVPDate") !== todayToString()) {
    set("todaysPVPWins", 0);
    set("todaysPVPLosses", 0);
    set("todaysPVPDate", todayToString());
  }
}

function equipPVPOutfit(): void {
  // Can we find a better way to determine if we are already wearing a PVP-optimal outfit?
  cliExecute("unequip all");
  cliExecute("UberPvPOptimizer");
}

function pvpAttack(attackType: string): string {
  const pvpChoice = getBestMini();

  print("");
  print(`Chose mini: ${activeMinis[pvpChoice]}`, "green");

  return visitUrl(
    `peevpee.php?action=fight&place=fight&ranked=1&stance=${pvpChoice}&attacktype=${attackType}&pwd`
  );
}

function parseCompactMode(result: string, whoAreWe: string[]): boolean {
  let slicedResult = result;
  const whoAmI = whoAreWe[0],
    whoAreThey = whoAreWe[1];
  while (slicedResult.includes("td nowrap")) {
    slicedResult = slicedResult.slice(slicedResult.indexOf("<td nowrap>"));
    const curString = slicedResult.slice(0, slicedResult.indexOf("</td></tr>") + 9);
    const mini = (curString
      .match(RegExp(/<td nowrap><b>(.*?)<\/b><\/td>/))
      ?.map((s) => s.replace("<td nowrap><b>", "").replace("</b></td>", "")) ?? [
      "unknown mini",
    ])[0];
    const miniID = activeMinisSorted.findIndex((sortedMini) => sortedMini === mini);

    if (curString.includes("A tie-breaker")) print(`We tied the mini: ${mini}`, "blue");
    else {
      // The winner is whosever's name is bolded
      let weWon = false;
      if (curString.includes(whoAmI)) {
        if (curString.includes(`<b>${whoAmI}</b>`)) weWon = true;
      } else {
        if (!curString.includes(`<b>${whoAreThey}</b>`)) weWon = true;
      }
      if (weWon) {
        if (verbose) print(`We won the mini: ${mini}`, "green");
        set(`myCurrentPVPWins_${miniID}`, get(`myCurrentPVPWins_${miniID}`, 0) + 1);
      } else {
        if (verbose) print(`We lost the mini: ${mini}`, "red");
        set(`myCurrentPVPLosses_${miniID}`, get(`myCurrentPVPLosses_${miniID}`, 0) + 1);
      }
    }
    slicedResult = slicedResult.slice(slicedResult.indexOf("</td></tr>") + 9);
  }

  return slicedResult.includes(whoAmI);
}

function parseNonCompactMode(result: string, whoAreWe: string[]): boolean {
  let slicedResult = result;
  const whoAmI = whoAreWe[0];
  while (slicedResult.includes("Round ")) {
    const splitIdx = slicedResult.slice(5).includes("Round ")
      ? slicedResult.slice(5).indexOf("Round ") + 5
      : slicedResult.indexOf('<div class="final">');
    const curString = slicedResult.slice(0, splitIdx);
    const mini = (curString
      .match(RegExp(/<b class="miniclick">(.*?)<\/b>/))
      ?.map((s) => s.replace('<b class="miniclick">', "").replace("</b>", "")) ?? [
      "unknown mini",
    ])[0];
    const miniID = activeMinisSorted.findIndex((sortedMini) => sortedMini === mini);

    if (curString.includes("A tie-breaker")) print(`We tied the mini: ${mini}`, "blue");
    else {
      let weWon = false;
      if (curString.includes('<td width="80"></td></tr>')) weWon = true;
      if (weWon) {
        if (verbose) print(`We won the mini: ${mini}`, "green");
        set(`myCurrentPVPWins_${miniID}`, get(`myCurrentPVPWins_${miniID}`, 0) + 1);
      } else {
        if (verbose) print(`We lost the mini: ${mini}`, "red");
        set(`myCurrentPVPLosses_${miniID}`, get(`myCurrentPVPLosses_${miniID}`, 0) + 1);
      }
    }
    slicedResult = slicedResult.slice(splitIdx);
  }

  return slicedResult.includes(whoAmI);
}

function parseResult(result: string): boolean {
  const whoAreWe =
    result
      .match(RegExp(/<a(.*?)showplayer(.*?)>(.*?)<\/a>(.*?)showplayer(.*?)>(.*?)<\/a>/))
      ?.filter((s, i) => [3, 6].includes(i))
      .map((s) => s.replace("<b>", "").replace("</b>", "")) ?? [];
  const whoAmI = whoAreWe[0],
    whoAreThey = whoAreWe[1];

  let slicedResult = result.slice(result.indexOf(whoAmI));
  if (slicedResult.includes("Wins!")) {
    slicedResult = slicedResult.slice(0, slicedResult.indexOf("Wins!") + 4);
  } else {
    slicedResult = slicedResult.slice(
      slicedResult.indexOf("Round ") + 5,
      slicedResult.indexOf("the fight,") + 9
    );
  }

  // Vanilla KoL has a comact mode for PVP, which returns different html results
  const compactMode = slicedResult.includes("td nowrap");
  const wonFight = compactMode
    ? parseCompactMode(slicedResult, whoAreWe)
    : parseNonCompactMode(slicedResult, whoAreWe);

  if (wonFight) print(`We beat ${whoAreThey}!`, "green");
  else print(`${whoAreThey} beat us!`, "red");

  return wonFight;
}

function printStats(): void {
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

type PvpTarget = "fame" | "loot" | "flowers";

const args = Args.create("pvp_mab", "A multi-armed bandit script for pvp", {
  breakStone: Args.flag({
    help: "Should pvp_mab break your stone?",
    default: true,
  }),
  target: Args.custom<PvpTarget>(
    {
      default: canInteract() ? "loot" : "fame",
      options: [["fame"], ["loot"], ["flowers"]],
    },
    (x) => x as PvpTarget,
    "pvp target"
  ),
});

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
      const result = pvpAttack(attackType);
      if (result.includes("Sorry, I couldn't find the player")) {
        print("Could not find anyone to fight!", "red");
        break;
      }
      parseResult(result)
        ? set("todaysPVPWins", (todaysWins += 1))
        : set("todaysPVPLosses", (todaysLosses += 1));
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
