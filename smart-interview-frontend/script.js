import {
  FaceDetector,
  FilesetResolver
} from "@mediapipe/tasks-vision";

/**
 * SMART INTERVIEW ANALYZER
 * Frontend connected to Flask backend.
 */

const BACKEND_URL = "http://localhost:5000";
const STORAGE_KEY = "smart_interview_history";

const SILENCE_WARNING_MS = 3000;
const SILENCE_RMS_THRESHOLD = 0.015;

const QUESTION_BANKS = {
  hr: [
    { q: "Tell me about yourself.", tip: "Cover your education, projects, strengths, and career objective." },
    { q: "Why should we hire you?", tip: "Connect your skills, learning ability, and enthusiasm to the role." },
    { q: "What is your biggest strength?", tip: "Give one strength and support it with a real example." },
    { q: "Tell me about a mistake you made and what you learned from it.", tip: "Take responsibility and explain what you changed." },
    { q: "Where do you see yourself in five years?", tip: "Describe how you hope to grow and contribute." },
    { q: "Why do you want to join our company?", tip: "Connect what you know about the company with your goals." },
    { q: "How do you handle workplace pressure and deadlines?", tip: "Explain how you prioritize, plan, and communicate." },
    { q: "What type of work environment brings out your best performance?", tip: "Describe the environment in which you work effectively." },
    { q: "Tell me about a situation where you had to adapt quickly to change.", tip: "Explain the change, your response, and the outcome." },
    { q: "How do you handle constructive feedback from peers or mentors?", tip: "Explain how you listen and apply useful feedback." }
  ],

  behavioral: [
    { q: "Tell me about a time you faced a difficult situation.", tip: "Use STAR: Situation, Task, Action, and Result." },
    { q: "How do you handle pressure?", tip: "Give a genuine example and explain your approach." },
    { q: "Describe a time when you had a disagreement with a team member.", tip: "Focus on listening, respect, and reaching a solution." },
    { q: "Tell me about a project where you took leadership initiative.", tip: "Describe the initiative you took and its impact." },
    { q: "Describe a time when you failed to achieve a target and what happened.", tip: "Explain what happened and what you learned." },
    { q: "Tell me about a time you had to solve a problem with incomplete information.", tip: "Explain how you evaluated what you knew and acted." },
    { q: "Describe an experience where you had to persuade someone to see your perspective.", tip: "Explain how you communicated your reasoning." },
    { q: "Tell me about a time you went above and beyond project expectations.", tip: "Give a specific example of extra effort." },
    { q: "How do you prioritize competing deadlines under strict time constraints?", tip: "Explain how you assess urgency and importance." },
    { q: "Describe a situation where you worked with someone whose style differed from yours.", tip: "Explain how you adapted and collaborated." }
  ]
};

const state = {
  currentView: "dashboard",
  selectedType: "hr",
  selectedDifficulty: "intermediate",
  selectedCount: 5,

  questions: [],
  currentQuestionIndex: 0,

  mediaStream: null,
  mediaRecorder: null,
  recordedChunks: [],

  currentRecordedBlob: null,
  currentRecordedUrl: null,
  recordedAnswers: [],

  recordingMimeType: "",
  isRecording: false,
  isSavingRecording: false,

  timerInterval: null,
  secondsElapsed: 0,

  cameraGranted: false,
  audioGranted: false,

  audioContext: null,
  audioAnalyser: null,
  audioAnimId: null,

  currentActiveSession: null,
  activeQuestionTabIdx: 0,
  history: []
};

const $ = id => document.getElementById(id);

const dom = {
  views: {
    dashboard: $("view-dashboard"),
    setup: $("view-setup"),
    interview: $("view-interview"),
    completion: $("view-completion"),
    loading: $("view-loading"),
    results: $("view-results"),
    history: $("view-history")
  },

  navLinks: document.querySelectorAll(".nav-link"),

  brandLogo: $("brand-logo-btn"),
  navProfileBtn: $("nav-profile-btn"),
  btnNavEnableCamera: $("btn-nav-enable-camera"),
  btnDashStart: $("btn-dash-start"),

  statCompleted: $("stat-completed"),
  statAvgScore: $("stat-avg-score"),
  statLatestScore: $("stat-latest-score"),
  statLatestSubtext: $("stat-latest-subtext"),
  statImprovement: $("stat-improvement"),

  progressSequence: $("progress-sequence"),
  dashboardChartLabels: $("dashboard-chart-labels"),
  chartPathArea: $("chart-path-area"),
  chartPathLine: $("chart-path-line"),
  chartDotsGroup: $("chart-dots-group"),
  recentSessionsTbody: $("recent-sessions-tbody"),
  btnViewAllHistory: $("btn-view-all-history"),

  typeCards: document.querySelectorAll(".type-select-card"),
  diffBtns: document.querySelectorAll("[data-setup-diff]"),
  countBtns: document.querySelectorAll("[data-setup-count]"),

  btnBeginInterview: $("btn-begin-interview"),
  btnSetupBack: $("btn-setup-back"),
  btnSetupEnableCamera: $("btn-setup-enable-camera"),

  topSessionPill: $("top-session-pill"),
  topQuestionNum: $("top-question-num"),
  topProgressBar: $("top-progress-bar"),
  btnExitInterview: $("btn-exit-interview"),

  videoFrame: $("video-frame"),
  webcamPreview: $("webcamPreview"),
  previewVideo: $("preview-video"),
  cameraErrorAlert: $("camera-error-alert"),
  cameraErrorText: $("camera-error-text"),
  btnRetryCamera: $("btn-retry-camera"),
  cameraStatusText: $("camera-status-text"),

  timerDisplay: $("timer-display"),
  stageStatusText: $("stage-status-text"),
  activeQuestionHeading: $("active-question-heading"),
  activeQuestionTip: $("active-question-tip"),

  btnStartAnswer: $("btn-start-answer"),
  btnStopAnswer: $("btn-stop-answer"),
  btnRetakeAnswer: $("btn-retake-answer"),
  btnNextQuestion: $("btn-next-question"),

  recStateMsg: $("rec-state-msg"),
  liveObservingNotice: $("live-observing-notice"),

  btnAnalyzeMyInterview: $("btn-analyze-my-interview"),

  loadQuestionProgress: $("load-question-progress"),
  loadingErrorBox: $("loading-error-box"),
  loadingErrorTitle: $("loading-error-title"),
  loadingErrorSubtext: $("loading-error-subtext"),
  loadingErrorDetails: $("loading-error-details"),

  btnLoadingRetry: $("btn-loading-retry"),
  btnLoadingCheckHealth: $("btn-loading-check-health"),
  btnLoadingCancel: $("btn-loading-cancel"),

  overallScoreNumber: $("overall-score-number"),
  overallGradeText: $("overall-grade-text"),
  overallGradeBadge: $("overall-grade-badge"),
  overallDescText: $("overall-desc-text"),
  circleProgressBar: $("circle-progress-bar"),

  videoScoreBadge: $("video-score-badge"),
  videoDetectedEmotion: $("video-detected-emotion"),
  videoDetectedText: $("video-detected-text"),
  videoFrameStats: $("video-frame-stats"),
  videoProbBars: $("video-prob-bars"),

  audioScoreBadge: $("audio-score-badge"),
  audioDetectedEmotion: $("audio-detected-emotion"),
  audioDetectedText: $("audio-detected-text"),
  audioConfidenceBadge: $("audio-confidence-badge"),
  audioProbBars: $("audio-prob-bars"),

  textScoreBadge: $("text-score-badge"),
  textQualityLabel: $("text-quality-label"),
  textQualityText: $("text-quality-text"),
  textProbBars: $("text-prob-bars"),

  fluencyStatusBadge: $("fluency-status-badge"),
  fluencyScoreVal: $("fluency-score-val"),
  fluencyFillerCount: $("fluency-filler-count"),
  fluencyPaceVal: $("fluency-pace-val"),
  fluencyFillersContainer: $("fluency-fillers-container"),
  fluencyDynamicDetails: $("fluency-dynamic-details"),

  transcriptContentText: $("transcript-content-text"),

  qBreakdownCount: $("q-breakdown-count"),
  questionTabsNav: $("question-tabs-nav"),
  resQuestionWiseList: $("res-question-wise-list"),

  btnResultsPracticeAgain: $("btn-results-practice-again"),
  btnResultsViewHistory: $("btn-results-view-history"),
  btnResultsPrint: $("btn-results-print"),

  historyTbody: $("history-tbody"),
  btnHistoryStartNew: $("btn-history-start-new")
};

function setText(el, value) {
  if (el) el.textContent = value;
}

function setHTML(el, value) {
  if (el) el.innerHTML = value;
}

function show(el, display = "block") {
  if (el) el.style.display = display;
}

function hide(el) {
  if (el) el.style.display = "none";
}

function capitalize(value) {
  const s = String(value ?? "");
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function switchView(viewName) {
  if (viewName === "start") {
    viewName = "setup";
  }

  state.currentView = viewName;

  Object.entries(dom.views).forEach(([key, el]) => {
    el?.classList.toggle("active", key === viewName);
  });

  dom.navLinks.forEach(link => {
    const target = link.getAttribute("data-target");

    link.classList.toggle(
      "active",
      target === viewName ||
      (viewName === "setup" && target === "start")
    );
  });

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

window.switchView = switchView;

async function analyzeInterviewWithBackend(videoBlob, question, filename) {
  if (!(videoBlob instanceof Blob) || videoBlob.size === 0) {
    throw new Error("This answer has no valid recording. Please record it again.");
  }

  const formData = new FormData();
  formData.append("question", question);
  formData.append("video", videoBlob, filename || "interview.webm");

  let response;

  try {
    response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      body: formData
    });
  } catch (error) {
    const networkError = new Error(
      "Cannot connect to the Flask backend. Check that it is running at http://localhost:5000."
    );

    networkError.isNetworkError = true;
    throw networkError;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data.details ||
      data.error ||
      `Analysis failed (HTTP ${response.status}).`;

    const error = new Error(message);

    error.status = response.status;
    error.serverDetails = data.details || data.error || "";

    throw error;
  }

  return data;
}

async function checkBackendHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    const data = await response.json().catch(() => ({}));

    return response.ok
      ? { ok: true, data }
      : { ok: false, error: `Server returned ${response.status}` };

  } catch (error) {
    return { ok: false, error: error.message };
  }
}
// LOCAL HISTORY

function getInterviewHistory() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(parsed) ? parsed : [];

  } catch (error) {
    console.warn("Could not read interview history:", error);
    return [];
  }
}

function saveInterviewHistory(session) {
  const history = getInterviewHistory();

  history.unshift(session);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(history)
  );

  state.history = history;

  updateDashboardAnalytics();
  displayInterviewHistory();
}

function renderEmptyDashboardChart() {
  dom.chartPathArea?.setAttribute(
    "points",
    "50,150 450,150"
  );

  dom.chartPathLine?.setAttribute(
    "points",
    "50,150 450,150"
  );

  setHTML(dom.chartDotsGroup, "");

  setHTML(
    dom.dashboardChartLabels,
    `<div style="width:100%;text-align:center;padding:6px;color:var(--text-muted)">
      Practice an interview to visualize your score trend.
    </div>`
  );
}

function updateDashboardAnalytics() {
  const history = getInterviewHistory();

  state.history = history;

  if (!history.length) {
    setText(dom.statCompleted, "0");
    setText(dom.statAvgScore, "--");
    setText(dom.statLatestScore, "--");
    setText(dom.statLatestSubtext, "No session recorded yet");
    setText(dom.statImprovement, "--");

    setHTML(
      dom.progressSequence,
      `<span style="color:var(--text-muted)">
        Complete an interview to track your progress.
      </span>`
    );

    setHTML(
      dom.recentSessionsTbody,
      `<tr>
        <td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">
          No saved interviews yet.
        </td>
      </tr>`
    );

    renderEmptyDashboardChart();
    return;
  }

  const scores = history
    .map(item => Number(item.overallScore))
    .filter(Number.isFinite);

  const latest = Number(history[0].overallScore);

  const average = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  setText(dom.statCompleted, String(history.length));

  setText(
    dom.statAvgScore,
    average === null ? "--" : `${average} / 100`
  );

  setText(
    dom.statLatestScore,
    Number.isFinite(latest) ? `${latest} / 100` : "--"
  );

  setText(
    dom.statLatestSubtext,
    `Grade: ${history[0].overallGrade || "Not available"}`
  );

  const previous = Number(history[1]?.overallScore);

  setText(
    dom.statImprovement,
    Number.isFinite(previous) && Number.isFinite(latest)
      ? `${latest - previous >= 0 ? "+" : ""}${latest - previous}%`
      : "--"
  );

  renderDashboardTrendChart(history);

  const recent = [...history].reverse().slice(-5);

  setHTML(
    dom.progressSequence,
    recent.map((item, index) =>
      `${index ? '<span class="seq-arrow">→</span>' : ""}
      <span class="seq-item ${index === recent.length - 1 ? "current" : ""}">
        ${escapeHTML(item.overallScore ?? "--")}
      </span>`
    ).join("")
  );

  renderSessionTable(
    dom.recentSessionsTbody,
    history.slice(0, 4)
  );
}

function renderDashboardTrendChart(history) {
  const sessions = [...history].reverse().slice(-5);

  if (!sessions.length) {
    return renderEmptyDashboardChart();
  }

  const width = 500;
  const height = 170;
  const pad = 50;
  const chartHeight = 110;

  const points = sessions.map((session, index) => {
    const score = Math.max(
      0,
      Math.min(100, Number(session.overallScore) || 0)
    );

    return {
      x: sessions.length === 1
        ? width / 2
        : pad + index * ((width - 2 * pad) / (sessions.length - 1)),

      y: 30 + chartHeight - score / 100 * chartHeight,
      score,
      session,
      index
    };
  });

  const line = points
    .map(point => `${point.x},${point.y}`)
    .join(" ");

  dom.chartPathLine?.setAttribute("points", line);

  dom.chartPathArea?.setAttribute(
    "points",
    `${points[0].x},${height - 10} ${line} ${points.at(-1).x},${height - 10}`
  );

  setHTML(
    dom.chartDotsGroup,
    points.map((point, index) =>
      `<circle cx="${point.x}" cy="${point.y}" r="5" class="chart-dot">
        <title>Session ${index + 1}: ${point.score}/100</title>
      </circle>`
    ).join("")
  );

  setHTML(
    dom.dashboardChartLabels,
    points.map((point, index) =>
      `<div class="chart-label-item">
        <div class="chart-label-session">Session ${index + 1}</div>
        <div class="chart-label-pct">${point.score}</div>
      </div>`
    ).join("")
  );
}

function renderSessionTable(container, items) {
  if (!container) return;

  container.innerHTML = "";

  items.forEach(item => {
    const tr = document.createElement("tr");
    const grade = item.overallGrade || "Not available";

    tr.innerHTML = `
      <td><strong>${escapeHTML(item.date || "")}</strong></td>

      <td>
        <span class="badge-pill ${item.type?.includes("HR") ? "badge-hr" : "badge-behavioral"}">
          ${escapeHTML(item.type || "Interview")}
        </span>
      </td>

      <td>${Number(item.questionsCount) || 0} Questions</td>

      <td>
        <strong>${escapeHTML(item.overallScore ?? "--")} / 100</strong>
      </td>

      <td>
        <span class="badge-pill">${escapeHTML(grade)}</span>
      </td>

      <td>
        <button class="btn btn-outline btn-sm" data-session-id="${escapeHTML(item.id)}">
          View Report →
        </button>
      </td>
    `;

    tr.querySelector("button")?.addEventListener("click", () => {
      window.viewSavedSession(item.id);
    });

    container.appendChild(tr);
  });
}

function displayInterviewHistory() {
  const history = getInterviewHistory();

  if (!history.length) {
    setHTML(
      dom.historyTbody,
      `<tr>
        <td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">
          No interview history found. Practice an interview to generate your first report.
        </td>
      </tr>`
    );

    return;
  }

  renderSessionTable(dom.historyTbody, history);
}

window.viewSavedSession = function(id) {
  const session = getInterviewHistory().find(
    item => item.id === id
  );

  if (!session) return;

  renderResultsDashboard(session);
  switchView("results");
};

// LIVE MULTIPLE-FACE DETECTION

let faceDetector = null;
let faceDetectorInitPromise = null;
let faceMonitorRaf = null;
let faceMonitoringActive = false;

let multipleFaceStreak = 0;
let lastFaceCheck = 0;
let lastFaceVideoTime = -1;

let faceWarningElement = null;
let faceDetectionUnavailableElement = null;

function createFaceWarning() {
  if (faceWarningElement) return;

  faceWarningElement = document.createElement("div");

  faceWarningElement.id = "multiple-face-warning";
  faceWarningElement.setAttribute("role", "alert");

  Object.assign(faceWarningElement.style, {
    display: "none",
    position: "fixed",
    top: "90px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "99999",
    background: "#b91c1c",
    color: "white",
    padding: "14px 22px",
    borderRadius: "10px",
    fontWeight: "600",
    textAlign: "center",
    maxWidth: "90%",
    width: "max-content",
    boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
  });

  document.body.appendChild(faceWarningElement);
}

function showMultipleFaceWarning() {
  createFaceWarning();

  faceWarningElement.textContent =
    "⚠️ Multiple faces detected! Please ensure you are the only person in the frame.";

  faceWarningElement.style.display = "block";
}

function hideMultipleFaceWarning() {
  if (faceWarningElement) {
    faceWarningElement.style.display = "none";
  }
}

function showFaceDetectionUnavailable(message) {
  if (!faceDetectionUnavailableElement) {
    faceDetectionUnavailableElement = document.createElement("div");

    faceDetectionUnavailableElement.id =
      "face-detection-unavailable";

    faceDetectionUnavailableElement.setAttribute(
      "role",
      "status"
    );

    Object.assign(faceDetectionUnavailableElement.style, {
      display: "block",
      position: "fixed",
      bottom: "18px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "99998",
      background: "#92400e",
      color: "white",
      padding: "10px 16px",
      borderRadius: "8px",
      fontSize: "13px",
      textAlign: "center",
      maxWidth: "90%",
      boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
    });

    document.body.appendChild(faceDetectionUnavailableElement);
  }

  faceDetectionUnavailableElement.textContent = message;
}

async function initializeFaceDetector() {
  if (faceDetector) return faceDetector;

  if (!faceDetectorInitPromise) {
    faceDetectorInitPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );

      return FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
        },

        runningMode: "VIDEO",
        minDetectionConfidence: 0.65
      });
    })();
  }

  try {
    faceDetector = await faceDetectorInitPromise;
    return faceDetector;

  } catch (error) {
    faceDetectorInitPromise = null;
    throw error;
  }
}

async function startFaceMonitoring() {
  if (faceMonitoringActive) return;

  try {
    await initializeFaceDetector();

    faceMonitoringActive = true;
    multipleFaceStreak = 0;
    lastFaceCheck = 0;
    lastFaceVideoTime = -1;

    if (faceDetectionUnavailableElement) {
      faceDetectionUnavailableElement.style.display = "none";
    }

    console.log("Live face detection started.");

    checkFacesInCamera();

  } catch (error) {
    console.error("Face detection initialization failed:", error);

    showFaceDetectionUnavailable(
      "Face detection unavailable. Check your internet connection and reload."
    );
  }
}

function checkFacesInCamera() {
  if (!faceMonitoringActive) return;

  const video = dom.webcamPreview;
  const now = performance.now();

  if (
    video &&
    video.readyState >= 2 &&
    video.videoWidth > 0 &&
    video.currentTime !== lastFaceVideoTime &&
    now - lastFaceCheck >= 400
  ) {
    lastFaceVideoTime = video.currentTime;
    lastFaceCheck = now;

    try {
      const result = faceDetector.detectForVideo(video, now);
      const faceCount = result.detections.length;

      console.log("Faces detected:", faceCount);

      if (faceCount >= 2) {
        multipleFaceStreak++;

        if (multipleFaceStreak >= 2) {
          showMultipleFaceWarning();
        }
      } else {
        multipleFaceStreak = 0;
        hideMultipleFaceWarning();
      }

    } catch (error) {
      console.error("Face detection error:", error);
    }
  }

  faceMonitorRaf = requestAnimationFrame(checkFacesInCamera);
}

function stopFaceMonitoring() {
  faceMonitoringActive = false;
  multipleFaceStreak = 0;

  if (faceMonitorRaf) {
    cancelAnimationFrame(faceMonitorRaf);
    faceMonitorRaf = null;
  }

  hideMultipleFaceWarning();

  if (faceDetectionUnavailableElement) {
    faceDetectionUnavailableElement.style.display = "none";
  }
}
// LIVE MICROPHONE SILENCE WARNING

let noVoiceWarningElement = null;
let silenceStartedAt = null;

function createNoVoiceWarning() {
  if (noVoiceWarningElement) return;

  noVoiceWarningElement = document.createElement("div");
  noVoiceWarningElement.id = "no-voice-warning";
  noVoiceWarningElement.setAttribute("role", "alert");

  Object.assign(noVoiceWarningElement.style, {
    display: "none",
    position: "fixed",
    top: "150px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "99999",
    background: "#92400e",
    color: "#ffffff",
    padding: "14px 22px",
    borderRadius: "10px",
    fontWeight: "600",
    textAlign: "center",
    maxWidth: "90%",
    boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
  });

  document.body.appendChild(noVoiceWarningElement);
}

function showNoVoiceWarning() {
  createNoVoiceWarning();

  noVoiceWarningElement.textContent =
    "⚠️ No microphone audio detected. Please check your microphone and speak.";

  noVoiceWarningElement.style.display = "block";
}

function hideNoVoiceWarning() {
  if (noVoiceWarningElement) {
    noVoiceWarningElement.style.display = "none";
  }
}

function checkMicrophoneSilence(analyser, timeData) {
  if (!state.isRecording) {
    silenceStartedAt = null;
    hideNoVoiceWarning();
    return;
  }

  analyser.getByteTimeDomainData(timeData);

  let sumSquares = 0;

  for (let i = 0; i < timeData.length; i++) {
    const sample = (timeData[i] - 128) / 128;
    sumSquares += sample * sample;
  }

  const rms = Math.sqrt(sumSquares / timeData.length);
  const now = performance.now();

  if (rms < SILENCE_RMS_THRESHOLD) {
    if (silenceStartedAt === null) {
      silenceStartedAt = now;
    }

    if (now - silenceStartedAt >= SILENCE_WARNING_MS) {
      showNoVoiceWarning();
    }

  } else {
    silenceStartedAt = null;
    hideNoVoiceWarning();
  }
}

// CAMERA AND AUDIO

async function initWebcam() {
  try {
    hide(dom.cameraErrorAlert);

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Camera access is not supported in this browser. Use localhost or HTTPS."
      );
    }

    if (state.mediaStream) {
      stopWebcam();
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    state.mediaStream = stream;

    state.cameraGranted =
      stream.getVideoTracks().length > 0;

    state.audioGranted =
      stream.getAudioTracks().length > 0;

    if (!state.cameraGranted || !state.audioGranted) {
      stream.getTracks().forEach(track => track.stop());
      state.mediaStream = null;

      throw new Error(
        "Both camera and microphone access are required to record an interview."
      );
    }

    if (dom.webcamPreview) {
      dom.webcamPreview.srcObject = stream;
      dom.webcamPreview.style.display = "block";

      await dom.webcamPreview.play().catch(() => {});
    }

    hide(dom.previewVideo);

    setText(dom.cameraStatusText, "Camera Ready");

    setText(
      dom.stageStatusText,
      "Camera and microphone ready. Click Start Answer when ready."
    );

    if (
      dom.btnStartAnswer &&
      !state.recordedAnswers[state.currentQuestionIndex]
    ) {
      dom.btnStartAnswer.disabled = false;
    }

    setupAudioVisualizer(stream);

    // Start the live face detector.
    startFaceMonitoring();

    return stream;

  } catch (error) {
    console.warn("Camera/microphone error:", error);

    state.cameraGranted = false;
    state.audioGranted = false;
    state.mediaStream = null;

    hide(dom.webcamPreview);

    setText(dom.cameraStatusText, "Camera Unavailable");

    setText(
      dom.stageStatusText,
      "Allow camera and microphone access, then retry."
    );

    if (dom.btnStartAnswer) {
      dom.btnStartAnswer.disabled = true;
    }

    show(dom.cameraErrorAlert, "flex");

    setText(
      dom.cameraErrorText,
      error.name === "NotAllowedError"
        ? "Camera or microphone permission was denied. Allow access using the browser lock icon, then retry."
        : error.message || "Unable to access camera or microphone."
    );

    return null;
  }
}

function stopWebcam() {
  stopFaceMonitoring();

  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(track => track.stop());
  }

  state.mediaStream = null;

  if (dom.webcamPreview) {
    dom.webcamPreview.srcObject = null;
  }

  stopAudioVisualizer();
}

function setupAudioVisualizer(stream) {
  stopAudioVisualizer();

  try {
    const audioTracks = stream.getAudioTracks();

    if (!audioTracks || audioTracks.length === 0) {
      return;
    }

    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      console.warn("AudioContext is not supported.");
      return;
    }

    state.audioContext = new AudioContextClass();

    const source =
      state.audioContext.createMediaStreamSource(stream);

    state.audioAnalyser =
      state.audioContext.createAnalyser();

    state.audioAnalyser.fftSize = 512;

    source.connect(state.audioAnalyser);

    const frequencyData = new Uint8Array(
      state.audioAnalyser.frequencyBinCount
    );

    const timeData = new Uint8Array(
      state.audioAnalyser.fftSize
    );

    const bars = document.querySelectorAll(".sound-bar");

    const animate = () => {
      if (!state.audioAnalyser) return;

      state.audioAnalyser.getByteFrequencyData(frequencyData);

      bars.forEach((bar, i) => {
        const height = Math.max(
          4,
          Math.min(22, (frequencyData[i] || 0) / 255 * 24)
        );

        bar.style.height = `${height}px`;

        bar.style.background =
          height > 10 ? "var(--primary)" : "#cbd5e1";
      });

      // Check for sustained microphone silence while recording.
      checkMicrophoneSilence(
        state.audioAnalyser,
        timeData
      );

      state.audioAnimId = requestAnimationFrame(animate);
    };

    state.audioContext.resume().catch(error => {
      console.warn("Could not resume AudioContext:", error);
    });

    animate();

  } catch (error) {
    console.warn("Audio visualizer unavailable:", error);
  }
}

function stopAudioVisualizer() {
  if (state.audioAnimId) {
    cancelAnimationFrame(state.audioAnimId);
  }

  state.audioAnimId = null;
  state.audioAnalyser = null;

  if (
    state.audioContext &&
    state.audioContext.state !== "closed"
  ) {
    state.audioContext.close().catch(() => {});
  }

  state.audioContext = null;

  silenceStartedAt = null;
  hideNoVoiceWarning();

  document.querySelectorAll(".sound-bar").forEach(bar => {
    bar.style.height = "6px";
    bar.style.background = "#cbd5e1";
  });
}

// RECORDING ENGINE

function startRecordingAnswer() {
  if (
    !state.mediaStream ||
    !state.cameraGranted ||
    !state.audioGranted
  ) {
    alert(
      "Please enable both your camera and microphone before recording."
    );

    initWebcam();
    return;
  }

  if (typeof MediaRecorder === "undefined") {
    alert(
      "This browser does not support video recording. Please use a recent version of Chrome or Edge."
    );

    return;
  }

  state.recordedChunks = [];
  state.secondsElapsed = 0;
  state.currentRecordedBlob = null;

  silenceStartedAt = null;
  hideNoVoiceWarning();

  updateTimerDisplay(0);

  const supportedTypes = [
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4"
  ];

  state.recordingMimeType =
    supportedTypes.find(type =>
      MediaRecorder.isTypeSupported(type)
    ) || "";

  try {
    state.mediaRecorder = new MediaRecorder(
      state.mediaStream,
      state.recordingMimeType
        ? { mimeType: state.recordingMimeType }
        : {}
    );

    state.recordingMimeType =
      state.mediaRecorder.mimeType ||
      state.recordingMimeType ||
      "video/webm";

    state.mediaRecorder.ondataavailable = event => {
      if (event.data?.size) {
        state.recordedChunks.push(event.data);
      }
    };

    state.mediaRecorder.onerror = event => {
      console.error(
        "MediaRecorder error:",
        event.error || event
      );

      alert(
        "A recording error occurred. Please retake this answer."
      );
    };

    state.mediaRecorder.onstop = finishRecordingSave;

    state.mediaRecorder.start(250);

  } catch (error) {
    console.error("Could not start recording:", error);

    alert(`Could not start recording: ${error.message}`);

    state.mediaRecorder = null;
    return;
  }

  state.isRecording = true;
  state.isSavingRecording = false;

  dom.videoFrame?.classList.add("recording-live");

  setText(dom.cameraStatusText, "Recording Live");

  show(dom.liveObservingNotice);

  if (dom.webcamPreview) {
    dom.webcamPreview.style.display = "block";
  }

  hide(dom.previewVideo);

  if (dom.btnStartAnswer) {
    dom.btnStartAnswer.disabled = true;
  }

  if (dom.btnStopAnswer) {
    dom.btnStopAnswer.disabled = false;
  }

  if (dom.btnRetakeAnswer) {
    dom.btnRetakeAnswer.disabled = true;
  }

  if (dom.btnNextQuestion) {
    dom.btnNextQuestion.disabled = true;
  }

  setText(
    dom.recStateMsg,
    "Recording in progress. Speak clearly into your microphone."
  );

  setText(
    dom.stageStatusText,
    "Recording your answer. Click Stop when finished."
  );

  clearInterval(state.timerInterval);

  state.timerInterval = setInterval(() => {
    state.secondsElapsed++;
    updateTimerDisplay(state.secondsElapsed);
  }, 1000);
}
function stopRecordingAnswer() {
  if (!state.isRecording || !state.mediaRecorder) {
    return;
  }

  state.isRecording = false;
  state.isSavingRecording = true;

  clearInterval(state.timerInterval);

  silenceStartedAt = null;
  hideNoVoiceWarning();

  dom.videoFrame?.classList.remove("recording-live");

  setText(dom.cameraStatusText, "Saving Recording…");

  hide(dom.liveObservingNotice);

  if (dom.btnStopAnswer) {
    dom.btnStopAnswer.disabled = true;
  }

  if (dom.btnNextQuestion) {
    dom.btnNextQuestion.disabled = true;
  }

  if (dom.btnRetakeAnswer) {
    dom.btnRetakeAnswer.disabled = true;
  }

  setText(
    dom.recStateMsg,
    "Saving your recording. Please wait…"
  );

  try {
    if (state.mediaRecorder.state !== "inactive") {
      state.mediaRecorder.stop();
    } else {
      finishRecordingSave();
    }

  } catch (error) {
    console.error("Could not stop recording:", error);

    state.isSavingRecording = false;

    alert(
      "Could not save this recording. Please retake your answer."
    );
  }
}

function finishRecordingSave() {
  const mime = state.recordingMimeType || "video/webm";

  const blob = new Blob(
    state.recordedChunks,
    { type: mime }
  );

  state.isSavingRecording = false;
  state.mediaRecorder = null;

  if (!blob.size) {
    state.currentRecordedBlob = null;

    delete state.recordedAnswers[state.currentQuestionIndex];

    setText(dom.cameraStatusText, "Recording Failed");

    setText(
      dom.recStateMsg,
      "No video data was captured. Please retake your answer."
    );

    if (dom.btnStartAnswer) dom.btnStartAnswer.disabled = false;
    if (dom.btnStopAnswer) dom.btnStopAnswer.disabled = true;
    if (dom.btnRetakeAnswer) dom.btnRetakeAnswer.disabled = true;
    if (dom.btnNextQuestion) dom.btnNextQuestion.disabled = true;

    return;
  }

  if (state.currentRecordedUrl) {
    URL.revokeObjectURL(state.currentRecordedUrl);
  }

  state.currentRecordedBlob = blob;
  state.currentRecordedUrl = URL.createObjectURL(blob);

  if (dom.previewVideo) {
    dom.previewVideo.src = state.currentRecordedUrl;
    dom.previewVideo.style.display = "block";
  }

  hide(dom.webcamPreview);

  const question =
    state.questions[state.currentQuestionIndex];

  state.recordedAnswers[state.currentQuestionIndex] = {
    questionIndex: state.currentQuestionIndex,

    questionText:
      question?.q ||
      `Question ${state.currentQuestionIndex + 1}`,

    blob,
    mimeType: blob.type,

    filename: blob.type.includes("mp4")
      ? "interview.mp4"
      : "interview.webm",

    duration: state.secondsElapsed
  };

  setText(dom.cameraStatusText, "Answer Recorded");

  setText(
    dom.recStateMsg,
    "Answer saved. Preview it or continue to the next question."
  );

  setText(
    dom.stageStatusText,
    "Recording saved successfully."
  );

  if (dom.btnStartAnswer) dom.btnStartAnswer.disabled = true;
  if (dom.btnStopAnswer) dom.btnStopAnswer.disabled = true;
  if (dom.btnRetakeAnswer) dom.btnRetakeAnswer.disabled = false;
  if (dom.btnNextQuestion) dom.btnNextQuestion.disabled = false;
}

function retakeCurrentAnswer() {
  if (
    state.isRecording &&
    state.mediaRecorder?.state !== "inactive"
  ) {
    alert(
      "Stop the current recording before retaking it."
    );

    return;
  }

  if (state.isSavingRecording) {
    alert(
      "Please wait until the recording has finished saving."
    );

    return;
  }

  if (state.currentRecordedUrl) {
    URL.revokeObjectURL(state.currentRecordedUrl);
  }

  state.currentRecordedUrl = null;
  state.currentRecordedBlob = null;
  state.recordedChunks = [];
  state.secondsElapsed = 0;

  updateTimerDisplay(0);

  delete state.recordedAnswers[state.currentQuestionIndex];

  if (dom.previewVideo) {
    dom.previewVideo.pause();
    dom.previewVideo.removeAttribute("src");
    dom.previewVideo.load();
    hide(dom.previewVideo);
  }

  if (dom.webcamPreview && state.mediaStream) {
    show(dom.webcamPreview);
  }

  setText(
    dom.cameraStatusText,
    state.mediaStream ? "Camera Ready" : "Camera Unavailable"
  );

  dom.videoFrame?.classList.remove("recording-live");

  hide(dom.liveObservingNotice);

  if (dom.btnStartAnswer) {
    dom.btnStartAnswer.disabled = !state.mediaStream;
  }

  if (dom.btnStopAnswer) dom.btnStopAnswer.disabled = true;
  if (dom.btnRetakeAnswer) dom.btnRetakeAnswer.disabled = true;
  if (dom.btnNextQuestion) dom.btnNextQuestion.disabled = true;

  setText(dom.recStateMsg, "Ready to record your answer.");

  setText(
    dom.stageStatusText,
    state.mediaStream
      ? "Click Start Answer when ready."
      : "Enable camera and microphone to continue."
  );
}

function updateTimerDisplay(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  setText(
    dom.timerDisplay,
    `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  );
}

// INTERVIEW FLOW

async function beginInterviewSession() {
  const pool =
    QUESTION_BANKS[state.selectedType] || QUESTION_BANKS.hr;

  state.questions = pool.slice(
    0,
    Math.min(state.selectedCount, pool.length)
  );

  state.currentQuestionIndex = 0;
  state.recordedAnswers = [];

  const typeName = state.selectedType === "hr"
    ? "HR Interview"
    : "Behavioral Interview";

  const diff = capitalize(state.selectedDifficulty);

  setText(
    dom.topSessionPill,
    `${typeName} · ${diff}`
  );

  switchView("interview");

  loadQuestion(0);

  const stream = await initWebcam();

  if (!stream && dom.btnStartAnswer) {
    dom.btnStartAnswer.disabled = true;
  }
}

function loadQuestion(index) {
  state.currentQuestionIndex = index;

  const question = state.questions[index];

  if (!question) return;

  setText(
    dom.topQuestionNum,
    `Question ${index + 1} of ${state.questions.length}`
  );

  if (dom.topProgressBar) {
    dom.topProgressBar.style.width =
      `${(index + 1) / state.questions.length * 100}%`;
  }

  setText(
    dom.activeQuestionHeading,
    `"${question.q}"`
  );

  setText(dom.activeQuestionTip, question.tip);

  if (dom.btnNextQuestion) {
    dom.btnNextQuestion.textContent =
      index === state.questions.length - 1
        ? "Finish Interview →"
        : "Next Question →";
  }

  retakeCurrentAnswer();
}

function handleNextQuestion() {
  if (state.isRecording) {
    stopRecordingAnswer();

    setText(
      dom.recStateMsg,
      "Recording is being saved. The next question will be available when saving finishes."
    );

    return;
  }

  if (state.isSavingRecording) return;

  const answer =
    state.recordedAnswers[state.currentQuestionIndex];

  if (!answer?.blob?.size) {
    alert(
      "Please record and save your answer before continuing."
    );

    return;
  }

  const next = state.currentQuestionIndex + 1;

  if (next < state.questions.length) {
    loadQuestion(next);

  } else {
    stopWebcam();
    switchView("completion");
  }
}

// ANALYSIS PIPELINE

async function triggerAIAnalysis() {
  const answers = state.questions
    .map((question, index) => state.recordedAnswers[index])
    .filter(Boolean);

  if (
    answers.length !== state.questions.length ||
    answers.some(answer => !answer.blob?.size)
  ) {
    alert(
      "One or more answers are missing. Return to the interview and record every answer before analyzing."
    );

    switchView("interview");
    return;
  }

  switchView("loading");

  hide(dom.loadingErrorBox);
  resetLoadingSteps();

  const results = [];

  try {
    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];

      setText(
        dom.loadQuestionProgress,
        `Analyzing Question ${i + 1} of ${answers.length}: "${answer.questionText}"…`
      );

      animateLoadingStep(1);

      const result = await analyzeInterviewWithBackend(
        answer.blob,
        answer.questionText,
        answer.filename
      );

      validateBackendResult(result);

      animateLoadingStep(2);

      results.push({
        questionIndex: i,
        question: answer.questionText,
        result
      });

      animateLoadingStep(3);
    }

    animateLoadingStep(6);

    onAllQuestionsAnalyzed(results);

  } catch (error) {
    console.error(
      "Interview analysis failed:",
      error
    );

    showLoadingError(error);
  }
}

function validateBackendResult(result) {
  if (!result || typeof result !== "object") {
    throw new Error(
      "The backend returned an empty or invalid response."
    );
  }

  const hasAnyOutput = [
    "video",
    "audio",
    "text",
    "fluency",
    "transcript",
    "final"
  ].some(key => key in result);

  if (!hasAnyOutput) {
    throw new Error(
      "The backend response did not contain the expected analysis fields."
    );
  }
}

function resetLoadingSteps() {
  for (let i = 1; i <= 6; i++) {
    const el = $(`load-step-${i}`);

    if (el) {
      el.className = i === 1
        ? "load-step-item active"
        : "load-step-item";
    }
  }
}

function animateLoadingStep(step) {
  for (let i = 1; i <= 6; i++) {
    const el = $(`load-step-${i}`);

    if (!el) continue;

    el.className = i < step
      ? "load-step-item done"
      : i === step
        ? "load-step-item active"
        : "load-step-item";
  }
}

function showLoadingError(error) {
  show(dom.loadingErrorBox);

  setText(
    dom.loadingErrorTitle,
    error.status === 500
      ? "⚠️ Analysis Error"
      : "⚠️ Unable to complete analysis"
  );

  setText(
    dom.loadingErrorSubtext,
    error.status === 500
      ? "The backend received the recording but could not complete the analysis. Check the error details and backend terminal."
      : "Check that the Flask backend is running at http://localhost:5000 and try again."
  );

  setText(
    dom.loadingErrorDetails,
    error.serverDetails || error.message || "Unknown error"
  );

  setText(
    dom.loadQuestionProgress,
    "Analysis stopped. No report has been saved."
  );
}

function onAllQuestionsAnalyzed(questionResults) {
  const scores = questionResults
    .map(item =>
      Number(item.result.final?.score ?? item.result.score)
    )
    .filter(Number.isFinite);

  if (scores.length !== questionResults.length) {
    throw new Error(
      "The backend did not return a valid final score for every question. No overall score was created."
    );
  }

  const score = Math.round(
    scores.reduce((a, b) => a + b, 0) / scores.length
  );

  const firstGrade =
    questionResults[0]?.result?.final?.grade;

  const grade = firstGrade || (
    score >= 70
      ? "Good"
      : score >= 40
        ? "Average"
        : "Poor"
  );

  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const session = {
    id: `session_${Date.now()}`,
    date,

    type: state.selectedType === "hr"
      ? "HR Interview"
      : "Behavioral Interview",

    difficulty: state.selectedDifficulty,
    questionsCount: questionResults.length,

    overallScore: score,
    overallGrade: grade,

    questionResults,
    primaryResult: questionResults[0].result
  };

  state.currentActiveSession = session;

  saveInterviewHistory(session);

  renderResultsDashboard(session);

  switchView("results");
}
// RESULTS RENDERING

function renderResultsDashboard(session) {
  state.currentActiveSession = session;
  state.activeQuestionTabIdx = 0;

  const results = session.questionResults || [];

  const primary =
    session.primaryResult ||
    results[0]?.result;

  if (!primary) return;

  const score = Number(
    session.overallScore ?? primary.final?.score
  );

  if (!Number.isFinite(score)) {
    setText(dom.overallScoreNumber, "--");
    setText(dom.overallGradeText, "Unavailable");

  } else {
    setText(
      dom.overallScoreNumber,
      String(Math.round(score))
    );

    setText(
      dom.overallGradeText,
      session.overallGrade ||
      primary.final?.grade ||
      "Not available"
    );
  }

  const grade =
    session.overallGrade ||
    primary.final?.grade ||
    "Not available";

  setText(
    dom.overallGradeBadge,
    `Final Grade: ${grade}`
  );

  if (dom.overallGradeBadge) {
    dom.overallGradeBadge.className =
      `badge-pill badge-${String(grade).toLowerCase()}`;
  }

  setText(
    dom.overallDescText,
    "Results are based on the analysis returned by the backend."
  );

  const circumference = 440;

  if (dom.circleProgressBar && Number.isFinite(score)) {
    dom.circleProgressBar.style.strokeDashoffset =
      circumference -
      circumference * Math.max(0, Math.min(100, score)) / 100;
  }

  renderQuestionTabs(results);
  displayQuestionResult(0);
}

function renderQuestionTabs(results) {
  setText(
    dom.qBreakdownCount,
    `${results.length} Question${results.length === 1 ? "" : "s"} Analyzed`
  );

  setHTML(dom.questionTabsNav, "");

  if (dom.questionTabsNav) {
    dom.questionTabsNav.style.display =
      results.length <= 1 ? "none" : "flex";
  }

  results.forEach((item, index) => {
    const button = document.createElement("button");

    button.className =
      `q-tab-btn ${index === 0 ? "active" : ""}`;

    button.textContent = `Question ${index + 1}`;

    button.addEventListener("click", () => {
      state.activeQuestionTabIdx = index;

      dom.questionTabsNav
        .querySelectorAll(".q-tab-btn")
        .forEach((tab, i) => {
          tab.classList.toggle("active", i === index);
        });

      displayQuestionResult(index);
    });

    dom.questionTabsNav?.appendChild(button);
  });

  renderQuestionCardsList(results);
}

function displayQuestionResult(index) {
  const item =
    state.currentActiveSession?.questionResults?.[index];

  if (!item) return;

  const result = item.result || {};

  renderVideoEmotionSection(result.video || {});
  renderAudioEmotionSection(result.audio || {});
  renderAnswerQualitySection(result.text || {});
  renderFluencySection(result.fluency ?? {});

  setText(
    dom.transcriptContentText,
    result.transcript || "(No transcript returned by the backend.)"
  );
}

function getEmotionEmoji(emotion) {
  return ({
    happy: "😊",
    neutral: "😐",
    sad: "😢",
    angry: "😠",
    fear: "😨",
    disgust: "🤢"
  })[String(emotion).toLowerCase()] || "🎭";
}

function renderVideoEmotionSection(video) {
  const emotion = video.emotion;

  setText(
    dom.videoScoreBadge,
    Number.isFinite(Number(video.score))
      ? `Score: ${Math.round(Number(video.score))} / 100`
      : "Score: N/A"
  );

  setText(
    dom.videoDetectedText,
    emotion ? capitalize(emotion) : "Not available"
  );

  const emoji =
    dom.videoDetectedEmotion?.querySelector("span:first-child");

  if (emoji) {
    emoji.textContent = emotion
      ? getEmotionEmoji(emotion)
      : "—";
  }

  const stats = [
    video.frames != null
      ? `Frames: ${video.frames}`
      : null,

    video.sampled_frames != null
      ? `Sampled: ${video.sampled_frames}`
      : null,

    video.face_frames != null
      ? `Faces: ${video.face_frames}`
      : null

  ].filter(Boolean);

  setText(
    dom.videoFrameStats,
    stats.length
      ? stats.join(" · ")
      : "Frame statistics not returned"
  );

  renderProbabilityBars(
    dom.videoProbBars,
    video.probabilities,
    ["Angry", "Disgust", "Fear", "Happy", "Neutral", "Sad"]
  );
}

function renderAudioEmotionSection(audio) {
  const emotion = audio.emotion;

  setText(
    dom.audioScoreBadge,
    Number.isFinite(Number(audio.score))
      ? `Score: ${Math.round(Number(audio.score))} / 100`
      : "Score: N/A"
  );

  setText(
    dom.audioDetectedText,
    emotion ? capitalize(emotion) : "Not available"
  );

  const emoji =
    dom.audioDetectedEmotion?.querySelector("span:first-child");

  if (emoji) {
    emoji.textContent = emotion
      ? getEmotionEmoji(emotion)
      : "—";
  }

  const confidence = Number(audio.confidence);

  setText(
    dom.audioConfidenceBadge,
    Number.isFinite(confidence)
      ? `Confidence: ${Math.round(confidence <= 1 ? confidence * 100 : confidence)}%`
      : "Confidence: N/A"
  );

  renderProbabilityBars(
    dom.audioProbBars,
    audio.probabilities,
    ["Angry", "Disgust", "Fear", "Happy", "Neutral", "Sad"]
  );
}

function renderAnswerQualitySection(textResult) {
  const label = textResult.label;

  setText(
    dom.textScoreBadge,
    Number.isFinite(Number(textResult.score))
      ? `Score: ${Math.round(Number(textResult.score))} / 100`
      : "Score: N/A"
  );

  setText(
    dom.textQualityText,
    label ? capitalize(label) : "Not available"
  );

  const emoji =
    dom.textQualityLabel?.querySelector("span:first-child");

  if (emoji) {
    emoji.textContent = label
      ? ({
          good: "⭐",
          average: "⚖️",
          poor: "⚠️"
        })[String(label).toLowerCase()] || "—"
      : "—";
  }

  renderProbabilityBars(
    dom.textProbBars,
    textResult.probabilities,
    ["Poor", "Average", "Good"]
  );
}

function renderFluencySection(fluency) {
  if (typeof fluency === "number") {
    fluency = { score: fluency };
  }

  if (!fluency || typeof fluency !== "object") {
    fluency = {};
  }

  const score =
    fluency.score ??
    fluency.fluency_score ??
    fluency.rating;

  const fillers =
    fluency.filler_words ??
    fluency.fillers ??
    [];

  const fillerCount = Number(
    fluency.filler_count ??
    fluency.fillers_count ??
    fluency.count ??
    (Array.isArray(fillers) ? fillers.length : 0)
  );

  setText(
    dom.fluencyScoreVal,
    score == null ? "N/A" : String(score)
  );

  setText(
    dom.fluencyFillerCount,
    Number.isFinite(fillerCount)
      ? String(fillerCount)
      : "N/A"
  );

  setText(
    dom.fluencyStatusBadge,
    score == null &&
    !("filler_count" in fluency) &&
    !("fillers" in fluency)
      ? "Not available"
      : fillerCount <= 2
        ? "High Fluency"
        : fillerCount <= 5
          ? "Moderate Fluency"
          : "Needs Practice"
  );

  const pace =
    fluency.pace ??
    fluency.words_per_minute ??
    fluency.speaking_rate;

  setText(
    dom.fluencyPaceVal,
    pace == null ? "N/A" : String(pace)
  );

  setHTML(dom.fluencyFillersContainer, "");

  const words = Array.isArray(fillers)
    ? fillers
    : fillers && typeof fillers === "object"
      ? Object.entries(fillers).map(
          ([word, count]) => `${word} (${count})`
        )
      : [];

  if (words.length) {
    words.forEach(word => {
      const chip = document.createElement("span");

      chip.className = "filler-chip";
      chip.textContent = `⚠️ ${word}`;

      dom.fluencyFillersContainer?.appendChild(chip);
    });

  } else if (
    fillerCount === 0 &&
    (
      ("filler_count" in fluency) ||
      ("fillers" in fluency) ||
      ("count" in fluency)
    )
  ) {
    setHTML(
      dom.fluencyFillersContainer,
      `<span style="color:var(--success)">No filler words detected.</span>`
    );

  } else {
    setText(
      dom.fluencyFillersContainer,
      "Filler-word details not returned."
    );
  }

  const ignored = new Set([
    "score",
    "fluency_score",
    "rating",
    "filler_count",
    "fillers_count",
    "count",
    "fillers",
    "filler_words",
    "pace",
    "words_per_minute",
    "speaking_rate"
  ]);

  const entries = Object.entries(fluency).filter(
    ([key, value]) =>
      !ignored.has(key) &&
      ["string", "number", "boolean"].includes(typeof value)
  );

  setHTML(
    dom.fluencyDynamicDetails,
    entries.map(([key, value]) =>
      `<div style="display:inline-block;background:var(--bg-subtle);border:1px solid var(--border-color);padding:4px 10px;border-radius:6px;margin:3px 6px 3px 0">
        <strong>${escapeHTML(key.replace(/_/g, " "))}:</strong>
        ${escapeHTML(value)}
      </div>`
    ).join("")
  );
}

function renderProbabilityBars(container, probabilities, keys) {
  if (!container) return;

  if (!probabilities || typeof probabilities !== "object") {
    container.innerHTML =
      `<span style="color:var(--text-muted)">Probability data not returned.</span>`;

    return;
  }

  const map = {};

  if (Array.isArray(probabilities)) {
    probabilities.forEach(item => {
      if (!item || typeof item !== "object") return;

      const key =
        item.label ||
        item.emotion ||
        item.name;

      const value =
        item.probability ??
        item.prob ??
        item.score;

      if (key && value != null) {
        map[String(key).toLowerCase()] = Number(value);
      }
    });

  } else {
    Object.entries(probabilities).forEach(([key, value]) => {
      map[key.toLowerCase()] = Number(value);
    });
  }

  container.innerHTML = keys.map(key => {
    const raw = map[key.toLowerCase()];

    if (!Number.isFinite(raw)) return "";

    const pct = Math.max(
      0,
      Math.min(100, Math.round(raw <= 1 ? raw * 100 : raw))
    );

    return `
      <div class="prob-bar-row">
        <span class="prob-label">${key}</span>

        <div class="prob-track">
          <div class="prob-fill" style="width:${pct}%"></div>
        </div>

        <span class="prob-pct">${pct}%</span>
      </div>
    `;
  }).join("") ||
    `<span style="color:var(--text-muted)">No probability values returned.</span>`;
}

function renderQuestionCardsList(results) {
  if (!dom.resQuestionWiseList) return;

  dom.resQuestionWiseList.innerHTML = "";

  results.forEach((item, index) => {
    const result = item.result || {};

    const score =
      result.final?.score ??
      result.score;

    const grade =
      result.final?.grade ??
      "Not available";

    const card = document.createElement("div");

    card.className = "q-card-item";

    card.innerHTML = `
      <div class="q-card-top">
        <div>
          <span class="badge-pill badge-hr">
            Question ${index + 1}
          </span>

          <h4 class="q-card-heading">
            "${escapeHTML(item.question)}"
          </h4>
        </div>

        <div class="q-card-score">
          Score: ${score == null ? "N/A" : escapeHTML(score)}
          / 100 (${escapeHTML(grade)})
        </div>
      </div>

      <div class="q-card-metrics-row">
        <div>
          Facial Emotion:
          <strong>
            ${escapeHTML(
              result.video?.emotion
                ? capitalize(result.video.emotion)
                : "N/A"
            )}
          </strong>
        </div>

        <div>
          Voice Emotion:
          <strong>
            ${escapeHTML(
              result.audio?.emotion
                ? capitalize(result.audio.emotion)
                : "N/A"
            )}
          </strong>
        </div>

        <div>
          Answer Quality:
          <strong>
            ${escapeHTML(
              result.text?.label
                ? capitalize(result.text.label)
                : "N/A"
            )}
          </strong>
        </div>
      </div>

      <div style="font-size:.875rem;color:var(--text-secondary);background:var(--bg-subtle);padding:10px 14px;border-radius:8px;margin-top:8px">
        <strong>Transcript:</strong>
        ${escapeHTML(result.transcript || "Not available")}
      </div>
    `;

    dom.resQuestionWiseList.appendChild(card);
  });
}

// EVENT LISTENERS

function setupEventListeners() {
  dom.brandLogo?.addEventListener("click", () => {
    switchView("dashboard");
  });

  dom.navLinks.forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();

      const target = link.getAttribute("data-target");

      if (target === "history") {
        displayInterviewHistory();
        switchView("history");

      } else if (target === "start") {
        switchView("setup");

      } else {
        switchView("dashboard");
      }
    });
  });

  dom.navProfileBtn?.addEventListener("click", () => {
    displayInterviewHistory();
    switchView("history");
  });

  dom.btnDashStart?.addEventListener("click", () => {
    switchView("setup");
  });

  dom.btnViewAllHistory?.addEventListener("click", () => {
    displayInterviewHistory();
    switchView("history");
  });

  dom.typeCards.forEach(card => {
    card.addEventListener("click", () => {
      dom.typeCards.forEach(item => {
        item.classList.remove("selected");
      });

      card.classList.add("selected");

      state.selectedType =
        card.getAttribute("data-setup-type") || "hr";
    });
  });

  dom.diffBtns.forEach(button => {
    button.addEventListener("click", () => {
      dom.diffBtns.forEach(item => {
        item.classList.remove("selected");
      });

      button.classList.add("selected");

      state.selectedDifficulty =
        button.getAttribute("data-setup-diff") || "intermediate";
    });
  });

  dom.countBtns.forEach(button => {
    button.addEventListener("click", () => {
      dom.countBtns.forEach(item => {
        item.classList.remove("selected");
      });

      button.classList.add("selected");

      state.selectedCount =
        Number(button.getAttribute("data-setup-count")) || 5;
    });
  });

  dom.btnBeginInterview?.addEventListener(
    "click",
    beginInterviewSession
  );

  dom.btnSetupBack?.addEventListener("click", () => {
    switchView("dashboard");
  });

  dom.btnNavEnableCamera?.addEventListener(
    "click",
    initWebcam
  );

  dom.btnSetupEnableCamera?.addEventListener(
    "click",
    initWebcam
  );

  dom.btnRetryCamera?.addEventListener(
    "click",
    initWebcam
  );

  dom.btnStartAnswer?.addEventListener(
    "click",
    startRecordingAnswer
  );

  dom.btnStopAnswer?.addEventListener(
    "click",
    stopRecordingAnswer
  );

  dom.btnRetakeAnswer?.addEventListener(
    "click",
    retakeCurrentAnswer
  );

  dom.btnNextQuestion?.addEventListener(
    "click",
    handleNextQuestion
  );

  dom.btnExitInterview?.addEventListener("click", () => {
    if (
      confirm(
        "Exit the ongoing interview session? Unsaved progress will be lost."
      )
    ) {
      stopWebcam();
      switchView("dashboard");
    }
  });

  dom.btnAnalyzeMyInterview?.addEventListener(
    "click",
    triggerAIAnalysis
  );

  dom.btnLoadingRetry?.addEventListener(
    "click",
    triggerAIAnalysis
  );

  dom.btnLoadingCheckHealth?.addEventListener("click", async () => {
    setText(
      dom.loadQuestionProgress,
      "Checking backend health…"
    );

    const health = await checkBackendHealth();

    alert(
      health.ok
        ? "Backend is online at http://localhost:5000. This confirms server connectivity; it does not guarantee every AI model is ready."
        : `Backend health check failed: ${health.error}`
    );
  });

  dom.btnLoadingCancel?.addEventListener("click", () => {
    switchView("completion");
  });

  dom.btnResultsPracticeAgain?.addEventListener("click", () => {
    switchView("setup");
  });

  dom.btnResultsViewHistory?.addEventListener("click", () => {
    displayInterviewHistory();
    switchView("history");
  });

  dom.btnResultsPrint?.addEventListener("click", () => {
    window.print();
  });

  dom.btnHistoryStartNew?.addEventListener("click", () => {
    switchView("setup");
  });
}

// INITIALIZE FRONTEND

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();

  updateDashboardAnalytics();
  displayInterviewHistory();

  switchView("dashboard");

  console.log(
    "Smart Interview Analyzer frontend initialized. Flask backend:",
    BACKEND_URL
  );
});