# Netview — Feature Checklist

Use this document to confirm graph viewer functionality. Open [netview.html](netview.html) and work through each section.

**Quick start:** pick a graph from the **sample graphs** dropdown (e.g. `example_graph.json`), keep the **Netview** panel open on the left, then open the **Features** panel (top right) to see live status.

---

## 1. Loading

| # | Feature | How to verify | Example |
|---|---------|---------------|---------|
| 1.1 | **Sample graph picker** | Choose a graph from the dropdown in the Load section. Graph loads immediately. | ✓ |
| 1.2 | **Load from file** | Click *Load JSON*, choose any valid graph JSON file. Stats update; graph renders. | |
| 1.3 | **Drag and drop** | Drop a `.json` file anywhere on the page. Overlay appears during drag; graph loads on drop. | |
| 1.4 | **URL parameter** | Open `netview.html?src=example_graph.json`. Graph loads automatically. | |
| 1.5 | **Format validation** | Load a file missing `nodes`, `edges`, or required fields. A red error appears; graph does not render. | |

### Required JSON shape (fmt spec)

- Top level: `metadata` (object), `nodes` (array), `edges` (array)
- Each node: `index` (matches array position), `address` (string)
- Each edge: `index`, `source`, `target`, `source_index`, `target_index`

See [graph_format.html](graph_format.html) for the full specification.

---

## 2. Directed edges

| # | Feature | How to verify | Example |
|---|---------|---------------|---------|
| 2.1 | **Arrowheads** | Every edge shows a triangular arrow at the target end. | ✓ |
| 2.2 | **Direction** | Hover an edge — tooltip shows `source → target` addresses. | ✓ |
| 2.3 | **Reverse pairs** | Nodes 0↔1 have edges in both directions (indices 0, 1, 5 in example). Arrows point opposite ways. | ✓ |

---

## 3. Parallel edges

| # | Feature | How to verify | Example |
|---|---------|---------------|---------|
| 3.1 | **Separate curves** | Multiple edges between the same directed pair fan out as distinct curved paths, not stacked. | ✓ |
| 3.2 | **Lane count** | Example: three edges 1→0 (indices 1, 5) and two edges 0→1 (indices 0) — parallel pairs are visually separated. | ✓ |
| 3.3 | **Independent hover** | Each parallel edge is individually pickable with its own tooltip. | |

---

## 4. Component coloring

| # | Feature | How to verify | Example |
|---|---------|---------------|---------|
| 4.1 | **Node color** | Nodes in the same `group` share a hue. Example: group 0 (left cluster) vs group 1 (right pair). | ✓ |
| 4.2 | **Edge color** | Edge color matches its `group` (or source node's group). | ✓ |
| 4.3 | **Component count** | Left panel *components* row matches `metadata.grouping.group_count` or distinct group values. | ✓ |

---

## 5. Layout modes

| # | Feature | How to verify | Example |
|---|---------|---------------|---------|
| 5.1 | **Baked x,y** | With example loaded, select *baked x,y*. Nodes snap to positions from the file (`x`, `y` fields). | ✓ |
| 5.2 | **Force layout** | Select *force*. Nodes animate into a force-directed layout; progress bar fills. | ✓ |
| 5.3 | **Switch back** | Toggle baked ↔ force. Baked restores file positions; force re-runs simulation. | |
| 5.4 | **Missing positions** | Load a graph where `x`/`y` are null. *baked x,y* is disabled; force layout runs instead. | |
| 5.5 | **Auto fit** | On load and layout change, view zooms to fit all nodes. Pan/zoom disables auto-fit until next layout. | |

---

## 6. Timeline

| # | Feature | How to verify | Example |
|---|---------|---------------|---------|
| 6.1 | **Timeline slider** | Load a graph with timestamps. Slider range spans earliest to latest edge timestamp. | ✓ |
| 6.2 | **Up to time mode** | Select *up to time*. As you scrub forward, edges accumulate through the selected timestamp. | ✓ |
| 6.3 | **Current only mode** | Select *current only*. Only edges at the selected timestamp remain visible. | ✓ |
| 6.4 | **Visible edge count** | Timeline section and top *edges* stat update as the visible edge subset changes. | ✓ |
| 6.5 | **No timestamp fallback** | Load a graph without edge timestamps. Timeline disables and all edges remain visible. | |

---

## 7. Edge display control

| # | Feature | How to verify | Example |
|---|---------|---------------|---------|
| 7.1 | **Color by ETH** | In *Edge Display*, choose *color by ETH*. Edges switch to fixed width and use a blue→gold ETH-value ramp. | ✓ |
| 7.2 | **Width by ETH** | Choose *width by ETH*. Edges switch back to component color and width scales with `value_eth`. | ✓ |
| 7.3 | **0 ETH legend** | In *color by ETH* mode, legend shows a magenta swatch labeled `0 ETH transaction`. | ✓ |
| 7.4 | **0 ETH distinct color** | Example edge 3 (`value_eth: 0.0`) renders in magenta in *color by ETH* mode. | ✓ |

---

## 8. Interaction

| # | Feature | How to verify | Example |
|---|---------|---------------|---------|
| 8.1 | **Pan** | Click-drag the canvas. View moves. | |
| 8.2 | **Zoom** | Scroll wheel zooms in/out. | |
| 8.3 | **Node tooltip** | Hover a node — address, group, tx counts, optional attributes (`ens_name`, bridge flags). NFT nodes show an **NFT NODE** badge. | ✓ |
| 8.4 | **Edge tooltip** | Hover an edge — source, target, value, timestamp, optional fields (`collection`, `is_seed`). | ✓ |
| 8.5 | **Token on hover** | Hover a token-tagged edge — token label (e.g. `#TokenZMF8`) appears prominently. | ✓ |
| 8.6 | **Timestamp on hover** | Edge tooltip includes formatted transaction time from `timestamp`. | ✓ |

---

## 9. Visual encoding

| # | Feature | How to verify | Example |
|---|---------|---------------|---------|
| 9.1 | **Edge width** | In *width by ETH* mode, thicker edges correspond to higher `value_eth`. | ✓ |
| 9.2 | **Fixed-width edges** | In *color by ETH* mode, all edges use the same thicker fixed width. | ✓ |
| 9.3 | **Node size** | Larger nodes have more `in_tx` + `out_tx`. | ✓ |
| 9.4 | **Cut vertex ring** | Node 1 (`is_bridge`) shows a gold ring. | ✓ |
| 9.5 | **Cabal bridge ring** | If `cabal_bridge` is set, node shows a white ring. | |
| 9.6 | **NFT node highlight** | Nodes with `nft: true` show gold fill, magenta ring, and outer halo. | ✓ |
| 9.7 | **Token edge color** | Edges with non-empty `token` render in bright cyan. | ✓ |

---

## 10. Panel toggles

| # | Feature | How to verify | Example |
|---|---------|---------------|---------|
| 10.1 | **Netview panel toggle** | Click *Netview* (top left). The left control panel slides closed; click again to reopen. | ✓ |
| 10.2 | **Netview close button** | Click `×` in the Netview panel header. Panel closes and leaves the top-left toggle visible. | ✓ |
| 10.3 | **Features toggle** | Click *Features* (top right). Panel slides in; click again to hide. | ✓ |
| 10.4 | **Features close button** | Click `×` in the Features panel header. Panel closes and leaves the top-right toggle visible. | ✓ |
| 10.5 | **Features live status** | Green dots = confirmed active. Grey = not yet applicable. Yellow = loaded but optional data absent. | ✓ |
| 10.6 | **Doc link** | Features panel links to this checklist (`netview_features.md`). | ✓ |

---

## 11. Example graph spot-check

After **Load Example**, confirm these specifics from `example_graph.json`:

- [ ] **6 nodes**, **8 edges**, **2 components**
- [ ] Left cluster (group 0): addresses `0xaaaa…0001` through `0xaaaa…0004`
- [ ] Right pair (group 1): addresses `0xbbbb…0001`, `0xbbbb…0002`
- [ ] Node 0 has `ens_name: moonwhale.eth` in tooltip
- [ ] Node 1 shows cut-vertex ring (`is_bridge`)
- [ ] Edge 3 (`is_seed: true`, zero value) is visible with seed note in tooltip
- [ ] Edge 3 turns magenta in *color by ETH* mode and matches the `0 ETH transaction` legend
- [ ] Three parallel edges between nodes 0 and 1 render as separate curves

---

## Notes

- Mark **Example** column ✓ when verified with the built-in example graph.
- Features marked optional (parallel edges, bridges) show yellow in the panel when the loaded graph lacks that data — this is expected, not a failure.
- For graphs without baked layout, force mode is the default and only available option.
