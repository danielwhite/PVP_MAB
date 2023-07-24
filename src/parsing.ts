import { print } from "kolmafia";
import { get, set } from "libram";
import { activeMinisSorted, prefChangeSettings, verbose } from "./lib";

export function parseCompactMode(result: string, whoAreWe: string[]): boolean {
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
      // updateExpBandits(miniID, weWon);
    }
    slicedResult = slicedResult.slice(slicedResult.indexOf("</td></tr>") + 9);
  }

  return slicedResult.includes(whoAmI);
}

export function parseNonCompactMode(result: string, whoAreWe: string[]): boolean {
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
      // updateExpBandits(miniID, weWon);
    }
    slicedResult = slicedResult.slice(splitIdx);
  }

  return slicedResult.includes(whoAmI);
}

export function parseResult(result: string): boolean {
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

  set("logPreferenceChange", false);
  const wonFight = compactMode
    ? parseCompactMode(slicedResult, whoAreWe)
    : parseNonCompactMode(slicedResult, whoAreWe);
  set("logPreferenceChange", prefChangeSettings);

  if (wonFight) print(`We beat ${whoAreThey}!`, "green");
  else print(`${whoAreThey} beat us!`, "red");

  return wonFight;
}
