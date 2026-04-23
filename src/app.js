const timerDisplay = document.getElementById("timerDisplay");
const startPauseButton = document.getElementById("startPauseButton");
const resetButton = document.getElementById("resetButton");
const presetButtons = document.querySelectorAll(".preset");
const cameraFeed = document.getElementById("cameraFeed");
const cameraFallback = document.getElementById("cameraFallback");
const recordQuestionButton = document.getElementById("recordQuestionButton");
const askAiButton = document.getElementById("askAiButton");
const qaStatus = document.getElementById("qaStatus");
const interviewerQuestion = document.getElementById("interviewerQuestion");
const aiAnswer = document.getElementById("aiAnswer");
const aiApiKeyInput = document.getElementById("aiApiKey");

let totalSeconds = 30 * 60;
let remainingSeconds = totalSeconds;
let timerId = null;
let recognition = null;
let isRecording = false;

const OPENROUTER_MODEL = "openrouter/free";
const API_KEY_STORAGE = "openrouter_api_key";

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

function setQaStatus(message) {
  qaStatus.textContent = message;
}

function getSpeechRecognitionConstructor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function setRecordingState(recording) {
  isRecording = recording;
  recordQuestionButton.textContent = recording ? "Stop Recording" : "Start Recording";
}

function setupSpeechRecognition() {
  const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
  if (!SpeechRecognitionCtor) {
    setQaStatus("Speech recognition is not supported in this browser.");
    recordQuestionButton.disabled = true;
    return;
  }

  recognition = new SpeechRecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.addEventListener("result", (event) => {
    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = 0; i < event.results.length; i += 1) {
      const transcript = event.results[i][0]?.transcript ?? "";
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    const stableText = finalTranscript.trim();
    const liveText = interimTranscript.trim();
    interviewerQuestion.value = [stableText, liveText].filter(Boolean).join(" ").trim();
  });

  recognition.addEventListener("error", (event) => {
    setRecordingState(false);
    setQaStatus(`Recording error: ${event.error}. Please retry.`);
  });

  recognition.addEventListener("end", () => {
    if (isRecording) {
      try {
        recognition.start();
      } catch (_error) {
        setRecordingState(false);
        setQaStatus("Recording stopped unexpectedly. Click Start Recording to continue.");
      }
      return;
    }
    setRecordingState(false);
  });
}

function toggleRecording() {
  if (!recognition) {
    return;
  }

  if (isRecording) {
    isRecording = false;
    recognition.stop();
    setQaStatus("Recording stopped. You can now ask AI for an answer.");
    return;
  }

  interviewerQuestion.value = "";
  try {
    recognition.start();
    setRecordingState(true);
    setQaStatus("Listening live for interviewer question...");
  } catch (_error) {
    setRecordingState(false);
    setQaStatus("Could not start recording. Check microphone permissions.");
  }
}

function loadStoredApiKey() {
  const storedKey = window.localStorage.getItem(API_KEY_STORAGE);
  if (storedKey) {
    aiApiKeyInput.value = storedKey;
  }
}

function getApiKey() {
  const key = aiApiKeyInput.value.trim();
  if (!key) {
    return "";
  }
  window.localStorage.setItem(API_KEY_STORAGE, key);
  return key;
}

async function askAi() {
  const question = interviewerQuestion.value.trim();
  if (!question) {
    setQaStatus("Please record or type a question before asking AI.");
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    setQaStatus("Please provide an OpenRouter API key.");
    aiApiKeyInput.focus();
    return;
  }

  askAiButton.disabled = true;
  askAiButton.textContent = "Thinking...";
  aiAnswer.value = "";
  setQaStatus("Generating concise answer with AI...");

  const prompt = [
    "You are an expert B2B SaaS account executive interview coach.",
    "Answer the interviewer question below.",
    "Requirements:",
    "- Keep the answer robust but concise (3-6 bullet points max).",
    "- Use clear business language and at least one measurable outcome when possible.",
    "- End with a short bridge sentence back to the role's priorities.",
    "",
    `Interviewer question: ${question}`
  ].join("\n");

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are an expert B2B SaaS account executive interview coach. Keep answers concise and practical."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.3
        })
      }
    );

    const payload = await response.json();
    if (!response.ok) {
      const message = payload?.error?.message || "AI request failed.";
      throw new Error(message);
    }

    const answer = payload?.choices?.[0]?.message?.content?.trim() || "";

    if (!answer) {
      throw new Error("The model returned an empty answer.");
    }

    aiAnswer.value = answer;
    setQaStatus("AI answer ready. Edit or use as needed.");
  } catch (error) {
    setQaStatus(`AI error: ${error.message}`);
    aiAnswer.value = "Unable to generate an answer. Check your API key and network, then try again.";
  } finally {
    askAiButton.disabled = false;
    askAiButton.textContent = "Ask AI";
  }
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

recordQuestionButton.addEventListener("click", toggleRecording);
askAiButton.addEventListener("click", askAi);
aiApiKeyInput.addEventListener("change", () => {
  const key = aiApiKeyInput.value.trim();
  if (key) {
    window.localStorage.setItem(API_KEY_STORAGE, key);
  }
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
loadStoredApiKey();
setupSpeechRecognition();
setupCamera();
