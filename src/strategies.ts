import { get, maxBy, set, sumNumbers } from "libram";
import { sampleBeta, sampleNormal } from "./distributions";
import { activeMinis, activeMinisSorted, getFightRecords, pvpIDs, sortedPvpIDs } from "./lib";
import { print } from "kolmafia";
import { args } from "./args";

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
  const fightRecords = getFightRecords();
  let carry = 0;
  const t = Math.max(1, sumNumbers(fightRecords.map(([wins, losses]) => wins + losses)));
  const gamma = 1 / Math.pow(t, 0.2);
  const K = activeMinis.length;
  const weights = pvpIDs.map((i) => get(`myCurrentPVPMiniExp3Weight_${i}`, 1.0));
  const weightSum = sumNumbers(weights);

  const CDF = pvpIDs.map((i) => {
    const prob = ((1 - gamma) * weights[i]) / weightSum + gamma / K;
    carry += prob;
    if (args.debug) print(`${activeMinisSorted[i]}: ${prob.toFixed(3)}`, "blue");
    return carry;
  });
  const rnd = Math.random() * carry;
  const idx = CDF.findIndex((cdf) => cdf >= rnd);

  return sortedPvpIDs[idx];
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
