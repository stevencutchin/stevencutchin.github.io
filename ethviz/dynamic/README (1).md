# deck.gl examples — Ethereum transaction networks

Three deck.gl visualizations that load from a shared **`transactions.csv`** (100 transfers).
Node positions and communities are *derived* from the transactions at load time — the CSV
holds only raw edges, like a real chain export.

## Files

| File | Layer(s) | Shows |
|---|---|---|
| `01-transaction-flows.html` | `PathLayer` + `ScatterplotLayer` | Value flowing between addresses; color/width encode ETH |
| `02-aggregation-density.html` | `ScreenGridLayer` | Endpoint binning — the scale technique, shown small |
| `03-network-graph.html` | `LineLayer` + `ScatterplotLayer` | Community structure; hue = cluster, size = degree |
| `04-time-series.html` | `ScatterplotLayer` + `LineLayer` + `TextLayer` | Transactions by time (x) and value (y, log ETH); static temporal layout |
| `viz-common.js` | — | Shared CSV parse, graph build, force layout, community detection, colors, loader |
| `transactions.csv` | — | 100 synthetic Ethereum transactions |

## Running

A page opened by double-clicking runs on `file://`, where browsers **block `fetch()` of a
local CSV** (CORS). Two ways around it:

**Recommended — local server** (run in this folder):

```
python3 -m http.server
# then open http://localhost:8000/01-transaction-flows.html
```

**Or — file picker.** If a page can't fetch the CSV, it shows a "Choose CSV file" button;
pick `transactions.csv` and it loads. No server needed.

deck.gl loads from unpkg, so an internet connection is needed on first open either way.

## CSV schema

```
hash, block_number, timestamp, datetime_utc,
from_address, to_address, value_eth, value_wei,
gas_used, gas_price_gwei, tx_fee_eth
```

Only `from_address`, `to_address`, and `value_eth` are required by the examples; the rest
show up in tooltips or are there for realism. To use real data, export from Etherscan or a
node and rename columns to match (or adjust `buildGraph` in `viz-common.js`).

## How layout works here vs. your pipeline

`viz-common.js` runs a small Fruchterman-Reingold force layout **live in the browser** —
fine at 52 nodes. It's a stand-in for the **offline cuGraph ForceAtlas2 pass on Borah**:
at real scale you bake positions offline and the browser does only lookup + draw.
Communities come from label propagation on the transaction graph; with real cluster labels
you'd skip that step.

## Mapping to your pipeline

- **Flows (01)** use in-plane bezier paths, not `ArcLayer` — an arc's curve bulges along z,
  invisible to a top-down `OrthographicView`. The baked polylines are the shape a
  width-varying **`RibbonLayer`** consumes; feed per-vertex widths to taper them.
- **Aggregation (02)** is the pixels-per-entity argument. `ScreenGridLayer` bins in *screen*
  space (rebins on zoom). For the LOD story you want *world*-space binning
  (`HexagonLayer`/`GridLayer`) — the runtime cousin of your **pre-baked LOD tiles**, where
  the level switch is the LOD. At 100 points this only shows the mechanism; grow the CSV to
  feel it.
- **Graph (03)** keeps the browser to lookup + draw; layout is precomputed.
- **Time series (04)** is the only view with real axes. Position is computed (time -> x,
  log value -> y); gridlines (`LineLayer`) and tick labels (`TextLayer`) live in world space,
  so they pan and zoom with the data and stay correct. `OrthographicView` keeps its default
  `flipY`, and the y mapping is inverted so high value sits at the top.

Layers use `*Units: 'common'` (world units, scale with zoom) plus `*MinPixels` floors, so
thin edges and rare paths stay visible at overview without width inflation.

## To React (your stack)

Scripting API maps 1:1: `new deck.PathLayer({...})` becomes `import { PathLayer } from
'@deck.gl/layers'`, same props. Wrap a `TileLayer` and return these in `renderSubLayers`
for the LOD pyramid.

## Scale knob

In `viz-common.js`, swap the data source or generate a larger CSV. Example 02 is built to
keep up; 01 and 03 are per-transaction views meant for the readable end of the range.
