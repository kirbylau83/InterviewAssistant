const timerDisplay = document.getElementById("timerDisplay");
const startPauseButton = document.getElementById("startPauseButton");
const resetButton = document.getElementById("resetButton");
const presetButtons = document.querySelectorAll(".preset");
const cameraFeed = document.getElementById("cameraFeed");
const cameraFallback = document.getElementById("cameraFallback");

let totalSeconds = 30 * 60;
let remainingSeconds = totalSeconds;
let timerId = null;

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function renderTimer() {
  timerDisplay.textContent = formatTime(remainingSeconds);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  startPauseButton.textContent = "Start";
}

function tick() {
  if (remainingSeconds > 0) {
    remainingSeconds -= 1;
    renderTimer();
    return;
  }
  stopTimer();
}

function startTimer() {
  if (timerId) {
    stopTimer();
    return;
  }

  startPauseButton.textContent = "Pause";
  timerId = setInterval(tick, 1000);
}

function resetTimer() {
  stopTimer();
  remainingSeconds = totalSeconds;
  renderTimer();
}

startPauseButton.addEventListener("click", startTimer);
resetButton.addEventListener("click", resetTimer);

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const minutes = Number(button.dataset.minutes);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return;
    }
    totalSeconds = minutes * 60;
    remainingSeconds = totalSeconds;
    stopTimer();
    renderTimer();
  });
});

async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraFallback.style.display = "block";
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    cameraFeed.srcObject = stream;
    await cameraFeed.play();
  } catch (_error) {
    cameraFeed.style.display = "none";
    cameraFallback.style.display = "block";
  }
}

renderTimer();
setupCamera();
