import { get, maxBy, set, sumNumbers } from "libram";
import { sampleBeta, sampleNormal } from "./distributions";
import { activeMinis, getFightRecords, pvpIDs, sortedPvpIDs } from "./lib";

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
  const idx =
    Math.random() <= 1.0 / Math.sqrt(t)
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
    const w = get(`myCurrentPVPMiniExp3Weight_${i}`, 1.0) * Math.exp((gamma * (wins / n)) / K);
    set(`myCurrentPVPMiniExp3Weight_${i}`, w);
    return w;
  });
  const weightSum = sumNumbers(weights);

  const CDF = pvpIDs.map((i) => {
    const prob = ((1 - gamma) * weights[i]) / weightSum + gamma / K;
    carry += prob;
    // print(`${activeMinisSorted[i]}: ${prob}`);
    return carry;
  });
  const rnd = Math.random() * carry;
  const idx = CDF.findIndex((cdf) => cdf >= rnd);

  return sortedPvpIDs[idx];
}
