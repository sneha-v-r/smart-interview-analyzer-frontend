import {
  FaceDetector,
  FilesetResolver
} from "@mediapipe/tasks-vision";

/**
 * SMART INTERVIEW ANALYZER
 * Vanilla JavaScript frontend
 * Flask backend: http://localhost:5000
 */

const BACKEND_URL = "http://localhost:5000";
const STORAGE_KEY = "smart_interview_history";

const SILENCE_WARNING_MS = 3000;
const SILENCE_RMS_THRESHOLD = 0.015;

// ============================================================
// 1. QUESTION BANKS
// ============================================================

const QUESTION_BANKS = {
  hr: [
    {
      q: "Tell me about yourself.",
      tip: "Structure your answer: your educational background, recent projects/roles, key strengths, and career objective."
    },
    {
      q: "Why should we hire you?",
      tip: "Highlight your unique combination of skills, quick learning ability, and enthusiasm to contribute to team goals."
    },
    {
      q: "What is your biggest strength?",
      tip: "Mention a specific strength backed by a concrete academic or project example."
    },
    {
      q: "Tell me about a mistake you made and what you learned from it.",
      tip: "Take accountability, explain how you addressed the mistake, and how it improved your future workflow."
    },
    {
      q: "Where do you see yourself in five years?",
      tip: "Express your ambition to grow in expertise and take on greater responsibilities."
    },
    {
      q: "Why do you want to join our company?",
      tip: "Show knowledge of the company and alignment with your career goals."
    },
    {
      q: "How do you handle workplace pressure and deadlines?",
      tip: "Discuss prioritization, time management, organization, and communication."
    },
    {
      q: "What type of work environment brings out your best performance?",
      tip: "Describe the environment in which you collaborate and work effectively."
    },
    {
      q: "Tell me about a situation where you had to adapt quickly to change.",
      tip: "Describe how you adjusted your priorities and responded to the change."
    },
    {
      q: "How do you handle constructive feedback from peers or mentors?",
      tip: "Explain how you listen to feedback and turn it into improvement."
    }
  ],

  behavioral: [
    {
      q: "Tell me about a time you faced a difficult situation.",
      tip: "Use STAR: Situation, Task, Action, and Result."
    },
    {
      q: "How do you handle pressure?",
      tip: "Give an authentic example showing composure and systematic action."
    },
    {
      q: "Describe a time when you had a disagreement with a team member.",
      tip: "Focus on respect, listening, different perspectives, and compromise."
    },
    {
      q: "Tell me about a project where you took leadership initiative.",
      tip: "Describe an initiative you took and its impact."
    },
    {
      q: "Describe a time when you failed to achieve a target and what happened.",
      tip: "Explain what happened and what you learned."
    },
    {
      q: "Tell me about a time you had to solve a problem with incomplete information.",
      tip: "Explain how you evaluated what you knew and acted."
    },
    {
      q: "Describe an experience where you had to persuade someone to see your perspective.",
      tip: "Explain how you communicated your reasoning."
    },
    {
      q: "Tell me about a time you went above and beyond project expectations.",
      tip: "Give a specific example of extra effort."
    },
    {
      q: "How do you prioritize competing deadlines under strict time constraints?",
      tip: "Explain how you assess urgency and importance."
    },
    {
      q: "Describe a situation where you worked with someone whose style differed from yours.",
      tip: "Explain how you adapted and collaborated."
    }
  ]
};

// ============================================================
// 2. APPLICATION STATE
// ============================================================

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

// ============================================================
// 3. DOM REFERENCES
// ============================================================

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
  progressCardBadge: $("progress-card-badge"),
  progressCalloutTitle: $("progress-callout-title"),
  progressCalloutDesc: $("progress-callout-desc"),

  dashboardChartSvg: $("dashboard-chart-svg"),
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

  loadStep1: $("load-step-1"),
  loadStep2: $("load-step-2"),
  loadStep3: $("load-step-3"),
  loadStep4: $("load-step-4"),
  loadStep5: $("load-step-5"),
  loadStep6: $("load-step-6"),

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

// ============================================================
// 4. COMMON HELPERS
// ============================================================

function setText(element, value) {
  if (element) element.textContent = value;
}

function setHTML(element, value) {
  if (element) element.innerHTML = value;
}

function show(element, display = "block") {
  if (element) element.style.display = display;
}

function hide(element) {
  if (element) element.style.display = "none";
}

function capitalize(value) {
  if (!value) return "";

  const text = String(value);

  return text.charAt(0).toUpperCase() +
    text.slice(1).toLowerCase();
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

function formatKeyName(key) {
  return String(key)
    .replace(/_/g, " ")
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// 5. VIEW NAVIGATION
// ============================================================

function switchView(viewName) {
  if (viewName === "start") {
    viewName = "setup";
  }

  state.currentView = viewName;

  Object.keys(dom.views).forEach(key => {
    dom.views[key]?.classList.remove("active");
  });

  if (dom.views[viewName]) {
    dom.views[viewName].classList.add("active");
  }

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

// ============================================================
// 6. BACKEND API
// ============================================================

async function analyzeInterviewWithBackend(videoBlob, question) {
  if (!(videoBlob instanceof Blob) || videoBlob.size === 0) {
    throw new Error(
      "No valid video recording was provided for analysis."
    );
  }

  console.log("Uploading video to backend:", {
    size: videoBlob.size,
    type: videoBlob.type
  });

  const formData = new FormData();

  formData.append("question", question);

  const extension = videoBlob.type.includes("mp4")
    ? "mp4"
    : "webm";

  formData.append(
    "video",
    videoBlob,
    `interview.${extension}`
  );

  let response;

  try {
    response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      body: formData
    });

  } catch (networkError) {
    const error = new Error(
      networkError.message ||
      "Cannot connect to the Flask backend at http://localhost:5000."
    );

    error.isNetworkError = true;
    throw error;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      data?.details ||
      data?.error ||
      `Analysis failed with HTTP ${response.status}.`
    );

    error.status = response.status;
    error.serverDetails = data?.details || data?.error || "";

    throw error;
  }

  if (!data || typeof data !== "object") {
    throw new Error("The backend returned an invalid response.");
  }

  console.log("Backend analysis successful:", data);

  return data;
}

async function checkBackendHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);

    const data = await response.json().catch(() => ({
      status: response.ok ? "ok" : "unknown"
    }));

    return response.ok
      ? { ok: true, data }
      : { ok: false, error: `Server returned status ${response.status}` };

  } catch (error) {
    return {
      ok: false,
      error: error.message || "Backend health check failed."
    };
  }
}
// ============================================================
// 7. LOCAL STORAGE AND HISTORY
// ============================================================

function getInterviewHistory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) return [];

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed) ? parsed : [];

  } catch (error) {
    console.warn("Error reading interview history:", error);
    return [];
  }
}

function saveInterviewHistory(sessionEntry) {
  const history = getInterviewHistory();

  history.unshift(sessionEntry);

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(history)
    );
  } catch (error) {
    console.error("Could not save interview history:", error);
    alert("The report was generated, but browser storage could not save it.");
  }

  state.history = history;

  updateDashboardAnalytics();
  displayInterviewHistory();
}

function renderEmptyDashboardChart() {
  if (dom.chartPathArea) {
    dom.chartPathArea.setAttribute("points", "50,150 450,150");
  }

  if (dom.chartPathLine) {
    dom.chartPathLine.setAttribute("points", "50,150 450,150");
  }

  if (dom.chartDotsGroup) {
    dom.chartDotsGroup.innerHTML = "";
  }

  if (dom.dashboardChartLabels) {
    dom.dashboardChartLabels.innerHTML = `
      <div style="width:100%;text-align:center;font-size:.85rem;color:var(--text-muted);padding:6px">
        Practice an interview to visualize your score trajectory.
      </div>
    `;
  }
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
      `<span style="font-size:.85rem;color:var(--text-muted)">
        Complete an interview session to start tracking your score trend.
      </span>`
    );

    setHTML(
      dom.recentSessionsTbody,
      `<tr>
        <td colspan="6" style="text-align:center;padding:32px;color:var(--text-muted)">
          No saved interviews yet. Click "Start New Interview" to begin!
        </td>
      </tr>`
    );

    renderEmptyDashboardChart();
    return;
  }

  const scores = history
    .map(session => Number(session.overallScore))
    .filter(Number.isFinite);

  const average = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
    : null;

  const latestSession = history[0];
  const latestScore = Number(latestSession.overallScore);

  setText(dom.statCompleted, String(history.length));

  setText(
    dom.statAvgScore,
    average === null ? "--" : `${average} / 100`
  );

  setText(
    dom.statLatestScore,
    Number.isFinite(latestScore) ? `${latestScore} / 100` : "--"
  );

  setText(
    dom.statLatestSubtext,
    `Grade: ${latestSession.overallGrade || "Not available"}`
  );

  let improvement = "--";

  if (history.length >= 2) {
    const previousScore = Number(history[1].overallScore);

    if (Number.isFinite(previousScore) && Number.isFinite(latestScore)) {
      const difference = latestScore - previousScore;

      improvement = difference >= 0
        ? `+${difference}%`
        : `${difference}%`;
    }
  }

  setText(dom.statImprovement, improvement);

  renderDashboardTrendChart(history);
  renderDashboardProgressSequence(history);
  renderRecentDashboardTable(history.slice(0, 4));
}

function renderDashboardTrendChart(history) {
  const sessions = [...history].reverse().slice(-5);

  if (!sessions.length) {
    renderEmptyDashboardChart();
    return;
  }

  const width = 500;
  const height = 170;
  const paddingX = 50;
  const paddingY = 30;
  const chartHeight = 110;

  const count = sessions.length;

  const step = count > 1
    ? (width - paddingX * 2) / (count - 1)
    : 0;

  const points = sessions.map((session, index) => {
    const score = Math.max(
      0,
      Math.min(100, Number(session.overallScore) || 0)
    );

    const x = count === 1
      ? width / 2
      : paddingX + index * step;

    const y = paddingY + chartHeight - (score / 100) * chartHeight;

    return {
      x,
      y,
      score,
      session,
      index: index + 1
    };
  });

  const linePoints = points
    .map(point => `${point.x},${point.y}`)
    .join(" ");

  const areaPoints =
    `${points[0].x},${height - 10} ` +
    `${linePoints} ` +
    `${points[points.length - 1].x},${height - 10}`;

  dom.chartPathLine?.setAttribute("points", linePoints);
  dom.chartPathArea?.setAttribute("points", areaPoints);

  if (dom.chartDotsGroup) {
    dom.chartDotsGroup.innerHTML = points.map(point => `
      <circle cx="${point.x}" cy="${point.y}" r="5" class="chart-dot">
        <title>Interview ${point.index}: ${point.score} / 100</title>
      </circle>
    `).join("");
  }

  if (dom.dashboardChartLabels) {
    dom.dashboardChartLabels.innerHTML = points.map((point, index) => `
      <div class="chart-label-item">
        <div class="chart-label-session">Session ${index + 1}</div>
        <div class="chart-label-pct">
          ${point.score}
        </div>
      </div>
    `).join("");
  }
}

function renderDashboardProgressSequence(history) {
  if (!dom.progressSequence) return;

  dom.progressSequence.innerHTML = "";

  const sessions = [...history].reverse().slice(-5);

  sessions.forEach((item, index) => {
    const isCurrent = index === sessions.length - 1;

    const span = document.createElement("span");

    span.className = `seq-item ${isCurrent ? "current" : ""}`;
    span.textContent = String(item.overallScore ?? "--");
    span.title = `Grade: ${item.overallGrade || "Not available"}`;

    dom.progressSequence.appendChild(span);

    if (index < sessions.length - 1) {
      const arrow = document.createElement("span");

      arrow.className = "seq-arrow";
      arrow.textContent = "→";

      dom.progressSequence.appendChild(arrow);
    }
  });
}

function createSessionTableRow(item) {
  const tr = document.createElement("tr");

  const grade = item.overallGrade || "Not available";
  const gradeClass = grade.toLowerCase();

  tr.innerHTML = `
    <td><strong>${escapeHTML(item.date || "")}</strong></td>

    <td>
      <span class="badge-pill ${
        item.type?.includes("HR")
          ? "badge-hr"
          : "badge-behavioral"
      }">
        ${escapeHTML(item.type || "Interview")}
      </span>
    </td>

    <td>
      ${Number(item.questionsCount) || 0}
      Questions
    </td>

    <td>
      <strong style="color:var(--primary)">
        ${escapeHTML(item.overallScore ?? "--")} / 100
      </strong>
    </td>

    <td>
      <span class="badge-pill badge-${escapeHTML(gradeClass)}">
        ${escapeHTML(grade)}
      </span>
    </td>

    <td>
      <button class="btn btn-outline btn-sm">
        View Report →
      </button>
    </td>
  `;

  tr.querySelector("button")?.addEventListener("click", () => {
    window.viewSavedSession(item.id);
  });

  return tr;
}

function renderRecentDashboardTable(items) {
  if (!dom.recentSessionsTbody) return;

  dom.recentSessionsTbody.innerHTML = "";

  items.forEach(item => {
    dom.recentSessionsTbody.appendChild(
      createSessionTableRow(item)
    );
  });
}

// ============================================================
// 8. HISTORY VIEW
// ============================================================

function displayInterviewHistory() {
  const history = getInterviewHistory();

  if (!dom.historyTbody) return;

  dom.historyTbody.innerHTML = "";

  if (!history.length) {
    dom.historyTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">
          No interview history found. Practice an interview to generate your first AI report!
        </td>
      </tr>
    `;

    return;
  }

  history.forEach(item => {
    dom.historyTbody.appendChild(
      createSessionTableRow(item)
    );
  });
}

window.viewSavedSession = function(sessionId) {
  const history = getInterviewHistory();

  const session = history.find(
    item => item.id === sessionId
  );

  if (!session) return;

  if (!session.questionResults?.length) {
    alert("This saved history entry does not contain detailed question results.");
    return;
  }

  renderResultsDashboard(session);
  switchView("results");
};

// ============================================================
// 9. LIVE MULTIPLE-FACE DETECTION
// ============================================================

let faceDetector = null;
let faceDetectorInitPromise = null;

let faceMonitoringActive = false;
let faceMonitorRaf = null;
let faceMonitorGeneration = 0;

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
    color: "#ffffff",
    padding: "14px 22px",
    borderRadius: "10px",
    fontWeight: "600",
    textAlign: "center",
    maxWidth: "90%",
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

    faceDetectionUnavailableElement.setAttribute("role", "status");

    Object.assign(faceDetectionUnavailableElement.style, {
      display: "block",
      position: "fixed",
      bottom: "18px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "99998",
      background: "#92400e",
      color: "#ffffff",
      padding: "12px 18px",
      borderRadius: "8px",
      fontWeight: "600",
      maxWidth: "90%",
      textAlign: "center"
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
        minDetectionConfidence: 0.5
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

  const generation = ++faceMonitorGeneration;

  try {
    console.log("Initializing MediaPipe face detector...");

    await initializeFaceDetector();

    // Do not restart monitoring after the camera has been stopped.
    if (
      generation !== faceMonitorGeneration ||
      !state.mediaStream
    ) {
      return;
    }

    faceMonitoringActive = true;

    multipleFaceStreak = 0;
    lastFaceCheck = 0;
    lastFaceVideoTime = -1;

    hide(faceDetectionUnavailableElement);

    console.log("Live face detection started.");

    checkFacesInCamera();

  } catch (error) {
    if (generation !== faceMonitorGeneration) return;

    console.error("Face detection initialization failed:", error);

    showFaceDetectionUnavailable(
      "⚠️ Face detection unavailable. Check your internet connection."
    );
  }
}

function checkFacesInCamera() {
  if (!faceMonitoringActive || !state.mediaStream) return;

  const video = dom.webcamPreview;
  const now = performance.now();

  if (
    video &&
    video.readyState >= 2 &&
    video.videoWidth > 0 &&
    video.currentTime !== lastFaceVideoTime &&
    now - lastFaceCheck >= 300
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
      console.error("Face detection frame error:", error);
    }
  }

  faceMonitorRaf = requestAnimationFrame(checkFacesInCamera);
}

function stopFaceMonitoring() {
  faceMonitoringActive = false;
  faceMonitorGeneration++;
  multipleFaceStreak = 0;

  if (faceMonitorRaf) {
    cancelAnimationFrame(faceMonitorRaf);
    faceMonitorRaf = null;
  }

  hideMultipleFaceWarning();
  hide(faceDetectionUnavailableElement);
}
// ============================================================
// 10. LIVE MICROPHONE SILENCE DETECTION
// ============================================================

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

// ============================================================
// 11. WEBCAM AND MEDIA CONTROLS
// ============================================================

async function initWebcam() {
  try {
    hide(dom.cameraErrorAlert);

    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      throw new Error(
        "getUserMedia is not supported by your browser environment."
      );
    }

    // Stop any previous camera stream before opening a new one.
    if (state.mediaStream) {
      stopWebcam();
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    state.mediaStream = stream;

    state.cameraGranted = stream.getVideoTracks().length > 0;
    state.audioGranted = stream.getAudioTracks().length > 0;

    if (!state.cameraGranted || !state.audioGranted) {
      stream.getTracks().forEach(track => track.stop());

      state.mediaStream = null;

      throw new Error(
        "Both camera and microphone access are required."
      );
    }

    if (dom.webcamPreview) {
      dom.webcamPreview.srcObject = stream;
      dom.webcamPreview.style.display = "block";

      await dom.webcamPreview.play().catch(error => {
        console.warn("Camera preview playback issue:", error);
      });
    }

    hide(dom.previewVideo);

    setText(dom.cameraStatusText, "Camera Ready");

    setText(
      dom.stageStatusText,
      "Camera and microphone ready. Click Start Answer when ready."
    );

    if (dom.btnStartAnswer && !state.recordedAnswers[state.currentQuestionIndex]) {
      dom.btnStartAnswer.disabled = false;
    }

    // Start audio-level monitoring.
    setupAudioVisualizer(stream);

    // IMPORTANT: Start MediaPipe face monitoring.
    startFaceMonitoring();

    console.log("Camera and microphone are ready.");

    return stream;

  } catch (error) {
    console.warn("Camera or microphone access error:", error);

    stopFaceMonitoring();
    stopAudioVisualizer();

    state.cameraGranted = false;
    state.audioGranted = false;
    state.mediaStream = null;

    hide(dom.webcamPreview);

    setText(dom.cameraStatusText, "Camera Blocked");

    setText(
      dom.stageStatusText,
      "Camera access denied. Please allow permissions in browser settings."
    );

    if (dom.btnStartAnswer) {
      dom.btnStartAnswer.disabled = true;
    }

    show(dom.cameraErrorAlert, "flex");

    if (dom.cameraErrorText) {
      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        dom.cameraErrorText.textContent =
          "Camera or microphone permission was denied. Please allow access in your browser site settings and retry.";

      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        dom.cameraErrorText.textContent =
          "No camera or microphone hardware was found.";

      } else {
        dom.cameraErrorText.textContent =
          error.message ||
          "Unable to access camera or microphone.";
      }
    }

    return null;
  }
}

function stopWebcam() {
  // Stop MediaPipe monitoring first.
  stopFaceMonitoring();

  // Stop camera and microphone tracks.
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(track => {
      track.stop();
    });

    state.mediaStream = null;
  }

  state.cameraGranted = false;
  state.audioGranted = false;

  if (dom.webcamPreview) {
    dom.webcamPreview.srcObject = null;
  }

  stopAudioVisualizer();
}

// ============================================================
// 12. AUDIO VISUALIZER AND SILENCE MONITOR
// ============================================================

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

    // A larger buffer is needed for time-domain silence measurement.
    state.audioAnalyser.fftSize = 512;

    source.connect(state.audioAnalyser);

    const frequencyData = new Uint8Array(
      state.audioAnalyser.frequencyBinCount
    );

    const timeData = new Uint8Array(
      state.audioAnalyser.fftSize
    );

    const bars = document.querySelectorAll(".sound-bar");

    const animateSound = () => {
      if (!state.audioAnalyser) return;

      // Existing audio visualizer.
      state.audioAnalyser.getByteFrequencyData(frequencyData);

      let sum = 0;

      for (let i = 0; i < frequencyData.length; i++) {
        sum += frequencyData[i];
      }

      const average =
        frequencyData.length > 0
          ? sum / frequencyData.length
          : 0;

      bars.forEach((bar, index) => {
        const value = frequencyData[index] || average;

        const height = Math.max(
          4,
          Math.min(22, (value / 255) * 24)
        );

        bar.style.height = `${height}px`;

        bar.style.background =
          height > 10 ? "var(--primary)" : "#cbd5e1";
      });

      // New live silence detection.
      checkMicrophoneSilence(
        state.audioAnalyser,
        timeData
      );

      state.audioAnimId =
        requestAnimationFrame(animateSound);
    };

    state.audioContext.resume().catch(error => {
      console.warn("AudioContext could not resume:", error);
    });

    animateSound();

  } catch (error) {
    console.warn(
      "Audio visualizer could not attach:",
      error
    );
  }
}

function stopAudioVisualizer() {
  if (state.audioAnimId) {
    cancelAnimationFrame(state.audioAnimId);
    state.audioAnimId = null;
  }

  if (
    state.audioContext &&
    state.audioContext.state !== "closed"
  ) {
    state.audioContext.close().catch(() => {});
  }

  state.audioContext = null;
  state.audioAnalyser = null;

  silenceStartedAt = null;
  hideNoVoiceWarning();

  document.querySelectorAll(".sound-bar").forEach(bar => {
    bar.style.height = "6px";
    bar.style.background = "#cbd5e1";
  });
}

// ============================================================
// 13. RECORDING ENGINE
// ============================================================

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
      "Your browser does not support MediaRecorder. Use a recent version of Chrome or Edge."
    );

    return;
  }

  state.recordedChunks = [];
  state.secondsElapsed = 0;
  state.currentRecordedBlob = null;

  silenceStartedAt = null;
  hideNoVoiceWarning();

  updateTimerDisplay(0);

  if (dom.webcamPreview) {
    dom.webcamPreview.style.display = "block";
  }

  if (dom.previewVideo) {
    dom.previewVideo.pause();
    dom.previewVideo.removeAttribute("src");
    dom.previewVideo.load();

    hide(dom.previewVideo);
  }

  const mimeTypes = [
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4"
  ];

  const selectedMime = mimeTypes.find(type =>
    MediaRecorder.isTypeSupported(type)
  ) || "";

  try {
    state.mediaRecorder = new MediaRecorder(
      state.mediaStream,
      selectedMime ? { mimeType: selectedMime } : {}
    );

    state.recordingMimeType =
      state.mediaRecorder.mimeType ||
      selectedMime ||
      "video/webm";

    state.mediaRecorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        state.recordedChunks.push(event.data);
      }
    };

    state.mediaRecorder.onerror = event => {
      console.error("MediaRecorder error:", event.error || event);

      alert("A recording error occurred. Please retake this answer.");
    };

    state.mediaRecorder.onstop = () => {
      onRecordingStopped();
    };

    state.mediaRecorder.start(200);

  } catch (error) {
    console.error("MediaRecorder creation error:", error);

    state.mediaRecorder = null;

    alert(`Could not start recording: ${error.message}`);

    return;
  }

  // Set this only after the recorder successfully starts.
  state.isRecording = true;
  state.isSavingRecording = false;

  if (state.audioContext?.state === "suspended") {
    state.audioContext.resume().catch(console.warn);
  }

  dom.videoFrame?.classList.add("recording-live");

  setText(dom.cameraStatusText, "Recording Live");

  show(dom.liveObservingNotice);

  if (dom.btnStartAnswer) dom.btnStartAnswer.disabled = true;
  if (dom.btnStopAnswer) dom.btnStopAnswer.disabled = false;
  if (dom.btnRetakeAnswer) dom.btnRetakeAnswer.disabled = true;
  if (dom.btnNextQuestion) dom.btnNextQuestion.disabled = true;

  setText(
    dom.recStateMsg,
    "Recording in progress... Speak clearly into your microphone."
  );

  setText(
    dom.stageStatusText,
    "Recording candidate answer. Click Stop when finished."
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

  if (dom.btnStopAnswer) dom.btnStopAnswer.disabled = true;
  if (dom.btnNextQuestion) dom.btnNextQuestion.disabled = true;
  if (dom.btnRetakeAnswer) dom.btnRetakeAnswer.disabled = true;

  setText(
    dom.recStateMsg,
    "Saving your recording. Please wait…"
  );

  try {
    if (state.mediaRecorder.state !== "inactive") {
      state.mediaRecorder.stop();
    } else {
      onRecordingStopped();
    }

  } catch (error) {
    console.error("Could not stop recording:", error);

    state.isSavingRecording = false;

    alert("Could not save this recording. Please retake your answer.");
  }
}

function onRecordingStopped() {
  console.log("Recording stopped.");

  state.isSavingRecording = false;
  state.isRecording = false;

  const chunks = state.recordedChunks || [];

  const blobType =
    state.recordingMimeType ||
    chunks[0]?.type ||
    "video/webm";

  const blob = new Blob(chunks, {
    type: blobType
  });

  state.mediaRecorder = null;

  if (!blob.size) {
    console.error("No video data was recorded.");

    state.currentRecordedBlob = null;

    delete state.recordedAnswers[state.currentQuestionIndex];

    setText(
      dom.recStateMsg,
      "Recording failed. Please record your answer again."
    );

    setText(dom.cameraStatusText, "Recording Failed");

    if (dom.btnStartAnswer) {
      dom.btnStartAnswer.disabled = !state.mediaStream;
    }

    if (dom.btnStopAnswer) dom.btnStopAnswer.disabled = true;
    if (dom.btnRetakeAnswer) dom.btnRetakeAnswer.disabled = true;
    if (dom.btnNextQuestion) dom.btnNextQuestion.disabled = true;

    return;
  }

  if (state.currentRecordedUrl) {
    URL.revokeObjectURL(state.currentRecordedUrl);
  }

  state.currentRecordedBlob = blob;

  const videoUrl = URL.createObjectURL(blob);

  state.currentRecordedUrl = videoUrl;

  if (dom.webcamPreview) {
    hide(dom.webcamPreview);
  }

  if (dom.previewVideo) {
    dom.previewVideo.style.display = "block";
    dom.previewVideo.src = videoUrl;
    dom.previewVideo.load();
  }

  const question =
    state.questions[state.currentQuestionIndex];

  state.recordedAnswers[state.currentQuestionIndex] = {
    questionIndex: state.currentQuestionIndex,

    questionText: question
      ? question.q
      : `Question ${state.currentQuestionIndex + 1}`,

    blob,
    mimeType: blob.type,

    filename: blob.type.includes("mp4")
      ? "interview.mp4"
      : "interview.webm",

    duration: state.secondsElapsed
  };

  console.log(
    `Question ${state.currentQuestionIndex + 1} recording saved successfully.`
  );

  setText(dom.cameraStatusText, "Answer Recorded");

  setText(
    dom.recStateMsg,
    "Answer recorded! Preview it or continue to the next question."
  );

  setText(
    dom.stageStatusText,
    "Answer saved. Review the preview or proceed."
  );

  if (dom.btnStartAnswer) dom.btnStartAnswer.disabled = true;
  if (dom.btnStopAnswer) dom.btnStopAnswer.disabled = true;
  if (dom.btnRetakeAnswer) dom.btnRetakeAnswer.disabled = false;
  if (dom.btnNextQuestion) dom.btnNextQuestion.disabled = false;
}

function retakeCurrentAnswer() {
  if (state.isRecording || state.isSavingRecording) {
    alert("Stop and save the current recording before retaking it.");
    return;
  }

  if (state.currentRecordedUrl) {
    URL.revokeObjectURL(state.currentRecordedUrl);
    state.currentRecordedUrl = null;
  }

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
  hideNoVoiceWarning();

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
      ? "Live camera preview active. Click Start Answer when ready."
      : "Enable camera and microphone to continue."
  );
}

function updateTimerDisplay(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  setText(
    dom.timerDisplay,
    `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
  );
}

// ============================================================
// 14. INTERVIEW SETUP AND FLOW
// ============================================================

async function beginInterviewSession() {
  const pool =
    QUESTION_BANKS[state.selectedType] || QUESTION_BANKS.hr;

  const count = Math.min(
    state.selectedCount,
    pool.length
  );

  state.questions = pool.slice(0, count);

  state.currentQuestionIndex = 0;
  state.recordedAnswers = [];

  state.currentRecordedBlob = null;

  if (state.currentRecordedUrl) {
    URL.revokeObjectURL(state.currentRecordedUrl);
    state.currentRecordedUrl = null;
  }

  const typeName = state.selectedType === "hr"
    ? "HR Interview"
    : "Behavioral Interview";

  const difficultyName = capitalize(
    state.selectedDifficulty
  );

  setText(
    dom.topSessionPill,
    `${typeName} · ${difficultyName}`
  );

  switchView("interview");

  const stream = await initWebcam();

  loadQuestion(0);

  if (!stream) {
    setText(
      dom.recStateMsg,
      "Enable your camera and microphone before recording."
    );
  }
}

function loadQuestion(index) {
  state.currentQuestionIndex = index;

  const total = state.questions.length;
  const item = state.questions[index];

  if (!item) return;

  setText(
    dom.topQuestionNum,
    `Question ${index + 1} of ${total}`
  );

  const percentage = (index + 1) / total * 100;

  if (dom.topProgressBar) {
    dom.topProgressBar.style.width = `${percentage}%`;
  }

  setText(
    dom.activeQuestionHeading,
    `"${item.q}"`
  );

  setText(dom.activeQuestionTip, item.tip);

  if (dom.btnNextQuestion) {
    dom.btnNextQuestion.textContent =
      index === total - 1
        ? "Finish Interview →"
        : "Next Question →";
  }

  retakeCurrentAnswer();
}

function handleNextQuestion() {
  // Stop first, then wait for the user to click again once saved.
  if (state.isRecording) {
    stopRecordingAnswer();
    return;
  }

  if (state.isSavingRecording) {
    return;
  }

  const answer =
    state.recordedAnswers[state.currentQuestionIndex];

  if (!answer?.blob?.size) {
    alert("Please record and save your answer before continuing.");
    return;
  }

  const nextIndex = state.currentQuestionIndex + 1;

  if (nextIndex < state.questions.length) {
    loadQuestion(nextIndex);

  } else {
    stopWebcam();
    switchView("completion");
  }
}

// ============================================================
// 15. REAL BACKEND ANALYSIS
// ============================================================

async function triggerAIAnalysis() {
  // Require a real recording for every selected question.
  const answersToAnalyze = state.questions.map(
    (question, index) => state.recordedAnswers[index]
  );

  const missingAnswers = answersToAnalyze.some(
    answer => !answer?.blob || answer.blob.size === 0
  );

  if (
    !state.questions.length ||
    missingAnswers
  ) {
    alert(
      "One or more answers are missing. Please return to the interview and record every answer."
    );

    switchView("interview");
    return;
  }

  switchView("loading");

  show(dom.loadingErrorBox, "none");

  resetLoadingSteps();

  const totalQuestions = answersToAnalyze.length;
  const interviewResults = [];

  try {
    for (let index = 0; index < totalQuestions; index++) {
      const answer = answersToAnalyze[index];

      setText(
        dom.loadQuestionProgress,
        `Analyzing Answer ${index + 1} of ${totalQuestions}: "${answer.questionText}"...`
      );

      animateLoadingStep(1);

      const backendResult = await analyzeInterviewWithBackend(
        answer.blob,
        answer.questionText
      );

      validateBackendResult(backendResult);

      animateLoadingStep(2);

      interviewResults.push({
        questionIndex: answer.questionIndex,
        question: answer.questionText,
        result: backendResult
      });

      animateLoadingStep(3);
    }

    onAllQuestionsAnalyzed(interviewResults);

  } catch (error) {
    console.error("Backend interview analysis error:", error);

    showLoadingError(error);
  }
}

function validateBackendResult(result) {
  if (!result || typeof result !== "object") {
    throw new Error("The backend returned an invalid response.");
  }

  const expectedKeys = [
    "video",
    "audio",
    "text",
    "fluency",
    "transcript",
    "final"
  ];

  const found = expectedKeys.some(
    key => Object.prototype.hasOwnProperty.call(result, key)
  );

  if (!found) {
    throw new Error(
      "The backend response did not contain the expected analysis fields."
    );
  }
}

function resetLoadingSteps() {
  for (let index = 1; index <= 6; index++) {
    const element = $(`load-step-${index}`);

    if (element) {
      element.className = index === 1
        ? "load-step-item active"
        : "load-step-item";
    }
  }
}

function animateLoadingStep(stepNumber) {
  for (let index = 1; index <= 6; index++) {
    const element = $(`load-step-${index}`);

    if (!element) continue;

    if (index < stepNumber) {
      element.className = "load-step-item done";

    } else if (index === stepNumber) {
      element.className = "load-step-item active";

    } else {
      element.className = "load-step-item";
    }
  }
}

function showLoadingError(error) {
  show(dom.loadingErrorBox);

  const isServerError =
    error.status >= 500 && error.status <= 599;

  setText(
    dom.loadingErrorTitle,
    isServerError
      ? "⚠️ AI Analysis / Video Processing Error"
      : "⚠️ Unable to complete analysis"
  );

  setText(
    dom.loadingErrorSubtext,
    isServerError
      ? "The backend received your recording but could not complete analysis. Check the backend terminal for details."
      : "Check that the Flask backend is running at localhost:5000 and try again."
  );

  setText(
    dom.loadingErrorDetails,
    error.serverDetails ||
    error.message ||
    "Unknown backend error."
  );

  setText(
    dom.loadQuestionProgress,
    "Analysis stopped. No report has been saved."
  );
}

// ============================================================
// 16. AGGREGATE RESULTS AND SAVE SESSION
// ============================================================

function onAllQuestionsAnalyzed(interviewResults) {
  if (!interviewResults.length) {
    throw new Error("No question analysis results were returned.");
  }

  const scores = interviewResults.map(item => {
    const value =
      item.result?.final?.score ??
      item.result?.score;

    return Number(value);
  });

  if (scores.some(score => !Number.isFinite(score))) {
    throw new Error(
      "The backend did not return a valid final score for every question. No overall score was generated."
    );
  }

  const averageScore =
    scores.reduce((sum, score) => sum + score, 0) /
    scores.length;

  const aggregateScore = Math.round(averageScore);

  const firstGrade =
    interviewResults[0]?.result?.final?.grade;

  const aggregateGrade = firstGrade || (
    aggregateScore >= 70
      ? "Good"
      : aggregateScore >= 40
        ? "Average"
        : "Poor"
  );

  const formattedDate = new Date().toLocaleDateString(
    "en-US",
    {
      month: "long",
      day: "numeric",
      year: "numeric"
    }
  );

  const sessionRecord = {
    id: `session_${Date.now()}`,
    date: formattedDate,

    type: state.selectedType === "hr"
      ? "HR Interview"
      : "Behavioral Interview",

    difficulty: state.selectedDifficulty,
    questionsCount: interviewResults.length,

    overallScore: aggregateScore,
    overallGrade: aggregateGrade,

    questionResults: interviewResults,
    primaryResult: interviewResults[0].result
  };

  state.currentActiveSession = sessionRecord;

  saveInterviewHistory(sessionRecord);

  renderResultsDashboard(sessionRecord);

  switchView("results");
}
// ============================================================
// 17. RESULTS DASHBOARD
// ============================================================

function renderResultsDashboard(session) {
  state.currentActiveSession = session;
  state.activeQuestionTabIdx = 0;

  const results = session.questionResults || [];

  const primaryResult =
    session.primaryResult ||
    results[0]?.result;

  if (!primaryResult) {
    alert("No analysis results are available for this session.");
    return;
  }

  const score = Number(
    session.overallScore ?? primaryResult.final?.score
  );

  const grade =
    session.overallGrade ||
    primaryResult.final?.grade ||
    "Not available";

  setText(
    dom.overallScoreNumber,
    Number.isFinite(score)
      ? String(Math.round(score))
      : "--"
  );

  setText(dom.overallGradeText, grade);

  setText(
    dom.overallGradeBadge,
    `Final Grade: ${grade}`
  );

  if (dom.overallGradeBadge) {
    const safeGrade = String(grade)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "");

    dom.overallGradeBadge.className =
      `badge-pill badge-${safeGrade}`;
  }

  setText(
    dom.overallDescText,
    "Weighted composite score returned by the interview analysis backend."
  );

  const circumference = 440;

  if (dom.circleProgressBar && Number.isFinite(score)) {
    const boundedScore = Math.max(
      0,
      Math.min(100, score)
    );

    const offset =
      circumference -
      (circumference * boundedScore) / 100;

    setTimeout(() => {
      dom.circleProgressBar.style.strokeDashoffset = offset;
    }, 100);
  }

  renderQuestionTabs(results);
  displayQuestionResult(0);
}

function renderQuestionTabs(questionResults) {
  if (!dom.questionTabsNav) return;

  dom.questionTabsNav.innerHTML = "";

  setText(
    dom.qBreakdownCount,
    `${questionResults.length} Question${questionResults.length === 1 ? "" : "s"} Analyzed`
  );

  if (questionResults.length <= 1) {
    dom.questionTabsNav.style.display = "none";

  } else {
    dom.questionTabsNav.style.display = "flex";

    questionResults.forEach((item, index) => {
      const button = document.createElement("button");

      button.className =
        `q-tab-btn ${index === state.activeQuestionTabIdx ? "active" : ""}`;

      button.textContent = `Question ${index + 1}`;

      button.addEventListener("click", () => {
        state.activeQuestionTabIdx = index;

        document.querySelectorAll(".q-tab-btn").forEach((tab, tabIndex) => {
          tab.classList.toggle("active", tabIndex === index);
        });

        displayQuestionResult(index);
      });

      dom.questionTabsNav.appendChild(button);
    });
  }

  renderQuestionCardsList(questionResults);
}

function displayQuestionResult(questionIndex) {
  const session = state.currentActiveSession;

  if (!session || !session.questionResults) return;

  const item =
    session.questionResults[questionIndex] ||
    session.questionResults[0];

  if (!item) return;

  const result = item.result || {};

  renderVideoEmotionSection(result.video || {});
  renderAudioEmotionSection(result.audio || {});
  renderAnswerQualitySection(result.text || {});
  renderFluencySection(result.fluency || {});

  const transcript =
    result.transcript ||
    item.transcript ||
    "(No speech transcript returned for this question.)";

  setText(dom.transcriptContentText, transcript);
}

// ============================================================
// 18. EMOTION HELPERS
// ============================================================

function getEmotionEmoji(emotion) {
  const value = String(emotion || "").toLowerCase();

  switch (value) {
    case "happy": return "😊";
    case "neutral": return "😐";
    case "sad": return "😢";
    case "angry": return "😠";
    case "fear": return "😨";
    case "disgust": return "🤢";
    default: return "🎭";
  }
}

function setDetectedEmotion(element, emotionElement, emotion) {
  const emojiElement =
    element?.querySelector("span:first-child");

  if (emojiElement) {
    emojiElement.textContent = emotion
      ? getEmotionEmoji(emotion)
      : "—";
  }

  setText(
    emotionElement,
    emotion ? capitalize(emotion) : "Not available"
  );
}

// ============================================================
// 19. VIDEO EMOTION RESULTS
// ============================================================

function renderVideoEmotionSection(video) {
  const emotion = video.emotion;

  const score = Number(video.score);

  setText(
    dom.videoScoreBadge,
    Number.isFinite(score)
      ? `Score: ${Math.round(score)} / 100`
      : "Score: N/A"
  );

  setDetectedEmotion(
    dom.videoDetectedEmotion,
    dom.videoDetectedText,
    emotion
  );

  const stats = [];

  if (video.frames != null) {
    stats.push(`Frames: ${video.frames}`);
  }

  if (video.sampled_frames != null) {
    stats.push(`Sampled: ${video.sampled_frames}`);
  }

  if (video.face_frames != null) {
    stats.push(`Face-positive frames: ${video.face_frames}`);
  }

  setText(
    dom.videoFrameStats,
    stats.length
      ? stats.join(" · ")
      : "Frame statistics not returned."
  );

  renderProbabilityBars(
    dom.videoProbBars,
    video.probabilities,
    ["Angry", "Disgust", "Fear", "Happy", "Neutral", "Sad"]
  );
}

// ============================================================
// 20. AUDIO EMOTION RESULTS
// ============================================================

function renderAudioEmotionSection(audio) {
  const emotion = audio.emotion;

  const score = Number(audio.score);

  setText(
    dom.audioScoreBadge,
    Number.isFinite(score)
      ? `Score: ${Math.round(score)} / 100`
      : "Score: N/A"
  );

  setDetectedEmotion(
    dom.audioDetectedEmotion,
    dom.audioDetectedText,
    emotion
  );

  const confidence = Number(audio.confidence);

  const confidenceAvailable =
    audio.confidence !== null &&
    audio.confidence !== undefined &&
    Number.isFinite(confidence);

  let confidenceText = "Confidence: N/A";

  if (confidenceAvailable) {
    const percentage = confidence <= 1
      ? Math.round(confidence * 100)
      : Math.round(confidence);

    confidenceText = `Confidence: ${percentage}%`;
  }

  setText(
    dom.audioConfidenceBadge,
    confidenceText
  );

  renderProbabilityBars(
    dom.audioProbBars,
    audio.probabilities,
    ["Angry", "Disgust", "Fear", "Happy", "Neutral", "Sad"]
  );
}

// ============================================================
// 21. ANSWER QUALITY RESULTS
// ============================================================

function renderAnswerQualitySection(textResult) {
  const label = textResult.label;

  const score = Number(textResult.score);

  setText(
    dom.textScoreBadge,
    Number.isFinite(score)
      ? `Score: ${Math.round(score)} / 100`
      : "Score: N/A"
  );

  setText(
    dom.textQualityText,
    label ? capitalize(label) : "Not available"
  );

  const emojiElement =
    dom.textQualityLabel?.querySelector("span:first-child");

  if (emojiElement) {
    const labelValue = String(label || "").toLowerCase();

    const emojiMap = {
      good: "⭐",
      average: "⚖️",
      poor: "⚠️"
    };

    emojiElement.textContent =
      emojiMap[labelValue] || "—";
  }

  renderProbabilityBars(
    dom.textProbBars,
    textResult.probabilities,
    ["Poor", "Average", "Good"]
  );
}

// ============================================================
// 22. FLUENCY RESULTS
// ============================================================

function renderFluencySection(fluency) {
  let score = null;
  let fillerCount = null;
  let fillerWords = [];
  let pace = null;
  let fluencyLabel = null;

  if (typeof fluency === "number") {
    score = fluency;

  } else if (
    fluency &&
    typeof fluency === "object"
  ) {
    score =
      fluency.score ??
      fluency.fluency_score ??
      fluency.rating ??
      null;

    fluencyLabel =
      fluency.label ||
      fluency.grade ||
      fluency.status ||
      null;

    if (fluency.filler_count != null) {
      fillerCount = Number(fluency.filler_count);

    } else if (fluency.fillers_count != null) {
      fillerCount = Number(fluency.fillers_count);

    } else if (fluency.count != null) {
      fillerCount = Number(fluency.count);
    }

    if (Array.isArray(fluency.filler_words)) {
      fillerWords = fluency.filler_words;

    } else if (Array.isArray(fluency.fillers)) {
      fillerWords = fluency.fillers;

    } else if (
      fluency.fillers &&
      typeof fluency.fillers === "object"
    ) {
      fillerWords = Object.entries(fluency.fillers).map(
        ([word, count]) => `${word} (${count})`
      );

    } else if (
      fluency.filler_words &&
      typeof fluency.filler_words === "object"
    ) {
      fillerWords = Object.entries(fluency.filler_words).map(
        ([word, count]) => `${word} (${count})`
      );
    }

    pace =
      fluency.pace ??
      fluency.words_per_minute ??
      fluency.speaking_rate ??
      null;

    if (fillerCount === null && Array.isArray(fluency.fillers)) {
      fillerCount = fluency.fillers.length;
    }
  }

  setText(
    dom.fluencyScoreVal,
    score == null ? "N/A" : String(score)
  );

  setText(
    dom.fluencyFillerCount,
    fillerCount == null || !Number.isFinite(fillerCount)
      ? "N/A"
      : String(fillerCount)
  );

  setText(
    dom.fluencyPaceVal,
    pace == null ? "N/A" : String(pace)
  );

  setText(
    dom.fluencyStatusBadge,
    fluencyLabel || (
      score == null && fillerCount == null
        ? "Not available"
        : "Analysis returned"
    )
  );

  if (dom.fluencyFillersContainer) {
    dom.fluencyFillersContainer.innerHTML = "";

    if (fillerWords.length > 0) {
      fillerWords.forEach(word => {
        const chip = document.createElement("span");

        chip.className = "filler-chip";
        chip.textContent = `⚠️ ${word}`;

        dom.fluencyFillersContainer.appendChild(chip);
      });

    } else if (fillerCount === 0) {
      dom.fluencyFillersContainer.innerHTML = `
        <span style="font-size:.85rem;color:var(--success);font-weight:600">
          ✓ No filler words were returned by the analysis.
        </span>
      `;

    } else if (fillerCount > 0) {
      setText(
        dom.fluencyFillersContainer,
        `${fillerCount} filler word(s) reported.`
      );

    } else {
      setText(
        dom.fluencyFillersContainer,
        "Filler-word details not returned."
      );
    }
  }

  const ignoredKeys = new Set([
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
    "speaking_rate",
    "label",
    "grade",
    "status"
  ]);

  const extraEntries = fluency && typeof fluency === "object"
    ? Object.entries(fluency).filter(([key, value]) =>
        !ignoredKeys.has(key.toLowerCase()) &&
        (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        )
      )
    : [];

  if (dom.fluencyDynamicDetails) {
    dom.fluencyDynamicDetails.innerHTML =
      extraEntries.map(([key, value]) => `
        <div style="display:inline-block;background:var(--bg-subtle);border:1px solid var(--border-color);padding:4px 10px;border-radius:6px;margin:3px 6px 3px 0">
          <strong>${escapeHTML(formatKeyName(key))}:</strong>
          ${escapeHTML(value)}
        </div>
      `).join("");
  }
}

// ============================================================
// 23. PROBABILITY BAR RENDERER
// ============================================================

function renderProbabilityBars(container, probsObject, expectedKeys) {
  if (!container) return;

  container.innerHTML = "";

  if (
    !probsObject ||
    typeof probsObject !== "object"
  ) {
    container.textContent = "Model probability data not returned.";
    return;
  }

  const map = {};

  if (Array.isArray(probsObject)) {
    probsObject.forEach(item => {
      if (!item || typeof item !== "object") return;

      const key =
        item.label ||
        item.emotion ||
        item.name;

      const value =
        item.probability ??
        item.prob ??
        item.score;

      if (key != null && value != null) {
        map[String(key).toLowerCase()] = Number(value);
      }
    });

  } else {
    Object.entries(probsObject).forEach(([key, value]) => {
      map[key.toLowerCase()] = Number(value);
    });
  }

  const available = expectedKeys
    .map(key => ({
      label: key,
      value: map[key.toLowerCase()]
    }))
    .filter(item => Number.isFinite(item.value) && item.value >= 0);

  if (!available.length) {
    container.textContent = "No probability values returned.";
    return;
  }

  // Normalize relative model scores for display.
  // These are relative values, not independent model confidence claims.
  const total = available.reduce(
    (sum, item) => sum + item.value,
    0
  );

  available.forEach(item => {
    let percentage = 0;

    if (total > 0) {
      percentage = Math.round(
        (item.value / total) * 100
      );
    }

    const row = document.createElement("div");

    row.className = "prob-bar-row";

    row.innerHTML = `
      <span class="prob-label">${escapeHTML(item.label)}</span>

      <div class="prob-track">
        <div class="prob-fill" style="width:${percentage}%"></div>
      </div>

      <span class="prob-pct">${percentage}%</span>
    `;

    container.appendChild(row);
  });
}

// ============================================================
// 24. QUESTION-WISE BREAKDOWN
// ============================================================

function renderQuestionCardsList(questionResults) {
  if (!dom.resQuestionWiseList) return;

  dom.resQuestionWiseList.innerHTML = "";

  questionResults.forEach((questionItem, index) => {
    const result = questionItem.result || {};

    const rawScore =
      result.final?.score ??
      result.score;

    const finalScore = Number(rawScore);

    const grade =
      result.final?.grade ||
      (Number.isFinite(finalScore)
        ? finalScore >= 70
          ? "Good"
          : finalScore >= 40
            ? "Average"
            : "Poor"
        : "Not available");

    const videoEmotion =
      result.video?.emotion
        ? capitalize(result.video.emotion)
        : "Not available";

    const audioEmotion =
      result.audio?.emotion
        ? capitalize(result.audio.emotion)
        : "Not available";

    const answerQuality =
      result.text?.label
        ? capitalize(result.text.label)
        : "Not available";

    const transcript =
      result.transcript ||
      "(No transcript returned.)";

    const card = document.createElement("div");

    card.className = "q-card-item";

    card.innerHTML = `
      <div class="q-card-top">
        <div>
          <span class="badge-pill badge-hr">
            Question ${index + 1}
          </span>

          <h4 class="q-card-heading">
            "${escapeHTML(questionItem.question)}"
          </h4>
        </div>

        <div class="q-card-score">
          Score: ${
            Number.isFinite(finalScore)
              ? Math.round(finalScore)
              : "N/A"
          } / 100 (${escapeHTML(grade)})
        </div>
      </div>

      <div class="q-card-metrics-row">
        <div>
          Facial Emotion:
          <strong>${escapeHTML(videoEmotion)}</strong>
        </div>

        <div>
          Voice Emotion:
          <strong>${escapeHTML(audioEmotion)}</strong>
        </div>

        <div>
          Answer Quality:
          <strong>${escapeHTML(answerQuality)}</strong>
        </div>
      </div>

      <div style="font-size:.875rem;color:var(--text-secondary);background:var(--bg-subtle);padding:10px 14px;border-radius:8px;margin-top:8px">
        <strong>Transcript:</strong>
        "${escapeHTML(transcript)}"
      </div>
    `;

    dom.resQuestionWiseList.appendChild(card);
  });
}

// ============================================================
// 25. EVENT LISTENERS
// ============================================================

function setupEventListeners() {
  // Brand logo.
  dom.brandLogo?.addEventListener("click", () => {
    switchView("dashboard");
  });

  // Navigation links.
  dom.navLinks.forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();

      const target = link.getAttribute("data-target");

      if (target === "start") {
        switchView("setup");

      } else if (target === "history") {
        displayInterviewHistory();
        switchView("history");

      } else {
        switchView("dashboard");
      }
    });
  });

  // Profile button.
  dom.navProfileBtn?.addEventListener("click", () => {
    displayInterviewHistory();
    switchView("history");
  });

  // Dashboard buttons.
  dom.btnDashStart?.addEventListener("click", () => {
    switchView("setup");
  });

  dom.btnViewAllHistory?.addEventListener("click", () => {
    displayInterviewHistory();
    switchView("history");
  });

  // Interview type.
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

  // Difficulty.
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

  // Question count.
  dom.countBtns.forEach(button => {
    button.addEventListener("click", () => {
      dom.countBtns.forEach(item => {
        item.classList.remove("selected");
      });

      button.classList.add("selected");

      state.selectedCount =
        parseInt(
          button.getAttribute("data-setup-count"),
          10
        ) || 5;
    });
  });

  // Setup.
  dom.btnBeginInterview?.addEventListener(
    "click",
    beginInterviewSession
  );

  dom.btnSetupBack?.addEventListener("click", () => {
    switchView("dashboard");
  });

  // Camera buttons.
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

  // Recording controls.
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
      clearInterval(state.timerInterval);

      state.isRecording = false;
      state.isSavingRecording = false;

      stopWebcam();

      switchView("dashboard");
    }
  });

  // Analysis.
  dom.btnAnalyzeMyInterview?.addEventListener(
    "click",
    triggerAIAnalysis
  );

  // Retry.
  dom.btnLoadingRetry?.addEventListener(
    "click",
    triggerAIAnalysis
  );

  // Backend health.
  dom.btnLoadingCheckHealth?.addEventListener("click", async () => {
    setText(
      dom.loadQuestionProgress,
      "Checking GET http://localhost:5000/health..."
    );

    const health = await checkBackendHealth();

    if (health.ok) {
      alert(
        "✅ Backend server is online and responding at http://localhost:5000/health.\n\nThis confirms server connectivity, not that every model has successfully loaded."
      );

    } else {
      alert(
        `❌ Backend health check failed:\n${health.error}`
      );
    }
  });

  dom.btnLoadingCancel?.addEventListener("click", () => {
    switchView("completion");
  });

  // Results buttons.
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

  // History.
  dom.btnHistoryStartNew?.addEventListener("click", () => {
    switchView("setup");
  });
}

// ============================================================
// 26. INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();

  updateDashboardAnalytics();
  displayInterviewHistory();

  switchView("dashboard");

  console.log(
    "Smart Interview Analyzer connected to Flask backend at",
    BACKEND_URL
  );

  console.log(
    "MediaPipe face monitoring is ready to initialize when camera is enabled."
  );
});