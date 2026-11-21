"""Local render probe for Saans: serves the app over HTTP, loads it in
Chromium through the local relay proxy (127.0.0.1:8899), and checks the
live-API render at desktop + phone widths. Exits non-zero on any failure.
Run: xvfb-run -a python3 tests/probe.py
"""
import json
import os
import socket
import subprocess
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PORT = 8471
RELAY_PORT = 8899
results = {}


def start_relay():
    proc = subprocess.Popen(
        [sys.executable, os.path.join(ROOT, "demo-video", "relay_proxy.py")],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            with socket.create_connection(("127.0.0.1", RELAY_PORT), timeout=1):
                return proc
        except OSError:
            time.sleep(0.2)
    proc.terminate()
    raise RuntimeError("relay proxy did not start")


def main():
    relay = start_relay()
    server = ThreadingHTTPServer(("127.0.0.1", PORT),
                                 partial(SimpleHTTPRequestHandler, directory=ROOT))
    threading = __import__("threading")
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(proxy={"server": "http://127.0.0.1:8899",
                                               "bypass": "127.0.0.1,localhost"})
            ctx = browser.new_context(ignore_https_errors=True,
                                      viewport={"width": 1280, "height": 720})
            page = ctx.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="networkidle")
            page.wait_for_selector("#nowCard:not([hidden])", timeout=30000)
            aqi = page.locator("#aqiNum").inner_text()
            band = page.locator("#aqiBand").inner_text()
            verdict = page.locator("#verdict").inner_text()
            windows = page.locator(".window").count()
            bars = page.locator(".bar").count()
            results["desktop"] = {"aqi": aqi, "band": band, "verdict": verdict,
                                  "windows": windows, "bars": bars,
                                  "console_errors": errors}
            assert aqi.strip() not in ("", "–"), "AQI number did not render"
            assert band.strip(), "band label empty"
            assert windows >= 1, "no planner windows rendered"
            assert bars >= 1, "no timeline bars rendered"
            assert not errors, f"console errors: {errors}"
            page.screenshot(path=os.path.join(HERE, "desktop.png"))

            # Profile switch changes the advice.
            page.locator('[data-profile="asthma"]').click()
            page.wait_for_timeout(400)
            verdict_asthma = page.locator("#verdict").inner_text()
            results["asthma_verdict"] = verdict_asthma
            assert verdict_asthma != verdict or "asthma" in verdict_asthma.lower(), \
                "asthma profile did not change the verdict"

            # City chip switch.
            page.locator(".chip", has_text="Mumbai").click()
            page.wait_for_selector("#nowCity:has-text('Mumbai')", timeout=30000)
            results["mumbai_aqi"] = page.locator("#aqiNum").inner_text()

            # Search box.
            page.locator("#citySearch").fill("Patna")
            page.locator("#searchBtn").click()
            page.wait_for_selector("#searchResults button", timeout=30000)
            page.locator("#searchResults button").first.click()
            page.wait_for_selector("#nowCity:has-text('Patna')", timeout=30000)
            results["patna_aqi"] = page.locator("#aqiNum").inner_text()

            # Phone width.
            phone_ctx = browser.new_context(ignore_https_errors=True,
                                            viewport={"width": 375, "height": 700})
            phone = phone_ctx.new_page()
            phone.goto(f"http://127.0.0.1:{PORT}/index.html", wait_until="networkidle")
            phone.wait_for_selector("#nowCard:not([hidden])", timeout=30000)
            overflow = phone.evaluate(
                "document.documentElement.scrollWidth > document.documentElement.clientWidth")
            results["phone_overflow"] = overflow
            assert not overflow, "horizontal overflow at 375px"
            phone.screenshot(path=os.path.join(HERE, "phone.png"))
            browser.close()
    finally:
        server.shutdown()
        relay.terminate()
    print(json.dumps(results, indent=2, ensure_ascii=False))
    print("PROBE PASSED")


if __name__ == "__main__":
    main()
