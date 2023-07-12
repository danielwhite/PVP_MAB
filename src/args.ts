import { Args } from "grimoire-kolmafia";
import { canInteract } from "kolmafia";

type PvpTarget = "fame" | "loot" | "flowers";

export const args = Args.create("pvp_mab", "A multi-armed bandit script for pvp", {
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
  debug: Args.flag({
    help: "Print debugging information for strategies",
    default: false,
  }),
});
