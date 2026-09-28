/**
 * ==========================================================================
 * SMART INTERVIEW ANALYZER - VANILLA JAVASCRIPT FRONTEND ENGINE
 * Connected to Flask Backend running at http://localhost:5000
 * Endpoints: GET /health | POST /analyze
 * ==========================================================================
 */

// ==========================================================================
// 1. BACKEND API CONFIGURATION & CALLS
// ==========================================================================
const BACKEND_URL = "http://localhost:5000";

/**
 * Uploads question and recorded video Blob to Flask backend
 * POST http://localhost:5000/analyze
 * Content-Type: multipart/form-data (set automatically by browser)
 * @param {Blob} videoBlob - Recorded interview video blob
 * @param {string} question - Interview question text
 * @returns {Promise<Object>} Backend analysis result
 */
async function analyzeInterviewWithBackend(videoBlob, question) {
  if (!videoBlob || videoBlob.size === 0) {
    throw new Error("No valid video recording was provided for analysis.");
  }

  console.log("Uploading video to backend:", {
    size: videoBlob.size,
    type: videoBlob.type
  });

  const formData = new FormData();
  formData.append("question", question);

  // Dynamic extension matching actual MIME type
  const extension = videoBlob.type.includes("webm") ? "webm" : "mp4";
  formData.append("video", videoBlob, `interview.${extension}`);

  let response;
  try {
    response = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      body: formData
      // Do NOT set Content-Type header manually; browser provides multipart/form-data boundary
    });
  } catch (netErr) {
    const err = new Error(netErr.message || "Failed to connect to AI server at http://localhost:5000/analyze");
    err.isNetworkError = true;
    throw err;
  }

  let data = null;
  try {
    data = await response.json();
  } catch (parseErr) {
    console.warn("Backend returned non-JSON response.");
  }

  if (!response.ok) {
    console.error("Backend error:", response?.status, data);
    if (response.status === 500) {
      const err = new Error(
        data?.details || data?.error || "Analysis could not be completed because the backend AI model or video processor encountered an error."
      );
      err.status = 500;
      throw err;
    }
    const err = new Error(
      data?.details ||
      data?.error ||
      `Interview analysis failed with server status ${response.status} (${response.statusText}).`
    );
    err.status = response.status;
    throw err;
  }

  console.log("Backend analysis successful:", data);
  return data;
}

/**
 * Health check helper to test backend connection
 * GET http://localhost:5000/health
 */
async function checkBackendHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { method: "GET" });
    if (res.ok) {
      const data = await res.json().catch(() => ({ status: "ok" }));
      return { ok: true, data };
    }
    return { ok: false, error: `Server returned status ${res.status}` };
  } catch (err) {
    return { ok: false, error: err.message || "Failed to fetch http://localhost:5000/health" };
  }
}

// ==========================================================================
// 2. QUESTION BANKS (HR & BEHAVIORAL)
// ==========================================================================
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
      tip: "Mention a specific strength (e.g. problem solving, clear communication) backed by a concrete academic or project example."
    },
    {
      q: "Tell me about a mistake you made and what you learned from it.",
      tip: "Take accountability, explain how you addressed the mistake, and how it improved your future workflow."
    },
    {
      q: "Where do you see yourself in five years?",
      tip: "Express your ambition to grow in expertise, take on greater technical or team responsibilities, and contribute to impact."
    },
    {
      q: "Why do you want to join our company?",
      tip: "Show knowledge of company mission, culture of innovation, and alignment with your personal career values."
    },
    {
      q: "How do you handle workplace pressure and deadlines?",
      tip: "Discuss prioritization, time blocking, staying organized, and transparent communication."
    },
    {
      q: "What type of work environment brings out your best performance?",
      tip: "Emphasize collaborative, supportive, and growth-oriented cultures with clear goals."
    },
    {
      q: "Tell me about a situation where you had to adapt quickly to change.",
      tip: "Describe how you stayed calm, adjusted priorities, and successfully delivered on expectations."
    },
    {
      q: "How do you handle constructive feedback from peers or mentors?",
      tip: "Highlight listening without defensiveness and actively turning feedback into tangible personal improvement."
    }
  ],
  behavioral: [
    {
      q: "Tell me about a time you faced a difficult situation.",
      tip: "Use the STAR method: explain the Situation, your specific Task, the Action you took, and the positive Result achieved."
    },
    {
      q: "How do you handle pressure?",
      tip: "Give an authentic example from exam periods or group project deadlines showing composure and systematic action."
    },
    {
      q: "Describe a time when you had a disagreement with a team member.",
      tip: "Focus on mutual respect, listening to different perspectives, objective facts, and finding a productive compromise."
    },
    {
      q: "Tell me about a project where you took leadership initiative.",
      tip: "Leadership can be organizing a team, unblocking a colleague, or identifying a missing requirement."
    },
    {
      q: "Describe a time when you failed to achieve a target and what happened.",
      tip: "Explain what factors contributed, how you notified stakeholders, and the lasting lesson you implemented."
    },
    {
      q: "Tell me about a time you had to solve a problem with incomplete information.",
      tip: "Discuss hypothesis testing, consulting available resources, assessing risks, and iterative progress."
    },
    {
      q: "Describe an experience where you had to persuade someone to see your perspective.",
      tip: "Show how you relied on data, logical reasoning, and empathetic listening rather than arguing."
    },
    {
      q: "Tell me about a time you went above and beyond project expectations.",
      tip: "Describe extra effort in documentation, polishing user experience, or thorough testing."
    },
    {
      q: "How do you prioritize competing deadlines under strict time constraints?",
      tip: "Explain your framework for urgency vs impact and how you communicate adjustments."
    },
    {
      q: "Describe a situation where you worked with someone whose style differed from yours.",
      tip: "Highlight finding common ground, establishing clear responsibilities, and professional harmony."
    }
  ]
};

// ==========================================================================
// 3. APPLICATION STATE
// ==========================================================================
const state = {
  currentView: 'dashboard',
  selectedType: 'hr',
  selectedDifficulty: 'intermediate',
  selectedCount: 5,

  questions: [],
  currentQuestionIndex: 0,

  mediaStream: null,
  mediaRecorder: null,
  recordedChunks: [],
  currentRecordedBlob: null,
  currentRecordedUrl: null,
  recordedAnswers: [], // Array of { questionIndex, questionText, blob, duration }

  isRecording: false,
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

// ==========================================================================
// 4. LOCAL STORAGE ENGINE
// ==========================================================================
const STORAGE_KEY = 'smart_interview_history';

function getInterviewHistory() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.warn("Error parsing localStorage history:", e);
    }
  }
  return [];
}

function saveInterviewHistory(sessionEntry) {
  const history = getInterviewHistory();
  history.unshift(sessionEntry); // Newest first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  state.history = history;
  updateDashboardAnalytics();
  displayInterviewHistory();
}

// ==========================================================================
// 5. DOM REFERENCES
// ==========================================================================
const dom = {
  // Views
  views: {
    dashboard: document.getElementById('view-dashboard'),
    setup: document.getElementById('view-setup'),
    interview: document.getElementById('view-interview'),
    completion: document.getElementById('view-completion'),
    loading: document.getElementById('view-loading'),
    results: document.getElementById('view-results'),
    history: document.getElementById('view-history')
  },

  // Navbar
  navLinks: document.querySelectorAll('.nav-link'),
  brandLogo: document.getElementById('brand-logo-btn'),
  navProfileBtn: document.getElementById('nav-profile-btn'),
  btnNavEnableCamera: document.getElementById('btn-nav-enable-camera'),

  // Dashboard
  btnDashStart: document.getElementById('btn-dash-start'),
  statCompleted: document.getElementById('stat-completed'),
  statAvgScore: document.getElementById('stat-avg-score'),
  statLatestScore: document.getElementById('stat-latest-score'),
  statLatestSubtext: document.getElementById('stat-latest-subtext'),
  statImprovement: document.getElementById('stat-improvement'),
  progressSequence: document.getElementById('progress-sequence'),
  progressCardBadge: document.getElementById('progress-card-badge'),
  progressCalloutTitle: document.getElementById('progress-callout-title'),
  progressCalloutDesc: document.getElementById('progress-callout-desc'),
  dashboardChartSvg: document.getElementById('dashboard-chart-svg'),
  dashboardChartLabels: document.getElementById('dashboard-chart-labels'),
  chartPathArea: document.getElementById('chart-path-area'),
  chartPathLine: document.getElementById('chart-path-line'),
  chartDotsGroup: document.getElementById('chart-dots-group'),
  recentSessionsTbody: document.getElementById('recent-sessions-tbody'),
  btnViewAllHistory: document.getElementById('btn-view-all-history'),

  // Setup View
  typeCards: document.querySelectorAll('.type-select-card'),
  diffBtns: document.querySelectorAll('[data-setup-diff]'),
  countBtns: document.querySelectorAll('[data-setup-count]'),
  btnBeginInterview: document.getElementById('btn-begin-interview'),
  btnSetupBack: document.getElementById('btn-setup-back'),
  btnSetupEnableCamera: document.getElementById('btn-setup-enable-camera'),

  // Interview Screen
  topSessionPill: document.getElementById('top-session-pill'),
  topQuestionNum: document.getElementById('top-question-num'),
  topProgressBar: document.getElementById('top-progress-bar'),
  btnExitInterview: document.getElementById('btn-exit-interview'),

  videoFrame: document.getElementById('video-frame'),
  webcamPreview: document.getElementById('webcamPreview'),
  previewVideo: document.getElementById('preview-video'),
  cameraErrorAlert: document.getElementById('camera-error-alert'),
  cameraErrorText: document.getElementById('camera-error-text'),
  btnRetryCamera: document.getElementById('btn-retry-camera'),
  cameraStatusText: document.getElementById('camera-status-text'),
  timerDisplay: document.getElementById('timer-display'),
  stageStatusText: document.getElementById('stage-status-text'),

  activeQuestionHeading: document.getElementById('active-question-heading'),
  activeQuestionTip: document.getElementById('active-question-tip'),
  btnStartAnswer: document.getElementById('btn-start-answer'),
  btnStopAnswer: document.getElementById('btn-stop-answer'),
  btnRetakeAnswer: document.getElementById('btn-retake-answer'),
  btnNextQuestion: document.getElementById('btn-next-question'),
  recStateMsg: document.getElementById('rec-state-msg'),
  liveObservingNotice: document.getElementById('live-observing-notice'),

  // Completion View
  btnAnalyzeMyInterview: document.getElementById('btn-analyze-my-interview'),

  // Loading View
  loadQuestionProgress: document.getElementById('load-question-progress'),
  loadStep1: document.getElementById('load-step-1'),
  loadStep2: document.getElementById('load-step-2'),
  loadStep3: document.getElementById('load-step-3'),
  loadStep4: document.getElementById('load-step-4'),
  loadStep5: document.getElementById('load-step-5'),
  loadStep6: document.getElementById('load-step-6'),
  loadingErrorBox: document.getElementById('loading-error-box'),
  loadingErrorTitle: document.getElementById('loading-error-title'),
  loadingErrorSubtext: document.getElementById('loading-error-subtext'),
  loadingErrorDetails: document.getElementById('loading-error-details'),
  btnLoadingRetry: document.getElementById('btn-loading-retry'),
  btnLoadingCheckHealth: document.getElementById('btn-loading-check-health'),
  btnLoadingCancel: document.getElementById('btn-loading-cancel'),

  // Results View
  overallScoreNumber: document.getElementById('overall-score-number'),
  overallGradeText: document.getElementById('overall-grade-text'),
  overallGradeBadge: document.getElementById('overall-grade-badge'),
  overallDescText: document.getElementById('overall-desc-text'),
  circleProgressBar: document.getElementById('circle-progress-bar'),

  // Section 1: Video Emotion
  videoScoreBadge: document.getElementById('video-score-badge'),
  videoDetectedEmotion: document.getElementById('video-detected-emotion'),
  videoDetectedText: document.getElementById('video-detected-text'),
  videoFrameStats: document.getElementById('video-frame-stats'),
  videoProbBars: document.getElementById('video-prob-bars'),

  // Section 2: Audio Emotion
  audioScoreBadge: document.getElementById('audio-score-badge'),
  audioDetectedEmotion: document.getElementById('audio-detected-emotion'),
  audioDetectedText: document.getElementById('audio-detected-text'),
  audioConfidenceBadge: document.getElementById('audio-confidence-badge'),
  audioProbBars: document.getElementById('audio-prob-bars'),

  // Section 3: Answer Quality
  textScoreBadge: document.getElementById('text-score-badge'),
  textQualityLabel: document.getElementById('text-quality-label'),
  textQualityText: document.getElementById('text-quality-text'),
  textProbBars: document.getElementById('text-prob-bars'),

  // Section 4: Fluency
  fluencyStatusBadge: document.getElementById('fluency-status-badge'),
  fluencyScoreVal: document.getElementById('fluency-score-val'),
  fluencyFillerCount: document.getElementById('fluency-filler-count'),
  fluencyPaceVal: document.getElementById('fluency-pace-val'),
  fluencyFillersContainer: document.getElementById('fluency-fillers-container'),
  fluencyDynamicDetails: document.getElementById('fluency-dynamic-details'),

  // Section 5: Transcript
  transcriptContentText: document.getElementById('transcript-content-text'),

  // Section 6: Question-Wise
  qBreakdownCount: document.getElementById('q-breakdown-count'),
  questionTabsNav: document.getElementById('question-tabs-nav'),
  resQuestionWiseList: document.getElementById('res-question-wise-list'),

  btnResultsPracticeAgain: document.getElementById('btn-results-practice-again'),
  btnResultsViewHistory: document.getElementById('btn-results-view-history'),
  btnResultsPrint: document.getElementById('btn-results-print'),

  // History View
  historyTbody: document.getElementById('history-tbody'),
  btnHistoryStartNew: document.getElementById('btn-history-start-new')
};

// ==========================================================================
// 6. VIEW NAVIGATION
// ==========================================================================
function switchView(viewName) {
  if (viewName === 'start') {
    viewName = 'setup';
  }
  state.currentView = viewName;

  Object.keys(dom.views).forEach(key => {
    if (dom.views[key]) {
      dom.views[key].classList.remove('active');
    }
  });

  if (dom.views[viewName]) {
    dom.views[viewName].classList.add('active');
  }

  // Update navbar active state
  dom.navLinks.forEach(link => {
    const target = link.getAttribute('data-target');
    if (target === viewName || (viewName === 'setup' && target === 'start')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.switchView = switchView;

// ==========================================================================
// 7. DASHBOARD ANALYTICS (CALCULATED FROM LOCAL STORAGE)
// ==========================================================================
function updateDashboardAnalytics() {
  const history = getInterviewHistory();
  state.history = history;

  if (history.length === 0) {
    dom.statCompleted.textContent = "0";
    dom.statAvgScore.textContent = "--";
    dom.statLatestScore.textContent = "--";
    dom.statLatestSubtext.textContent = "No session recorded yet";
    dom.statImprovement.textContent = "+0%";
    dom.progressSequence.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-muted);">Complete an interview session to start tracking your score trend.</span>`;
    dom.recentSessionsTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">
          No saved interviews yet. Click "Start New Interview" to begin!
        </td>
      </tr>
    `;
    renderEmptyDashboardChart();
    return;
  }

  const total = history.length;
  const sumScore = history.reduce((acc, h) => acc + (Number(h.overallScore) || 0), 0);
  const avgScore = Math.round(sumScore / total);

  // Latest session is at index 0 (newest first)
  const latestSession = history[0];
  const latestScore = Number(latestSession.overallScore) || 0;
  const latestGrade = latestSession.overallGrade || (latestScore >= 80 ? "Good" : latestScore >= 60 ? "Average" : "Poor");

  // Improvement compared to previous session
  let diffStr = "+0%";
  if (history.length >= 2) {
    const previousScore = Number(history[1].overallScore) || 0;
    const diff = latestScore - previousScore;
    diffStr = diff >= 0 ? `+${diff}%` : `${diff}%`;
  }

  dom.statCompleted.textContent = String(total);
  dom.statAvgScore.textContent = `${avgScore} / 100`;
  dom.statLatestScore.textContent = `${latestScore} / 100`;
  dom.statLatestSubtext.textContent = `Grade: ${latestGrade}`;
  dom.statImprovement.textContent = diffStr;

  renderDashboardTrendChart(history);
  renderDashboardProgressSequence(history);
  renderRecentDashboardTable(history.slice(0, 4));
}

function renderEmptyDashboardChart() {
  if (dom.chartPathArea) dom.chartPathArea.setAttribute('points', '50,150 450,150');
  if (dom.chartPathLine) dom.chartPathLine.setAttribute('points', '50,150 450,150');
  if (dom.chartDotsGroup) dom.chartDotsGroup.innerHTML = '';
  if (dom.dashboardChartLabels) {
    dom.dashboardChartLabels.innerHTML = `
      <div style="width: 100%; text-align: center; font-size: 0.85rem; color: var(--text-muted); padding: 6px;">
        Practice an interview to visualize your score trajectory
      </div>
    `;
  }
}

function renderDashboardTrendChart(history) {
  // Chronological order: up to last 5 sessions (oldest to newest)
  const sessions = [...history].reverse().slice(-5);
  if (sessions.length === 0) {
    renderEmptyDashboardChart();
    return;
  }

  const width = 500;
  const height = 170;
  const paddingX = 50;
  const paddingY = 30;
  const chartHeight = 110;

  const count = sessions.length;
  const step = count > 1 ? (width - paddingX * 2) / (count - 1) : 0;

  const points = sessions.map((s, idx) => {
    const score = Math.max(0, Math.min(100, Number(s.overallScore) || 0));
    const x = count === 1 ? width / 2 : paddingX + idx * step;
    const y = paddingY + chartHeight - (score / 100) * chartHeight;
    return { x, y, score, session: s, idx: idx + 1 };
  });

  const linePointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPointsStr = `${points[0].x},${height - 10} ${linePointsStr} ${points[points.length - 1].x},${height - 10}`;

  if (dom.chartPathLine) dom.chartPathLine.setAttribute('points', linePointsStr);
  if (dom.chartPathArea) dom.chartPathArea.setAttribute('points', areaPointsStr);

  if (dom.chartDotsGroup) {
    dom.chartDotsGroup.innerHTML = points.map(p => `
      <circle cx="${p.x}" cy="${p.y}" r="5" class="chart-dot">
        <title>Interview ${p.idx}: ${p.score} / 100 (${p.session.overallGrade || ''})</title>
      </circle>
    `).join('');
  }

  if (dom.dashboardChartLabels) {
    dom.dashboardChartLabels.innerHTML = points.map((p, i) => `
      <div class="chart-label-item">
        <div class="chart-label-session">Session ${i + 1}</div>
        <div class="chart-label-pct" style="${i === points.length - 1 ? 'color: var(--primary); font-weight: 700;' : ''}">
          ${p.score}
        </div>
      </div>
    `).join('');
  }
}

function renderDashboardProgressSequence(history) {
  dom.progressSequence.innerHTML = '';
  const sessions = [...history].reverse().slice(-5);

  sessions.forEach((item, index) => {
    const isCurrent = (index === sessions.length - 1);
    const span = document.createElement('span');
    span.className = `seq-item ${isCurrent ? 'current' : ''}`;
    span.textContent = `${item.overallScore}`;
    span.title = `Grade: ${item.overallGrade || 'N/A'}`;
    dom.progressSequence.appendChild(span);

    if (index < sessions.length - 1) {
      const arrow = document.createElement('span');
      arrow.className = 'seq-arrow';
      arrow.textContent = '→';
      dom.progressSequence.appendChild(arrow);
    }
  });
}

function renderRecentDashboardTable(items) {
  dom.recentSessionsTbody.innerHTML = '';

  items.forEach(item => {
    const tr = document.createElement('tr');
    const gradeClass = (item.overallGrade || 'good').toLowerCase();
    tr.innerHTML = `
      <td><strong>${item.date}</strong></td>
      <td>
        <span class="badge-pill ${item.type && item.type.includes('HR') ? 'badge-hr' : 'badge-behavioral'}">
          ${item.type || 'HR Interview'}
        </span>
      </td>
      <td>${item.questionsCount || 1} Question${(item.questionsCount || 1) > 1 ? 's' : ''}</td>
      <td><strong style="color: var(--primary); font-size: 1.05rem;">${item.overallScore} / 100</strong></td>
      <td>
        <span class="badge-pill badge-${gradeClass}">
          ${item.overallGrade || 'Good'}
        </span>
      </td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="viewSavedSession('${item.id}')">
          View Report →
        </button>
      </td>
    `;
    dom.recentSessionsTbody.appendChild(tr);
  });
}

// ==========================================================================
// 8. HISTORY VIEW
// ==========================================================================
function displayInterviewHistory() {
  const history = getInterviewHistory();
  dom.historyTbody.innerHTML = '';

  if (history.length === 0) {
    dom.historyTbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
          No interview history found. Practice an interview to generate your first AI report!
        </td>
      </tr>
    `;
    return;
  }

  history.forEach(item => {
    const tr = document.createElement('tr');
    const gradeClass = (item.overallGrade || 'good').toLowerCase();
    tr.innerHTML = `
      <td><strong>${item.date}</strong></td>
      <td>
        <span class="badge-pill ${item.type && item.type.includes('HR') ? 'badge-hr' : 'badge-behavioral'}">
          ${item.type || 'HR Interview'}
        </span>
      </td>
      <td>${item.questionsCount || 1} Question${(item.questionsCount || 1) > 1 ? 's' : ''}</td>
      <td><strong style="color: var(--primary); font-size: 1.05rem;">${item.overallScore} / 100</strong></td>
      <td>
        <span class="badge-pill badge-${gradeClass}">
          ${item.overallGrade || 'Good'}
        </span>
      </td>
      <td>
        <button class="btn btn-outline btn-sm" onclick="viewSavedSession('${item.id}')">
          View Report →
        </button>
      </td>
    `;
    dom.historyTbody.appendChild(tr);
  });
}

window.viewSavedSession = function(sessionId) {
  const history = getInterviewHistory();
  const session = history.find(s => s.id === sessionId);
  if (!session) return;

  renderResultsDashboard(session);
  switchView('results');
};

// ==========================================================================
// 9. WEBCAM & MEDIA CONTROLS
// ==========================================================================
async function initWebcam() {
  try {
    if (dom.cameraErrorAlert) dom.cameraErrorAlert.style.display = 'none';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia is not supported by your browser environment.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });

    state.mediaStream = stream;
    state.cameraGranted = true;
    state.audioGranted = stream.getAudioTracks().length > 0;

    if (dom.webcamPreview) {
      dom.webcamPreview.srcObject = stream;
      dom.webcamPreview.style.display = 'block';
    }
    if (dom.previewVideo) {
      dom.previewVideo.style.display = 'none';
    }

    if (dom.cameraStatusText) dom.cameraStatusText.textContent = "Camera Ready";
    if (dom.stageStatusText) dom.stageStatusText.textContent = "Camera & microphone ready. Click 'Start Answer' when ready.";

    if (state.audioGranted) {
      setupAudioVisualizer(stream);
    }

    return stream;
  } catch (err) {
    console.warn("Camera or microphone access error:", err);
    state.cameraGranted = false;
    state.mediaStream = null;

    if (dom.webcamPreview) dom.webcamPreview.style.display = 'none';
    if (dom.cameraStatusText) dom.cameraStatusText.textContent = "Camera Blocked";
    if (dom.stageStatusText) dom.stageStatusText.textContent = "Camera access denied. Please allow permissions in browser settings.";

    if (dom.cameraErrorAlert) dom.cameraErrorAlert.style.display = 'flex';
    if (dom.cameraErrorText) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        dom.cameraErrorText.textContent = "Camera or microphone permission was denied. Please allow access in your browser site settings (click the 🔒 lock icon in the address bar) and retry.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        dom.cameraErrorText.textContent = "No camera or microphone hardware found on this device. Please connect a webcam/mic and retry.";
      } else {
        dom.cameraErrorText.textContent = "Unable to access camera or microphone. Please ensure access is allowed in your browser settings.";
      }
    }
    return null;
  }
}

function stopWebcam() {
  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach(track => track.stop());
    state.mediaStream = null;
  }
  if (dom.webcamPreview) {
    dom.webcamPreview.srcObject = null;
  }
  stopAudioVisualizer();
}

function setupAudioVisualizer(stream) {
  stopAudioVisualizer();
  try {
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks || audioTracks.length === 0) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    state.audioContext = new AudioContextClass();
    const source = state.audioContext.createMediaStreamSource(stream);
    state.audioAnalyser = state.audioContext.createAnalyser();
    state.audioAnalyser.fftSize = 32;
    source.connect(state.audioAnalyser);

    const dataArray = new Uint8Array(state.audioAnalyser.frequencyBinCount);
    const bars = document.querySelectorAll('.sound-bar');

    function animateSound() {
      if (!state.audioAnalyser) return;
      state.audioAnalyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;

      bars.forEach((bar, idx) => {
        const val = dataArray[idx] || avg;
        const height = Math.max(4, Math.min(22, (val / 255) * 24));
        bar.style.height = `${height}px`;
        bar.style.background = height > 10 ? 'var(--primary)' : '#cbd5e1';
      });

      state.audioAnimId = requestAnimationFrame(animateSound);
    }

    animateSound();
  } catch (e) {
    console.warn("Audio visualizer could not attach:", e);
  }
}

function stopAudioVisualizer() {
  if (state.audioAnimId) {
    cancelAnimationFrame(state.audioAnimId);
    state.audioAnimId = null;
  }
  if (state.audioContext && state.audioContext.state !== 'closed') {
    state.audioContext.close().catch(() => {});
    state.audioContext = null;
    state.audioAnalyser = null;
  }
  const bars = document.querySelectorAll('.sound-bar');
  bars.forEach(bar => {
    bar.style.height = '6px';
    bar.style.background = '#cbd5e1';
  });
}

// ==========================================================================
// 10. RECORDING ENGINE (MediaRecorder API)
// ==========================================================================
function startRecordingAnswer() {
  state.recordedChunks = [];
  state.secondsElapsed = 0;
  updateTimerDisplay(0);

  if (dom.webcamPreview) dom.webcamPreview.style.display = 'block';
  if (dom.previewVideo) {
    dom.previewVideo.pause();
    dom.previewVideo.src = "";
    dom.previewVideo.style.display = 'none';
  }

  if (state.mediaStream && typeof MediaRecorder !== 'undefined') {
    try {
      const mimeTypes = [
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ];
      let selectedMime = '';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const options = selectedMime ? { mimeType: selectedMime } : {};
      state.mediaRecorder = new MediaRecorder(state.mediaStream, options);

      state.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          state.recordedChunks.push(e.data);
        }
      };

      state.mediaRecorder.onstop = () => {
        onRecordingStopped();
      };

      state.mediaRecorder.start(200);
    } catch (e) {
      console.warn("MediaRecorder creation error:", e);
    }
  }

  state.isRecording = true;

  dom.videoFrame.classList.add('recording-live');
  dom.cameraStatusText.textContent = "Recording Live";
  dom.liveObservingNotice.style.display = 'block';

  dom.btnStartAnswer.disabled = true;
  dom.btnStopAnswer.disabled = false;
  dom.btnRetakeAnswer.disabled = true;
  dom.btnNextQuestion.disabled = true;

  dom.recStateMsg.textContent = "Recording in progress... Speak clearly into your microphone.";
  dom.stageStatusText.textContent = "Recording candidate answer. Click 'Stop' when finished.";

  state.timerInterval = setInterval(() => {
    state.secondsElapsed++;
    updateTimerDisplay(state.secondsElapsed);
  }, 1000);
}

function stopRecordingAnswer() {
  if (!state.isRecording) return;

  state.isRecording = false;
  clearInterval(state.timerInterval);

  dom.videoFrame.classList.remove('recording-live');
  dom.cameraStatusText.textContent = "Answer Recorded";
  dom.liveObservingNotice.style.display = 'none';

  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  } else {
    onRecordingStopped();
  }

  dom.btnStartAnswer.disabled = true;
  dom.btnStopAnswer.disabled = true;
  dom.btnRetakeAnswer.disabled = false;
  dom.btnNextQuestion.disabled = false;

  dom.recStateMsg.textContent = "Answer recorded! Preview your recording or proceed to the next question.";
  dom.stageStatusText.textContent = "Answer saved. Review preview or proceed.";
}

function onRecordingStopped() {
  console.log("Recording stopped.");

  if (!state.recordedChunks || state.recordedChunks.length === 0) {
    console.error("No video data was recorded.");
    if (dom.recStateMsg) {
      dom.recStateMsg.textContent = "Recording failed. Please record your answer again.";
    }
    state.currentRecordedBlob = null;
    state.currentRecordedUrl = null;
    return;
  }

  const blobType = state.recordedChunks[0]?.type || "video/webm";
  const blob = new Blob(state.recordedChunks, { type: blobType });

  if (blob.size === 0) {
    console.error("Recorded video blob is empty.");
    if (dom.recStateMsg) {
      dom.recStateMsg.textContent = "Recording failed. Please record your answer again.";
    }
    state.currentRecordedBlob = null;
    state.currentRecordedUrl = null;
    return;
  }

  state.currentRecordedBlob = blob;
  const videoUrl = URL.createObjectURL(blob);
  state.currentRecordedUrl = videoUrl;

  if (dom.previewVideo) {
    if (dom.webcamPreview) dom.webcamPreview.style.display = 'none';
    dom.previewVideo.style.display = 'block';
    dom.previewVideo.src = videoUrl;
    dom.previewVideo.load();
  }

  const qObj = state.questions[state.currentQuestionIndex];
  state.recordedAnswers[state.currentQuestionIndex] = {
    questionIndex: state.currentQuestionIndex,
    questionText: qObj ? qObj.q : `Question ${state.currentQuestionIndex + 1}`,
    blob: blob,
    duration: state.secondsElapsed
  };

  console.log(`Question ${state.currentQuestionIndex + 1} recording saved successfully.`);
}

function retakeCurrentAnswer() {
  if (state.isRecording) {
    clearInterval(state.timerInterval);
    state.isRecording = false;
  }

  if (state.currentRecordedUrl) {
    URL.revokeObjectURL(state.currentRecordedUrl);
    state.currentRecordedUrl = null;
  }
  state.currentRecordedBlob = null;
  state.recordedChunks = [];
  state.secondsElapsed = 0;
  updateTimerDisplay(0);

  // Clear recorded answer for this index
  delete state.recordedAnswers[state.currentQuestionIndex];

  if (dom.previewVideo) {
    dom.previewVideo.pause();
    dom.previewVideo.src = "";
    dom.previewVideo.style.display = 'none';
  }

  if (dom.webcamPreview) dom.webcamPreview.style.display = 'block';
  dom.cameraStatusText.textContent = "Camera Ready";

  dom.videoFrame.classList.remove('recording-live');
  dom.liveObservingNotice.style.display = 'none';

  dom.btnStartAnswer.disabled = false;
  dom.btnStopAnswer.disabled = true;
  dom.btnRetakeAnswer.disabled = true;
  dom.btnNextQuestion.disabled = false;

  dom.recStateMsg.textContent = "Ready to record your answer.";
  dom.stageStatusText.textContent = "Live camera preview active. Click 'Start Answer' when ready.";
}

function updateTimerDisplay(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  dom.timerDisplay.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ==========================================================================
// 11. INTERVIEW SETUP & FLOW
// ==========================================================================
function beginInterviewSession() {
  const pool = QUESTION_BANKS[state.selectedType] || QUESTION_BANKS.hr;
  const count = Math.min(state.selectedCount, pool.length);
  state.questions = pool.slice(0, count);
  state.currentQuestionIndex = 0;
  state.recordedAnswers = [];

  const typeName = state.selectedType === 'hr' ? 'HR Interview' : 'Behavioral Interview';
  const diffName = state.selectedDifficulty.charAt(0).toUpperCase() + state.selectedDifficulty.slice(1);
  dom.topSessionPill.textContent = `${typeName} · ${diffName}`;

  switchView('interview');
  initWebcam();
  loadQuestion(0);
}

function loadQuestion(index) {
  state.currentQuestionIndex = index;
  const total = state.questions.length;
  const item = state.questions[index];

  dom.topQuestionNum.textContent = `Question ${index + 1} of ${total}`;
  const pct = ((index + 1) / total) * 100;
  dom.topProgressBar.style.width = `${pct}%`;

  dom.activeQuestionHeading.textContent = `"${item.q}"`;
  dom.activeQuestionTip.textContent = item.tip;

  if (index === total - 1) {
    dom.btnNextQuestion.innerHTML = `Finish Interview →`;
  } else {
    dom.btnNextQuestion.innerHTML = `Next Question →`;
  }

  retakeCurrentAnswer();
}

function handleNextQuestion() {
  if (state.isRecording) {
    stopRecordingAnswer();
  }

  const nextIdx = state.currentQuestionIndex + 1;
  if (nextIdx < state.questions.length) {
    loadQuestion(nextIdx);
  } else {
    stopWebcam();
    switchView('completion');
  }
}

// ==========================================================================
// 12. REAL BACKEND ANALYSIS & MULTI-QUESTION HANDLING
// ==========================================================================
async function triggerAIAnalysis() {
  // Validate that at least one valid recording exists
  const answersToAnalyze = state.recordedAnswers.filter(a => a && a.blob && a.blob.size > 0);

  if (answersToAnalyze.length === 0) {
    alert("No recorded answers were found to analyze. Please go back and record your responses.");
    switchView('interview');
    return;
  }

  switchView('loading');
  dom.loadingErrorBox.style.display = 'none';

  const totalQuestions = answersToAnalyze.length;
  const interviewResults = [];

  // Reset steps UI
  resetLoadingSteps();

  try {
    for (let i = 0; i < totalQuestions; i++) {
      const ans = answersToAnalyze[i];
      dom.loadQuestionProgress.textContent = `Analyzing Answer ${i + 1} of ${totalQuestions}: "${ans.questionText}"...`;

      // Animate progress steps for visual feedback
      animateLoadingStep(1);
      await sleep(300);

      animateLoadingStep(2);
      await sleep(250);

      animateLoadingStep(3);
      await sleep(250);

      // Perform actual fetch call to Flask backend
      animateLoadingStep(4);
      const backendResult = await analyzeInterviewWithBackend(ans.blob, ans.questionText);

      animateLoadingStep(5);
      await sleep(250);

      animateLoadingStep(6);
      await sleep(200);

      // Save question-wise result
      interviewResults.push({
        questionIndex: ans.questionIndex,
        question: ans.questionText,
        result: backendResult
      });
    }

    // All questions successfully analyzed!
    onAllQuestionsAnalyzed(interviewResults);

  } catch (error) {
    console.error("Backend interview analysis error:", error);
    showLoadingError(error);
  }
}

function resetLoadingSteps() {
  for (let i = 1; i <= 6; i++) {
    const el = document.getElementById(`load-step-${i}`);
    if (el) el.className = (i === 1) ? 'load-step-item active' : 'load-step-item';
  }
}

function animateLoadingStep(stepNum) {
  for (let i = 1; i <= 6; i++) {
    const el = document.getElementById(`load-step-${i}`);
    if (!el) continue;
    if (i < stepNum) {
      el.className = 'load-step-item done';
    } else if (i === stepNum) {
      el.className = 'load-step-item active';
    } else {
      el.className = 'load-step-item';
    }
  }
}

function showLoadingError(error) {
  dom.loadingErrorBox.style.display = 'block';

  const isModelUnavailable = error.status === 500 ||
    (error.message && error.message.includes("backend AI model is currently unavailable"));

  if (isModelUnavailable) {
    if (dom.loadingErrorTitle) {
      dom.loadingErrorTitle.textContent = "⚠️ AI Model / Video Processing Error";
    }
    if (dom.loadingErrorSubtext) {
      dom.loadingErrorSubtext.textContent = "Connected to the backend server, but analysis failed while processing the video.";
    }
    dom.loadingErrorDetails.textContent = error.message;
    dom.loadQuestionProgress.textContent = "Analysis stopped due to a backend processing error.";
  } else {
    if (dom.loadingErrorTitle) {
      dom.loadingErrorTitle.textContent = "⚠️ Unable to connect to the AI analysis server.";
    }
    if (dom.loadingErrorSubtext) {
      dom.loadingErrorSubtext.innerHTML = "Make sure the Smart Interview Analyzer backend is running on <strong>localhost:5000</strong>.";
    }
    dom.loadingErrorDetails.textContent = error.message || "Failed to connect to AI server at http://localhost:5000/analyze";
    dom.loadQuestionProgress.textContent = "Analysis paused due to connection error.";
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Aggregates all question-wise results and saves to history & renders dashboard
 */
function onAllQuestionsAnalyzed(interviewResults) {
  const total = interviewResults.length;
  let sumScore = 0;

  interviewResults.forEach(item => {
    const res = item.result;
    const finalScore = (res.final && typeof res.final.score === 'number')
      ? res.final.score
      : (typeof res.score === 'number' ? res.score : 80);
    sumScore += finalScore;
  });

  const aggregateScore = Math.round(sumScore / total);

  let aggregateGrade = "Good";
  if (interviewResults[0] && interviewResults[0].result.final && interviewResults[0].result.final.grade) {
    aggregateGrade = interviewResults[0].result.final.grade;
  } else if (aggregateScore >= 80) {
    aggregateGrade = "Good";
  } else if (aggregateScore >= 60) {
    aggregateGrade = "Average";
  } else {
    aggregateGrade = "Poor";
  }

  const dateObj = new Date();
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const sessionRecord = {
    id: "session_" + Date.now(),
    date: formattedDate,
    type: state.selectedType === 'hr' ? 'HR Interview' : 'Behavioral Interview',
    difficulty: state.selectedDifficulty,
    questionsCount: total,
    overallScore: aggregateScore,
    overallGrade: aggregateGrade,
    questionResults: interviewResults,
    primaryResult: interviewResults[0].result
  };

  state.currentActiveSession = sessionRecord;

  // Save to localStorage
  saveInterviewHistory(sessionRecord);

  // Render Real Results Dashboard
  renderResultsDashboard(sessionRecord);
  switchView('results');
}

// ==========================================================================
// 13. REAL RESULTS DASHBOARD RENDERING
// ==========================================================================
function renderResultsDashboard(session) {
  state.currentActiveSession = session;
  const results = session.questionResults || [];
  const primaryResult = session.primaryResult || (results[0] ? results[0].result : null);

  if (!primaryResult) return;

  // 1. Overall Score & Grade
  const overallScore = Math.round(Number(session.overallScore) || (primaryResult.final && primaryResult.final.score) || 82);
  const overallGrade = session.overallGrade || (primaryResult.final && primaryResult.final.grade) || "Good";

  dom.overallScoreNumber.textContent = String(overallScore);
  dom.overallGradeText.textContent = overallGrade;
  dom.overallGradeBadge.textContent = `Final Grade: ${overallGrade}`;
  dom.overallGradeBadge.className = `badge-pill badge-${overallGrade.toLowerCase()}`;

  // SVG Circular progress
  const circumference = 440;
  const offset = circumference - (circumference * Math.min(100, overallScore)) / 100;
  setTimeout(() => {
    if (dom.circleProgressBar) {
      dom.circleProgressBar.style.strokeDashoffset = offset;
    }
  }, 100);

  // Render question-wise tab selector
  renderQuestionTabs(results);

  // Render question #0 by default
  displayQuestionResult(0);
}

function renderQuestionTabs(questionResults) {
  dom.questionTabsNav.innerHTML = '';
  dom.qBreakdownCount.textContent = `${questionResults.length} Question${questionResults.length > 1 ? 's' : ''} Analyzed`;

  if (questionResults.length <= 1) {
    dom.questionTabsNav.style.display = 'none';
  } else {
    dom.questionTabsNav.style.display = 'flex';
    questionResults.forEach((qItem, idx) => {
      const btn = document.createElement('button');
      btn.className = `q-tab-btn ${idx === state.activeQuestionTabIdx ? 'active' : ''}`;
      btn.textContent = `Question ${idx + 1}`;
      btn.addEventListener('click', () => {
        state.activeQuestionTabIdx = idx;
        document.querySelectorAll('.q-tab-btn').forEach((b, i) => {
          b.classList.toggle('active', i === idx);
        });
        displayQuestionResult(idx);
      });
      dom.questionTabsNav.appendChild(btn);
    });
  }

  renderQuestionCardsList(questionResults);
}

function displayQuestionResult(questionIndex) {
  const session = state.currentActiveSession;
  if (!session || !session.questionResults) return;

  const item = session.questionResults[questionIndex] || session.questionResults[0];
  if (!item) return;

  const res = item.result;

  // 1. VIDEO / FACIAL EMOTION
  renderVideoEmotionSection(res.video || {});

  // 2. AUDIO / VOICE EMOTION
  renderAudioEmotionSection(res.audio || {});

  // 3. ANSWER QUALITY
  renderAnswerQualitySection(res.text || {});

  // 4. FLUENCY
  renderFluencySection(res.fluency || {});

  // 5. TRANSCRIPT
  const transcriptText = res.transcript || item.transcript || "(No speech transcript returned for this question)";
  dom.transcriptContentText.textContent = transcriptText;
}

/**
 * 1. Facial / Video Emotion
 */
function renderVideoEmotionSection(video) {
  const emotion = video.emotion || "Neutral";
  const score = Math.round(Number(video.score) || 0);

  dom.videoScoreBadge.textContent = `Score: ${score} / 100`;
  dom.videoDetectedText.textContent = capitalize(emotion);
  dom.videoDetectedEmotion.querySelector('span:first-child').textContent = getEmotionEmoji(emotion);

  if (video.frames || video.sampled_frames || video.face_frames) {
    const f = video.frames || 0;
    const sf = video.sampled_frames || 0;
    const ff = video.face_frames || 0;
    dom.videoFrameStats.textContent = `Frames: ${f} · Sampled: ${sf} · Faces: ${ff}`;
  } else {
    dom.videoFrameStats.textContent = `Visual Facial Expression Analysis`;
  }

  renderProbabilityBars(
    dom.videoProbBars,
    video.probabilities,
    ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad']
  );
}

/**
 * 2. Voice / Audio Emotion
 */
function renderAudioEmotionSection(audio) {
  const emotion = audio.emotion || "Neutral";
  const score = Math.round(Number(audio.score) || 0);
  const confRaw = audio.confidence;
  let confPct = 80;
  if (typeof confRaw === 'number') {
    confPct = confRaw <= 1 ? Math.round(confRaw * 100) : Math.round(confRaw);
  }

  dom.audioScoreBadge.textContent = `Score: ${score} / 100`;
  dom.audioDetectedText.textContent = capitalize(emotion);
  dom.audioDetectedEmotion.querySelector('span:first-child').textContent = getEmotionEmoji(emotion);
  dom.audioConfidenceBadge.textContent = `Confidence: ${confPct}%`;

  renderProbabilityBars(
    dom.audioProbBars,
    audio.probabilities,
    ['Angry', 'Disgust', 'Fear', 'Happy', 'Neutral', 'Sad']
  );
}

/**
 * 3. Answer Quality
 */
function renderAnswerQualitySection(text) {
  const label = text.label || "Good";
  const score = Math.round(Number(text.score) || 0);

  dom.textScoreBadge.textContent = `Score: ${score} / 100`;
  dom.textQualityText.textContent = capitalize(label);

  const emoji = label.toLowerCase() === 'good' ? '⭐' : label.toLowerCase() === 'average' ? '⚖️' : '⚠️';
  dom.textQualityLabel.querySelector('span:first-child').textContent = emoji;

  renderProbabilityBars(
    dom.textProbBars,
    text.probabilities,
    ['Poor', 'Average', 'Good']
  );
}

/**
 * 4. Speaking & Fluency
 */
function renderFluencySection(fluency) {
  let fluencyScore = "--";
  let fillerCount = 0;
  let fillerWords = [];
  let extraEntries = [];

  if (typeof fluency === 'object' && fluency !== null) {
    if ('score' in fluency) fluencyScore = String(fluency.score);
    else if ('fluency_score' in fluency) fluencyScore = String(fluency.fluency_score);
    else if ('rating' in fluency) fluencyScore = String(fluency.rating);

    if ('filler_count' in fluency) fillerCount = Number(fluency.filler_count) || 0;
    else if ('fillers_count' in fluency) fillerCount = Number(fluency.fillers_count) || 0;
    else if ('count' in fluency) fillerCount = Number(fluency.count) || 0;
    else if (Array.isArray(fluency.fillers)) fillerCount = fluency.fillers.length;

    if (Array.isArray(fluency.filler_words)) {
      fillerWords = fluency.filler_words;
    } else if (Array.isArray(fluency.fillers)) {
      fillerWords = fluency.fillers;
    } else if (typeof fluency.filler_words === 'object' && fluency.filler_words !== null) {
      fillerWords = Object.entries(fluency.filler_words).map(([w, c]) => `${w} (${c})`);
    } else if (typeof fluency.fillers === 'object' && fluency.fillers !== null) {
      fillerWords = Object.entries(fluency.fillers).map(([w, c]) => `${w} (${c})`);
    }

    Object.keys(fluency).forEach(k => {
      const lower = k.toLowerCase();
      if (!lower.includes('filler') && !lower.includes('score')) {
        const val = fluency[k];
        if (typeof val === 'string' || typeof val === 'number') {
          extraEntries.push({ key: formatKeyName(k), value: String(val) });
        }
      }
    });
  } else if (typeof fluency === 'number') {
    fluencyScore = String(fluency);
  }

  dom.fluencyScoreVal.textContent = fluencyScore;
  dom.fluencyFillerCount.textContent = String(fillerCount);
  dom.fluencyStatusBadge.textContent = fillerCount <= 2 ? "High Fluency" : fillerCount <= 5 ? "Moderate Fluency" : "Needs Practice";

  dom.fluencyFillersContainer.innerHTML = '';
  if (fillerWords.length > 0) {
    fillerWords.forEach(word => {
      const chip = document.createElement('span');
      chip.className = 'filler-chip';
      chip.innerHTML = `⚠️ <span>${word}</span>`;
      dom.fluencyFillersContainer.appendChild(chip);
    });
  } else if (fillerCount === 0) {
    dom.fluencyFillersContainer.innerHTML = `
      <span style="font-size: 0.85rem; color: var(--success); font-weight: 600;">
        ✓ Excellent! No disruptive filler words detected.
      </span>
    `;
  } else {
    dom.fluencyFillersContainer.innerHTML = `
      <span style="font-size: 0.85rem; color: var(--text-muted);">
        Total ${fillerCount} filler word(s) identified.
      </span>
    `;
  }

  if (extraEntries.length > 0) {
    dom.fluencyDynamicDetails.innerHTML = extraEntries.map(e => `
      <div style="display: inline-block; background: var(--bg-subtle); border: 1px solid var(--border-color); padding: 4px 10px; border-radius: 6px; margin: 3px 6px 3px 0;">
        <strong>${e.key}:</strong> ${e.value}
      </div>
    `).join('');
  } else {
    dom.fluencyDynamicDetails.innerHTML = '';
  }
}

/**
 * Probability distribution bar renderer
 */
function renderProbabilityBars(container, probsObj, expectedKeys) {
  container.innerHTML = '';

  const normalized = normalizeProbabilities(probsObj, expectedKeys);

  normalized.forEach(item => {
    const row = document.createElement('div');
    row.className = 'prob-bar-row';
    row.innerHTML = `
      <span class="prob-label">${item.label}</span>
      <div class="prob-track">
        <div class="prob-fill" style="width: ${item.pct}%;"></div>
      </div>
      <span class="prob-pct">${item.pct}%</span>
    `;
    container.appendChild(row);
  });
}

function normalizeProbabilities(probs, expectedKeys) {
  const result = [];
  const map = {};

  if (typeof probs === 'object' && probs !== null) {
    if (Array.isArray(probs)) {
      probs.forEach(item => {
        if (typeof item === 'object' && item !== null) {
          const key = item.label || item.emotion || item.name || Object.keys(item)[0];
          const val = item.prob ?? item.probability ?? item.score ?? Object.values(item)[0];
          if (key) map[key.toLowerCase()] = Number(val);
        }
      });
    } else {
      Object.keys(probs).forEach(k => {
        map[k.toLowerCase()] = Number(probs[k]);
      });
    }
  }

  expectedKeys.forEach(k => {
    const rawVal = map[k.toLowerCase()];
    let pct = 0;
    if (typeof rawVal === 'number' && !isNaN(rawVal)) {
      pct = rawVal <= 1 ? Math.round(rawVal * 100) : Math.round(rawVal);
    }
    result.push({
      label: k,
      pct: Math.max(0, Math.min(100, pct))
    });
  });

  return result;
}

/**
 * Question breakdown card list
 */
function renderQuestionCardsList(questionResults) {
  dom.resQuestionWiseList.innerHTML = '';

  questionResults.forEach((qItem, idx) => {
    const res = qItem.result;
    const finalScore = (res.final && typeof res.final.score === 'number') ? res.final.score : 80;
    const grade = (res.final && res.final.grade) || (finalScore >= 80 ? "Good" : finalScore >= 60 ? "Average" : "Poor");

    const vEmotion = res.video ? capitalize(res.video.emotion || 'Neutral') : 'Neutral';
    const aEmotion = res.audio ? capitalize(res.audio.emotion || 'Neutral') : 'Neutral';
    const textLabel = res.text ? capitalize(res.text.label || 'Good') : 'Good';
    const transcript = res.transcript || "(No transcript)";

    const card = document.createElement('div');
    card.className = 'q-card-item';
    card.innerHTML = `
      <div class="q-card-top">
        <div>
          <span class="badge-pill badge-hr">Question ${idx + 1}</span>
          <h4 class="q-card-heading">"${qItem.question}"</h4>
        </div>
        <div class="q-card-score">Score: ${finalScore} / 100 (${grade})</div>
      </div>
      <div class="q-card-metrics-row">
        <div>Facial Emotion: <strong>${vEmotion}</strong></div>
        <div>Voice Emotion: <strong>${aEmotion}</strong></div>
        <div>Answer Quality: <strong>${textLabel}</strong></div>
      </div>
      <div style="font-size: 0.875rem; color: var(--text-secondary); background: var(--bg-subtle); padding: 10px 14px; border-radius: 8px; margin-top: 8px;">
        <strong>Transcript:</strong> "${transcript}"
      </div>
    `;
    dom.resQuestionWiseList.appendChild(card);
  });
}

// Helpers
function capitalize(str) {
  if (!str) return '';
  return String(str).charAt(0).toUpperCase() + String(str).slice(1).toLowerCase();
}

function getEmotionEmoji(emotion) {
  const e = (emotion || '').toLowerCase();
  switch (e) {
    case 'happy': return '😊';
    case 'neutral': return '😐';
    case 'sad': return '😢';
    case 'angry': return '😠';
    case 'fear': return '😨';
    case 'disgust': return '🤢';
    default: return '🎭';
  }
}

function formatKeyName(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// ==========================================================================
// 14. EVENT LISTENERS
// ==========================================================================
function setupEventListeners() {
  // Brand Logo Click -> Go to Dashboard
  if (dom.brandLogo) {
    dom.brandLogo.addEventListener('click', () => switchView('dashboard'));
  }

  // Navigation Links
  dom.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-target');
      if (target === 'start') {
        switchView('setup');
      } else if (target === 'history') {
        displayInterviewHistory();
        switchView('history');
      } else {
        switchView('dashboard');
      }
    });
  });

  // Profile Button Action
  if (dom.navProfileBtn) {
    dom.navProfileBtn.addEventListener('click', () => {
      displayInterviewHistory();
      switchView('history');
    });
  }

  // Dashboard Start Button
  if (dom.btnDashStart) {
    dom.btnDashStart.addEventListener('click', () => switchView('setup'));
  }

  // Dashboard View All History Button
  if (dom.btnViewAllHistory) {
    dom.btnViewAllHistory.addEventListener('click', () => {
      displayInterviewHistory();
      switchView('history');
    });
  }

  // Setup: Type selection
  dom.typeCards.forEach(card => {
    card.addEventListener('click', () => {
      dom.typeCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedType = card.getAttribute('data-setup-type');
    });
  });

  // Setup: Difficulty selection
  dom.diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.diffBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedDifficulty = btn.getAttribute('data-setup-diff');
    });
  });

  // Setup: Number of questions selection
  dom.countBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      dom.countBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.selectedCount = parseInt(btn.getAttribute('data-setup-count'), 10) || 5;
    });
  });

  // Setup Actions
  if (dom.btnBeginInterview) {
    dom.btnBeginInterview.addEventListener('click', beginInterviewSession);
  }
  if (dom.btnSetupBack) {
    dom.btnSetupBack.addEventListener('click', () => switchView('dashboard'));
  }

  // Camera Enable Buttons
  if (dom.btnNavEnableCamera) {
    dom.btnNavEnableCamera.addEventListener('click', initWebcam);
  }
  if (dom.btnSetupEnableCamera) {
    dom.btnSetupEnableCamera.addEventListener('click', initWebcam);
  }
  if (dom.btnRetryCamera) {
    dom.btnRetryCamera.addEventListener('click', initWebcam);
  }

  // Interview Controls
  if (dom.btnStartAnswer) {
    dom.btnStartAnswer.addEventListener('click', startRecordingAnswer);
  }
  if (dom.btnStopAnswer) {
    dom.btnStopAnswer.addEventListener('click', stopRecordingAnswer);
  }
  if (dom.btnRetakeAnswer) {
    dom.btnRetakeAnswer.addEventListener('click', retakeCurrentAnswer);
  }
  if (dom.btnNextQuestion) {
    dom.btnNextQuestion.addEventListener('click', handleNextQuestion);
  }
  if (dom.btnExitInterview) {
    dom.btnExitInterview.addEventListener('click', () => {
      if (confirm("Exit the ongoing interview session? Unsaved progress will be lost.")) {
        stopWebcam();
        switchView('dashboard');
      }
    });
  }

  // Completion View
  if (dom.btnAnalyzeMyInterview) {
    dom.btnAnalyzeMyInterview.addEventListener('click', triggerAIAnalysis);
  }

  // Loading View Error Buttons
  if (dom.btnLoadingRetry) {
    dom.btnLoadingRetry.addEventListener('click', triggerAIAnalysis);
  }
  if (dom.btnLoadingCheckHealth) {
    dom.btnLoadingCheckHealth.addEventListener('click', async () => {
      dom.loadQuestionProgress.textContent = "Checking GET http://localhost:5000/health...";
      const health = await checkBackendHealth();
      if (health.ok) {
        alert("✅ Backend server is online and responding at http://localhost:5000/health!\n\nNote: The backend service is running and reachable.");
      } else {
        alert(`❌ Could not connect to http://localhost:5000/health:\n${health.error}\n\nPlease verify that your Flask server is running on port 5000 with CORS enabled.`);
      }
    });
  }
  if (dom.btnLoadingCancel) {
    dom.btnLoadingCancel.addEventListener('click', () => switchView('completion'));
  }

  // Results Action Buttons
  if (dom.btnResultsPracticeAgain) {
    dom.btnResultsPracticeAgain.addEventListener('click', () => switchView('setup'));
  }
  if (dom.btnResultsViewHistory) {
    dom.btnResultsViewHistory.addEventListener('click', () => {
      displayInterviewHistory();
      switchView('history');
    });
  }
  if (dom.btnResultsPrint) {
    dom.btnResultsPrint.addEventListener('click', () => window.print());
  }

  // History View
  if (dom.btnHistoryStartNew) {
    dom.btnHistoryStartNew.addEventListener('click', () => switchView('setup'));
  }
}

// ==========================================================================
// 15. INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  updateDashboardAnalytics();
  displayInterviewHistory();
  switchView('dashboard');
  console.log("Smart Interview Analyzer connected to Flask backend at http://localhost:5000");
});