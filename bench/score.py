#!/usr/bin/env python3
"""Score audit reports against a verified ground-truth file.

    python3 bench/score.py --truth truth.json --runs results/ [--judge-model claude-sonnet-5-5]

truth.json: {"issues": [{"id", "title", "claim", "locations", "severity"}]}, where every issue
has been verified against the code. A judge model maps each report's findings onto truth IDs.
Findings that match nothing are listed as UNMATCHED: they are either false positives or real
issues the truth file lacks, and must be verified by hand before they count either way.

Reported per run and per arm: severity-weighted recall, issues found, MEDIUM+ found, severity
over/under-rating, and unmatched findings.
"""
import argparse
import collections
import concurrent.futures as cf
import glob
import json
import os
import re
import subprocess

WEIGHT = {"CRITICAL": 10, "HIGH": 6, "MEDIUM": 3, "LOW": 1, "INFO": 0.25}
RANK = {"INFO": 0, "LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

JUDGE = """You are matching the findings in a security audit report against a list of known,
verified issues in the same codebase. Be strict: a finding matches an issue only if it describes
the same underlying weakness (same root cause, same place), not merely the same category.
A finding may match at most one issue. Ignore items the report presents as safe/clean.

KNOWN ISSUES (JSON):
{truth}

REPORT:
<<<
{report}
>>>

Reply with ONLY a JSON object, no prose:
{{"matches": [{{"issue": "<known id>", "claimed_severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO|UNRATED"}}],
  "unmatched": [{{"title": "<finding title>", "claimed_severity": "...", "location": "<file:line or empty>"}}]}}"""


def judge(report, truth, model):
    slim = [{k: i[k] for k in ("id", "title", "claim", "locations")} for i in truth]
    prompt = JUDGE.format(truth=json.dumps(slim, indent=1), report=report)
    p = subprocess.run(
        ["claude", "-p", "--setting-sources", "project", "--strict-mcp-config", "--model", model,
         "--output-format", "json", "--tools", ""],
        input=prompt, capture_output=True, text=True)
    text = json.loads(p.stdout)["result"]
    m = re.search(r"\{.*\}", text, re.S)
    return json.loads(m.group(0))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--truth", required=True)
    ap.add_argument("--runs", required=True, help="directory of <arm>-<n>.md reports")
    ap.add_argument("--judge-model", default="claude-sonnet-5-5")
    a = ap.parse_args()
    truth = json.load(open(a.truth))["issues"]
    by_id = {i["id"]: i for i in truth}
    total = sum(WEIGHT[i["severity"]] for i in truth)
    reports = sorted(glob.glob(os.path.join(a.runs, "*.md")))

    with cf.ThreadPoolExecutor(6) as ex:
        judged = dict(zip(reports, ex.map(lambda r: judge(open(r).read(), truth, a.judge_model), reports)))

    rows, arms = {}, collections.defaultdict(list)
    for path, j in judged.items():
        name = os.path.basename(path)[:-3]
        r = collections.Counter()
        seen = set()
        for m in j.get("matches", []):
            i = by_id.get(m["issue"])
            if not i or i["id"] in seen:
                continue
            seen.add(i["id"])
            r["found"] += 1
            r["weight"] += WEIGHT[i["severity"]]
            if RANK[i["severity"]] >= RANK["MEDIUM"]:
                r["med_plus"] += 1
            cs = m.get("claimed_severity", "UNRATED")
            if cs in RANK:
                d = RANK[cs] - RANK[i["severity"]]
                r["exact" if d == 0 else "over" if d > 0 else "under"] += 1
        r["unmatched"] = len(j.get("unmatched", []))
        rows[name] = (r, seen, j.get("unmatched", []))
        arms[name.rsplit("-", 1)[0]].append(name)

    cols = ["found", "med_plus", "weight", "exact", "over", "under", "unmatched"]
    print(f"truth: {len(truth)} issues, weight {total:g}")
    print(f"{'run':10}" + "".join(f"{c:>10}" for c in cols) + f"{'recall':>9}")
    for name in sorted(rows):
        r = rows[name][0]
        print(f"{name:10}" + "".join(f"{round(r[c], 2):>10}" for c in cols) + f"{r['weight'] / total:>9.0%}")
    print()
    for arm, names in sorted(arms.items()):
        rs = [rows[n][0] for n in names]
        union = set().union(*(rows[n][1] for n in names))
        mean = lambda k: sum(r[k] for r in rs) / len(rs)
        print(f"{arm:6} runs={len(rs)}  recall mean {mean('weight') / total:.0%} "
              f"(min {min(r['weight'] for r in rs) / total:.0%}, max {max(r['weight'] for r in rs) / total:.0%})  "
              f"found {mean('found'):.1f}  MEDIUM+ {[r['med_plus'] for r in rs]}  "
              f"over {mean('over'):.1f}  under {mean('under'):.1f}  unmatched {mean('unmatched'):.1f}  "
              f"union {len(union)}/{len(truth)}")
    out = os.path.join(a.runs, "score.json")
    json.dump({n: {"counts": dict(rows[n][0]), "matched": sorted(rows[n][1]), "unmatched": rows[n][2]}
               for n in rows}, open(out, "w"), indent=1)
    print(f"\nunmatched findings (verify before counting): see {out}")


if __name__ == "__main__":
    main()
