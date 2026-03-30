# Timer

A very colorful and simple stopwatch built with plain HTML, CSS, and JavaScript.

## Features

- Bright animated gradient background
- Large stopwatch display with hundredths of a second
- Simple `Start`, `Pause`, and `Reset` controls
- Space bar shortcut to start or pause
- Periodic server clock sync with drift correction for long-running sessions

## Accuracy notes

- The stopwatch measures elapsed time with `performance.now()`, which is a browser-provided high-resolution monotonic timer.
- Browser zoom should not change the actual elapsed time, but it can make the display feel less smooth because the UI is updated with `requestAnimationFrame`.
- In normal use, the displayed time is usually accurate to about one screen refresh, often around `10-20ms`, though heavy CPU or graphics load can make the visual updates appear laggier.
- This project is meant for casual timing, not scientific, competitive, or standards-based timekeeping.
- When you run the included `server.js`, the stopwatch periodically samples `/api/time` and recalibrates itself against the server clock using the lowest-latency response.
- That reduces long-session drift compared with a purely local browser timer, but the result is still only as accurate as the server's own system clock.
- It is not an atomic clock, and it does not directly sync with `pool.ntp.org` or implement the full NTP protocol in the browser.
- Over long sessions, some drift is still possible because the stopwatch depends on the local device, browser, server clock, network latency, and power state.
- Sleep, background tab throttling, or browser suspension can affect how a long-running session behaves.

## Run locally

For the drift-corrected version, run the included local server:

```bash
node server.js
```

Then open `http://127.0.0.1:8123`.

If you open `index.html` directly in a browser or serve it with a generic static file server that does not provide `/api/time`, the stopwatch still works, but it falls back to the local browser clock without periodic server sync.
