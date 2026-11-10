"""Summarise hone/r13/checks.log: one line per section with fails, errors and the gate verdicts."""
import json
from pathlib import Path

LOG = Path(__file__).with_name("checks.log")
raw = LOG.read_bytes()
text = raw.decode("utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8", "replace")

section = None
for line in text.splitlines():
    if line.startswith("=="):
        section = line.strip("= ").strip()
        if section == "done":
            print("done")
        continue
    if not line.startswith("RESULT "):
        continue
    data = json.loads(line[len("RESULT "):])
    if section == "gates":
        g4_bad = []
        for size, views in data["G4"].items():
            for view, res in views.items():
                if view == "errors":
                    if res:
                        g4_bad.append(f"{size} errors {res}")
                    continue
                if res["overflowX"] or res["offenders"] or res["clipped"]:
                    g4_bad.append(f"{size}/{view} {res}")
        g6 = data["G6"]
        contrast_bad = {k: v["bad"] for k, v in g6["contrast"].items() if v["bad"]}
        print("gates: G4", g4_bad or "ok",
              "| G6 parity", g6["parity"]["en"], "/", g6["parity"]["id"], g6["parity"]["missingId"], g6["parity"]["missingEn"],
              "| contrast", contrast_bad or "ok",
              "| G6 errors", g6["errors"],
              "| G1", data["G1file"],
              "| G7 errors", data["G7"]["errors"])
    else:
        print(section, "fails:", data.get("fails"), "errors:", data.get("errors"), "sounds:", data.get("soundCount"), "occluded:", data.get("occluded"))
