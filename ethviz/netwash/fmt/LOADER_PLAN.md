# Graph JSON Loader — Plan

*`graph_loader.js` — one module, one job: JSON file → columnar in-memory graph.*

---

## 1. What the loader requires

The loader validates exactly this and nothing more:

| Where | Field | Rule |
|---|---|---|
| top level | `metadata`, `nodes`, `edges` | present; object, array, array |
| node | `index` | int, equal to array position |
| node | `address` | string |
| edge | `index` | int, equal to array position |
| edge | `source`, `target` | strings |
| edge | `source_index`, `target_index` | ints in `[0, nodes.length)` |

Violations of these are **errors** — the file is rejected with the offending index in the message. Everything else in the file is an open attribute and cannot cause a failure.

## 2. The open-attribute mechanism

Two passes over each array.

**Pass 1 — discover.** Walk every object, take the union of its keys. For each key, infer a column type from the values seen:

- all numbers → `float64` (narrow to `int32` if every value is a safe integer)
- all booleans → `uint8`
- all strings → dictionary-encoded string column (`int32` codes + string table)
- arrays of scalars → ragged column (`offsets` + flat values)
- mixed scalar types → string column, values coerced via `String()`, with one warning naming the key
- any nested object → warning naming the key; column dropped (flatten to dotted keys upstream)

`null` and *absent* are the same thing: a hole. Every column carries a validity bitmask; numeric holes additionally read as `NaN` so unmasked math stays sane.

**Pass 2 — fill.** Allocate one typed array per column at full length, walk the objects again, write values, set validity bits.

The core fields from §1 are not special-cased in storage — `address` is just a string column, `group` just an `int32` column. "Required" only means pass 1 is guaranteed to find them and validation checks them. One mechanism, no second path.

## 3. In-memory shape

```js
{
  metadata: { ... },                    // verbatim
  nodes: {
    length: N,
    columns: Map<string, Column>,      // every discovered key
    byAddress: Map<string, int>        // address → index (built once)
  },
  edges: {
    length: M,
    columns: Map<string, Column>
  }
}

Column = {
  name, kind,                          // 'f64' | 'i32' | 'u8' | 'str' | 'list'
  data,                                // TypedArray (codes for 'str')
  valid,                               // Uint8Array bitmask
  dict                                 // string table, 'str' only
}
```

This is deliberately the same shape `cbin_loader.js` produces: JSON is the interchange and teaching format, `.cbin` the packed production format, and everything downstream of the loader sees one columnar store and cannot tell which file fed it. (Same move as the segment envelope: prebaked and live are indistinguishable past the boundary.)

## 4. API surface

```js
const g = await loadGraphJSON(url | File | object);

g.nodes.column('degree')        // Column, or null if absent — never throws
g.nodes.has('ens_name')         // boolean
g.nodes.attributeNames()        // sorted list, for the UI selector
g.nodes.get(i, 'ens_name')      // decoded scalar or null (convenience; hot paths use .data)
g.edges.endpoints()             // { sourceIndex: Int32Array, targetIndex: Int32Array }
g.nodes.byAddress.get('0x…')    // int index
```

`column()` returning `null` for unknown names is the whole "ignored when not used" contract on the read side: a renderer binds color to `g.nodes.column(selectedAttr)`, and if the file lacks that attribute the binding falls back to its default. No renderer code enumerates fields.

deck.gl accessors read `column.data` directly — dictionary codes and floats feed attribute buffers with zero per-object work.

## 5. Validation and warnings

Errors (reject file): §1 violations, `index !== position`, endpoint index out of range, non-array `nodes`/`edges`.

Warnings (load anyway, log once per key): mixed-type column, dropped nested-object column, `source`/`target` address disagreeing with the address at `source_index`/`target_index`, `x`/`y` all-null (graph needs layout — viewers that require positions check this and say so).

## 6. Size guard

`JSON.parse` on the full text is fine to ~200 MB of JSON; the columnar store it produces is small (the 1.2 GB full dataset packs to ~108 MB of columns). Above that, the answer is not a streaming JSON parser — it is `.cbin` (Law 5: remove machinery). The loader checks byte length and, past a threshold, tells the caller to convert with `pack_graph.py`.

## 7. Tests

Against `example_graph.json` (two components, heterogeneous attributes):

1. Round-trip: every value in the file is reachable through `get()`.
2. Discovery: `attributeNames()` includes `ens_name`, `funded_by`, `wallet_age_days`, `original_value_eth`, `note` — none declared anywhere.
3. Holes: `ens_name` valid only at node 0; numeric hole reads `NaN`, `valid` bit 0.
4. Ignore-for-free: render the graph binding only `x/y/group`; presence of every extra column changes nothing.
5. Minimal file (two nodes, one edge, empty metadata) loads clean.
6. Each §1 violation produces its specific error; each §5 case its specific warning.

## 8. Build order

1. Pass-1 discovery + type inference (pure function, unit-testable on plain arrays)
2. Pass-2 fill + Column type
3. Validation
4. API wrapper + `byAddress`
5. Wire into `cbin_viewer.html` behind a format sniff (first byte `{` → JSON, else `.cbin`)
