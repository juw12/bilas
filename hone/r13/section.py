"""Print the tail of one section of hone/r13/checks.log (default: flow phone)."""
import sys
from pathlib import Path

name = sys.argv[1] if len(sys.argv) > 1 else "flow phone"
raw = Path(__file__).with_name("checks.log").read_bytes()
text = raw.decode("utf-16") if raw[:2] in (b"\xff\xfe", b"\xfe\xff") else raw.decode("utf-8", "replace")
lines = text.splitlines()
start = next(i for i, line in enumerate(lines) if line.strip() == "== " + name)
end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("== ")), len(lines))
body = [line for line in lines[start:end] if not line.startswith(" ") and "File " not in line]
for line in body[:60]:
    print(line[:300])
