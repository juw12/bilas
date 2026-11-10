"""Run a bilas test script with Playwright's chromium launches redirected to the system Edge.

Used only while the shared ms-playwright browser folder is being reinstalled by another session.
Usage: python edge_run.py tests/gestures.py
"""
import runpy
import sys
from pathlib import Path

from playwright._impl._browser_type import BrowserType

original_launch = BrowserType.launch


async def launch_with_edge(self, *args, **kwargs):
    if self.name == "chromium" and not kwargs.get("executablePath") and not kwargs.get("channel"):
        kwargs["channel"] = "msedge"
    return await original_launch(self, *args, **kwargs)


BrowserType.launch = launch_with_edge

script = sys.argv[1]
sys.argv = sys.argv[1:]
sys.path.insert(0, str(Path(script).resolve().parent))
runpy.run_path(script, run_name="__main__")
