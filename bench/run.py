#!/usr/bin/env python3
"""Run security-audit arms against a target repo, isolated from your own Claude Code setup.

    python3 bench/run.py --target ~/code/app --arm plain --arm fast --arm deep --runs 3 --out results/

Arms:
  plain  plain Claude Code, no plugins: "Do a security audit of this repository..."
  fast   /securitymaxxing:audit           (this working tree loaded with --plugin-dir)
  deep   /securitymaxxing:audit --deep

Each run gets user settings, installed plugins, hooks, and MCP servers switched off
(--setting-sources project --strict-mcp-config), the same model, and the same read-only tools.
The target is cloned first, so untracked files (keys, .env) never reach the run.
Output per run: <arm>-<n>.json (claude -p result) and <arm>-<n>.md (every assistant message,
so reports printed before a closing summary aren't lost).
"""
import argparse
import concurrent.futures as cf
import glob
import json
import os
import subprocess
import tempfile

PLUGIN_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLAIN_PROMPT = (
    "Do a security audit of this repository. Report each finding with a severity, the file "
    "and line, and an explanation of the risk and how to fix it. This is read-only: do not "
    "modify any files."
)
ARMS = {
    "plain": (PLAIN_PROMPT, False),
    "fast": ("/securitymaxxing:audit", True),
    "deep": ("/securitymaxxing:audit --deep", True),
}
READ_ONLY = ["Read", "Grep", "Glob", "Bash(git log:*)", "Bash(git ls-files:*)"]


def transcript_text(session_id):
    hits = glob.glob(os.path.expanduser(f"~/.claude/projects/*/{session_id}.jsonl"))
    if not hits:
        return None
    out = []
    for line in open(hits[0], encoding="utf-8"):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get("type") != "assistant":
            continue
        for b in e.get("message", {}).get("content", []):
            if b.get("type") == "text" and b["text"].strip():
                out.append(b["text"])
            elif b.get("type") == "tool_use" and b["name"] in ("ReportFindings",):
                out.append(json.dumps(b.get("input"), indent=1))
    return "\n\n".join(out)


def run_one(target, arm, n, model, budget, out):
    prompt, with_plugin = ARMS[arm]
    tools = READ_ONLY + (["Agent", "Bash(which:*)"] if arm == "deep" else [])
    cmd = ["claude", "-p", prompt, "--setting-sources", "project", "--strict-mcp-config",
           "--model", model, "--max-budget-usd", str(budget), "--output-format", "json",
           "--allowedTools", *tools,
           "--disallowedTools", "Edit", "Write", "NotebookEdit", "WebFetch", "WebSearch"]
    if with_plugin:
        cmd += ["--plugin-dir", PLUGIN_DIR]
    p = subprocess.run(cmd, cwd=target, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    stem = os.path.join(out, f"{arm}-{n}")
    open(stem + ".json", "w").write(p.stdout)
    try:
        d = json.loads(p.stdout)
    except ValueError:
        return f"{arm}-{n}: failed ({p.stderr.strip()[-200:]})"
    text = transcript_text(d.get("session_id", "")) or d.get("result") or ""
    open(stem + ".md", "w").write(text)
    return f"{arm}-{n}: ${d.get('total_cost_usd', 0):.2f}, {d.get('num_turns')} turns, {len(text)} chars"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", required=True, help="path to the git repo to audit")
    ap.add_argument("--arm", action="append", choices=ARMS, required=True)
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--model", default="claude-sonnet-5-5")
    ap.add_argument("--budget", type=float, default=6.0, help="max USD per run")
    ap.add_argument("--jobs", type=int, default=6)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    snap = tempfile.mkdtemp(prefix="smx-bench-")
    target = os.path.join(snap, "target")
    subprocess.run(["git", "clone", "-q", os.path.expanduser(a.target), target], check=True)
    jobs = [(arm, n) for arm in a.arm for n in range(1, a.runs + 1)]
    with cf.ThreadPoolExecutor(a.jobs) as ex:
        for msg in ex.map(lambda j: run_one(target, j[0], j[1], a.model, a.budget, a.out), jobs):
            print(msg, flush=True)


if __name__ == "__main__":
    main()
