# PVP_MAB

`PVP_MAB` is a [Multi-Armed Bandit](https://en.wikipedia.org/wiki/Multi-armed_bandit) PVP Script that seeks to automatically figure out which is your strongest minigame in a given PVP season, and does so (figuring out the strongest minigame) as fast as possible.

The implementation is an epsilon-decreasing multi-armed bandit strategy (from 0.9 to 0.05 linearly over ~1000 pvp fights minis) which attempts to estimate your best minigame and plays that mini (1-epsilon)x100% of the time, and otherwise chooses to play the other minis uniformly at random. (Advanced users can probably code up a more complex strategy if so desired [e.g. Thompson sampling or UCB] - this was just a pretty simple implementation).

This script has a hardcoded dependency on UberPVPOptimizer, but may otherwise be run out of the box (it currently accepts no arguments and will simply use all of your remaining pvp fights). It should reset the stats every time the season changes (unfortunately, this means that even if a mini is repeated in the future, we do not consider how it has performed historically in the previous PVP seasons), so unless there's a drastic change to the peevpee.php?place=fight page, there's pretty much no upkeep to be done on the script.

## Installation

To install the script, use the following command in the KoLMafia CLI.

```text
git checkout https://github.com/Pantocyclus/PVP_MAB.git release
```

## Running the Script

To run the script, simply type `PVP_MAB` into the CLI.
