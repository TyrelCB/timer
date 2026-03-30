const display = document.getElementById("display");
const statusBadge = document.getElementById("status");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");
const syncStatus = document.getElementById("syncStatus");

const INITIAL_SYNC_SAMPLE_COUNT = 5;
const RESYNC_SAMPLE_COUNT = 3;
const RESYNC_INTERVAL_MS = 60_000;
const SYNC_TIMEOUT_MS = 3_000;
const SERVER_TIME_ENDPOINT = new URL("./api/time", window.location.href);

let running = false;
let startTime = 0;
let elapsedTime = 0;
let animationFrameId = null;
let syncIntervalId = null;
let syncRequest = null;
let clockCalibration = createLocalCalibration();

function createLocalCalibration() {
  return {
    source: "local",
    anchorEpoch: Date.now(),
    anchorPerformance: performance.now(),
    rtt: null,
    lastSyncedAt: null,
  };
}

function formatTime(milliseconds) {
  const totalHundredths = Math.floor(milliseconds / 10);
  const hundredths = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const paddedTime = [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");

  return `${paddedTime}.${String(hundredths).padStart(2, "0")}`;
}

function render(time = elapsedTime) {
  display.textContent = formatTime(time);
}

function setStopwatchState(label, state) {
  statusBadge.textContent = label;
  statusBadge.dataset.state = state;
  startButton.textContent = elapsedTime > 0 ? "Resume" : "Start";
  startButton.disabled = running;
  pauseButton.disabled = !running;
}

function setSyncState(label, state) {
  syncStatus.textContent = label;
  syncStatus.dataset.state = state;
}

// Tie elapsed time to a monotonic clock, then recalibrate it against the server
// clock so long-running sessions can correct drift without depending on repaint rate.
function getSynchronizedNow() {
  return (
    clockCalibration.anchorEpoch +
    (performance.now() - clockCalibration.anchorPerformance)
  );
}

function tick() {
  render(elapsedTime + (getSynchronizedNow() - startTime));
  animationFrameId = requestAnimationFrame(tick);
}

function startStopwatch() {
  if (running) {
    return;
  }

  running = true;
  startTime = getSynchronizedNow();
  setStopwatchState("Running", "running");
  tick();
}

function pauseStopwatch() {
  if (!running) {
    return;
  }

  running = false;
  elapsedTime += getSynchronizedNow() - startTime;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  render();
  setStopwatchState("Paused", "paused");
}

function resetStopwatch() {
  running = false;
  elapsedTime = 0;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  render(0);
  setStopwatchState("Ready", "ready");
}

async function requestServerSample() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  const requestUrl = new URL(SERVER_TIME_ENDPOINT);
  requestUrl.searchParams.set(
    "cacheBust",
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
  const startedAt = performance.now();

  try {
    const response = await fetch(requestUrl, {
      cache: "no-store",
      headers: { "Cache-Control": "no-store" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Unexpected status ${response.status}`);
    }

    const payload = await response.json();
    const endedAt = performance.now();

    if (!Number.isFinite(payload.now)) {
      throw new Error("Invalid server time payload");
    }

    return {
      midpoint: startedAt + (endedAt - startedAt) / 2,
      rtt: endedAt - startedAt,
      serverNow: payload.now,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function synchronizeClock(sampleCount = INITIAL_SYNC_SAMPLE_COUNT) {
  if (syncRequest) {
    return syncRequest;
  }

  syncRequest = (async () => {
    const hadServerSync = clockCalibration.source === "server";
    setSyncState("Sync: checking server clock...", "syncing");
    const samples = [];

    for (let attempt = 0; attempt < sampleCount; attempt += 1) {
      try {
        samples.push(await requestServerSample());
      } catch {
        // Continue sampling and fall back only if every request fails.
      }
    }

    if (samples.length === 0) {
      if (hadServerSync) {
        setSyncState("Sync: using last server calibration", "stale");
        return false;
      }

      setSyncState("Sync: local clock fallback", "local");
      return false;
    }

    const bestSample = samples.reduce((best, sample) =>
      sample.rtt < best.rtt ? sample : best
    );

    clockCalibration = {
      source: "server",
      anchorEpoch: bestSample.serverNow,
      anchorPerformance: bestSample.midpoint,
      rtt: bestSample.rtt,
      lastSyncedAt: Date.now(),
    };

    setSyncState(
      `Sync: server clock active · ${Math.round(bestSample.rtt)}ms RTT`,
      "synced"
    );
    return true;
  })();

  try {
    return await syncRequest;
  } finally {
    syncRequest = null;
  }
}

function beginClockSync() {
  synchronizeClock();
  syncIntervalId = window.setInterval(() => {
    synchronizeClock(RESYNC_SAMPLE_COUNT);
  }, RESYNC_INTERVAL_MS);
}

startButton.addEventListener("click", startStopwatch);
pauseButton.addEventListener("click", pauseStopwatch);
resetButton.addEventListener("click", resetStopwatch);

document.addEventListener("keydown", (event) => {
  if (event.code !== "Space" || document.activeElement?.tagName === "BUTTON") {
    return;
  }

  event.preventDefault();

  if (running) {
    pauseStopwatch();
    return;
  }

  startStopwatch();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    synchronizeClock(RESYNC_SAMPLE_COUNT);
  }
});

window.addEventListener("focus", () => {
  synchronizeClock(RESYNC_SAMPLE_COUNT);
});

render(0);
setStopwatchState("Ready", "ready");
beginClockSync();
