import { get, maxBy, sumNumbers } from "libram";
import { sampleBeta, sampleNormal } from "./distributions";
import {
  activeMinis,
  activeMinisSorted,
  getExp3IXProbabilities,
  getExp3Probabilities,
  getFightRecords,
  pvpIDs,
  sampleProbabilitiesIdx,
  sortedPvpIDs,
} from "./lib";
import { print } from "kolmafia";
import { args } from "./args";

export function UCB(): number {
  if (args.debug) print("Using UCB strategy", "blue");
  const fightRecords = getFightRecords();
  const t = Math.max(1, sumNumbers(fightRecords.map(([wins, losses]) => wins + losses)));
  const logConst = 2 * Math.log(t);
  const payoffs = pvpIDs.map((i) => {
    const [wins, losses] = fightRecords[i];
    const n = wins + losses;
    const payoff = n > 0 ? wins / n + Math.sqrt(logConst / n) : 10; // Try all at least once at the start
    if (args.debug) print(`${activeMinisSorted[i]}: ${payoff.toFixed(3)}`, "blue");
    return payoff;
  });
  return sortedPvpIDs[maxBy(pvpIDs, (i) => payoffs[i])];
}

export function gaussianThompson(): number {
  if (args.debug) print("Using Gaussian Thompson strategy", "blue");
  const fightRecords = getFightRecords();
  const payoffs = pvpIDs.map((i) => {
    const [wins, losses] = fightRecords[i];
    const n = wins + losses;
    const payoff = n > 0 ? sampleNormal(wins / n, 1.0 / Math.sqrt(n)) : sampleNormal(0.5, 1e-2);
    if (args.debug) print(`${activeMinisSorted[i]}: ${payoff.toFixed(3)}`, "blue");
    return payoff;
  });
  return sortedPvpIDs[maxBy(pvpIDs, (i) => payoffs[i])];
}

export function bernoulliThompson(): number {
  if (args.debug) print("Using Bernoulli Thompson strategy", "blue");
  const fightRecords = getFightRecords();
  const payoffs = pvpIDs.map((i) => {
    const [wins, losses] = fightRecords[i];
    const payoff = sampleBeta(wins, losses);
    if (args.debug) print(`${activeMinisSorted[i]}: ${payoff.toFixed(3)}`, "blue");
    return payoff;
  });
  return sortedPvpIDs[maxBy(pvpIDs, (i) => payoffs[i])];
}

export function epsilonGreedy(): number {
  if (args.debug) print("Using Epsilon Greedy strategy", "blue");
  const fightRecords = getFightRecords();
  const t = Math.max(1, sumNumbers(fightRecords.map(([wins, losses]) => wins + losses)));
  const payoffs = pvpIDs.map((i) => {
    const [wins, losses] = fightRecords[i];
    const payoff = wins / (wins + losses);
    if (args.debug) print(`${activeMinisSorted[i]}: ${payoff.toFixed(3)}`, "blue");
    return payoff;
  });
  const idx =
    Math.random() <= 1.0 / Math.sqrt(t)
      ? Math.floor(Math.random() * activeMinis.length)
      : maxBy(pvpIDs, (i) => payoffs[i]);
  return sortedPvpIDs[idx];
}

export function Exp3(): number {
  if (args.debug) print("Using Exp3 strategy", "blue");
  const Ls = sortedPvpIDs.map((i) => {
    const L = Number(get(`myCurrentPVPMiniExp3Weight_${i}`));
    return L === 0.0 ? 1.0 : L;
  });
  const Ps = getExp3Probabilities(Ls);
  if (args.debug) Ps.forEach((P, i) => print(`${activeMinisSorted[i]}: ${P.toFixed(3)}`, "blue"));

  const idx = sampleProbabilitiesIdx(Ps);

  return sortedPvpIDs[idx];
}

export function Exp3IX(): number {
  if (args.debug) print("Using Exp3IX strategy", "blue");
  const Ls = sortedPvpIDs.map((i) => Number(get(`myCurrentPVPMiniExp3IXWeight_${i}`)));
  const Ps = getExp3IXProbabilities(Ls);
  if (args.debug) Ps.forEach((P, i) => print(`${activeMinisSorted[i]}: ${P.toFixed(3)}`, "blue"));

  const idx = sampleProbabilitiesIdx(Ps);

  return sortedPvpIDs[idx];
}
