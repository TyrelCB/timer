const display = document.getElementById("display");
const statusBadge = document.getElementById("status");
const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const resetButton = document.getElementById("resetButton");

let running = false;
let startTime = 0;
let elapsedTime = 0;
let animationFrameId = null;

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

function setState(label, state) {
  statusBadge.textContent = label;
  statusBadge.dataset.state = state;
  startButton.textContent = elapsedTime > 0 ? "Resume" : "Start";
  startButton.disabled = running;
  pauseButton.disabled = !running;
}

function tick() {
  render(elapsedTime + (performance.now() - startTime));
  animationFrameId = requestAnimationFrame(tick);
}

function startStopwatch() {
  if (running) {
    return;
  }

  running = true;
  startTime = performance.now();
  setState("Running", "running");
  tick();
}

function pauseStopwatch() {
  if (!running) {
    return;
  }

  running = false;
  elapsedTime += performance.now() - startTime;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  render();
  setState("Paused", "paused");
}

function resetStopwatch() {
  running = false;
  elapsedTime = 0;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  render(0);
  setState("Ready", "ready");
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

render(0);
setState("Ready", "ready");
