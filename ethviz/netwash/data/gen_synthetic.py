#!/usr/bin/env python3
"""Synthetic wash-trading test dataset generator.

Emits:
  nft_trades_synth.csv  - one collection, 12 tokens, ~30 trades each,
                          3 wash traders embedded (Law 9: ground truth
                          lives in the generator -> labeled columns).
  eth_market_synth.csv  - the ETH normal-transaction layer: settlement
                          legs for every priced NFT trade, shared-funder
                          legs for the wash trio, one exchange hub, and
                          organic peer traffic. 100 distinct addresses.
"""
import csv, random, hashlib

rng = random.Random(42)

# ---------------------------------------------------------------- addresses
def addr(tag):
    return "0x" + hashlib.sha256(tag.encode()).hexdigest()[:40]

W = [addr(f"wash{i}") for i in range(3)]            # wash trio
FUNDER = addr("funder")                              # common funding wallet
HUB = addr("exchange_hub")                           # the exchange
NFT_ORGANIC = [addr(f"nft_org{i}") for i in range(40)]
ETH_ONLY = [addr(f"eth_only{i}") for i in range(55)]
ALL = W + [FUNDER, HUB] + NFT_ORGANIC + ETH_ONLY
assert len(set(ALL)) == 100

CONTRACT = addr("synth_collection_contract")
COLLECTION = "SYNTH"
TOKENS = [3400 + i for i in range(12)]
WASH_TOKENS = {3401, 3405, 3409}
# one zero-value seed transfer per wash token; pairs chosen so the
# per-token 2-sets merge into {W0,W1,W2} by shared membership
SEED_PAIR = {3401: (W[0], W[1]), 3405: (W[1], W[2]), 3409: (W[2], W[0])}

BASE_BLOCK, BASE_TS = 19001000, 1705112000
def ts_of(block): return BASE_TS + (block - BASE_BLOCK) * 12

_hash_ctr = [0]
def txh():
    _hash_ctr[0] += 1
    return "0x" + hashlib.sha256(f"tx{_hash_ctr[0]}".encode()).hexdigest()

def gas(): return rng.randint(60000, 180000), round(rng.uniform(8, 40), 2)

# ---------------------------------------------------------------- NFT market
nft_rows = []   # dicts
block = BASE_BLOCK

def nft_row(blk, frm, to, token, price, cabal_id, pattern, is_wash):
    g, gp = gas()
    return dict(tx_hash=txh(), block_number=blk, timestamp=ts_of(blk),
                from_address=frm, to_address=to, contract_address=CONTRACT,
                collection=COLLECTION, token_id=token,
                price_eth=price, value_wei=str(int(round(price * 1e18))),
                gas_used=g, gas_price_gwei=gp,
                cabal_id=cabal_id, cabal_label=("W0-W1-W2" if is_wash else ""),
                pattern_type=pattern, is_wash=int(is_wash))

# guarantee every organic trader appears: deal them out across tokens
org_pool = NFT_ORGANIC * 2
rng.shuffle(org_pool)
org_iter = iter(org_pool)
def next_org(exclude):
    for _ in range(200):
        try: a = next(org_iter)
        except StopIteration: a = rng.choice(NFT_ORGANIC)
        if a != exclude: return a
    return rng.choice([x for x in NFT_ORGANIC if x != exclude])

for token in TOKENS:
    owner = next_org(None)
    n_trades = rng.randint(28, 32)
    if token not in WASH_TOKENS:
        floor = rng.uniform(0.4, 2.0)
        for _ in range(n_trades):
            buyer = next_org(owner)
            price = round(max(0.05, floor * rng.lognormvariate(0, 0.25)), 4)
            floor = 0.8 * floor + 0.2 * price          # gentle drift
            block += rng.randint(2, 40)
            nft_rows.append(nft_row(block, owner, buyer, token, price,
                                    "", "organic", False))
            owner = buyer
    else:
        a, b = SEED_PAIR[token]
        # organic opening
        for _ in range(3):
            buyer = next_org(owner)
            price = round(rng.uniform(0.3, 0.9), 4)
            block += rng.randint(2, 40)
            nft_rows.append(nft_row(block, owner, buyer, token, price,
                                    "", "organic", False))
            owner = buyer
        # entry: cabal buys from organic holder (real trade, not flagged)
        block += rng.randint(2, 30)
        price = round(rng.uniform(0.4, 0.8), 4)
        nft_rows.append(nft_row(block, owner, a, token, price,
                                "", "organic", False))
        owner = a
        # the seed: zero-value transfer inside the trio
        block += rng.randint(2, 10)
        nft_rows.append(nft_row(block, a, b, token, 0.0,
                                "C01", "seed_transfer", True))
        owner = b
        # wash cycle: b -> next -> next ... escalating price
        price = round(rng.uniform(0.8, 1.2), 4)
        for _ in range(n_trades - 7):
            nxt = W[(W.index(owner) + 1) % 3]
            price = round(price * rng.uniform(1.03, 1.12), 4)
            block += rng.randint(1, 6)                 # tight cadence
            nft_rows.append(nft_row(block, owner, nxt, token, price,
                                    "C01", "cycle_pump", True))
            owner = nxt
        # exit: dump on organic buyers at the inflated price
        for _ in range(3):
            buyer = next_org(owner)
            price = round(price * rng.uniform(0.95, 1.05), 4)
            block += rng.randint(3, 25)
            nft_rows.append(nft_row(block, owner, buyer, token, price,
                                    "C01", "exit_dump", True) if owner in W
                            else nft_row(block, owner, buyer, token, price,
                                         "", "organic", False))
            owner = buyer

nft_rows.sort(key=lambda r: r["block_number"])

# ---------------------------------------------------------------- ETH market
eth_rows = []
def eth_row(blk, frm, to, val, role, nft_link=""):
    g, gp = gas()
    return dict(tx_hash=txh(), block_number=blk, timestamp=ts_of(blk),
                from_address=frm, to_address=to,
                value_eth=round(val, 6), value_wei=str(int(round(val * 1e18))),
                gas_used=g, gas_price_gwei=gp, tx_role=role,
                nft_tx_hash=nft_link)

# 1. hub seeds the funder (withdrawal), funder splits to the trio
fb = BASE_BLOCK - 400
eth_rows.append(eth_row(fb, HUB, FUNDER, 16.0, "hub_withdrawal"))
for i, w in enumerate(W):
    eth_rows.append(eth_row(fb + 6 + 2 * i, FUNDER, w,
                            round(5.0 + rng.uniform(-0.1, 0.1), 4), "funding"))

# 2. settlement leg for every priced NFT trade: buyer -> seller, same value
for r in nft_rows:
    if r["price_eth"] > 0:
        eth_rows.append(eth_row(r["block_number"] + 1, r["to_address"],
                                r["from_address"], r["price_eth"],
                                "settlement", r["tx_hash"]))

# 3. exchange hub traffic: ~75 distinct counterparties, 1-2 txs each
hub_peers = rng.sample(NFT_ORGANIC, 28) + rng.sample(ETH_ONLY, 45) + [W[2]]
for p in hub_peers:
    for _ in range(rng.randint(1, 2)):
        blk = BASE_BLOCK + rng.randint(-500, 4000)
        v = round(rng.lognormvariate(0.2, 0.9), 4)
        if rng.random() < 0.5: eth_rows.append(eth_row(blk, p, HUB, v, "hub_deposit"))
        else:                  eth_rows.append(eth_row(blk, HUB, p, v, "hub_withdrawal"))

# 4. organic ETH traffic. ETH-only addresses live in small pods whose only
#    route to the wider graph is the exchange hub -- so walling the hub
#    (sentinel group -1) dissolves the giant component into the NFT-market
#    island plus a scatter of pods, which is the behavior the gate exists
#    to produce. A little extra traffic inside the NFT crowd is fine; they
#    are already one island via settlement legs.
pods, shuffled = [], ETH_ONLY[:]
rng.shuffle(shuffled)
while shuffled:
    k = min(rng.randint(3, 6), len(shuffled))
    pods.append([shuffled.pop() for _ in range(k)])
for pod in pods:
    for i in range(len(pod)):                       # ring + a chord or two
        a, b = pod[i], pod[(i + 1) % len(pod)]
        blk = BASE_BLOCK + rng.randint(-500, 4000)
        eth_rows.append(eth_row(blk, a, b,
                                round(rng.lognormvariate(-0.3, 0.8), 4), "organic"))
    if len(pod) > 3 and rng.random() < 0.6:
        a, b = rng.sample(pod, 2)
        eth_rows.append(eth_row(BASE_BLOCK + rng.randint(-500, 4000), a, b,
                                round(rng.lognormvariate(-0.3, 0.8), 4), "organic"))
for _ in range(25):                                  # NFT-crowd internal churn
    a, b = rng.sample(NFT_ORGANIC, 2)
    eth_rows.append(eth_row(BASE_BLOCK + rng.randint(-500, 4000), a, b,
                            round(rng.lognormvariate(-0.3, 0.8), 4), "organic"))

eth_rows.sort(key=lambda r: r["block_number"])

# ---------------------------------------------------------------- write
def dump(path, rows):
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)

dump("/home/claude/nft_trades_synth.csv", nft_rows)
dump("/home/claude/eth_market_synth.csv", eth_rows)

# ---------------------------------------------------------------- invariants
from collections import defaultdict, Counter

# NFT: ownership chains consistent per token
own = {}
for r in nft_rows:
    t = r["token_id"]
    if t in own: assert own[t] == r["from_address"], f"chain break token {t}"
    own[t] = r["to_address"]

per_tok = Counter(r["token_id"] for r in nft_rows)
assert set(per_tok) == set(TOKENS) and all(25 <= c <= 35 for c in per_tok.values())

seeds = [r for r in nft_rows if r["price_eth"] == 0]
assert len(seeds) == 3 and all(r["token_id"] in WASH_TOKENS for r in seeds)
wash = [r for r in nft_rows if r["is_wash"]]
assert all(r["from_address"] in W and r["to_address"] in W or r["to_address"] not in W
           for r in wash)

# ETH: every priced NFT trade settled
nft_priced = {r["tx_hash"]: r for r in nft_rows if r["price_eth"] > 0}
settled = {r["nft_tx_hash"] for r in eth_rows if r["tx_role"] == "settlement"}
assert settled == set(nft_priced)
for r in eth_rows:
    if r["tx_role"] == "settlement":
        n = nft_priced[r["nft_tx_hash"]]
        assert (r["from_address"], r["to_address"], r["value_eth"]) == \
               (n["to_address"], n["from_address"], n["price_eth"])

eth_addrs = {x for r in eth_rows for x in (r["from_address"], r["to_address"])}
nft_addrs = {x for r in nft_rows for x in (r["from_address"], r["to_address"])
             if x != CONTRACT}
assert nft_addrs <= eth_addrs, "NFT participants missing from ETH graph"
assert len(eth_addrs) == 100, len(eth_addrs)

# distinct-counterparty degree: hub must sit alone past the knee
deg = defaultdict(set)
for r in eth_rows:
    deg[r["from_address"]].add(r["to_address"])
    deg[r["to_address"]].add(r["from_address"])
top = sorted(((len(v), k) for k, v in deg.items()), reverse=True)[:6]
print("nft rows:", len(nft_rows), "| eth rows:", len(eth_rows),
      "| eth addresses:", len(eth_addrs))
print("nft participants:", len(nft_addrs),
      "| wash trades:", sum(r['is_wash'] for r in nft_rows),
      "| seed transfers:", len(seeds))
print("top distinct-counterparty degrees:")
label = {HUB: "HUB", FUNDER: "FUNDER", W[0]: "W0", W[1]: "W1", W[2]: "W2"}
for d, k in top:
    print(f"  {d:4d}  {label.get(k, k[:10])}")
print("all invariants passed")
