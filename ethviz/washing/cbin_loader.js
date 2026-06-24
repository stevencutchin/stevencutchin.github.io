/* cbin_loader.js - read the columnar binary graph store (.cbin).
 *
 * Zero parse: every column becomes a typed-array VIEW directly over the fetched
 * ArrayBuffer. No JSON.parse, no per-row objects. deck.gl binds the columns as
 * binary attributes, so the runtime is pure indexed lookup (Law 2).
 *
 *   const g = await CabalBin.load('graph.cbin');
 *   g.nodeCount, g.edgeCount
 *   g.node.x      // Float32Array, length nodeCount
 *   g.edge.source_index  // Uint32Array, length edgeCount
 *   g.address(i)  // "0x..." for node i
 *   g.collection(e), g.label(e), g.tokenId(e)   // dictionary strings
 *   g.isBridge(i), g.cabalBridge(i), g.hub(i)   // node flags
 *   g.deckNodes(), g.deckEdges()  // deck.gl binary-attribute payloads
 *
 * Format: [header 36B][string pool][column directory][4-aligned column blocks].
 * Must stay in lockstep with pack_graph.py.
 */
(function (root) {
  "use strict";

  const MAGIC = "CABALBN1";
  // dtype codes (match pack_graph.py)
  const U8 = 0, U16 = 1, U32 = 2, F32 = 3, F64 = 4, B20 = 5;

  function view(buf, dtype, offset, byteLength) {
    switch (dtype) {
      case U8:  return new Uint8Array(buf, offset, byteLength);
      case U16: return new Uint16Array(buf, offset, byteLength / 2);
      case U32: return new Uint32Array(buf, offset, byteLength / 4);
      case F32: return new Float32Array(buf, offset, byteLength / 4);
      case F64: return new Float64Array(buf, offset, byteLength / 8);
      case B20: return new Uint8Array(buf, offset, byteLength); // raw addr bytes
      default: throw new Error("unknown dtype " + dtype);
    }
  }

  function parse(buf) {
    const dv = new DataView(buf);
    let magic = "";
    for (let i = 0; i < 8; i++) magic += String.fromCharCode(dv.getUint8(i));
    if (magic !== MAGIC) throw new Error("not a .cbin file (magic=" + magic + ")");

    const version   = dv.getUint32(8, true);
    const nodeCount = dv.getUint32(12, true);
    const edgeCount = dv.getUint32(16, true);
    const poolOff   = dv.getUint32(20, true);
    const dirOff    = dv.getUint32(24, true);
    const colCount  = dv.getUint32(28, true);

    // string pool
    const nStr = dv.getUint32(poolOff, true);
    const strings = new Array(nStr);
    const dec = new TextDecoder("utf-8");
    let p = poolOff + 4;
    for (let i = 0; i < nStr; i++) {
      const len = dv.getUint16(p, true); p += 2;
      strings[i] = dec.decode(new Uint8Array(buf, p, len)); p += len;
    }

    // column directory -> typed-array views
    const node = {}, edge = {}, meta = {};
    for (let i = 0; i < colCount; i++) {
      const o = dirOff + i * 28;
      let name = "";
      for (let j = 0; j < 16; j++) {
        const c = dv.getUint8(o + j); if (c) name += String.fromCharCode(c);
      }
      const kind  = dv.getUint8(o + 16);
      const dtype = dv.getUint8(o + 17);
      const off   = dv.getUint32(o + 20, true);
      const len   = dv.getUint32(o + 24, true);
      (kind === 0 ? node : edge)[name] = view(buf, dtype, off, len);
      meta[(kind === 0 ? "node." : "edge.") + name] = { dtype, off, len };
    }

    return { buffer: buf, version, nodeCount, edgeCount, strings, node, edge, meta };
  }

  const HEX = [];
  for (let i = 0; i < 256; i++) HEX[i] = i.toString(16).padStart(2, "0");

  function decorate(g) {
    g.address = (i) => {
      const a = g.node.addr, base = i * 20;
      let s = "0x";
      for (let k = 0; k < 20; k++) s += HEX[a[base + k]];
      return s;
    };
    g.collection = (e) => g.strings[g.edge.collection[e]] || "";
    g.label      = (e) => g.strings[g.edge.cabal_label[e]] || "";
    g.tokenId    = (e) => g.strings[g.edge.token_id[e]] || "";
    g.isBridge    = (i) => (g.node.flags[i] & 1) !== 0;
    g.cabalBridge = (i) => (g.node.flags[i] & 2) !== 0;
    g.hub         = (i) => (g.node.flags[i] & 4) !== 0;

    // golden-angle group color, identical to the viewer's hslToRgb
    function hslToRgb(h, s, l) {
      h /= 360; const a = s * Math.min(l, 1 - l);
      const f = (n) => { const k = (n + h * 12) % 12;
        return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
      return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
    }
    const colorCache = new Map();
    g.groupColor = (grp) => {
      let c = colorCache.get(grp);
      if (!c) { c = hslToRgb((grp * 137.508) % 360, 0.62, 0.58); colorCache.set(grp, c); }
      return c;
    };

    // ---- deck.gl binary attribute payloads (materialized once) -------------
    // Positions for edges are gathered from node x/y by index. This is the one
    // O(E) pass the runtime pays; everything after is GPU-side.
    g.deckNodes = () => {
      const n = g.nodeCount;
      const pos = new Float32Array(n * 2), col = new Uint8Array(n * 3);
      const rad = new Float32Array(n), lw = new Float32Array(n);
      const lc = new Uint8Array(n * 4);
      const x = g.node.x, y = g.node.y, grp = g.node.group;
      const inx = g.node.in_tx, outx = g.node.out_tx, fl = g.node.flags;
      for (let i = 0; i < n; i++) {
        pos[i * 2] = x[i]; pos[i * 2 + 1] = y[i];
        const c = g.groupColor(grp[i]);
        col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
        rad[i] = Math.sqrt((inx[i] || 0) + (outx[i] || 0) + 1);
        const isB = (fl[i] & 1) !== 0, isCB = (fl[i] & 2) !== 0;
        lw[i] = isB ? 2 : 0;
        if (isCB)      { lc[i*4]=255; lc[i*4+1]=255; lc[i*4+2]=255; lc[i*4+3]=255; }
        else if (isB)  { lc[i*4]=255; lc[i*4+1]=210; lc[i*4+2]= 79; lc[i*4+3]=255; }
        else           { lc[i*4]=0;   lc[i*4+1]=0;   lc[i*4+2]=0;   lc[i*4+3]=0;   }
      }
      return {
        length: n,
        attributes: {
          getPosition:  { value: pos, size: 2 },
          getFillColor: { value: col, size: 3 },
          getRadius:    { value: rad, size: 1 },
          getLineWidth: { value: lw,  size: 1 },
          getLineColor: { value: lc,  size: 4 },
        },
      };
    };
    g.deckEdges = () => {
      const e = g.edgeCount;
      const src = new Float32Array(e * 2), tgt = new Float32Array(e * 2);
      const col = new Uint8Array(e * 4), wid = new Float32Array(e);
      const x = g.node.x, y = g.node.y, grp = g.node.group;
      const si = g.edge.source_index, ti = g.edge.target_index, val = g.edge.value_eth;
      for (let i = 0; i < e; i++) {
        const a = si[i], b = ti[i];
        src[i * 2] = x[a]; src[i * 2 + 1] = y[a];
        tgt[i * 2] = x[b]; tgt[i * 2 + 1] = y[b];
        const c = g.groupColor(grp[a]);
        col[i * 4] = c[0]; col[i * 4 + 1] = c[1]; col[i * 4 + 2] = c[2]; col[i * 4 + 3] = 130;
        wid[i] = Math.sqrt((val[i] || 0) + 0.1);
      }
      return {
        length: e,
        attributes: {
          getSourcePosition: { value: src, size: 2 },
          getTargetPosition: { value: tgt, size: 2 },
          getColor:          { value: col, size: 4 },
          getWidth:          { value: wid, size: 1 },
        },
      };
    };
    return g;
  }

  async function load(url) {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("fetch " + url + " -> " + resp.status);
    return decorate(parse(await resp.arrayBuffer()));
  }

  root.CabalBin = { load, parse: (buf) => decorate(parse(buf)), MAGIC };
})(typeof window !== "undefined" ? window : globalThis);

/* ---- wiring into the existing viewer -------------------------------------
 *
 * The clustered viewer builds layers from {nodes, edges} arrays. With .cbin you
 * skip the per-row accessors and hand deck the binary payloads instead:
 *
 *   const g = await CabalBin.load('graph.cbin');
 *   new ScatterplotLayer({ id:'nodes', data: g.deckNodes(),
 *       radiusUnits:'common', radiusScale:0.8, radiusMinPixels:3 });
 *   new LineLayer({ id:'edges', data: g.deckEdges(),
 *       widthUnits:'common', widthScale:0.5, widthMinPixels:1 });
 *
 * Tooltips still resolve through the helpers by picked index:
 *   getTooltip: ({index, layer}) =>
 *     layer.id === 'nodes'
 *       ? { html: g.address(index) + ' · group ' + g.node.group[index] }
 *       : { html: g.collection(index) + ' #' + g.tokenId(index) };
 *
 * Note: .cbin assumes x/y are already baked (NaN if not). The live d3-force
 * path reseeds positions itself, so it can ignore g.node.x/y and write its own.
 * --------------------------------------------------------------------------- */
