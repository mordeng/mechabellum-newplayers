# Contributing

The whole counter database is one file: [`data/units.json`](data/units.json). No code changes needed to improve the app's advice.

## Quick ways to help

- **Open an issue** — the app's "Suggest a change" button pre-fills one for you. Say which unit, what should change, and why (a replay, your experience, a source).
- **Open a PR** — edit `data/units.json` directly.

## Data format

Each unit looks like this:

```jsonc
{
  "id": "steel-ball",          // kebab-case, must be unique
  "name": "Steel Ball",
  "emoji": "🔩",               // shown in the UI
  "cost": 200,                 // supply cost
  "type": "ground",            // "ground" | "air"
  "giant": false,
  "description": "One or two sentences on the unit's role.",
  "counters": [                // units THIS unit is good against
    { "unit": "Melting Point", "reason": "why it works", "strength": 3 }
  ],
  "counteredBy": [             // units that beat THIS unit
    { "unit": "Scorpion", "reason": "why it works", "strength": 3 }
  ],
  "tips": ["Practical advice: tech, positioning, common mistakes."]
}
```

Rules of thumb:

- `strength`: `1` = soft counter (situational/tech-dependent), `2` = good counter (the default — you can omit it), `3` = hard counter (the go-to answer).
- `unit` names in `counters` / `counteredBy` must exactly match another unit's `name`.
- A matchup only needs to be listed on **one** side — the app merges `counters` and `counteredBy` from both units. Listing it on both sides is fine too (the first reason found wins).
- Keep `reason` to one sentence a new player can act on. "Outranges it and kills it before it closes the gap" beats "it's just better".

## Validate before you PR

```bash
node -e "
const d = require('./data/units.json');
const ids = new Set(d.units.map(u => u.id));
const toId = n => n.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-');
let bad = 0;
for (const u of d.units)
  for (const list of ['counters','counteredBy'])
    for (const c of (u[list]||[]))
      if (!ids.has(toId(c.unit))) { console.log('UNRESOLVED:', u.id, list, c.unit); bad++; }
console.log(bad ? bad + ' problems' : 'OK');
"
```

## After balance patches

Costs and matchups drift with patches. When the game updates, PRs that adjust `cost`, add new units, or re-rate strengths are very welcome — mention the patch version in the PR description.
