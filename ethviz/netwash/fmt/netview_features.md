# Netview — Feature Checklist

Use this document to confirm graph viewer functionality. Open [netview.html](netview.html) and work through each section.

**Quick start:** pick a graph from the **sample graphs** dropdown (e.g. `example_graph.json`), then open the **Features** panel (top right) to see live status.

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

## 6. Interaction

| # | Feature | How to verify | Example |
|---|---------|---------------|---------|
| 6.1 | **Pan** | Click-drag the canvas. View moves. | |
| 6.2 | **Zoom** | Scroll wheel zooms in/out. | |
| 6.3 | **Node tooltip** | Hover a node — address, group, tx counts, optional attributes (`ens_name`, bridge flags). | ✓ |
| 6.4 | **Edge tooltip** | Hover an edge — source, target, value, optional fields (`collection`, `is_seed`). | ✓ |

---

## 7. Visual encoding

| # | Feature | How to verify | Example |
|---|---------|---------------|---------|
| 7.1 | **Edge width** | Thicker edges correspond to higher `value_eth`. | ✓ |
| 7.2 | **Node size** | Larger nodes have more `in_tx` + `out_tx`. | ✓ |
| 7.3 | **Cut vertex ring** | Node 1 (`is_bridge`) shows a gold ring. | ✓ |
| 7.4 | **Cabal bridge ring** | If `cabal_bridge` is set, node shows a white ring. | |

---

## 8. Features panel

| # | Feature | How to verify | Example |
|---|---------|---------------|---------|
| 8.1 | **Toggle** | Click *Features* (top right). Panel slides in; click again to hide. | ✓ |
| 8.2 | **Live status** | Green dots = confirmed active. Grey = not yet applicable. Yellow = loaded but optional data absent. | ✓ |
| 8.3 | **Doc link** | Panel links to this checklist (`netview_features.md`). | ✓ |

---

## 9. Example graph spot-check

After **Load Example**, confirm these specifics from `example_graph.json`:

- [ ] **6 nodes**, **8 edges**, **2 components**
- [ ] Left cluster (group 0): addresses `0xaaaa…0001` through `0xaaaa…0004`
- [ ] Right pair (group 1): addresses `0xbbbb…0001`, `0xbbbb…0002`
- [ ] Node 0 has `ens_name: moonwhale.eth` in tooltip
- [ ] Node 1 shows cut-vertex ring (`is_bridge`)
- [ ] Edge 3 (`is_seed: true`, zero value) is visible with seed note in tooltip
- [ ] Three parallel edges between nodes 0 and 1 render as separate curves

---

## Notes

- Mark **Example** column ✓ when verified with the built-in example graph.
- Features marked optional (parallel edges, bridges) show yellow in the panel when the loaded graph lacks that data — this is expected, not a failure.
- For graphs without baked layout, force mode is the default and only available option.
