const STORAGE_KEY = "animeLocalBlog.v1";
const DB_NAME = "animeLocalBlogDB";
const DB_VERSION = 1;
const DB_STORE = "state";
const DB_STATE_KEY = "main";
const defaultFocusSubjects = [
  { id: "math", name: "数学", color: "#ff6fae", locked: true },
  { id: "english", name: "英语", color: "#4fc3f7", locked: true },
  { id: "signal", name: "信号", color: "#54d6a2", locked: true },
  { id: "politics", name: "政治", color: "#ffbd5a", locked: true }
];

const seedMarkdown = `# 欢迎来到星屑笔记

这是你的本地优先个人博客。你可以在这里写 Markdown、做每日打卡、上传照片并自由摆放。

## 可以先试试

- 在右侧实时预览 Markdown
- 把文章设为草稿或发布
- 上传一张二次元背景图
- 在照片墙拖动照片

\`\`\`js
console.log("未来这里可以接入联网 API");
\`\`\`
`;

const defaultState = {
  settings: {
    blogName: "星屑笔记",
    blogSignature: "Local-first Blog Studio",
    theme: "light",
    background: "",
    bgOpacity: 0.86,
    bgMode: "character",
    bgPosition: "right bottom",
    uiOpacity: 0.66,
    blurAmount: 10,
    bodyFontSize: 17,
    readerFocusMode: false,
    avatar: "",
    sidebarCollapsed: false,
    musicSrc: "",
    musicName: "默认轻音乐",
    musicVolume: 0.35,
    dailyWordGoal: 30
  },
  exam: {
    targetDate: "2026-12-26",
    goalText: "稳住节奏，完成每日计划",
    focusMode: false,
    heatmapMode: "daily",
    unlockedBadges: [],
    reports: [],
    reviews: [],
    memoryItems: [],
    memoryRecords: []
  },
  profile: {
    name: "关于我",
    bio: "这里可以写你的介绍、方向、作品和联系方式。",
    links: ""
  },
  posts: [
    {
      id: crypto.randomUUID(),
      title: "第一篇本地博客",
      summary: "一个从本地出发、未来可以联网的博客工作台。",
      tags: ["博客", "Markdown", "本地优先"],
      category: "技术",
      status: "published",
      date: todayKey(),
      content: seedMarkdown,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ],
  tasks: [],
  photos: [],
  photoWalls: [],
  activePhotoWallId: "",
  focusRecords: [],
  achievements: {
    unlocked: []
  },
  words: [
    { id: crypto.randomUUID(), word: "abandon", meaning: "放弃；抛弃", example: "Do not abandon your plan.", level: 0, reviews: 0, nextReview: todayKey(), lastReview: "" },
    { id: crypto.randomUUID(), word: "accurate", meaning: "准确的；精确的", example: "The data must be accurate.", level: 0, reviews: 0, nextReview: todayKey(), lastReview: "" },
    { id: crypto.randomUUID(), word: "contribute", meaning: "贡献；促成；投稿", example: "Exercise contributes to health.", level: 0, reviews: 0, nextReview: todayKey(), lastReview: "" },
    { id: crypto.randomUUID(), word: "significant", meaning: "重要的；显著的", example: "This is a significant change.", level: 0, reviews: 0, nextReview: todayKey(), lastReview: "" },
    { id: crypto.randomUUID(), word: "analysis", meaning: "分析", example: "The analysis is convincing.", level: 0, reviews: 0, nextReview: todayKey(), lastReview: "" }
  ],
  wordCheckins: [],
  wordReviewRecords: [],
  wordNewStudyRecords: [],
  meta: {
    lastSavedAt: "",
    lastBackupAt: ""
  },
  timer: {
    mode: "pomodoro",
    focusMinutes: 25,
    breakMinutes: 5,
    activeSubjectId: "math",
    subjects: structuredClone(defaultFocusSubjects)
  }
};

const api = {
  db: null,
  serverReady: location.protocol.startsWith("http"),
  openDb() {
    if (!("indexedDB" in window)) return Promise.resolve(null);
    if (this.db) return Promise.resolve(this.db);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = () => reject(request.error);
    });
  },
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    try {
      return { ...structuredClone(defaultState), ...JSON.parse(raw) };
    } catch {
      return structuredClone(defaultState);
    }
  },
  async loadFull() {
    const db = await this.openDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const request = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(DB_STATE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },
  async loadServer() {
    if (!this.serverReady) return null;
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) return null;
      const payload = await response.json();
      return payload.state || null;
    } catch (error) {
      this.serverReady = false;
      console.warn("Local server load failed", error);
      return null;
    }
  },
  compact(nextState) {
    return {
      ...nextState,
      settings: {
        ...nextState.settings,
        background: "",
        avatar: "",
        musicSrc: ""
      },
      photoWalls: nextState.photoWalls.map((wall) => ({ ...wall, photos: [] })),
      photos: []
    };
  },
  save(nextState) {
    nextState.meta = { ...(nextState.meta || {}), lastSavedAt: new Date().toISOString() };
    this.saveServer(nextState).catch((error) => console.error("Local file save failed", error));
    this.saveFull(nextState).catch((error) => console.error("IndexedDB save failed", error));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.compact(nextState)));
  },
  async saveServer(nextState) {
    if (!this.serverReady) return;
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextState)
    });
    if (!response.ok) throw new Error("Local server rejected state save");
  },
  async saveFull(nextState) {
    const db = await this.openDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const request = db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).put(nextState, DB_STATE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
  async uploadDataUrl(kind, name, dataUrl) {
    if (!this.serverReady) return dataUrl;
    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name, dataUrl })
      });
      if (!response.ok) throw new Error("Upload failed");
      const payload = await response.json();
      return payload.url || dataUrl;
    } catch (error) {
      console.error("Local file upload failed", error);
      return dataUrl;
    }
  },
  async futureSync() {
    return { ok: true, mode: "local" };
  }
};

let state = normalizeState(api.load());
let initialDataLoaded = false;
let currentView = "home";
let activePostId = state.posts[0]?.id || null;
let activeTag = "全部";
let activeTaskFilter = "today";
let activeTaskDate = todayKey();
let activeTaskType = "";
let activeTaskView = "list";
let activeTaskMenuTarget = null;
let collapsedTaskIds = new Set();
let currentMonthDate = new Date();
let dragState = null;
let taskDragState = null;
let activeWordMode = "review";
let activeWordOverviewFilter = "all";
let activeWordOverviewPage = 1;
const WORD_OVERVIEW_PAGE_SIZE = 80;
let activeWordLibraryPage = 1;
const WORD_LIBRARY_PAGE_SIZE = 40;
let wordFamiliarityCache = new Map();
let wordFamiliarityCacheDay = todayKey();
let timerInterval = null;
let timerRunning = false;
let timerRemaining = 25 * 60;
let timerElapsed = 0;
let timerStartedAt = 0;
let timerStartRemaining = timerRemaining;
let activeFocusRange = "week";
let activeFocusTaskId = null;
let avatarCrop = null;
let activeWordId = null;
let wordRevealed = false;
let musicAudio = new Audio();
let musicPlaying = false;
let musicAutoplayArmed = false;
let synthContext = null;
let synthTimer = null;
let synthStep = 0;
let lastTrailAt = 0;
let cursorVisible = false;
let autoSaveTimer = null;
let achievementToastTimer = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const taskTypeLabels = { work: "工作", study: "学习", life: "生活" };
const taskPriorityLabels = { high: "\u9ad8\u4f18\u5148", medium: "\u4e2d\u4f18\u5148", low: "\u4f4e\u4f18\u5148", none: "\u65e0\u4f18\u5148" };
const taskPriorityRank = { high: 3, medium: 2, low: 1, none: 0 };

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthTitle(date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function normalizeState(nextState) {
  const normalized = {
    ...structuredClone(defaultState),
    ...nextState,
  settings: {
      ...structuredClone(defaultState.settings),
      ...(nextState.settings || {})
    },
    profile: {
      ...structuredClone(defaultState.profile),
      ...(nextState.profile || {})
    },
    exam: {
      ...structuredClone(defaultState.exam),
      ...(nextState.exam || {}),
      unlockedBadges: nextState.exam?.unlockedBadges || [],
      reports: nextState.exam?.reports || [],
      reviews: nextState.exam?.reviews || [],
      memoryItems: nextState.exam?.memoryItems || [],
      memoryRecords: nextState.exam?.memoryRecords || []
    },
    achievements: {
      ...structuredClone(defaultState.achievements),
      ...(nextState.achievements || {}),
      unlocked: nextState.achievements?.unlocked || []
    }
  };
  normalized.focusRecords = nextState.focusRecords || [];
  normalized.words = nextState.words || structuredClone(defaultState.words);
  normalized.tasks = (nextState.tasks || []).map((task) => ({
    ...task,
    pinned: Boolean(task.pinned),
    priority: task.priority || "none",
    subjectId: task.subjectId || "",
    completedDate: task.completedDate || (task.done ? task.date : ""),
    subtasks: (task.subtasks || []).map((subtask) => ({
      ...subtask,
      completedDate: subtask.completedDate || (subtask.done ? (task.completedDate || task.date) : "")
    }))
  }));
  normalized.wordCheckins = nextState.wordCheckins || [];
  normalized.wordReviewRecords = nextState.wordReviewRecords || [];
  normalized.wordNewStudyRecords = nextState.wordNewStudyRecords || [];
  normalized.meta = {
    ...structuredClone(defaultState.meta),
    ...(nextState.meta || {})
  };
  if (nextState.photos?.length && nextState.photoWalls?.length) {
    normalized.photos = [];
  }
  if (!normalized.photoWalls?.length) {
    normalized.photoWalls = [{
      id: crypto.randomUUID(),
      name: "默认照片墙",
      photos: nextState.photos || []
    }];
  }
  normalized.activePhotoWallId = nextState.activePhotoWallId || normalized.photoWalls[0]?.id || "";
  normalized.timer = {
    ...structuredClone(defaultState.timer),
    ...(nextState.timer || {})
  };
  normalized.timer.subjects = normalizeFocusSubjects(normalized.timer.subjects);
  if (!normalized.timer.subjects.some((subject) => subject.id === normalized.timer.activeSubjectId)) {
    normalized.timer.activeSubjectId = normalized.timer.subjects[0]?.id || "math";
  }
  if (normalized.settings.background && Number(normalized.settings.bgOpacity) < 0.72) {
    normalized.settings.bgOpacity = 0.86;
  }
  return normalized;
}

function normalizeFocusSubjects(subjects = []) {
  const byId = new Map();
  [...defaultFocusSubjects, ...subjects].forEach((subject, index) => {
    if (!subject?.id || !subject?.name) return;
    byId.set(subject.id, {
      id: subject.id,
      name: subject.name,
      color: subject.color || focusSubjectColor(index),
      locked: Boolean(subject.locked || defaultFocusSubjects.some((item) => item.id === subject.id))
    });
  });
  return [...byId.values()];
}

function backgroundVars() {
  const mode = state.settings.bgMode || "character";
  const position = state.settings.bgPosition || "right bottom";
  if (mode === "cover") return { size: "cover", repeat: "no-repeat", position };
  if (mode === "contain") return { size: "contain", repeat: "no-repeat", position };
  if (mode === "repeat") return { size: "220px auto", repeat: "repeat", position };
  return { size: "auto min(76vh, 760px)", repeat: "no-repeat", position };
}

const els = {
  bgLayer: $("#bgLayer"),
  desktopTitlebar: $("#desktopTitlebar"),
  desktopMenuPopover: $("#desktopMenuPopover"),
  windowMinimizeBtn: $("#windowMinimizeBtn"),
  windowMaximizeBtn: $("#windowMaximizeBtn"),
  windowCloseBtn: $("#windowCloseBtn"),
  topbar: $(".topbar"),
  avatarButton: $("#avatarButton"),
  avatarFallback: $("#avatarFallback"),
  avatarImage: $("#avatarImage"),
  avatarUpload: $("#avatarUpload"),
  sidebarToggle: $("#sidebarToggle"),
  avatarCropModal: $("#avatarCropModal"),
  avatarConfirmModal: $("#avatarConfirmModal"),
  cropStage: $("#cropStage"),
  cropImage: $("#cropImage"),
  cropBox: $("#cropBox"),
  cancelAvatarCropBtn: $("#cancelAvatarCropBtn"),
  resetCropBtn: $("#resetCropBtn"),
  saveAvatarCropBtn: $("#saveAvatarCropBtn"),
  profileAvatarButton: $("#profileAvatarButton"),
  profileAvatarImage: $("#profileAvatarImage"),
  profileAvatarFallback: $("#profileAvatarFallback"),
  profileSignatureDisplay: $("#profileSignatureDisplay"),
  profilePostCount: $("#profilePostCount"),
  profileWallCount: $("#profileWallCount"),
  profileWordCount: $("#profileWordCount"),
  profileDashboard: $("#profileDashboard"),
  cancelAvatarChangeBtn: $("#cancelAvatarChangeBtn"),
  confirmAvatarChangeBtn: $("#confirmAvatarChangeBtn"),
  appConfirmModal: $("#appConfirmModal"),
  appConfirmEyebrow: $("#appConfirmEyebrow"),
  appConfirmTitle: $("#appConfirmTitle"),
  appConfirmMessage: $("#appConfirmMessage"),
  appConfirmCancelBtn: $("#appConfirmCancelBtn"),
  appConfirmOkBtn: $("#appConfirmOkBtn"),
  appInputModal: $("#appInputModal"),
  appInputEyebrow: $("#appInputEyebrow"),
  appInputTitle: $("#appInputTitle"),
  appInputMessage: $("#appInputMessage"),
  appInputLabel: $("#appInputLabel"),
  appInputControl: $("#appInputControl"),
  appInputCancelBtn: $("#appInputCancelBtn"),
  appInputOkBtn: $("#appInputOkBtn"),
  storageCount: $("#storageCount"),
  searchInput: $("#searchInput"),
  postGrid: $("#postGrid"),
  tagFilters: $("#tagFilters"),
  postForm: $("#postForm"),
  postTitle: $("#postTitle"),
  postSummary: $("#postSummary"),
  postTags: $("#postTags"),
  postCategory: $("#postCategory"),
  postStatus: $("#postStatus"),
  postDate: $("#postDate"),
  markdownInput: $("#markdownInput"),
  markdownPreview: $("#markdownPreview"),
  previewTitle: $("#previewTitle"),
  readerMeta: $("#readerMeta"),
  readerTitle: $("#readerTitle"),
  readerTags: $("#readerTags"),
  readerContent: $("#readerContent"),
  readerProgressBar: $("#readerProgressBar"),
  readerToc: $("#readerToc"),
  backToPostsBtn: $("#backToPostsBtn"),
  editCurrentPostBtn: $("#editCurrentPostBtn"),
  pinPostBtn: $("#pinPostBtn"),
  favoritePostBtn: $("#favoritePostBtn"),
  focusReadBtn: $("#focusReadBtn"),
  readerFocusExitBtn: $("#readerFocusExitBtn"),
  deletePostBtn: $("#deletePostBtn"),
  deleteReaderPostBtn: $("#deleteReaderPostBtn"),
  autosaveStatus: $("#autosaveStatus"),
  prevPostBtn: $("#prevPostBtn"),
  nextPostBtn: $("#nextPostBtn"),
  taskList: $("#taskList"),
  wordDueCount: $("#wordDueCount"),
  wordNewCount: $("#wordNewCount"),
  wordWrongCount: $("#wordWrongCount"),
  wordKnownCount: $("#wordKnownCount"),
  wordStreakCount: $("#wordStreakCount"),
  wordDailyGoal: $("#wordDailyGoal"),
  wordAddForm: $("#wordAddForm"),
  wordText: $("#wordText"),
  wordMeaning: $("#wordMeaning"),
  wordExample: $("#wordExample"),
  wordImportInput: $("#wordImportInput"),
  wordImportStatus: $("#wordImportStatus"),
  wordExportBtn: $("#wordExportBtn"),
  wordSearchInput: $("#wordSearchInput"),
  wordLibraryPager: $("#wordLibraryPager"),
  wordLibraryList: $("#wordLibraryList"),
  wordOverviewSearch: $("#wordOverviewSearch"),
  wordOverviewStats: $("#wordOverviewStats"),
  wordMemoryCurve: $("#wordMemoryCurve"),
  wordOverviewFilters: $("#wordOverviewFilters"),
  wordOverviewPager: $("#wordOverviewPager"),
  wordOverviewList: $("#wordOverviewList"),
  resetWordMemoryBtn: $("#resetWordMemoryBtn"),
  backToWordStudyBtn: $("#backToWordStudyBtn"),
  wordCard: $("#wordCard"),
  wordStage: $("#wordStage"),
  wordProgress: $("#wordProgress"),
  studyWord: $("#studyWord"),
  studyMeaning: $("#studyMeaning"),
  studyExample: $("#studyExample"),
  revealWordBtn: $("#revealWordBtn"),
  againWordBtn: $("#againWordBtn"),
  hardWordBtn: $("#hardWordBtn"),
  knownWordBtn: $("#knownWordBtn"),
  wordPlanList: $("#wordPlanList"),
  checkinForm: $("#checkinForm"),
  checkinText: $("#checkinText"),
  checkinDate: $("#checkinDate"),
  tomorrowTaskBtn: $("#tomorrowTaskBtn"),
  checkinType: $("#checkinType"),
  checkinSubject: $("#checkinSubject"),
  streakCount: $("#streakCount"),
  calendarStrip: $("#calendarStrip"),
  photoStatus: $("#photoStatus"),
  photoWall: $("#photoWall"),
  wallSwitcher: $("#wallSwitcher"),
  addPhotoWallBtn: $("#addPhotoWallBtn"),
  renameWallBtn: $("#renameWallBtn"),
  duplicateWallBtn: $("#duplicateWallBtn"),
  deleteWallBtn: $("#deleteWallBtn"),
  archiveList: $("#archiveList"),
  dataGrid: $("#dataGrid"),
  dataDashboard: $("#dataDashboard"),
  dataHealth: $("#dataHealth"),
  exportAllDataBtn: $("#exportAllDataBtn"),
  clearFocusDataBtn: $("#clearFocusDataBtn"),
  clearDoneTasksBtn: $("#clearDoneTasksBtn"),
  resetDataBtn: $("#resetDataBtn"),
  desktopDataPanel: $("#desktopDataPanel"),
  desktopDataPath: $("#desktopDataPath"),
  desktopDataStatus: $("#desktopDataStatus"),
  openDesktopDataBtn: $("#openDesktopDataBtn"),
  desktopBackupBtn: $("#desktopBackupBtn"),
  desktopRestoreBtn: $("#desktopRestoreBtn"),
  aboutForm: $("#aboutForm"),
  aboutName: $("#aboutName"),
  aboutBio: $("#aboutBio"),
  profileName: $("#profileName"),
  profileBio: $("#profileBio"),
  profileLinks: $("#profileLinks"),
  settingsForm: $("#settingsForm"),
  settingsPreviewAvatar: $("#settingsPreviewAvatar"),
  settingsPreviewFallback: $("#settingsPreviewFallback"),
  settingsPreviewName: $("#settingsPreviewName"),
  settingsPreviewSignature: $("#settingsPreviewSignature"),
  settingsPreviewBg: $("#settingsPreviewBg"),
  settingsPreviewMusic: $("#settingsPreviewMusic"),
  settingsPreviewWalls: $("#settingsPreviewWalls"),
  blogName: $("#blogName"),
  blogSignature: $("#blogSignature"),
  backgroundUpload: $("#backgroundUpload"),
  backgroundPreview: $("#backgroundPreview"),
  backgroundStatus: $("#backgroundStatus"),
  clearBackgroundBtn: $("#clearBackgroundBtn"),
  musicToggleBtn: $("#musicToggleBtn"),
  musicUpload: $("#musicUpload"),
  musicStatus: $("#musicStatus"),
  musicVolume: $("#musicVolume"),
  clearMusicBtn: $("#clearMusicBtn"),
  bgOpacity: $("#bgOpacity"),
  uiOpacity: $("#uiOpacity"),
  blurAmount: $("#blurAmount"),
  bodyFontSize: $("#bodyFontSize"),
  dailyWordGoal: $("#dailyWordGoal"),
  bgMode: $("#bgMode"),
  bgPosition: $("#bgPosition"),
  taskViewTitle: $("#taskViewTitle"),
  taskSectionLabel: $("#taskSectionLabel"),
  tickLayout: $(".tick-layout"),
  taskListView: $("#taskListView"),
  taskMonthView: $("#taskMonthView"),
  taskScheduleView: $("#taskScheduleView"),
  taskListViewBtn: $("#taskListViewBtn"),
  taskMonthViewBtn: $("#taskMonthViewBtn"),
  taskScheduleViewBtn: $("#taskScheduleViewBtn"),
  monthTitle: $("#monthTitle"),
  monthGrid: $("#monthGrid"),
  scheduleList: $("#scheduleList"),
  prevMonthBtn: $("#prevMonthBtn"),
  nextMonthBtn: $("#nextMonthBtn"),
  todayMonthBtn: $("#todayMonthBtn"),
  clearDoneBtn: $("#clearDoneBtn"),
  todayTaskCount: $("#todayTaskCount"),
  recentTaskCount: $("#recentTaskCount"),
  doneTaskCount: $("#doneTaskCount"),
  workTaskCount: $("#workTaskCount"),
  studyTaskCount: $("#studyTaskCount"),
  lifeTaskCount: $("#lifeTaskCount"),
  examFocusToggleBtn: $("#examFocusToggleBtn"),
  examReportBtn: $("#examReportBtn"),
  examTargetForm: $("#examTargetForm"),
  examTargetDate: $("#examTargetDate"),
  examGoalText: $("#examGoalText"),
  examCountdownDays: $("#examCountdownDays"),
  examStageText: $("#examStageText"),
  examStats: $("#examStats"),
  examReportList: $("#examReportList"),
  examTodayDate: $("#examTodayDate"),
  examStartGrid: $("#examStartGrid"),
  examReviewForm: $("#examReviewForm"),
  examReviewDate: $("#examReviewDate"),
  examReviewType: $("#examReviewType"),
  examReviewContent: $("#examReviewContent"),
  examReviewNext: $("#examReviewNext"),
  examReviewList: $("#examReviewList"),
  examMemoryForm: $("#examMemoryForm"),
  examMemoryTitle: $("#examMemoryTitle"),
  examMemorySubject: $("#examMemorySubject"),
  examMemoryContent: $("#examMemoryContent"),
  examMemoryDueCount: $("#examMemoryDueCount"),
  examMemoryList: $("#examMemoryList"),
  examBadges: $("#examBadges"),
  examHeatmapMode: $("#examHeatmapMode"),
  examHeatmapRange: $("#examHeatmapRange"),
  examHeatmap: $("#examHeatmap"),
  pomodoroModeBtn: $("#pomodoroModeBtn"),
  stopwatchModeBtn: $("#stopwatchModeBtn"),
  timerRing: $("#timerRing"),
  timerRingProgress: $("#timerRingProgress"),
  timerLabel: $("#timerLabel"),
  timerDisplay: $("#timerDisplay"),
  timerStartBtn: $("#timerStartBtn"),
  timerSaveBtn: $("#timerSaveBtn"),
  timerResetBtn: $("#timerResetBtn"),
  focusMinutes: $("#focusMinutes"),
  breakMinutes: $("#breakMinutes"),
  focusSubjectSelect: $("#focusSubjectSelect"),
  focusSubjectName: $("#focusSubjectName"),
  addFocusSubjectBtn: $("#addFocusSubjectBtn"),
  focusPieChart: $("#focusPieChart"),
  focusSubjectLegend: $("#focusSubjectLegend"),
  focusSubjectList: $("#focusSubjectList"),
  focusChartTotal: $("#focusChartTotal"),
  focusChartDate: $("#focusChartDate"),
  focusRangeSwitch: $("#focusRangeSwitch"),
  focusStackChart: $("#focusStackChart"),
  todayPomodoroCount: $("#todayPomodoroCount"),
  todayFocusMinutes: $("#todayFocusMinutes"),
  totalPomodoroCount: $("#totalPomodoroCount"),
  totalFocusMinutes: $("#totalFocusMinutes"),
  focusRecords: $("#focusRecords"),
  achievementHeroProgress: $("#achievementHeroProgress"),
  achievementStats: $("#achievementStats"),
  achievementGrid: $("#achievementGrid"),
  achievementToast: $("#achievementToast"),
  clearFocusRecordsBtn: $("#clearFocusRecordsBtn"),
  exportBtn: $("#exportBtn"),
  importInput: $("#importInput")
};

function renderCurrentView(view = currentView) {
  applyTheme();
  syncTaskDateInput(activeTaskDate || todayKey());
  if (view === "home") {
    renderTags();
    renderPosts();
  } else if (view === "editor") {
    loadPost(activePostId);
  } else if (view === "reader") {
    renderReader();
  } else if (view === "checkins") {
    renderTasks();
    renderTaskViewMode();
  } else if (view === "exam") {
    renderExam();
  } else if (view === "words") {
    renderWords();
  } else if (view === "word-overview") {
    renderWordOverview();
  } else if (view === "pomodoro") {
    renderTimer();
  } else if (view === "achievements") {
    renderAchievements();
  } else if (view === "photos") {
    renderPhotos();
  } else if (view === "archive") {
    renderArchive();
  } else if (view === "about") {
    renderProfile();
  } else if (view === "settings") {
    renderSettings();
    updateSettingsNavHighlight();
  } else if (view === "data") {
    renderDataCenter();
  }
  if (els.storageCount) els.storageCount.textContent = `${state.posts.length} \u7bc7\u6587\u7ae0`;
}

function persist(scope = "current") {
  let saved = true;
  try {
    syncAchievements({ notify: true, save: false });
    api.save(state);
  } catch (error) {
    saved = false;
    console.error("Save failed", error);
  }
  if (scope === "all") render();
  else renderCurrentView();
  return saved;
}

function switchView(view) {
  const changed = currentView !== view;
  currentView = view;
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  $$(".view").forEach((panel) => panel.classList.toggle("active", panel.id === `view-${view}`));
  applyTheme();
  updateTopbarVisibility();
  renderCurrentView(view);
  if (changed) {
    requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  }
}

function updateTopbarVisibility() {
  const searchableViews = new Set(["home", "archive", "reader"]);
  els.topbar.classList.toggle("search-hidden", !searchableViews.has(currentView));
}

function applyTheme() {
  document.body.classList.toggle("dark", state.settings.theme === "dark");
  document.body.classList.toggle("has-custom-bg", Boolean(state.settings.background));
  document.body.classList.toggle("reader-focus-mode", Boolean(state.settings.readerFocusMode) && currentView === "reader");
  document.body.classList.toggle("exam-focus-mode", Boolean(state.exam?.focusMode) && currentView === "exam");
  document.querySelector(".app-shell")?.classList.toggle("sidebar-collapsed", Boolean(state.settings.sidebarCollapsed));
  const bg = backgroundVars();
  document.documentElement.style.setProperty("--custom-bg", state.settings.background ? `url("${state.settings.background}")` : "none");
  document.documentElement.style.setProperty("--preview-bg", state.settings.background ? `url("${state.settings.background}")` : "none");
  document.documentElement.style.setProperty("--bg-opacity", state.settings.bgOpacity);
  document.documentElement.style.setProperty("--bg-size", bg.size);
  document.documentElement.style.setProperty("--bg-repeat", bg.repeat);
  document.documentElement.style.setProperty("--bg-position", bg.position);
  document.documentElement.style.setProperty("--ui-alpha", state.settings.uiOpacity ?? 0.66);
  document.documentElement.style.setProperty("--ui-strong-alpha", Math.min(0.96, (state.settings.uiOpacity ?? 0.66) + 0.12));
  document.documentElement.style.setProperty("--blur-amount", `${state.settings.blurAmount ?? 10}px`);
  document.documentElement.style.setProperty("--body-font-size", `${state.settings.bodyFontSize ?? 17}px`);
  els.avatarButton.classList.toggle("has-avatar", Boolean(state.settings.avatar));
  els.avatarImage.src = state.settings.avatar || "";
  $(".brand h1").textContent = state.settings.blogName || "星屑笔记";
  $("#blogSignatureText").textContent = state.settings.blogSignature || "Local-first Blog Studio";
  if (els.sidebarToggle) {
    const collapsed = Boolean(state.settings.sidebarCollapsed);
    els.sidebarToggle.setAttribute("aria-pressed", String(collapsed));
    els.sidebarToggle.setAttribute("aria-label", collapsed ? "\u5c55\u5f00\u4fa7\u8fb9\u680f" : "\u6536\u8d77\u4fa7\u8fb9\u680f");
  }
  document.title = state.settings.blogName || "个人博客工作台";
}

function markdownToHtml(markdown) {
  const escape = (text) => text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

  const lines = markdown.split("\n");
  const html = [];
  let inCode = false;
  let listOpen = false;
  let quoteOpen = false;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      if (inCode) html.push("</code></pre>");
      else html.push("<pre><code>");
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html.push(`${escape(line)}\n`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      if (!listOpen) html.push("<ul>");
      listOpen = true;
      html.push(`<li>${inlineMarkdown(escape(line.replace(/^\s*[-*]\s+/, "")))}</li>`);
      continue;
    }
    if (listOpen) {
      html.push("</ul>");
      listOpen = false;
    }
    if (/^>\s?/.test(line)) {
      if (!quoteOpen) html.push("<blockquote>");
      quoteOpen = true;
      html.push(`<p>${inlineMarkdown(escape(line.replace(/^>\s?/, "")))}</p>`);
      continue;
    }
    if (quoteOpen) {
      html.push("</blockquote>");
      quoteOpen = false;
    }
    if (!line.trim()) {
      html.push("");
    } else if (line.startsWith("# ")) {
      html.push(`<h1>${inlineMarkdown(escape(line.slice(2)))}</h1>`);
    } else if (line.startsWith("## ")) {
      html.push(`<h2>${inlineMarkdown(escape(line.slice(3)))}</h2>`);
    } else if (line.startsWith("### ")) {
      html.push(`<h3>${inlineMarkdown(escape(line.slice(4)))}</h3>`);
    } else {
      html.push(`<p>${inlineMarkdown(escape(line))}</p>`);
    }
  }
  if (listOpen) html.push("</ul>");
  if (quoteOpen) html.push("</blockquote>");
  if (inCode) html.push("</code></pre>");
  return html.join("\n");
}

function inlineMarkdown(text) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function filteredPosts() {
  const query = els.searchInput.value.trim().toLowerCase();
  return state.posts
    .filter((post) => activeTag === "全部" || post.tags.includes(activeTag))
    .filter((post) => {
      const haystack = [post.title, post.summary, post.content, post.category, ...post.tags].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .sort(sortPosts);
}

function sortPosts(a, b) {
  if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
  return new Date(b.date) - new Date(a.date);
}

function orderedPosts() {
  return [...state.posts].sort(sortPosts);
}

function renderPosts() {
  const posts = filteredPosts();
  els.postGrid.innerHTML = "";
  if (!posts.length) {
    els.postGrid.append($("#emptyTemplate").content.cloneNode(true));
    renderWordLibrary();
    return;
  }
  for (const post of posts) {
    const card = document.createElement("article");
    const status = post.status === "draft" ? "\u8349\u7a3f" : "\u5df2\u53d1\u5e03";
    card.className = "post-card";
    card.innerHTML = `
      <div class="card-meta">
        <span>${post.pinned ? "\u7f6e\u9876 · " : ""}${post.date}</span>
        <span>${status}</span>
      </div>
      <h3>${post.title}</h3>
      <p>${post.summary || plainText(post.content).slice(0, 80)}</p>
      <div class="tag-row">${post.tags.map((tag) => `<span class="tag-pill">${tag}</span>`).join("")}</div>
      ${post.favorite ? '<span class="post-badge">\u6536\u85cf</span>' : ""}
      <button class="ghost-button" data-read="${post.id}">\u9605\u8bfb</button>
    `;
    els.postGrid.append(card);
  }
}

function renderReader() {
  const post = state.posts.find((item) => item.id === activePostId) || state.posts[0];
  if (!post) return;
  activePostId = post.id;
  els.readerTitle.textContent = post.title;
  els.readerMeta.textContent = `${post.date} · ${post.category} · ${post.status === "draft" ? "\u8349\u7a3f" : "\u5df2\u53d1\u5e03"}`;
  els.readerTags.innerHTML = post.tags.map((tag) => `<span class="tag-pill">${tag}</span>`).join("");
  els.readerContent.innerHTML = markdownToHtml(post.content || "");
  els.pinPostBtn.textContent = post.pinned ? "\u53d6\u6d88\u7f6e\u9876" : "\u7f6e\u9876";
  els.favoritePostBtn.textContent = post.favorite ? "\u53d6\u6d88\u6536\u85cf" : "\u6536\u85cf";
  els.focusReadBtn.textContent = state.settings.readerFocusMode ? "\u9000\u51fa\u4e13\u6ce8" : "\u4e13\u6ce8\u9605\u8bfb";
  applyTheme();
  renderReaderToc();
  renderReaderNav();
  updateReaderProgress();
}

function renderReaderToc() {
  const headings = [...els.readerContent.querySelectorAll("h1, h2, h3")];
  if (!headings.length) {
    els.readerToc.innerHTML = '<span class="muted">\u6682\u65e0\u76ee\u5f55</span>';
    return;
  }
  els.readerToc.innerHTML = headings.map((heading, index) => {
    const id = `heading-${index}`;
    heading.id = id;
    return `<a href="#${id}" class="toc-${heading.tagName.toLowerCase()}">${heading.textContent}</a>`;
  }).join("");
}

function renderReaderNav() {
  const posts = orderedPosts();
  const index = posts.findIndex((post) => post.id === activePostId);
  const prev = posts[index - 1];
  const next = posts[index + 1];
  els.prevPostBtn.disabled = !prev;
  els.nextPostBtn.disabled = !next;
  els.prevPostBtn.textContent = prev ? `\u4e0a\u4e00\u7bc7\uff1a${prev.title}` : "\u4e0a\u4e00\u7bc7";
  els.nextPostBtn.textContent = next ? `\u4e0b\u4e00\u7bc7\uff1a${next.title}` : "\u4e0b\u4e00\u7bc7";
}

function updateReaderProgress() {
  if (!els.readerProgressBar) return;
  if (currentView !== "reader") {
    els.readerProgressBar.style.width = "0%";
    return;
  }
  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const progress = Math.min(100, Math.max(0, window.scrollY / scrollable * 100));
  els.readerProgressBar.style.width = `${progress}%`;
}

function updateSettingsNavHighlight() {
  if (currentView !== "settings") return;
  const sections = $$(".settings-section");
  const active = sections
    .map((section) => ({ id: section.id, top: Math.abs(section.getBoundingClientRect().top - 120) }))
    .sort((a, b) => a.top - b.top)[0];
  if (!active) return;
  $$(".settings-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsTarget === active.id);
  });
}

let confirmResolver = null;
let inputResolver = null;

function showConfirm({ title, message, eyebrow = "Confirm", okText = "\u786e\u8ba4", cancelText = "\u53d6\u6d88", danger = false }) {
  if (confirmResolver) confirmResolver(false);
  els.appConfirmEyebrow.textContent = eyebrow;
  els.appConfirmTitle.textContent = title;
  els.appConfirmMessage.textContent = message;
  els.appConfirmOkBtn.textContent = okText;
  els.appConfirmCancelBtn.textContent = cancelText || "";
  els.appConfirmCancelBtn.hidden = !cancelText;
  els.appConfirmOkBtn.classList.toggle("danger-button", Boolean(danger));
  els.appConfirmModal.classList.add("active");
  els.appConfirmModal.setAttribute("aria-hidden", "false");
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function showInputModal({
  title,
  message = "",
  eyebrow = "Task",
  label = "内容",
  value = "",
  type = "text",
  okText = "保存",
  placeholder = "",
  options = null
}) {
  if (inputResolver) inputResolver(null);
  els.appInputEyebrow.textContent = eyebrow;
  els.appInputTitle.textContent = title;
  els.appInputMessage.textContent = message;
  els.appInputMessage.hidden = !message;
  els.appInputLabel.textContent = label;
  els.appInputOkBtn.textContent = okText;

  const previous = els.appInputControl;
  const control = options?.length ? document.createElement("select") : document.createElement("input");
  control.id = "appInputControl";
  control.className = previous.className;
  if (options?.length) {
    control.innerHTML = options.map((option) => `<option value="${option.value}">${option.label}</option>`).join("");
  } else {
    control.type = type;
    control.placeholder = placeholder;
  }
  control.value = value || "";
  previous.replaceWith(control);
  els.appInputControl = control;
  els.appInputModal.classList.add("active");
  els.appInputModal.setAttribute("aria-hidden", "false");
  setTimeout(() => {
    els.appInputControl.focus();
    els.appInputControl.select?.();
  }, 30);
  return new Promise((resolve) => {
    inputResolver = resolve;
  });
}

function closeInputModal(result = null) {
  els.appInputModal.classList.remove("active");
  els.appInputModal.setAttribute("aria-hidden", "true");
  if (inputResolver) {
    const resolve = inputResolver;
    inputResolver = null;
    resolve(result);
  }
}

function closeConfirm(result = false) {
  els.appConfirmModal.classList.remove("active");
  els.appConfirmModal.setAttribute("aria-hidden", "true");
  els.appConfirmOkBtn.classList.remove("danger-button");
  if (confirmResolver) {
    const resolve = confirmResolver;
    confirmResolver = null;
    resolve(result);
  }
}

async function deleteCurrentPost() {
  if (!activePostId) return;
  const post = state.posts.find((item) => item.id === activePostId);
  const ok = await showConfirm({
    eyebrow: "\u6587\u7ae0",
    title: "\u5220\u9664\u6587\u7ae0\uff1f",
    message: `\u786e\u5b9a\u5220\u9664\u300a${post?.title || "\u8fd9\u7bc7\u6587\u7ae0"}\u300b\u5417\uff1f\u8fd9\u4e2a\u64cd\u4f5c\u4e0d\u4f1a\u8fdb\u5165\u56de\u6536\u7ad9\u3002`,
    okText: "\u5220\u9664",
    danger: true
  });
  if (!ok) return;
  state.posts = state.posts.filter((post) => post.id !== activePostId);
  activePostId = state.posts[0]?.id || null;
  persist();
  switchView("home");
}

function plainText(markdown) {
  return markdown.replace(/[#*_`>\-\[\]()]/g, " ").replace(/\s+/g, " ").trim();
}

function renderTags() {
  const tags = ["全部", ...new Set(state.posts.flatMap((post) => post.tags))];
  els.tagFilters.innerHTML = tags.map((tag) => `<button class="chip ${tag === activeTag ? "active" : ""}" data-tag="${tag}">${tag}</button>`).join("");
}

function loadPost(id) {
  const post = state.posts.find((item) => item.id === id) || state.posts[0];
  if (!post) return;
  activePostId = post.id;
  els.postTitle.value = post.title;
  els.postSummary.value = post.summary;
  els.postTags.value = post.tags.join(", ");
  els.postCategory.value = post.category;
  els.postStatus.value = post.status;
  els.postDate.value = post.date;
  els.markdownInput.value = post.content;
  if (els.autosaveStatus) {
    els.autosaveStatus.textContent = "自动保存已就绪";
    els.autosaveStatus.classList.remove("is-saved");
  }
  updatePreview();
}

function updatePreview() {
  const title = els.postTitle.value || "Untitled";
  els.previewTitle.textContent = title;
  els.markdownPreview.innerHTML = markdownToHtml(els.markdownInput.value || "");
}

function currentPostPayload() {
  return {
    id: activePostId || crypto.randomUUID(),
    title: els.postTitle.value.trim() || "未命名文章",
    summary: els.postSummary.value.trim(),
    tags: els.postTags.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
    category: els.postCategory.value.trim() || "未分类",
    status: els.postStatus.value,
    date: els.postDate.value || new Date().toISOString().slice(0, 10),
    content: els.markdownInput.value,
    updatedAt: Date.now()
  };
}

function upsertPost(payload) {
  const index = state.posts.findIndex((post) => post.id === payload.id);
  if (index >= 0) state.posts[index] = { ...state.posts[index], ...payload };
  else state.posts.unshift({ ...payload, createdAt: Date.now() });
  activePostId = payload.id;
}

function savePost(event) {
  event.preventDefault();
  upsertPost(currentPostPayload());
  persist();
  switchView("home");
}

function autoSavePost() {
  if (currentView !== "editor") return;
  upsertPost(currentPostPayload());
  api.save(state);
  if (els.autosaveStatus) {
    els.autosaveStatus.textContent = `已自动保存 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`;
    els.autosaveStatus.classList.add("is-saved");
  }
}

function scheduleAutoSave() {
  updatePreview();
  if (els.autosaveStatus) {
    els.autosaveStatus.textContent = "正在编辑...";
    els.autosaveStatus.classList.remove("is-saved");
  }
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(autoSavePost, 900);
}

function createPost() {
  const today = todayKey();
  const post = {
    id: crypto.randomUUID(),
    title: "未命名文章",
    summary: "",
    tags: ["随笔"],
    category: "日常",
    status: "draft",
    date: today,
    content: "# 未命名文章\n\n",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  state.posts.unshift(post);
  activePostId = post.id;
  persist();
  switchView("editor");
}

function taskProgress(task) {
  const subtasks = task.subtasks || [];
  if (!subtasks.length) return "";
  const done = subtasks.filter((subtask) => subtask.done).length;
  return `<span class="task-progress">${done}/${subtasks.length}</span>`;
}

function taskSubtaskHtml(task) {
  if (collapsedTaskIds.has(task.id)) return "";
  return (task.subtasks || [])
    .sort((a, b) => taskSortOrder(b) - taskSortOrder(a))
    .map((subtask) => `
    <label class="subtask-item ${subtask.done ? "done" : ""}" data-subtask-id="${subtask.id}" draggable="true">
      <input type="checkbox" ${subtask.done ? "checked" : ""} data-subtask-toggle="${subtask.id}" />
      <span data-subtask-edit="${subtask.id}" title="双击修改子任务">${subtask.text}</span>
    </label>
  `).join("");
}

function isTaskOverdue(task, today = todayKey()) {
  return !task.done && task.date < today;
}

function taskSortOrder(task) {
  return Number.isFinite(Number(task.sortOrder)) ? Number(task.sortOrder) : Number(task.createdAt || 0);
}

function taskDateTitle(key) {
  const today = todayKey();
  const tomorrow = todayKey(addDays(new Date(), 1));
  const yesterday = todayKey(addDays(new Date(), -1));
  if (key === today) return "\u4eca\u5929";
  if (key === tomorrow) return "\u660e\u5929";
  if (key === yesterday) return "\u6628\u5929";
  const date = dateFromKey(key);
  const weekdays = ["\u5468\u65e5", "\u5468\u4e00", "\u5468\u4e8c", "\u5468\u4e09", "\u5468\u56db", "\u5468\u4e94", "\u5468\u516d"];
  return `${key.replaceAll("-", "/")} ${weekdays[date.getDay()]}`;
}

function syncTaskDateInput(key) {
  const nextKey = key || todayKey();
  activeTaskDate = nextKey;
  if (els.checkinDate) els.checkinDate.value = nextKey;
}

function jumpToTaskDate(key) {
  if (!key) return;
  syncTaskDateInput(key);
  activeTaskView = "list";
  activeTaskType = "";
  activeTaskFilter = key === todayKey() ? "today" : "date";
  currentMonthDate = dateFromKey(key);
  renderTaskViewMode();
  renderTasks();
}

function renderTasks() {
  renderFocusSubjects();
  const today = todayKey();
  const selectedDate = activeTaskDate || els.checkinDate?.value || today;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const sevenKey = todayKey(sevenDaysAgo);
  const isInTodayQueue = (task) => task.date === today || isTaskOverdue(task, today);
  const counts = {
    today: state.tasks.filter(isInTodayQueue).length,
    recent: state.tasks.filter((task) => task.date >= sevenKey).length,
    done: state.tasks.filter((task) => task.done).length,
    work: state.tasks.filter((task) => task.type === "work").length,
    study: state.tasks.filter((task) => task.type === "study").length,
    life: state.tasks.filter((task) => task.type === "life").length
  };
  els.todayTaskCount.textContent = counts.today;
  els.recentTaskCount.textContent = counts.recent;
  els.doneTaskCount.textContent = counts.done;
  els.workTaskCount.textContent = counts.work;
  els.studyTaskCount.textContent = counts.study;
  els.lifeTaskCount.textContent = counts.life;

  $$(".tick-nav").forEach((item) => item.classList.toggle("active", item.dataset.taskFilter === activeTaskFilter && !activeTaskType));
  $$(".tick-list").forEach((item) => item.classList.toggle("active", item.dataset.taskType === activeTaskType));

  let tasks = [...state.tasks];
  if (activeTaskType) {
    tasks = tasks.filter((task) => task.type === activeTaskType);
    els.taskViewTitle.textContent = taskTypeLabels[activeTaskType] || "清单";
    els.taskSectionLabel.textContent = "清单任务";
  } else if (activeTaskFilter === "recent") {
    tasks = tasks.filter((task) => task.date >= sevenKey);
    els.taskViewTitle.textContent = "最近7天";
    els.taskSectionLabel.textContent = "近期安排";
  } else if (activeTaskFilter === "done") {
    tasks = tasks.filter((task) => task.done);
    els.taskViewTitle.textContent = "已完成";
    els.taskSectionLabel.textContent = "完成记录";
  } else if (activeTaskFilter === "date") {
    tasks = tasks.filter((task) => task.date === selectedDate);
    els.taskViewTitle.textContent = taskDateTitle(selectedDate);
    els.taskSectionLabel.textContent = `${taskDateTitle(selectedDate)}\u5b89\u6392`;
  } else {
    tasks = tasks.filter(isInTodayQueue);
    els.taskViewTitle.textContent = "今天";
    els.taskSectionLabel.textContent = "今日安排";
  }
  tasks.sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(isTaskOverdue(b, today)) - Number(isTaskOverdue(a, today)) || Number(a.done) - Number(b.done) || (taskPriorityRank[b.priority || "none"] - taskPriorityRank[a.priority || "none"]) || b.date.localeCompare(a.date) || taskSortOrder(b) - taskSortOrder(a));
  els.taskList.innerHTML = tasks.length ? "" : '<div class="empty-state"><strong>这里还没有任务</strong><span>在上方输入框添加一条安排。</span></div>';
  for (const task of tasks) {
    const item = document.createElement("div");
    const hasSubtasks = Boolean(task.subtasks?.length);
    const overdue = isTaskOverdue(task, today);
    item.className = `task-item priority-${task.priority || "none"} ${task.done ? "done" : ""} ${task.pinned ? "pinned" : ""} ${hasSubtasks ? "has-subtasks" : ""} ${overdue ? "overdue" : ""}`;
    item.dataset.taskId = task.id;
    item.draggable = true;
    item.innerHTML = `
      <button class="task-expand" data-task-collapse="${task.id}" type="button">${hasSubtasks ? (collapsedTaskIds.has(task.id) ? "&rsaquo;" : "&#8964;") : ""}</button>
      <input type="checkbox" ${task.done ? "checked" : ""} data-task-toggle="${task.id}" />
      <div>
        <strong class="task-title" data-task-edit="${task.id}" title="\u53cc\u51fb\u4fee\u6539\u4efb\u52a1">${task.pinned ? "\u2605 " : ""}${task.text}</strong>
        <div class="task-type"><span class="priority-flag">${taskPriorityLabels[task.priority || "none"]}</span>${taskTypeLabels[task.type] || task.type}${taskSubjectLabel(task)}${taskProgress(task)}</div>
        <div class="subtask-list">${taskSubtaskHtml(task)}</div>
      </div>
      <span class="task-date">${overdue ? '<b>已逾期</b>' : ""}${task.date}</span>
      <button class="task-delete" data-task-delete="${task.id}" title="\u5220\u9664">\u00d7</button>
    `;
    els.taskList.append(item);
  }
  els.streakCount.textContent = `${calculateStreak()} 天`;
  renderCalendar();
  renderMonthView();
}

function findTask(taskId) {
  return state.tasks.find((task) => task.id === taskId);
}

function findSubtask(subtaskId) {
  for (const task of state.tasks) {
    const subtask = (task.subtasks || []).find((item) => item.id === subtaskId);
    if (subtask) return { task, subtask };
  }
  return {};
}

async function promptAddSubtask(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  const text = await showInputModal({
    eyebrow: "Subtask",
    title: "添加子任务",
    message: `给「${task.text}」添加一条子任务。`,
    label: "子任务",
    placeholder: "例如：整理资料"
  });
  if (!text?.trim()) return;
  task.subtasks = task.subtasks || [];
  task.subtasks.push({ id: crypto.randomUUID(), text: text.trim(), done: false, createdAt: Date.now(), sortOrder: Date.now() });
  persist();
}

async function promptEditTask(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  const text = await showInputModal({
    eyebrow: "Task",
    title: "修改任务",
    label: "任务",
    value: task.text,
    placeholder: "输入任务内容"
  });
  if (!text?.trim()) return;
  task.text = text.trim();
  persist();
}

async function promptEditSubtask(subtaskId) {
  const { subtask } = findSubtask(subtaskId);
  if (!subtask) return;
  const text = await showInputModal({
    eyebrow: "Subtask",
    title: "修改子任务",
    label: "子任务",
    value: subtask.text,
    placeholder: "输入子任务内容"
  });
  if (!text?.trim()) return;
  subtask.text = text.trim();
  persist();
}

function deleteTask(taskId) {
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
  persist();
}

function deleteSubtask(subtaskId) {
  const { task } = findSubtask(subtaskId);
  if (!task) return;
  task.subtasks = (task.subtasks || []).filter((item) => item.id !== subtaskId);
  persist();
}

async function promptMoveTaskDate(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  const nextDate = await showInputModal({
    eyebrow: "Date",
    title: "移动日期",
    message: `调整「${task.text}」的计划日期。`,
    label: "日期",
    type: "date",
    value: task.date || todayKey()
  });
  if (!nextDate?.trim()) return;
  task.date = nextDate.trim();
  persist();
}

async function promptChangeTaskType(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  const nextType = await showInputModal({
    eyebrow: "List",
    title: "修改分类",
    label: "分类",
    value: task.type || "work",
    options: [
      { value: "work", label: "工作任务" },
      { value: "study", label: "学习安排" },
      { value: "life", label: "个人备忘" }
    ]
  });
  if (!nextType?.trim()) return;
  const normalized = nextType.trim();
  if (!["work", "study", "life"].includes(normalized)) {
    await showConfirm({
      eyebrow: "\u63d0\u793a",
      title: "\u5206\u7c7b\u683c\u5f0f\u4e0d\u5bf9",
      message: "\u5206\u7c7b\u53ea\u80fd\u586b\u5199 work\u3001study \u6216 life\u3002",
      okText: "\u77e5\u9053\u4e86",
      cancelText: ""
    });
    return;
  }
  task.type = normalized;
  persist();
}

async function promptChangeTaskSubject(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  const subjects = normalizeFocusSubjects(state.timer.subjects);
  const subjectId = await showInputModal({
    eyebrow: "Focus",
    title: "绑定学习种类",
    label: "学习种类",
    value: task.subjectId || "",
    options: [
      { value: "", label: "不绑定科目" },
      ...subjects.map((subject) => ({ value: subject.id, label: subject.name }))
    ]
  });
  if (subjectId === null) return;
  task.subjectId = subjectId;
  persist();
}

function startFocusFromTask(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  activeFocusTaskId = task.id;
  if (task.subjectId && focusSubjectById(task.subjectId)) {
    state.timer.activeSubjectId = task.subjectId;
  }
  if (!timerRunning) {
    startTimer();
  }
  persist();
  switchView("pomodoro");
}

function toggleTaskPinned(taskId) {
  const task = findTask(taskId);
  if (!task) return;
  task.pinned = !task.pinned;
  persist();
}

function setTaskPriority(taskId, priority) {
  const task = findTask(taskId);
  if (!task) return;
  task.priority = priority;
  persist();
}

function toggleTaskCollapsed(taskId) {
  if (collapsedTaskIds.has(taskId)) collapsedTaskIds.delete(taskId);
  else collapsedTaskIds.add(taskId);
  renderTasks();
  renderTaskViewMode();
}

function taskContextMenu() {
  let menu = $("#taskContextMenu");
  if (menu) return menu;
  menu = document.createElement("div");
  menu.id = "taskContextMenu";
  menu.className = "task-context-menu";
  document.body.append(menu);
  return menu;
}

function hideTaskContextMenu() {
  const menu = $("#taskContextMenu");
  if (menu) menu.classList.remove("active");
  activeTaskMenuTarget = null;
}

function showTaskContextMenu(event, target) {
  activeTaskMenuTarget = target;
  const menu = taskContextMenu();
  const isSubtask = target.type === "subtask";
  menu.innerHTML = isSubtask ? `
    <button data-task-menu-action="edit-subtask" type="button"><span>&#9998;</span>\u4fee\u6539\u5b50\u4efb\u52a1</button>
    <button class="danger" data-task-menu-action="delete-subtask" type="button"><span>&times;</span>\u5220\u9664\u5b50\u4efb\u52a1</button>
  ` : `
    <button class="primary-row" data-task-menu-action="add-subtask" type="button"><span>&#8627;</span>\u6dfb\u52a0\u5b50\u4efb\u52a1</button>
    <button data-task-menu-action="start-focus" type="button"><span>◴</span>开始专注</button>
    <button data-task-menu-action="edit-task" type="button"><span>&#9998;</span>\u4fee\u6539\u4efb\u52a1</button>
    <button data-task-menu-action="move-date" type="button"><span>\u65e5</span>\u79fb\u52a8\u65e5\u671f</button>
    <button data-task-menu-action="change-type" type="button"><span>\u7c7b</span>\u4fee\u6539\u5206\u7c7b</button>
    <button data-task-menu-action="change-subject" type="button"><span>科</span>绑定科目</button>
    <button data-task-menu-action="priority-high" type="button"><span>!</span>\u9ad8\u4f18\u5148</button>
    <button data-task-menu-action="priority-medium" type="button"><span>!</span>\u4e2d\u4f18\u5148</button>
    <button data-task-menu-action="priority-low" type="button"><span>!</span>\u4f4e\u4f18\u5148</button>
    <button data-task-menu-action="priority-none" type="button"><span>-</span>\u65e0\u4f18\u5148</button>
    <button data-task-menu-action="toggle-pin" type="button"><span>&#9733;</span>\u7f6e\u9876/\u53d6\u6d88\u7f6e\u9876</button>
    <button class="danger" data-task-menu-action="delete-task" type="button"><span>&#9003;</span>\u5220\u9664\u4efb\u52a1</button>
  `;
  menu.classList.add("active");
  const width = 230;
  const height = isSubtask ? 96 : 500;
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - width - 12)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - height - 12)}px`;
}

function taskDragAllowed(event) {
  return !event.target.closest("input, button, select, textarea, [data-task-delete], [data-task-collapse]");
}

function resetTaskDragClasses() {
  $$(".task-item.dragging, .subtask-item.dragging, .task-item.drag-over, .subtask-item.drag-over").forEach((item) => {
    item.classList.remove("dragging", "drag-over");
  });
}

function commitTaskDomOrder() {
  const ids = $$("#taskList > .task-item[data-task-id]").map((item) => item.dataset.taskId);
  const base = Date.now() + ids.length;
  ids.forEach((id, index) => {
    const task = findTask(id);
    if (task) task.sortOrder = base - index;
  });
}

function commitSubtaskDomOrder(parentTaskId) {
  const task = findTask(parentTaskId);
  if (!task) return;
  const taskItem = $(`#taskList > .task-item[data-task-id="${parentTaskId}"]`);
  const ids = taskItem ? $$(".subtask-item[data-subtask-id]", taskItem).map((item) => item.dataset.subtaskId) : [];
  const base = Date.now() + ids.length;
  ids.forEach((id, index) => {
    const subtask = (task.subtasks || []).find((item) => item.id === id);
    if (subtask) subtask.sortOrder = base - index;
  });
}

function handleTaskDragStart(event) {
  if (!taskDragAllowed(event)) {
    event.preventDefault();
    return;
  }
  const subtaskItem = event.target.closest(".subtask-item[data-subtask-id]");
  if (subtaskItem) {
    const parent = subtaskItem.closest(".task-item[data-task-id]");
    taskDragState = { type: "subtask", id: subtaskItem.dataset.subtaskId, parentId: parent?.dataset.taskId || "" };
    subtaskItem.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    return;
  }
  const taskItem = event.target.closest(".task-item[data-task-id]");
  if (!taskItem) return;
  taskDragState = { type: "task", id: taskItem.dataset.taskId };
  taskItem.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
}

function handleTaskDragOver(event) {
  if (!taskDragState) return;
  event.preventDefault();
  const selector = taskDragState.type === "subtask" ? ".subtask-item[data-subtask-id]" : ".task-item[data-task-id]";
  const target = event.target.closest(selector);
  if (!target || target.classList.contains("dragging")) return;
  if (taskDragState.type === "subtask") {
    const parent = target.closest(".task-item[data-task-id]");
    if (parent?.dataset.taskId !== taskDragState.parentId) return;
  }
  const source = taskDragState.type === "subtask"
    ? $(`.subtask-item[data-subtask-id="${taskDragState.id}"]`)
    : $(`.task-item[data-task-id="${taskDragState.id}"]`);
  if (!source || source === target) return;
  const rect = target.getBoundingClientRect();
  const after = event.clientY > rect.top + rect.height / 2;
  $$(".task-item.drag-over, .subtask-item.drag-over").forEach((item) => item.classList.remove("drag-over"));
  target.classList.add("drag-over");
  target.parentElement.insertBefore(source, after ? target.nextSibling : target);
}

function handleTaskDrop(event) {
  if (!taskDragState) return;
  event.preventDefault();
  if (taskDragState.type === "subtask") commitSubtaskDomOrder(taskDragState.parentId);
  else commitTaskDomOrder();
  taskDragState = null;
  resetTaskDragClasses();
  persist();
}

function handleTaskDragEnd() {
  taskDragState = null;
  resetTaskDragClasses();
}

function renderTaskViewMode() {
  els.tickLayout.classList.toggle("month-mode", activeTaskView === "month");
  els.taskListView.classList.toggle("active", activeTaskView === "list");
  els.taskMonthView.classList.toggle("active", activeTaskView === "month");
  els.taskScheduleView.classList.toggle("active", activeTaskView === "schedule");
  els.taskListViewBtn.classList.toggle("active", activeTaskView === "list");
  els.taskMonthViewBtn.classList.toggle("active", activeTaskView === "month");
  els.taskScheduleViewBtn.classList.toggle("active", activeTaskView === "schedule");
  if (activeTaskView === "month") {
    els.taskViewTitle.textContent = monthTitle(currentMonthDate);
    renderMonthView();
  } else if (activeTaskView === "schedule") {
    els.tickLayout.classList.add("month-mode");
    els.taskViewTitle.textContent = "日程";
    renderScheduleView();
  }
}

function renderMonthView() {
  if (!els.monthGrid) return;
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const today = todayKey();
  els.monthTitle.textContent = monthTitle(currentMonthDate);
  els.monthGrid.innerHTML = "";

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = todayKey(date);
    const dayTasks = state.tasks
      .filter((task) => task.date === key)
      .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt);
    const cell = document.createElement("div");
    cell.className = [
      "month-cell",
      date.getMonth() !== month ? "is-outside" : "",
      key === today ? "is-today" : ""
    ].filter(Boolean).join(" ");
    const taskHtml = dayTasks.slice(0, 4).map((task) => `
      <label class="month-task type-${task.type} ${task.done ? "is-done" : ""}">
        <input type="checkbox" ${task.done ? "checked" : ""} data-task-toggle="${task.id}" />
        <span>${task.text}</span>
      </label>
    `).join("");
    cell.innerHTML = `
      <div class="month-day"><strong>${date.getDate()}</strong><span>${dayTasks.length ? `${dayTasks.length}项` : ""}</span></div>
      ${taskHtml}
      ${dayTasks.length > 4 ? `<div class="month-more">还有 ${dayTasks.length - 4} 项</div>` : ""}
    `;
    els.monthGrid.append(cell);
  }
}

function renderScheduleView() {
  const grouped = [...state.tasks]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
    .reduce((map, task) => {
      if (!map.has(task.date)) map.set(task.date, []);
      map.get(task.date).push(task);
      return map;
    }, new Map());
  els.scheduleList.innerHTML = grouped.size ? "" : '<div class="empty-state"><strong>暂无日程</strong><span>添加任务后会按日期排成时间线。</span></div>';
  for (const [date, tasks] of grouped.entries()) {
    const dateObj = dateFromKey(date);
    const day = document.createElement("section");
    day.className = "schedule-day";
    day.innerHTML = `
      <div class="schedule-date"><strong>${dateObj.getDate()}</strong><span>${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][dateObj.getDay()]}</span></div>
      <div class="schedule-items">
        ${tasks.map((task) => `
          <label class="schedule-item type-${task.type}">
            <span>${date} · ${taskTypeLabels[task.type] || task.type}</span>
            <strong>${task.text}</strong>
          </label>
        `).join("")}
      </div>
    `;
    els.scheduleList.append(day);
  }
}

function renderCalendar() {
  const grouped = [...new Set(state.tasks.map((task) => task.date))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 7);
  els.calendarStrip.innerHTML = grouped.length ? "" : '<div class="empty-state"><strong>暂无记录</strong><span>完成任务后会形成打卡记录。</span></div>';
  for (const date of grouped) {
    const dayTasks = state.tasks.filter((task) => task.date === date);
    const done = dayTasks.filter((task) => task.done).length;
    const row = document.createElement("div");
    row.className = "day-row";
    row.innerHTML = `<span>${date}</span><strong>${done}/${dayTasks.length}</strong>`;
    els.calendarStrip.append(row);
  }
}

function calculateStreak() {
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = todayKey(cursor);
    const tasks = state.tasks.filter((task) => task.date === key);
    if (!tasks.length || !tasks.some((task) => task.done)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function dailyNewWordGoal() {
  return Math.max(1, Number(state.settings.dailyWordGoal || 30));
}

function sortReviewWords(a, b) {
  return a.nextReview.localeCompare(b.nextReview)
    || (a.level || 0) - (b.level || 0)
    || (a.reviews || 0) - (b.reviews || 0)
    || a.word.localeCompare(b.word);
}

function todayReviewWords() {
  const today = todayKey();
  return state.words
    .filter((word) => (word.reviews || 0) > 0 && word.nextReview <= today)
    .sort(sortReviewWords);
}

function ensureTodayNewStudyRecords() {
  const today = todayKey();
  const goal = dailyNewWordGoal();
  const wordIds = new Set(state.words.map((word) => word.id));
  const records = state.wordNewStudyRecords || [];
  const cleaned = records.filter((record) => wordIds.has(record.wordId));
  let changed = cleaned.length !== records.length;
  state.wordNewStudyRecords = cleaned;
  const todayRecords = state.wordNewStudyRecords.filter((record) => record.date === today);
  const plannedIds = new Set(todayRecords.map((record) => record.wordId));
  const slots = Math.max(0, goal - todayRecords.length);
  if (slots > 0) {
    state.words
      .filter((word) => !(word.reviews || 0) && !plannedIds.has(word.id))
      .sort((a, b) => a.word.localeCompare(b.word))
      .slice(0, slots)
      .forEach((word) => {
        state.wordNewStudyRecords.push({
          id: crypto.randomUUID(),
          wordId: word.id,
          date: today,
          createdAt: Date.now()
        });
        plannedIds.add(word.id);
        changed = true;
      });
  }
  if (changed) api.save(state);
  return state.wordNewStudyRecords.filter((record) => record.date === today);
}

function todayNewStudyRecords() {
  return ensureTodayNewStudyRecords();
}

function todayNewWords() {
  const planned = todayNewStudyRecords();
  return planned
    .map((record) => state.words.find((word) => word.id === record.wordId))
    .filter((word) => word && !(word.reviews || 0));
}

function isTodayNewStudyWord(wordId) {
  return todayNewStudyRecords().some((record) => record.wordId === wordId);
}

function learnedNewTodayCount() {
  const planned = todayNewStudyRecords();
  return planned.filter((record) => {
    const word = state.words.find((item) => item.id === record.wordId);
    return word && (word.reviews || 0) > 0;
  }).length;
}

function dueWords() {
  if (activeWordMode === "new") return todayNewWords();
  if (activeWordMode === "wrong") {
    return state.words
      .filter((word) => (word.wrongCount || 0) > 0)
      .sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0) || sortReviewWords(a, b));
  }
  if (activeWordMode === "all") return [...state.words].sort((a, b) => a.word.localeCompare(b.word));
  return [...todayReviewWords(), ...todayNewWords()];
}

function calculateWordStreak() {
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = todayKey(cursor);
    if (!state.wordCheckins.includes(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function daysSince(key) {
  if (!key) return 999;
  return Math.max(0, Math.floor((dateFromKey(todayKey()) - dateFromKey(key)) / 86400000));
}

function invalidateWordFamiliarityCache() {
  wordFamiliarityCache = new Map();
  wordFamiliarityCacheDay = todayKey();
}

function wordCacheKey(word) {
  return [
    word.id,
    word.reviews || 0,
    word.level || 0,
    word.wrongCount || 0,
    word.lastReview || "",
    word.nextReview || "",
    wordFamiliarityCacheDay
  ].join("|");
}

function wordFamiliarity(word) {
  const today = todayKey();
  if (wordFamiliarityCacheDay !== today) {
    wordFamiliarityCache = new Map();
    wordFamiliarityCacheDay = today;
  }
  const cacheKey = wordCacheKey(word);
  const cached = wordFamiliarityCache.get(cacheKey);
  if (cached) return cached;
  const reviews = Number(word.reviews || 0);
  const level = Math.max(0, Math.min(6, Number(word.level || 0)));
  const wrongCount = Number(word.wrongCount || 0);
  if (!reviews) {
    const score = Math.max(3, Math.min(24, 14 - wrongCount * 4));
    const result = { score, status: "unknown", label: "\u4e0d\u8ba4\u8bc6" };
    wordFamiliarityCache.set(cacheKey, result);
    return result;
  }
  const elapsed = daysSince(word.lastReview || word.nextReview);
  const halfLives = [0.5, 1, 2, 4, 8, 16, 32];
  const reviewBoost = 1 + Math.min(reviews, 20) * 0.08;
  const errorPenalty = 1 + wrongCount * 0.35;
  const halfLife = Math.max(0.25, halfLives[level] * reviewBoost / errorPenalty);
  const retention = Math.exp(-Math.log(2) * elapsed / halfLife);
  const mastery = 0.36 + (level / 6) * 0.64;
  const score = Math.round(Math.max(0, Math.min(100, retention * mastery * 100)));
  const status = score >= 75 ? "known" : score >= 40 ? "fuzzy" : "unknown";
  const label = status === "known" ? "\u8ba4\u8bc6" : status === "fuzzy" ? "\u6a21\u7cca" : "\u4e0d\u8ba4\u8bc6";
  const result = { score, status, label };
  wordFamiliarityCache.set(cacheKey, result);
  return result;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function reviewStatusFromQuality(quality) {
  if (quality === "known") return "known";
  if (quality === "hard") return "fuzzy";
  return "unknown";
}

function reviewQualityLabel(quality) {
  if (quality === "known") return "\u8ba4\u8bc6";
  if (quality === "hard") return "\u6a21\u7cca";
  return "\u4e0d\u8ba4\u8bc6";
}

function fallbackWordReviewRecords() {
  const recordedKeys = new Set((state.wordReviewRecords || []).map((record) => `${record.date}:${record.wordId}`));
  return state.words
    .filter((word) => word.reviews > 0 && word.lastReview && !recordedKeys.has(`${word.lastReview}:${word.id}`))
    .map((word) => ({
      id: `fallback-${word.id}-${word.lastReview}`,
      wordId: word.id,
      date: word.lastReview,
      status: wordFamiliarity(word).status,
      fallback: true
    }));
}

function memoryCurveRows(days = 14) {
  const start = addDays(dateFromKey(todayKey()), -(days - 1));
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = todayKey(addDays(start, index));
    return { date, unknown: 0, fuzzy: 0, known: 0, total: 0 };
  });
  const bucketMap = new Map(buckets.map((bucket) => [bucket.date, bucket]));
  const latestByDayWord = new Map();
  for (const record of [...fallbackWordReviewRecords(), ...(state.wordReviewRecords || [])]) {
    if (!record.date || !record.wordId || !bucketMap.has(record.date)) continue;
    latestByDayWord.set(`${record.date}:${record.wordId}`, record);
  }
  for (const record of latestByDayWord.values()) {
    const bucket = bucketMap.get(record.date);
    const status = ["unknown", "fuzzy", "known"].includes(record.status) ? record.status : "unknown";
    bucket[status] += 1;
    bucket.total += 1;
  }
  return buckets;
}

function renderMemoryCurve() {
  if (!els.wordMemoryCurve) return;
  const rows = memoryCurveRows();
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.unknown, row.fuzzy, row.known]));
  const hasData = rows.some((row) => row.total > 0);
  if (!hasData) {
    els.wordMemoryCurve.innerHTML = '<div class="empty-state"><strong>暂无曲线数据</strong><span>背过单词后，这里会按天显示不认识、模糊、认识的数量。</span></div>';
    return;
  }
  const width = 720;
  const height = 230;
  const pad = { left: 34, right: 18, top: 18, bottom: 44 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const xFor = (index) => pad.left + (rows.length === 1 ? 0 : index / (rows.length - 1) * chartWidth);
  const yFor = (value) => pad.top + chartHeight - (value / maxValue) * chartHeight;
  const lineFor = (key) => rows.map((row, index) => `${xFor(index).toFixed(1)},${yFor(row[key]).toFixed(1)}`).join(" ");
  const dotsFor = (key) => rows.map((row, index) => `
    <circle class="${key}" cx="${xFor(index).toFixed(1)}" cy="${yFor(row[key]).toFixed(1)}" r="4">
      <title>${row.date} ${key === "unknown" ? "不认识" : key === "fuzzy" ? "模糊" : "认识"} ${row[key]}</title>
    </circle>
  `).join("");
  const grid = [0, 0.5, 1].map((ratio) => {
    const y = pad.top + chartHeight - ratio * chartHeight;
    return `<line class="memory-grid" x1="${pad.left}" x2="${width - pad.right}" y1="${y}" y2="${y}" />`;
  }).join("");
  const labels = rows.map((row, index) => `
    <text x="${xFor(index).toFixed(1)}" y="${height - 18}" text-anchor="middle">${row.date.slice(5).replace("-", "/")}</text>
  `).join("");
  els.wordMemoryCurve.innerHTML = `
    <svg class="memory-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="最近 14 天单词记忆曲线">
      ${grid}
      <text class="memory-axis" x="6" y="${yFor(maxValue).toFixed(1)}">${maxValue}</text>
      <text class="memory-axis" x="14" y="${yFor(0).toFixed(1)}">0</text>
      <polyline class="memory-line unknown" points="${lineFor("unknown")}" />
      <polyline class="memory-line fuzzy" points="${lineFor("fuzzy")}" />
      <polyline class="memory-line known" points="${lineFor("known")}" />
      <g class="memory-dots">${dotsFor("unknown")}${dotsFor("fuzzy")}${dotsFor("known")}</g>
      <g class="memory-labels">${labels}</g>
    </svg>
  `;
}

function renderWordOverview() {
  if (!els.wordOverviewList) return;
  const query = (els.wordOverviewSearch?.value || "").trim().toLowerCase();
  const enriched = state.words.map((word) => ({ ...wordFamiliarity(word), word }));
  const counts = {
    all: enriched.length,
    unknown: enriched.filter((item) => item.status === "unknown").length,
    fuzzy: enriched.filter((item) => item.status === "fuzzy").length,
    known: enriched.filter((item) => item.status === "known").length
  };
  els.wordOverviewStats.innerHTML = [
    ["\u5168\u90e8", counts.all],
    ["\u4e0d\u8ba4\u8bc6", counts.unknown],
    ["\u6a21\u7cca", counts.fuzzy],
    ["\u8ba4\u8bc6", counts.known]
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  renderMemoryCurve();
  $$("#wordOverviewFilters button").forEach((button) => {
    button.classList.toggle("active", button.dataset.overviewFilter === activeWordOverviewFilter);
  });
  const rows = enriched
    .filter((item) => activeWordOverviewFilter === "all" || item.status === activeWordOverviewFilter)
    .filter(({ word }) => !query || [word.word, word.meaning, word.example].join(" ").toLowerCase().includes(query))
    .sort((a, b) => a.score - b.score || a.word.nextReview.localeCompare(b.word.nextReview));
  if (!rows.length) {
    els.wordOverviewPager.innerHTML = "";
    els.wordOverviewList.innerHTML = '<div class="empty-state"><strong>\u6ca1\u6709\u5339\u914d\u7684\u5355\u8bcd</strong><span>\u6362\u4e2a\u5206\u7c7b\u6216\u641c\u7d22\u5173\u952e\u8bcd\u8bd5\u8bd5\u3002</span></div>';
    return;
  }
  const totalPages = Math.max(1, Math.ceil(rows.length / WORD_OVERVIEW_PAGE_SIZE));
  activeWordOverviewPage = Math.min(Math.max(1, activeWordOverviewPage), totalPages);
  const start = (activeWordOverviewPage - 1) * WORD_OVERVIEW_PAGE_SIZE;
  const pageRows = rows.slice(start, start + WORD_OVERVIEW_PAGE_SIZE);
  els.wordOverviewPager.innerHTML = `
    <span>显示 ${start + 1}-${Math.min(start + WORD_OVERVIEW_PAGE_SIZE, rows.length)} / ${rows.length}</span>
    <div>
      <button class="ghost-button compact" data-overview-page="prev" ${activeWordOverviewPage <= 1 ? "disabled" : ""} type="button">上一页</button>
      <strong>${activeWordOverviewPage} / ${totalPages}</strong>
      <button class="ghost-button compact" data-overview-page="next" ${activeWordOverviewPage >= totalPages ? "disabled" : ""} type="button">下一页</button>
    </div>
  `;
  els.wordOverviewList.innerHTML = pageRows.map(({ word, score, status, label }) => `
    <article class="overview-word ${status}">
      <div>
        <strong>${word.word}</strong>
        <span>${word.meaning}</span>
        ${word.example ? `<small>${word.example}</small>` : ""}
      </div>
      <div class="memory-meter" aria-label="\u719f\u6089\u5ea6 ${score}%">
        <span style="width: ${score}%"></span>
      </div>
      <b>${score}%</b>
      <em>${label}</em>
      <button class="ghost-button compact" data-overview-study="${word.id}" type="button">\u80cc\u8bf5</button>
    </article>
  `).join("");
}

function renderWords() {
  const due = dueWords();
  const active = state.words.find((word) => word.id === activeWordId);
  const current = due.includes(active) ? active : due[0] || (activeWordMode === "all" ? state.words[0] : null);
  if (current) activeWordId = current.id;
  const reviewCount = todayReviewWords().length;
  const newGoal = dailyNewWordGoal();
  const learnedToday = learnedNewTodayCount();
  els.wordDueCount.textContent = reviewCount;
  els.wordNewCount.textContent = `${learnedToday}/${newGoal}`;
  els.wordWrongCount.textContent = state.words.filter((word) => (word.wrongCount || 0) > 0).length;
  els.wordKnownCount.textContent = state.words.filter((word) => word.level >= 5).length;
  els.wordStreakCount.textContent = `${calculateWordStreak()}天`;
  if (els.wordDailyGoal) els.wordDailyGoal.value = newGoal;
  els.wordProgress.textContent = `${current ? Math.max(1, due.findIndex((word) => word.id === activeWordId) + 1) : 0} / ${due.length}`;
  if (!current) {
    els.studyWord.textContent = "暂无单词";
    els.studyMeaning.textContent = activeWordMode === "review" ? "今天的新学和复习都完成了。" : "先添加一个单词开始打卡。";
    els.studyExample.textContent = "";
    els.wordStage.textContent = "已完成";
    renderWordPlan();
    renderWordLibrary();
    return;
  }
  els.wordStage.textContent = isTodayNewStudyWord(current.id) && !(current.reviews || 0)
    ? "今日新学"
    : current.nextReview <= todayKey()
      ? "曲线复习"
      : "提前预习";
  els.studyWord.textContent = current.word;
  els.studyMeaning.textContent = wordRevealed ? current.meaning : "先回忆释义，再点击显示。";
  els.studyExample.textContent = wordRevealed ? current.example || "" : "";
  els.revealWordBtn.textContent = wordRevealed ? "隐藏释义" : "显示释义";
  $$(".word-filterbar button").forEach((button) => button.classList.toggle("active", button.dataset.wordMode === activeWordMode));
  renderWordPlan();
  renderWordLibrary();
}

function renderWordPlan() {
  const today = todayKey();
  const tomorrow = todayKey(new Date(Date.now() + 86400000));
  const weekEnd = todayKey(new Date(Date.now() + 7 * 86400000));
  const learnedToday = learnedNewTodayCount();
  const newGoal = dailyNewWordGoal();
  const rows = [
    ["今日新学", `${learnedToday}/${newGoal} 个`],
    ["今日复习", `${todayReviewWords().length} 个`],
    ["明日复习", `${state.words.filter((word) => (word.reviews || 0) > 0 && word.nextReview === tomorrow).length} 个`],
    ["7天内复习", `${state.words.filter((word) => (word.reviews || 0) > 0 && word.nextReview > today && word.nextReview <= weekEnd).length} 个`]
  ];
  els.wordPlanList.innerHTML = `
    ${rows.map(([label, value]) => `<div class="word-plan-row"><span>${label}</span><strong>${value}</strong></div>`).join("")}
    <p class="word-plan-note">新学名额和曲线复习分开计算，复习由下次复习日自动生成。</p>
  `;
}

function renderWordLibrary() {
  if (!els.wordLibraryList) return;
  const query = (els.wordSearchInput?.value || "").trim().toLowerCase();
  const words = state.words
    .filter((item) => !query || [item.word, item.meaning, item.example].join(" ").toLowerCase().includes(query))
    .sort((a, b) => a.word.localeCompare(b.word));
  if (!words.length) {
    els.wordLibraryPager.innerHTML = "";
    els.wordLibraryList.innerHTML = '<div class="empty-state"><strong>\u6ca1\u6709\u627e\u5230\u5355\u8bcd</strong><span>\u6362\u4e2a\u5173\u952e\u8bcd\u6216\u5bfc\u5165\u65b0\u8bcd\u5e93\u3002</span></div>';
    return;
  }
  const totalPages = Math.max(1, Math.ceil(words.length / WORD_LIBRARY_PAGE_SIZE));
  activeWordLibraryPage = Math.min(Math.max(1, activeWordLibraryPage), totalPages);
  const start = (activeWordLibraryPage - 1) * WORD_LIBRARY_PAGE_SIZE;
  const pageWords = words.slice(start, start + WORD_LIBRARY_PAGE_SIZE);
  els.wordLibraryPager.innerHTML = `
    <span>${start + 1}-${Math.min(start + WORD_LIBRARY_PAGE_SIZE, words.length)} / ${words.length}</span>
    <div>
      <button class="ghost-button compact" data-word-library-page="prev" ${activeWordLibraryPage <= 1 ? "disabled" : ""} type="button">上一页</button>
      <strong>${activeWordLibraryPage} / ${totalPages}</strong>
      <button class="ghost-button compact" data-word-library-page="next" ${activeWordLibraryPage >= totalPages ? "disabled" : ""} type="button">下一页</button>
    </div>
  `;
  els.wordLibraryList.innerHTML = pageWords.map((word) => `
    <div class="word-row">
      <div>
        <strong>${word.word}</strong>
        <span>${word.meaning}</span>
      </div>
      <button class="ghost-button compact" data-word-study="${word.id}" type="button">\u80cc\u8bf5</button>
      <button class="ghost-button compact" data-word-reset="${word.id}" type="button">\u91cd\u7f6e</button>
      <button class="ghost-button compact danger-button" data-word-delete="${word.id}" type="button">\u5220\u9664</button>
    </div>
  `).join("");
}

function playWordFeedback(quality) {
  const context = synthContext || new AudioContext();
  synthContext = context;
  context.resume?.();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const frequency = quality === "known" ? 740 : quality === "hard" ? 520 : 260;
  oscillator.type = quality === "again" ? "triangle" : "sine";
  oscillator.frequency.setValueAtTime(frequency, context.currentTime);
  if (quality === "known") oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.22);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.24);
}

function animateWordFeedback(quality) {
  els.wordCard.classList.remove("feedback-known", "feedback-hard", "feedback-again");
  void els.wordCard.offsetWidth;
  els.wordCard.classList.add(`feedback-${quality}`);
  setTimeout(() => els.wordCard.classList.remove(`feedback-${quality}`), 520);
}

function reviewWord(quality) {
  const word = state.words.find((item) => item.id === activeWordId);
  if (!word) return;
  playWordFeedback(quality);
  animateWordFeedback(quality);
  const wasNewStudy = isTodayNewStudyWord(word.id) && !(word.reviews || 0);
  const intervals = quality === "again" ? [0, 1, 1, 2, 3, 5] : quality === "hard" ? [1, 1, 2, 3, 5, 7] : [1, 2, 4, 7, 15, 30];
  word.level = quality === "again" ? Math.max(0, word.level - 1) : Math.min(6, word.level + (quality === "known" ? 1 : 0));
  if (quality === "again") word.wrongCount = (word.wrongCount || 0) + 1;
  if (quality === "known" && word.wrongCount) word.wrongCount = Math.max(0, word.wrongCount - 1);
  word.reviews += 1;
  word.lastReview = todayKey();
  const status = reviewStatusFromQuality(quality);
  state.wordReviewRecords = state.wordReviewRecords || [];
  state.wordReviewRecords.push({
    id: crypto.randomUUID(),
    wordId: word.id,
    date: word.lastReview,
    quality,
    status,
    isNewStudy: wasNewStudy,
    createdAt: Date.now()
  });
  const next = new Date();
  next.setDate(next.getDate() + intervals[Math.min(word.level, intervals.length - 1)]);
  word.nextReview = todayKey(next);
  if (!state.wordCheckins.includes(todayKey())) state.wordCheckins.push(todayKey());
  wordRevealed = false;
  const nextQueue = dueWords();
  activeWordId = nextQueue.find((item) => item.id !== word.id)?.id || nextQueue[0]?.id || state.words.find((item) => item.id !== word.id)?.id || word.id;
  invalidateWordFamiliarityCache();
  persist();
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseWordImport(text, filename = "") {
  if (filename.toLowerCase().endsWith(".json") || text.trim().startsWith("[")) {
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("JSON 需要是数组");
    return data.map((item) => ({
      word: String(item.word || item.单词 || "").trim(),
      meaning: String(item.meaning || item.释义 || item.definition || "").trim(),
      example: String(item.example || item.例句 || "").trim()
    }));
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const first = parseCsvLine(lines[0]).map((item) => item.toLowerCase());
  const hasHeader = first.includes("word") || first.includes("单词");
  const headers = hasHeader ? first : ["word", "meaning", "example"];
  const rows = hasHeader ? lines.slice(1) : lines;
  return rows.map((line) => {
    const values = parseCsvLine(line);
    const record = Object.fromEntries(headers.map((key, index) => [key, values[index] || ""]));
    return {
      word: String(record.word || record["单词"] || "").trim(),
      meaning: String(record.meaning || record["释义"] || record.definition || "").trim(),
      example: String(record.example || record["例句"] || "").trim()
    };
  });
}

function importWords(records) {
  const existing = new Set(state.words.map((item) => item.word.toLowerCase()));
  const imported = records
    .filter((item) => item.word && item.meaning && !existing.has(item.word.toLowerCase()))
    .map((item) => {
      existing.add(item.word.toLowerCase());
      return {
        id: crypto.randomUUID(),
        word: item.word,
        meaning: item.meaning,
        example: item.example || "",
        level: 0,
        reviews: 0,
        wrongCount: 0,
        nextReview: todayKey(),
        lastReview: ""
      };
    });
  state.words.unshift(...imported);
  if (imported.length) invalidateWordFamiliarityCache();
  return imported.length;
}

function exportWords() {
  const payload = state.words.map(({ word, meaning, example, level, reviews, wrongCount, nextReview, lastReview }) => ({
    word,
    meaning,
    example,
    level,
    reviews,
    wrongCount: wrongCount || 0,
    nextReview,
    lastReview
  }));
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `words-${todayKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function addTask(event) {
  event.preventDefault();
  const text = els.checkinText.value.trim();
  if (!text) return;
  const date = els.checkinDate.value || todayKey();
  syncTaskDateInput(date);
  activeTaskFilter = date === todayKey() ? "today" : "date";
  activeTaskType = "";
  activeTaskView = "list";
  state.tasks.unshift({
    id: crypto.randomUUID(),
    text,
    type: els.checkinType.value,
    subjectId: els.checkinSubject.value || "",
    done: false,
    date,
    priority: "none",
    subtasks: [],
    createdAt: Date.now(),
    sortOrder: Date.now()
  });
  els.checkinText.value = "";
  persist();
}

function renderPhotos() {
  renderWallSwitcher();
  const wall = activeWall();
  els.photoWall.innerHTML = "";
  if (!wall.photos.length) {
    els.photoWall.innerHTML = '<div class="empty-state"><strong>照片墙等待点亮</strong><span>上传图片后可以拖动、缩放、旋转。</span></div>';
    return;
  }
  for (const [index, photo] of wall.photos.entries()) {
    const card = document.createElement("div");
    card.className = "photo-card";
    card.style.left = `${photo.x}px`;
    card.style.top = `${photo.y}px`;
    card.style.width = `${photo.width}px`;
    card.style.height = `${photo.height || photo.width}px`;
    card.style.zIndex = photo.zIndex || index + 1;
    card.style.setProperty("--photo-rotation", `${photo.rotation || 0}deg`);
    card.dataset.photoId = photo.id;
    card.innerHTML = `
      <img src="${photo.src}" alt="${photo.name}" />
      <button class="photo-delete" data-photo-delete="${photo.id}" title="删除照片">×</button>
      <button class="photo-rotate" data-photo-rotate="${photo.id}" title="拖动旋转">↻</button>
      <span class="photo-resize" data-photo-resize="${photo.id}" title="拖动缩放"></span>
    `;
    els.photoWall.append(card);
    const image = card.querySelector("img");
    const syncPhotoRatio = () => {
      if (!image.naturalWidth || !image.naturalHeight || photo.aspectRatio) return;
      photo.aspectRatio = image.naturalWidth / image.naturalHeight;
      if (!photo.height || Math.abs(photo.height - photo.width) < 2) {
        photo.height = Math.max(70, Math.round(photo.width / photo.aspectRatio));
        card.style.height = `${photo.height}px`;
        api.save(state);
      }
    };
    image.onload = syncPhotoRatio;
    if (image.complete) syncPhotoRatio();
  }
}

function activeWall() {
  let wall = state.photoWalls.find((item) => item.id === state.activePhotoWallId);
  if (!wall) {
    wall = state.photoWalls[0] || { id: crypto.randomUUID(), name: "默认照片墙", photos: [] };
    state.photoWalls = state.photoWalls.length ? state.photoWalls : [wall];
    state.activePhotoWallId = wall.id;
  }
  return wall;
}

function renderWallSwitcher() {
  els.wallSwitcher.innerHTML = state.photoWalls.map((wall) => `
    <button class="wall-tab ${wall.id === state.activePhotoWallId ? "active" : ""}" data-wall-id="${wall.id}" title="双击重命名">
      ${wall.name} · ${wall.photos.length}
    </button>
  `).join("");
}

async function renameWall(id) {
  const wall = state.photoWalls.find((item) => item.id === id);
  if (!wall) return;
  const nextName = await showInputModal({
    eyebrow: "Gallery",
    title: "重命名照片墙",
    label: "名称",
    value: wall.name,
    placeholder: "给这面照片墙取个名字"
  });
  if (!nextName) return;
  wall.name = nextName.trim() || wall.name;
  persist();
}

function duplicateCurrentWall() {
  const wall = activeWall();
  const copy = {
    id: crypto.randomUUID(),
    name: `${wall.name} Copy`,
    photos: wall.photos.map((photo) => ({
      ...photo,
      id: crypto.randomUUID(),
      x: (photo.x || 0) + 28,
      y: (photo.y || 0) + 28
    }))
  };
  state.photoWalls.push(copy);
  state.activePhotoWallId = copy.id;
  persist();
}

async function deleteCurrentWall() {
  const wall = activeWall();
  if (state.photoWalls.length <= 1) {
    await showConfirm({
      eyebrow: "\u63d0\u793a",
      title: "\u4e0d\u80fd\u5220\u9664",
      message: "\u81f3\u5c11\u9700\u8981\u4fdd\u7559\u4e00\u9762\u7167\u7247\u5899\u3002",
      okText: "\u77e5\u9053\u4e86",
      cancelText: ""
    });
    return;
  }
  const ok = await showConfirm({
    eyebrow: "\u7167\u7247\u5899",
    title: "\u5220\u9664\u7167\u7247\u5899\uff1f",
    message: `\u5220\u9664\u7167\u7247\u5899\u300c${wall.name}\u300d\u5417\uff1f\u5176\u4e2d\u7684\u7167\u7247\u4e5f\u4f1a\u4ece\u672c\u5730\u6570\u636e\u4e2d\u79fb\u9664\u3002`,
    okText: "\u5220\u9664",
    danger: true
  });
  if (!ok) return;
  state.photoWalls = state.photoWalls.filter((item) => item.id !== wall.id);
  state.activePhotoWallId = state.photoWalls[0]?.id || "";
  persist();
}

function movePhotoLayer(photoId, direction) {
  const wall = activeWall();
  const index = wall.photos.findIndex((photo) => photo.id === photoId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= wall.photos.length) return false;
  const [photo] = wall.photos.splice(index, 1);
  wall.photos.splice(nextIndex, 0, photo);
  wall.photos.forEach((item, order) => {
    item.zIndex = order + 1;
  });
  return true;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function imageFileToDataUrl(file, options = {}) {
  const { maxEdge = 1000, quality = 0.76 } = options;
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件");
  }
  if (file.type === "image/svg+xml") {
    return fileToDataUrl(file);
  }

  const rawUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(rawUrl);
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    if (!blob) return canvas.toDataURL("image/png");
    return fileToDataUrl(blob);
  } finally {
    URL.revokeObjectURL(rawUrl);
  }
}

function setUploadStatus(element, message, type = "") {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("is-ok", type === "ok");
  element.classList.toggle("is-error", type === "error");
}

async function uploadPhotos(event) {
  const files = [...event.target.files];
  if (!files.length) return;
  const wall = activeWall();
  setUploadStatus(els.photoStatus, "正在处理图片...");
  try {
    for (const [index, file] of files.entries()) {
      const processed = await imageFileToDataUrl(file, { maxEdge: 900, quality: 0.72 });
      const src = await api.uploadDataUrl("photos", file.name, processed);
      const image = await loadImage(src);
      const width = 220;
      const height = Math.max(90, Math.round(width * image.naturalHeight / image.naturalWidth));
      wall.photos.push({
        id: crypto.randomUUID(),
        name: file.name,
        src,
        x: 24 + index * 32,
        y: 24 + index * 32,
        width,
        height,
        aspectRatio: image.naturalWidth / image.naturalHeight,
        rotation: 0,
        zIndex: wall.photos.length + 1
      });
    }
    event.target.value = "";
    const saved = persist();
    setUploadStatus(els.photoStatus, saved ? `已上传 ${files.length} 张照片` : "图片已显示，但本地保存空间不足，请导出备份或减少图片数量", saved ? "ok" : "error");
  } catch (error) {
    setUploadStatus(els.photoStatus, error.message || "图片上传失败", "error");
    event.target.value = "";
  }
}

function renderArchive() {
  const posts = orderedPosts();
  els.archiveList.innerHTML = posts.length ? "" : '<div class="empty-state"><strong>暂无归档</strong><span>文章保存后会出现在这里。</span></div>';
  for (const post of posts) {
    const item = document.createElement("div");
    item.className = "archive-item";
    item.innerHTML = `
      <strong>${post.date.slice(0, 7)}</strong>
      <span>${post.title}</span>
      <button class="ghost-button" data-edit="${post.id}">打开</button>
    `;
    els.archiveList.append(item);
  }
}

function renderProfile() {
  const recentPosts = orderedPosts().slice(0, 3);
  const recentTasks = [...state.tasks].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  const recentWordRecords = [...(state.wordReviewRecords || [])].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  els.aboutName.textContent = state.profile.name || "关于我";
  els.aboutBio.textContent = state.profile.bio || "";
  els.profileName.value = state.profile.name || "";
  els.profileBio.value = state.profile.bio || "";
  els.profileLinks.value = state.profile.links || "";
  els.profileSignatureDisplay.textContent = state.settings.blogSignature || "Local-first Blog Studio";
  els.profileAvatarButton.classList.toggle("has-avatar", Boolean(state.settings.avatar));
  els.profileAvatarImage.src = state.settings.avatar || "";
  els.profileAvatarFallback.textContent = (state.settings.blogName || state.profile.name || "星").trim().slice(0, 1);
  els.profilePostCount.textContent = state.posts.length;
  els.profileWallCount.textContent = state.photoWalls.length;
  els.profileWordCount.textContent = state.words.length;
  els.profileDashboard.innerHTML = `
    <section>
      <h3>\u6700\u8fd1\u6587\u7ae0</h3>
      ${recentPosts.length ? recentPosts.map((post) => `<button type="button" data-profile-read="${post.id}"><strong>${post.title}</strong><span>${post.date}</span></button>`).join("") : '<p>\u6682\u65e0\u6587\u7ae0</p>'}
    </section>
    <section>
      <h3>\u6700\u8fd1\u6253\u5361</h3>
      ${recentTasks.length ? recentTasks.map((task) => `<div><strong>${task.text}</strong><span>${task.date} · ${taskPriorityLabels[task.priority || "none"]}</span></div>`).join("") : '<p>\u6682\u65e0\u4efb\u52a1</p>'}
    </section>
    <section>
      <h3>\u80cc\u8bcd\u52a8\u6001</h3>
      ${recentWordRecords.length ? recentWordRecords.map((record) => {
        const word = state.words.find((item) => item.id === record.wordId);
        return `<div><strong>${word?.word || "\u5355\u8bcd"}</strong><span>${record.date} · ${reviewQualityLabel(record.quality)}</span></div>`;
      }).join("") : '<p>\u6682\u65e0\u80cc\u8bcd\u8bb0\u5f55</p>'}
    </section>
  `;
}

function renderSettings() {
  els.blogName.value = state.settings.blogName || "";
  els.blogSignature.value = state.settings.blogSignature || "";
  els.bgOpacity.value = state.settings.bgOpacity;
  els.uiOpacity.value = state.settings.uiOpacity ?? 0.66;
  els.blurAmount.value = state.settings.blurAmount ?? 10;
  els.bodyFontSize.value = state.settings.bodyFontSize ?? 17;
  els.dailyWordGoal.value = state.settings.dailyWordGoal ?? 30;
  if (els.wordDailyGoal) els.wordDailyGoal.value = state.settings.dailyWordGoal ?? 30;
  els.musicVolume.value = state.settings.musicVolume ?? 0.35;
  els.musicStatus.textContent = state.settings.musicSrc ? `当前音乐：${state.settings.musicName || "自定义音乐"}` : "默认音乐已就绪";
  els.musicToggleBtn.textContent = musicPlaying ? "暂停" : "播放";
  els.bgMode.value = state.settings.bgMode || "character";
  els.bgPosition.value = state.settings.bgPosition || "right bottom";
  els.backgroundPreview.classList.toggle("has-image", Boolean(state.settings.background));
  els.backgroundPreview.querySelector("span").textContent = state.settings.background ? "当前背景" : "未设置背景";
  els.backgroundStatus.textContent = state.settings.background ? "背景已明显应用到页面外层，可以切换显示模式和位置。" : "选择一张图片作为页面背景";
  els.clearBackgroundBtn.disabled = !state.settings.background;
  els.settingsPreviewName.textContent = state.settings.blogName || "星屑笔记";
  els.settingsPreviewSignature.textContent = state.settings.blogSignature || "Local-first Blog Studio";
  els.settingsPreviewBg.textContent = state.settings.background ? "已设置" : "未设置";
  els.settingsPreviewMusic.textContent = state.settings.musicSrc ? "自定义" : "默认";
  els.settingsPreviewWalls.textContent = state.photoWalls.length;
  els.settingsPreviewAvatar.parentElement.classList.toggle("has-avatar", Boolean(state.settings.avatar));
  els.settingsPreviewAvatar.src = state.settings.avatar || "";
}

function formatDuration(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatTimer(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function focusSubjectColor(index = 0) {
  const colors = ["#ff6fae", "#4fc3f7", "#54d6a2", "#ffbd5a", "#b49cff", "#ff8f70", "#6de0d8", "#f06aa6"];
  return colors[index % colors.length];
}

function activeFocusSubject() {
  state.timer.subjects = normalizeFocusSubjects(state.timer.subjects);
  return state.timer.subjects.find((subject) => subject.id === state.timer.activeSubjectId) || state.timer.subjects[0];
}

function focusSubjectForRecord(record) {
  const subject = state.timer.subjects.find((item) => item.id === record.subjectId);
  if (subject) return subject;
  return {
    id: record.subjectId || "uncategorized",
    name: record.subjectName || "未分类",
    color: record.subjectColor || "#9b96b5"
  };
}

function focusSubjectById(subjectId) {
  state.timer.subjects = normalizeFocusSubjects(state.timer.subjects);
  return state.timer.subjects.find((subject) => subject.id === subjectId) || null;
}

function taskSubjectLabel(task) {
  const subject = focusSubjectById(task.subjectId);
  if (!subject) return "";
  return `<span class="task-subject-pill" style="--subject-color:${subject.color}">${htmlEscape(subject.name)}</span>`;
}

function focusSubjectTotals(records) {
  const totals = new Map();
  records.forEach((record) => {
    const subject = focusSubjectForRecord(record);
    const current = totals.get(subject.id) || { ...subject, minutes: 0, count: 0 };
    current.minutes += Number(record.minutes || 0);
    current.count += 1;
    totals.set(subject.id, current);
  });
  return [...totals.values()].sort((a, b) => b.minutes - a.minutes);
}

function focusRecordsForRange(mode) {
  const days = mode === "month" ? 30 : 7;
  const start = addDays(new Date(), -(days - 1));
  const startKey = todayKey(start);
  return {
    days,
    startKey,
    records: state.focusRecords.filter((record) => record.date >= startKey)
  };
}

function renderFocusSubjects() {
  state.timer.subjects = normalizeFocusSubjects(state.timer.subjects);
  const selectedTaskSubject = els.checkinSubject?.value || "";
  els.focusSubjectSelect.innerHTML = state.timer.subjects.map((subject) => (
    `<option value="${subject.id}">${htmlEscape(subject.name)}</option>`
  )).join("");
  els.focusSubjectSelect.value = state.timer.activeSubjectId;
  if (els.checkinSubject) {
    els.checkinSubject.innerHTML = [
      '<option value="">不绑定科目</option>',
      ...state.timer.subjects.map((subject) => `<option value="${subject.id}">${htmlEscape(subject.name)}</option>`)
    ].join("");
    els.checkinSubject.value = state.timer.subjects.some((subject) => subject.id === selectedTaskSubject) ? selectedTaskSubject : "";
  }
  els.focusSubjectList.innerHTML = state.timer.subjects.map((subject) => `
    <span class="focus-subject-chip ${subject.id === state.timer.activeSubjectId ? "active" : ""}" style="--subject-color:${subject.color}">
      <button type="button" data-focus-subject-select="${subject.id}">
        <i></i>${htmlEscape(subject.name)}
      </button>
      ${subject.locked ? "" : `<button class="focus-subject-delete" data-focus-subject-delete="${subject.id}" type="button">×</button>`}
    </span>
  `).join("");
}

function renderFocusStackChart() {
  $$("#focusRangeSwitch button").forEach((button) => button.classList.toggle("active", button.dataset.focusRange === activeFocusRange));
  const { days, records } = focusRecordsForRange(activeFocusRange);
  if (!records.length) {
    els.focusStackChart.innerHTML = '<div class="empty-state compact-empty"><strong>暂无阶段记录</strong><span>完成几次计时后会出现周/月统计。</span></div>';
    return;
  }
  const dates = Array.from({ length: days }, (_, index) => todayKey(addDays(new Date(), index - days + 1)));
  const dayTotals = dates.map((date) => {
    const totals = focusSubjectTotals(records.filter((record) => record.date === date));
    const minutes = totals.reduce((sum, item) => sum + item.minutes, 0);
    return { date, totals, minutes };
  });
  const maxMinutes = Math.max(1, ...dayTotals.map((item) => item.minutes));
  els.focusStackChart.innerHTML = `
    <div class="focus-stack-bars ${activeFocusRange === "month" ? "month-bars" : ""}">
      ${dayTotals.map((day) => `
        <div class="focus-stack-day" title="${day.date} · ${formatDuration(day.minutes)}">
          <div class="focus-stack-bar">
            <div class="focus-stack-fill" style="height:${Math.max(day.minutes ? 8 : 0, day.minutes / maxMinutes * 100)}%">
              ${day.totals.map((item) => `<span style="height:${item.minutes / Math.max(1, day.minutes) * 100}%;background:${item.color}" title="${htmlEscape(item.name)} ${formatDuration(item.minutes)}"></span>`).join("")}
            </div>
          </div>
          <small>${activeFocusRange === "month" ? day.date.slice(8) : day.date.slice(5).replace("-", "/")}</small>
        </div>
      `).join("")}
    </div>
    <small>近 ${days} 天，每根柱子代表当天总学习时间，颜色代表科目。</small>
  `;
}

function renderFocusPie(records) {
  const totals = focusSubjectTotals(records);
  const totalMinutes = totals.reduce((sum, item) => sum + item.minutes, 0);
  els.focusChartTotal.textContent = formatDuration(totalMinutes);
  if (!totalMinutes) {
    els.focusPieChart.style.background = "conic-gradient(rgba(255,255,255,0.2) 0 360deg)";
    els.focusPieChart.innerHTML = "<strong>暂无</strong><span>今天</span>";
    els.focusSubjectLegend.innerHTML = '<div class="empty-state compact-empty"><strong>还没有学习记录</strong><span>完成一次计时后会显示分布。</span></div>';
    return;
  }
  let cursor = 0;
  const segments = totals.map((item) => {
    const start = cursor;
    cursor += (item.minutes / totalMinutes) * 360;
    return `${item.color} ${start}deg ${cursor}deg`;
  });
  els.focusPieChart.style.background = `conic-gradient(${segments.join(", ")})`;
  els.focusPieChart.innerHTML = `<strong>${formatDuration(totalMinutes)}</strong><span>今日</span>`;
  els.focusSubjectLegend.innerHTML = totals.map((item) => `
    <div class="focus-legend-row">
      <span><i style="background:${item.color}"></i>${htmlEscape(item.name)}</span>
      <strong>${formatDuration(item.minutes)}</strong>
    </div>
  `).join("");
}

function renderTimer() {
  syncTimerClock();
  const mode = state.timer.mode || "pomodoro";
  const focusSeconds = timerFocusSeconds();
  const subject = activeFocusSubject();
  if (!timerRunning && mode === "pomodoro") timerRemaining = Math.min(timerRemaining || focusSeconds, focusSeconds);
  els.pomodoroModeBtn.classList.toggle("active", mode === "pomodoro");
  els.stopwatchModeBtn.classList.toggle("active", mode === "stopwatch");
  els.timerLabel.textContent = `${subject?.name || "专注"} · ${mode === "pomodoro" ? "番茄" : "正计时"}`;
  els.timerDisplay.textContent = mode === "pomodoro" ? formatTimer(timerRemaining || focusSeconds) : formatTimer(timerElapsed);
  const progress = mode === "pomodoro"
    ? 360 - ((timerRemaining || focusSeconds) / focusSeconds) * 360
    : (timerElapsed % 3600) / 3600 * 360;
  const progressRatio = Math.max(0, Math.min(1, progress / 360));
  els.timerRing.style.setProperty("--timer-ratio", progressRatio.toFixed(4));
  if (els.timerRingProgress) {
    const circumference = 2 * Math.PI * 96;
    els.timerRingProgress.style.strokeDasharray = String(circumference);
    els.timerRingProgress.style.strokeDashoffset = String(circumference * (1 - progressRatio));
  }
  els.timerRing.style.setProperty("--subject-color", subject?.color || "var(--primary)");
  const gradientStops = $("#timerRingGradient")?.querySelectorAll("stop");
  if (gradientStops?.length >= 2) {
    gradientStops[0].setAttribute("stop-color", subject?.color || "#ff6fae");
    gradientStops[1].setAttribute("stop-color", state.settings.theme === "dark" ? "#66d9ff" : "#4fc3f7");
  }
  els.timerStartBtn.textContent = timerRunning ? "暂停" : (mode === "stopwatch" && timerElapsed > 0 ? "继续" : "开始");
  els.timerSaveBtn.hidden = mode !== "stopwatch";
  els.timerSaveBtn.disabled = timerElapsed <= 0;
  els.timerSaveBtn.textContent = timerRunning ? "结束并记录" : "记录本次";
  els.focusMinutes.value = state.timer.focusMinutes;
  els.breakMinutes.value = state.timer.breakMinutes;
  renderFocusSubjects();

  const today = todayKey();
  const todayRecords = state.focusRecords.filter((record) => record.date === today);
  if (!els.focusChartDate.value) els.focusChartDate.value = today;
  const chartDate = els.focusChartDate.value || today;
  const chartRecords = state.focusRecords.filter((record) => record.date === chartDate);
  const todayMinutes = todayRecords.reduce((sum, record) => sum + Number(record.minutes || 0), 0);
  const totalMinutes = state.focusRecords.reduce((sum, record) => sum + Number(record.minutes || 0), 0);
  els.todayPomodoroCount.textContent = todayRecords.length;
  els.todayFocusMinutes.textContent = formatDuration(todayMinutes);
  els.totalPomodoroCount.textContent = state.focusRecords.length;
  els.totalFocusMinutes.textContent = formatDuration(totalMinutes);
  renderFocusPie(chartRecords);
  renderFocusStackChart();
  els.focusRecords.innerHTML = state.focusRecords.length ? "" : '<div class="empty-state"><strong>暂无记录</strong><span>完成一次专注后会显示在这里。</span></div>';
  for (const record of state.focusRecords.slice(0, 8)) {
    const itemSubject = focusSubjectForRecord(record);
    const item = document.createElement("div");
    item.className = "focus-record";
    item.style.setProperty("--subject-color", itemSubject.color);
    item.innerHTML = `
      <span>${record.date} ${record.time}</span>
      ${record.taskText ? `<small>${htmlEscape(record.taskText)}</small>` : ""}
      <em>${htmlEscape(itemSubject.name)}</em>
      <strong>${formatDuration(Number(record.minutes || 0))}</strong>
    `;
    els.focusRecords.append(item);
  }
}

function htmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function examDaysLeft() {
  const target = dateFromKey(state.exam.targetDate || todayKey());
  const today = dateFromKey(todayKey());
  return Math.ceil((target - today) / 86400000);
}

function examStage(days) {
  if (days > 180) return "基础期：把教材、单词和核心概念过第一遍。";
  if (days > 90) return "强化期：主攻题型、错题和知识框架。";
  if (days > 30) return "冲刺期：套卷、限时训练和高频背诵。";
  if (days >= 0) return "临考期：稳节奏、查漏补缺、保持手感。";
  return "考试已过：适合做总结、复盘和下一阶段规划。";
}

function examReviewLabel(type) {
  return type === "weekly" ? "每周复盘" : "每日复盘";
}

function examMemoryDueItems() {
  const today = todayKey();
  return (state.exam.memoryItems || [])
    .filter((item) => !item.archived && (!item.nextReview || item.nextReview <= today))
    .sort((a, b) => (a.nextReview || today).localeCompare(b.nextReview || today) || (a.level || 0) - (b.level || 0));
}

function studyScoreForDate(key) {
  const parentDoneTasks = state.tasks.filter((task) => task.done && (task.completedDate || task.date) === key).length;
  const subtaskDoneTasks = state.tasks.reduce((sum, task) => (
    sum + (task.subtasks || []).filter((subtask) => subtask.done && (subtask.completedDate || task.completedDate || task.date) === key).length
  ), 0);
  const doneTasks = parentDoneTasks + subtaskDoneTasks;
  const focusMinutes = state.focusRecords.filter((record) => record.date === key).reduce((sum, record) => sum + Number(record.minutes || 0), 0);
  const wordReviews = (state.wordReviewRecords || []).filter((record) => record.date === key).length;
  const examReviews = (state.exam.reviews || []).filter((record) => record.date === key).length;
  const memoReviews = (state.exam.memoryRecords || []).filter((record) => record.date === key).length;
  const score = doneTasks * 2 + Math.floor(focusMinutes / 25) + Math.ceil((wordReviews + memoReviews) / 8) + examReviews * 2;
  return { doneTasks, parentDoneTasks, subtaskDoneTasks, focusMinutes, wordReviews, examReviews, memoReviews, score, level: Math.min(4, score) };
}

function examStudyStreak() {
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = todayKey(cursor);
    if (!studyScoreForDate(key).score) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function renderExamStats() {
  const today = todayKey();
  const todayStats = studyScoreForDate(today);
  const totalFocus = state.focusRecords.reduce((sum, record) => sum + Number(record.minutes || 0), 0);
  const dueMemory = examMemoryDueItems().length;
  const reviewCount = (state.exam.reviews || []).length;
  els.examStats.innerHTML = [
    ["今日完成", `${todayStats.doneTasks} 项`, "来自打卡完成记录"],
    ["今日专注", formatDuration(todayStats.focusMinutes), "来自番茄钟"],
    ["待复习背诵", `${dueMemory} 个`, "按记忆曲线计算"],
    ["累计复盘", `${reviewCount} 次`, `累计专注 ${formatDuration(totalFocus)}`]
  ].map(([label, value, hint]) => `
    <div>
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${hint}</small>
    </div>
  `).join("");
}

function tasksForTodayQueue() {
  const today = todayKey();
  return state.tasks
    .filter((task) => !task.done && (task.date === today || task.date < today))
    .sort((a, b) => a.date.localeCompare(b.date) || b.createdAt - a.createdAt);
}

function renderExamStart() {
  const today = todayKey();
  const yesterday = todayKey(addDays(new Date(), -1));
  const todayStats = studyScoreForDate(today);
  const yesterdayReview = (state.exam.reviews || []).find((review) => review.date === yesterday);
  const dueMemory = examMemoryDueItems();
  const dueWords = state.words.filter((word) => (word.reviews || 0) > 0 && word.nextReview <= today).length;
  const tasks = tasksForTodayQueue();
  els.examTodayDate.textContent = today;
  els.examStartGrid.innerHTML = [
    {
      title: "今日任务",
      value: `${tasks.length} 项`,
      body: tasks.slice(0, 4).map((task) => `<span>${task.date < today ? "已逾期 · " : ""}${htmlEscape(task.text)}</span>`).join("") || "<span>目前没有未完成任务。</span>"
    },
    {
      title: "待复习",
      value: `${dueMemory.length + dueWords} 项`,
      body: `<span>考研背诵 ${dueMemory.length} 个</span><span>单词复习 ${dueWords} 个</span>`
    },
    {
      title: "今日专注",
      value: formatDuration(todayStats.focusMinutes),
      body: `<span>完成任务 ${todayStats.doneTasks} 项</span><span>学习强度 ${todayStats.score}</span>`
    },
    {
      title: "昨日复盘",
      value: yesterdayReview ? "已记录" : "未记录",
      body: yesterdayReview
        ? `<span>${htmlEscape(yesterdayReview.next || plainText(yesterdayReview.content).slice(0, 36) || "继续保持节奏")}</span>`
        : "<span>建议先补一条昨日复盘，方便今天调整。</span>"
    }
  ].map((card) => `
    <article class="exam-start-card">
      <strong>${card.title}</strong>
      <b>${card.value}</b>
      <div>${card.body}</div>
    </article>
  `).join("");
}

function examWeekDates() {
  const end = new Date();
  const start = addDays(end, -6);
  const dates = [];
  for (let index = 0; index < 7; index += 1) {
    dates.push(todayKey(addDays(start, index)));
  }
  return dates;
}

function examReportSummary(dates) {
  return dates.reduce((summary, date) => {
    const stats = studyScoreForDate(date);
    summary.doneTasks += stats.doneTasks;
    summary.focusMinutes += stats.focusMinutes;
    summary.wordReviews += stats.wordReviews;
    summary.memoReviews += stats.memoReviews;
    summary.studyDays += stats.score > 0 ? 1 : 0;
    return summary;
  }, {
    doneTasks: 0,
    focusMinutes: 0,
    wordReviews: 0,
    memoReviews: 0,
    studyDays: 0
  });
}

function createExamWeeklyReport() {
  const dates = examWeekDates();
  const summary = examReportSummary(dates);
  const start = dates[0];
  const end = dates[dates.length - 1];
  const weeklyReviews = (state.exam.reviews || [])
    .filter((review) => review.date >= start && review.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  const dailyRows = dates.map((date) => {
    const stats = studyScoreForDate(date);
    return `| ${date} | ${stats.doneTasks} | ${formatDuration(stats.focusMinutes)} | ${stats.wordReviews} | ${stats.memoReviews} |`;
  }).join("\n");
  const reviewText = weeklyReviews.length
    ? weeklyReviews.map((review) => `- ${review.date} ${examReviewLabel(review.type)}：${plainText(review.content).slice(0, 80)}${review.next ? `；下一步：${plainText(review.next).slice(0, 60)}` : ""}`).join("\n")
    : "- 本周还没有复盘记录，可以先补一条本周总结。";
  const title = `考研周报 ${start} 至 ${end}`;
  const content = `# ${title}

## 本周概览

- 学习天数：${summary.studyDays} / 7 天
- 完成任务：${summary.doneTasks} 项
- 专注时长：${formatDuration(summary.focusMinutes)}
- 单词复习：${summary.wordReviews} 个
- 考研背诵复习：${summary.memoReviews} 个

## 每日数据

| 日期 | 完成任务 | 专注时长 | 单词复习 | 背诵复习 |
| --- | ---: | ---: | ---: | ---: |
${dailyRows}

## 复盘摘要

${reviewText}

## 下周计划

- 
- 
- 
`;
  const post = {
    id: crypto.randomUUID(),
    title,
    summary: `最近 7 天完成 ${summary.doneTasks} 项任务，专注 ${formatDuration(summary.focusMinutes)}。`,
    category: "考研",
    status: "published",
    date: end,
    tags: ["考研", "周报"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    content
  };
  state.posts.unshift(post);
  state.exam.reports = state.exam.reports || [];
  state.exam.reports.unshift({
    id: crypto.randomUUID(),
    postId: post.id,
    start,
    end,
    createdAt: Date.now(),
    summary
  });
  activePostId = post.id;
  persist();
  switchView("editor");
}

function weekDatesEnding(endKey) {
  const end = dateFromKey(endKey);
  const start = addDays(end, -6);
  const dates = [];
  for (let index = 0; index < 7; index += 1) {
    dates.push(todayKey(addDays(start, index)));
  }
  return dates;
}

function lastSundayKey(date = new Date()) {
  return todayKey(addDays(date, -date.getDay()));
}

function buildExamWeeklyReport(dates) {
  const summary = examReportSummary(dates);
  const start = dates[0];
  const end = dates[dates.length - 1];
  const weeklyReviews = (state.exam.reviews || [])
    .filter((review) => review.date >= start && review.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  const dailyRows = dates.map((date) => {
    const stats = studyScoreForDate(date);
    return `| ${date} | ${stats.doneTasks} | ${formatDuration(stats.focusMinutes)} | ${stats.wordReviews} | ${stats.memoReviews} |`;
  }).join("\n");
  const reviewText = weeklyReviews.length
    ? weeklyReviews.map((review) => `- ${review.date} ${examReviewLabel(review.type)}：${plainText(review.content).slice(0, 80)}${review.next ? `；下一步：${plainText(review.next).slice(0, 60)}` : ""}`).join("\n")
    : "- 本周还没有复盘记录，可以补一条本周总结。";
  const title = `考研周报 ${start} 至 ${end}`;
  const content = `# ${title}

## 本周概览

- 学习天数：${summary.studyDays} / 7 天
- 完成任务：${summary.doneTasks} 项
- 专注时长：${formatDuration(summary.focusMinutes)}
- 单词复习：${summary.wordReviews} 个
- 考研背诵复习：${summary.memoReviews} 个

## 每日数据

| 日期 | 完成任务 | 专注时长 | 单词复习 | 背诵复习 |
| --- | ---: | ---: | ---: | ---: |
${dailyRows}

## 复盘摘要

${reviewText}

## 下周计划

- 
- 
- 
`;
  return { title, content, summary, start, end };
}

function upsertExamWeeklyReport({ dates = examWeekDates(), auto = false, open = false } = {}) {
  state.exam.reports = state.exam.reports || [];
  const reportData = buildExamWeeklyReport(dates);
  let report = state.exam.reports.find((item) => item.start === reportData.start && item.end === reportData.end);
  let post = report?.postId ? state.posts.find((item) => item.id === report.postId) : null;
  let changed = false;
  if (!post) {
    post = {
      id: crypto.randomUUID(),
      title: reportData.title,
      summary: `本周完成 ${reportData.summary.doneTasks} 项任务，专注 ${formatDuration(reportData.summary.focusMinutes)}。`,
      category: "考研",
      status: "published",
      date: reportData.end,
      tags: ["考研", "周报"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      content: reportData.content
    };
    state.posts.unshift(post);
    changed = true;
  }
  const nextSummary = `本周完成 ${reportData.summary.doneTasks} 项任务，专注 ${formatDuration(reportData.summary.focusMinutes)}。`;
  const postNeedsUpdate = post.title !== reportData.title
    || post.summary !== nextSummary
    || post.category !== "考研"
    || post.status !== "published"
    || post.date !== reportData.end
    || JSON.stringify(post.tags || []) !== JSON.stringify(["考研", "周报"])
    || post.content !== reportData.content;
  if (postNeedsUpdate) {
    Object.assign(post, {
      title: reportData.title,
      summary: nextSummary,
      category: "考研",
      status: "published",
      date: reportData.end,
      tags: ["考研", "周报"],
      content: reportData.content,
      updatedAt: Date.now()
    });
    changed = true;
  }
  if (!report) {
    report = {
      id: crypto.randomUUID(),
      postId: post.id,
      start: reportData.start,
      end: reportData.end,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      auto,
      summary: reportData.summary
    };
    state.exam.reports.unshift(report);
    changed = true;
  } else {
    const nextReport = {
      ...report,
      postId: post.id,
      updatedAt: Date.now(),
      auto: Boolean(report.auto || auto),
      summary: reportData.summary
    };
    if (JSON.stringify(report.summary) !== JSON.stringify(nextReport.summary) || report.postId !== nextReport.postId || report.auto !== nextReport.auto) {
      Object.assign(report, nextReport);
      changed = true;
    }
  }
  if (open) {
    activePostId = post.id;
    persist();
    switchView("reader");
  }
  return { report, post, changed };
}

function createExamWeeklyReport() {
  upsertExamWeeklyReport({ dates: examWeekDates(), auto: false, open: true });
}

function ensureAutoWeeklyReport() {
  const end = lastSundayKey();
  const dates = weekDatesEnding(end);
  const existing = (state.exam.reports || []).find((item) => item.start === dates[0] && item.end === end);
  if (existing && todayKey() !== end) return;
  const result = upsertExamWeeklyReport({ dates, auto: true, open: false });
  if (result.changed) api.save(state);
}

function renderExamReports() {
  if (!els.examReportList) return;
  const reports = [...(state.exam.reports || [])].sort((a, b) => b.end.localeCompare(a.end)).slice(0, 8);
  els.examReportList.innerHTML = reports.length ? reports.map((report) => `
    <article class="exam-report-item">
      <div>
        <strong>${report.start} 至 ${report.end}</strong>
        <span>${report.auto ? "自动周报" : "手动周报"} · ${formatDateTime(report.updatedAt || report.createdAt)}</span>
      </div>
      <p>学习 ${report.summary?.studyDays || 0}/7 天，完成 ${report.summary?.doneTasks || 0} 项，专注 ${formatDuration(report.summary?.focusMinutes || 0)}</p>
      <button class="ghost-button compact" data-exam-report-open="${report.postId}" type="button">查看</button>
    </article>
  `).join("") : '<div class="empty-state"><strong>还没有周报</strong><span>每周日会自动生成；也可以点击右上角“生成周报”。</span></div>';
}

function renderExamReviews() {
  const reviews = [...(state.exam.reviews || [])].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 8);
  els.examReviewList.innerHTML = reviews.length ? reviews.map((review) => `
    <article class="exam-review-item">
      <div>
        <strong>${examReviewLabel(review.type)} · ${review.date}</strong>
        <button class="task-delete" data-exam-review-delete="${review.id}" type="button">×</button>
      </div>
      <p>${htmlEscape(review.content)}</p>
      ${review.next ? `<small>下一步：${htmlEscape(review.next)}</small>` : ""}
    </article>
  `).join("") : '<div class="empty-state"><strong>还没有复盘</strong><span>保存一次每日或每周复盘后会显示在这里。</span></div>';
}

function renderExamMemory() {
  const due = examMemoryDueItems();
  els.examMemoryDueCount.textContent = `${due.length} 个待复习`;
  const items = due.length ? due : [...(state.exam.memoryItems || [])].filter((item) => !item.archived).slice(0, 6);
  els.examMemoryList.innerHTML = items.length ? items.map((item) => `
    <article class="exam-memory-item">
      <div class="memory-item-head">
        <div>
          <strong>${htmlEscape(item.title)}</strong>
          <span>${htmlEscape(item.subject || "未分类")} · ${item.nextReview || "今天"} · ${item.reviews || 0} 次</span>
        </div>
        <button class="task-delete" data-exam-memory-delete="${item.id}" type="button">×</button>
      </div>
      <p>${htmlEscape(item.content)}</p>
      <div class="memory-actions">
        <button class="ghost-button compact" data-exam-memory-quality="again" data-memory-id="${item.id}" type="button">不熟</button>
        <button class="ghost-button compact" data-exam-memory-quality="hard" data-memory-id="${item.id}" type="button">模糊</button>
        <button class="primary-button compact" data-exam-memory-quality="known" data-memory-id="${item.id}" type="button">掌握</button>
      </div>
    </article>
  `).join("") : '<div class="empty-state"><strong>还没有背诵任务</strong><span>可以添加政治、英语作文、专业课名词解释等内容。</span></div>';
}

function renderExamBadges() {
  const totalFocus = state.focusRecords.reduce((sum, record) => sum + Number(record.minutes || 0), 0);
  const streak = examStudyStreak();
  const reviewCount = (state.exam.reviews || []).length;
  const memoKnown = (state.exam.memoryItems || []).filter((item) => (item.level || 0) >= 4).length;
  const badges = [
    ["countdown", "倒计时启动", Boolean(state.exam.targetDate), "设置初试日期"],
    ["streak7", "连续 7 天", streak >= 7, `当前 ${streak} 天`],
    ["focus10h", "专注 10 小时", totalFocus >= 600, `累计 ${formatDuration(totalFocus)}`],
    ["review7", "复盘 7 次", reviewCount >= 7, `已复盘 ${reviewCount} 次`],
    ["memory5", "背诵破冰", (state.exam.memoryItems || []).length >= 5, `${state.exam.memoryItems.length} 个任务`],
    ["known10", "掌握 10 条", memoKnown >= 10, `已掌握 ${memoKnown} 条`]
  ];
  const unlockedBefore = new Set(state.exam.unlockedBadges || []);
  const newlyUnlocked = badges.filter(([id, , unlocked]) => unlocked && !unlockedBefore.has(id)).map(([id]) => id);
  if (newlyUnlocked.length) {
    state.exam.unlockedBadges = [...unlockedBefore, ...newlyUnlocked];
    api.save(state);
  }
  els.examBadges.innerHTML = badges.map(([id, title, unlocked, hint]) => `
    <div class="exam-badge ${unlocked ? "unlocked" : ""} ${newlyUnlocked.includes(id) ? "just-unlocked" : ""}">
      <strong>${unlocked ? "✓" : "·"}</strong>
      <span>${title}</span>
      <small>${hint}</small>
    </div>
  `).join("");
}

function examHeatCell({ level, label, title, tasks = 0, minutes = 0, compact = false }) {
  const taskStrength = Math.min(1, tasks / 4);
  const focusStrength = Math.min(1, minutes / (compact ? 600 : 180));
  return `
    <span class="heat-${level} ${tasks || minutes ? "has-activity" : ""}" title="${title}" style="--task-strength:${taskStrength};--focus-strength:${focusStrength}">
      <b>${label}</b>
      <i class="heat-focus" style="height:${Math.max(minutes ? 8 : 0, focusStrength * 100)}%"></i>
      <em>${tasks ? `${tasks}项` : ""}${tasks && minutes ? " · " : ""}${minutes ? formatDuration(minutes) : ""}</em>
    </span>
  `;
}

function renderExamHeatmap() {
  const mode = state.exam.heatmapMode || "daily";
  $$("#examHeatmapMode button").forEach((button) => button.classList.toggle("active", button.dataset.heatmapMode === mode));
  els.examHeatmap.className = `exam-heatmap mode-${mode}`;
  if (mode === "weekly") {
    els.examHeatmapRange.textContent = "近 26 周学习强度";
    const start = new Date();
    start.setDate(start.getDate() - 25 * 7);
    const cells = [];
    for (let index = 0; index < 26; index += 1) {
      const weekStart = addDays(start, index * 7);
      let score = 0;
      let minutes = 0;
      let tasks = 0;
      for (let day = 0; day < 7; day += 1) {
        const stats = studyScoreForDate(todayKey(addDays(weekStart, day)));
        score += stats.score;
        minutes += stats.focusMinutes;
        tasks += stats.doneTasks;
      }
      const level = Math.min(4, Math.ceil(score / 6));
      const key = todayKey(weekStart);
      const label = `${key} 起：完成 ${tasks} 项，专注 ${formatDuration(minutes)}`;
      cells.push(examHeatCell({
        level,
        label: key.slice(5).replace("-", "/"),
        title: label,
        tasks,
        minutes,
        compact: true
      }));
    }
    els.examHeatmap.innerHTML = cells.join("");
    return;
  }
  if (mode === "monthly") {
    els.examHeatmapRange.textContent = "近 12 个月学习强度";
    const now = new Date();
    const cells = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const month = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      let cursor = new Date(month);
      let score = 0;
      let minutes = 0;
      let tasks = 0;
      while (cursor < nextMonth && cursor <= now) {
        const stats = studyScoreForDate(todayKey(cursor));
        score += stats.score;
        minutes += stats.focusMinutes;
        tasks += stats.doneTasks;
        cursor.setDate(cursor.getDate() + 1);
      }
      const level = Math.min(4, Math.ceil(score / 18));
      const label = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}：完成 ${tasks} 项，专注 ${formatDuration(minutes)}`;
      cells.push(examHeatCell({
        level,
        label: `${String(month.getFullYear()).slice(2)}/${month.getMonth() + 1}`,
        title: label,
        tasks,
        minutes,
        compact: true
      }));
    }
    els.examHeatmap.innerHTML = cells.join("");
    return;
  }
  els.examHeatmapRange.textContent = "近 14 周学习强度";
  const start = new Date();
  start.setDate(start.getDate() - 97);
  const cells = [];
  for (let index = 0; index < 98; index += 1) {
    const date = addDays(start, index);
    const key = todayKey(date);
    const stats = studyScoreForDate(key);
    const title = `${key}：完成 ${stats.doneTasks} 项，专注 ${formatDuration(stats.focusMinutes)}，复习 ${stats.wordReviews + stats.memoReviews}`;
    cells.push(examHeatCell({
      level: stats.level,
      label: key.slice(5).replace("-", "/"),
      title,
      tasks: stats.doneTasks,
      minutes: stats.focusMinutes
    }));
  }
  els.examHeatmap.innerHTML = cells.join("");
}

function reviewExamMemory(itemId, quality) {
  const item = (state.exam.memoryItems || []).find((entry) => entry.id === itemId);
  if (!item) return;
  const intervals = quality === "again" ? [0, 1, 1, 2, 3, 5] : quality === "hard" ? [1, 1, 2, 3, 5, 7] : [1, 2, 4, 7, 15, 30];
  item.level = quality === "again" ? Math.max(0, Number(item.level || 0) - 1) : Math.min(6, Number(item.level || 0) + (quality === "known" ? 1 : 0));
  item.reviews = Number(item.reviews || 0) + 1;
  item.lastReview = todayKey();
  item.nextReview = todayKey(addDays(new Date(), intervals[Math.min(item.level, intervals.length - 1)]));
  state.exam.memoryRecords = state.exam.memoryRecords || [];
  state.exam.memoryRecords.unshift({
    id: crypto.randomUUID(),
    itemId,
    date: todayKey(),
    quality,
    createdAt: Date.now()
  });
  persist();
}

function renderExam() {
  if (initialDataLoaded) ensureAutoWeeklyReport();
  state.exam = { ...structuredClone(defaultState.exam), ...(state.exam || {}) };
  const days = examDaysLeft();
  els.examTargetDate.value = state.exam.targetDate || "";
  els.examGoalText.value = state.exam.goalText || "";
  if (!els.examReviewDate.value) els.examReviewDate.value = todayKey();
  els.examCountdownDays.textContent = days >= 0 ? `${days} 天` : `已过 ${Math.abs(days)} 天`;
  els.examStageText.textContent = `${examStage(days)} ${state.exam.goalText ? `目标：${state.exam.goalText}` : ""}`;
  els.examFocusToggleBtn.textContent = state.exam.focusMode ? "退出考研专注" : "考研专注模式";
  renderExamStats();
  renderExamReports();
  renderExamStart();
  renderExamReviews();
  renderExamMemory();
  renderExamBadges();
  renderExamHeatmap();
}

function timerFocusSeconds() {
  return Math.max(1, Number(state.timer.focusMinutes || 25)) * 60;
}

function syncTimerClock() {
  if (!timerRunning || !timerStartedAt) return;
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - timerStartedAt) / 1000));
  if (state.timer.mode === "pomodoro") {
    timerRemaining = Math.max(0, timerStartRemaining - elapsedSeconds);
    if (timerRemaining <= 0) {
      stopTimer({ sync: false });
      timerRemaining = Number(state.timer.breakMinutes || 5) * 60;
      completeFocus(Number(state.timer.focusMinutes || 25));
    }
  } else {
    timerElapsed = elapsedSeconds;
  }
}

function startTimer() {
  if (timerRunning) return;
  const mode = state.timer.mode || "pomodoro";
  if (mode === "pomodoro") {
    timerRemaining = timerRemaining || timerFocusSeconds();
    timerStartRemaining = timerRemaining;
    timerStartedAt = Date.now();
  } else {
    timerStartedAt = Date.now() - Math.max(0, timerElapsed) * 1000;
  }
  timerRunning = true;
  timerInterval = setInterval(tickTimer, 1000);
}

function stopTimer({ sync = true } = {}) {
  if (sync) syncTimerClock();
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  timerStartedAt = 0;
  timerStartRemaining = timerRemaining;
}

function completeFocus(minutes) {
  const now = new Date();
  const subject = activeFocusSubject();
  const task = activeFocusTaskId ? findTask(activeFocusTaskId) : null;
  state.focusRecords.unshift({
    id: crypto.randomUUID(),
    date: todayKey(now),
    time: now.toTimeString().slice(0, 5),
    minutes,
    subjectId: subject?.id || "uncategorized",
    subjectName: subject?.name || "未分类",
    subjectColor: subject?.color || "#9b96b5",
    taskId: task?.id || "",
    taskText: task?.text || ""
  });
  activeFocusTaskId = null;
  persist();
  notifyDesktop("\u4e13\u6ce8\u5df2\u8bb0\u5f55", `${subject?.name || "\u4e13\u6ce8"} \u00b7 ${formatDuration(minutes)}`);
}

function tickTimer() {
  syncTimerClock();
  renderTimer();
}

function stopDefaultMusic() {
  clearInterval(synthTimer);
  synthTimer = null;
}

async function playDefaultMusic() {
  synthContext = synthContext || new AudioContext();
  await synthContext.resume();
  const notes = [261.63, 329.63, 392, 523.25, 392, 329.63];
  stopDefaultMusic();
  synthTimer = setInterval(() => {
    const oscillator = synthContext.createOscillator();
    const gain = synthContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = notes[synthStep % notes.length];
    gain.gain.setValueAtTime(0.0001, synthContext.currentTime);
    gain.gain.exponentialRampToValueAtTime((state.settings.musicVolume ?? 0.35) * 0.08, synthContext.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, synthContext.currentTime + 1.4);
    oscillator.connect(gain).connect(synthContext.destination);
    oscillator.start();
    oscillator.stop(synthContext.currentTime + 1.5);
    synthStep += 1;
  }, 1500);
}

async function toggleMusic() {
  if (musicPlaying) {
    musicAudio.pause();
    stopDefaultMusic();
    musicPlaying = false;
    renderSettings();
    return;
  }
  musicPlaying = true;
  if (state.settings.musicSrc) {
    stopDefaultMusic();
    musicAudio.src = state.settings.musicSrc;
    musicAudio.loop = true;
    musicAudio.volume = state.settings.musicVolume ?? 0.35;
    await musicAudio.play();
  } else {
    musicAudio.pause();
    await playDefaultMusic();
  }
  renderSettings();
}

function armMusicAutoplayUnlock() {
  if (musicAutoplayArmed || musicPlaying) return;
  musicAutoplayArmed = true;
  const resume = () => {
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("keydown", resume);
    musicAutoplayArmed = false;
    tryAutoplayMusic();
  };
  window.addEventListener("pointerdown", resume, { once: true });
  window.addEventListener("keydown", resume, { once: true });
}

function tryAutoplayMusic() {
  if (musicPlaying) return;
  musicAudio.volume = state.settings.musicVolume ?? 0.35;
  toggleMusic().catch(() => {
    musicPlaying = false;
    musicAudio.pause();
    stopDefaultMusic();
    renderSettings();
    armMusicAutoplayUnlock();
  });
}

function initMusicAutoplay() {
  musicAudio.volume = state.settings.musicVolume ?? 0.35;
  requestAnimationFrame(tryAutoplayMusic);
}

async function openAvatarCrop(file) {
  const src = await fileToDataUrl(file);
  avatarCrop = {
    src,
    scale: 1,
    minScale: 0.1,
    maxScale: 8,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0
  };
  els.cropImage.src = src;
  els.avatarCropModal.classList.add("active");
  els.avatarCropModal.setAttribute("aria-hidden", "false");
  els.cropImage.onload = resetAvatarCrop;
}

function resetAvatarCrop() {
  if (!avatarCrop) return;
  const box = els.cropBox.getBoundingClientRect();
  const image = els.cropImage;
  const coverScale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight);
  avatarCrop.minScale = Math.max(0.04, coverScale * 1.01);
  avatarCrop.maxScale = Math.max(avatarCrop.minScale * 10, 8);
  avatarCrop.scale = coverScale;
  avatarCrop.offsetX = 0;
  avatarCrop.offsetY = 0;
  applyCropTransform();
}

function clampAvatarCrop() {
  if (!avatarCrop) return;
  const box = els.cropBox.getBoundingClientRect();
  const image = els.cropImage;
  avatarCrop.scale = Math.min(avatarCrop.maxScale, Math.max(avatarCrop.minScale, avatarCrop.scale));
  const imageWidth = image.naturalWidth * avatarCrop.scale;
  const imageHeight = image.naturalHeight * avatarCrop.scale;
  const maxOffsetX = Math.max(0, (imageWidth - box.width) / 2);
  const maxOffsetY = Math.max(0, (imageHeight - box.height) / 2);
  avatarCrop.offsetX = Math.min(maxOffsetX, Math.max(-maxOffsetX, avatarCrop.offsetX));
  avatarCrop.offsetY = Math.min(maxOffsetY, Math.max(-maxOffsetY, avatarCrop.offsetY));
}

function applyCropTransform() {
  if (!avatarCrop) return;
  clampAvatarCrop();
  els.cropImage.style.width = `${els.cropImage.naturalWidth * avatarCrop.scale}px`;
  els.cropImage.style.height = `${els.cropImage.naturalHeight * avatarCrop.scale}px`;
  els.cropImage.style.transform = `translate(calc(-50% + ${avatarCrop.offsetX}px), calc(-50% + ${avatarCrop.offsetY}px))`;
}

function closeAvatarCrop() {
  avatarCrop = null;
  els.avatarUpload.value = "";
  els.avatarCropModal.classList.remove("active");
  els.avatarCropModal.setAttribute("aria-hidden", "true");
}

function openAvatarConfirm() {
  els.avatarConfirmModal.classList.add("active");
  els.avatarConfirmModal.setAttribute("aria-hidden", "false");
}

function closeAvatarConfirm() {
  els.avatarConfirmModal.classList.remove("active");
  els.avatarConfirmModal.setAttribute("aria-hidden", "true");
}

async function saveAvatarCrop() {
  if (!avatarCrop) return;
  const stage = els.cropStage.getBoundingClientRect();
  const box = els.cropBox.getBoundingClientRect();
  const image = els.cropImage;
  const imageRect = image.getBoundingClientRect();
  const scaleX = image.naturalWidth / imageRect.width;
  const scaleY = image.naturalHeight / imageRect.height;
  const sx = (box.left - imageRect.left) * scaleX;
  const sy = (box.top - imageRect.top) * scaleY;
  const sw = box.width * scaleX;
  const sh = box.height * scaleY;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  context.drawImage(image, sx, sy, sw, sh, 0, 0, 256, 256);
  const dataUrl = canvas.toDataURL("image/webp", 0.86);
  state.settings.avatar = await api.uploadDataUrl("avatars", "avatar.webp", dataUrl);
  closeAvatarCrop();
  persist();
}

function bytesLabel(bytes) {
  if (!Number.isFinite(bytes)) return "\u672a\u77e5";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value) {
  if (!value) return "\u5c1a\u672a\u8bb0\u5f55";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u5c1a\u672a\u8bb0\u5f55";
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function mediaPayloadSize() {
  const background = state.settings.background?.length || 0;
  const avatar = state.settings.avatar?.length || 0;
  const music = state.settings.musicSrc?.length || 0;
  const photos = state.photoWalls.reduce((sum, wall) => sum + wall.photos.reduce((photoSum, photo) => photoSum + (photo.src?.length || 0), 0), 0);
  return Math.round((background + avatar + music + photos) * 0.75);
}

function spawnCursorRipple(x, y) {
  if (!window.matchMedia("(pointer: fine)").matches) return;
  const ripple = document.createElement("span");
  ripple.className = "cursor-ripple";
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;
  document.body.append(ripple);
  ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
}

function spawnCursorStar(x, y) {
  if (!window.matchMedia("(pointer: fine)").matches) return;
  const now = performance.now();
  if (now - lastTrailAt < 46) return;
  lastTrailAt = now;
  const star = document.createElement("span");
  star.className = "cursor-star";
  star.style.left = `${x + (Math.random() * 18 - 9)}px`;
  star.style.top = `${y + (Math.random() * 18 - 9)}px`;
  star.style.setProperty("--star-x", `${Math.random() * 28 - 14}px`);
  star.style.setProperty("--star-y", `${Math.random() * 22 - 32}px`);
  document.body.append(star);
  star.addEventListener("animationend", () => star.remove(), { once: true });
}

function updateMagicCursor(event) {
  if (!window.matchMedia("(pointer: fine)").matches) return;
  const cursor = $("#magicCursor");
  if (!cursor) return;
  cursorVisible = true;
  document.body.classList.add("magic-cursor-active");
  cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
  const interactive = event.target.closest?.("button, a, input, textarea, select, label, .photo-card, [role='button']");
  cursor.classList.toggle("is-hovering", Boolean(interactive));
  spawnCursorStar(event.clientX, event.clientY);
}

function hideMagicCursor() {
  if (!cursorVisible) return;
  cursorVisible = false;
  document.body.classList.remove("magic-cursor-active");
}

function recentDateKeys(days = 7) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return todayKey(date);
  });
}

function renderDataDashboard() {
  if (!els.dataDashboard) return;
  const keys = recentDateKeys(7);
  const stats = keys.map((key) => ({ key, ...dayActivityStats(key) }));
  const totalFocus = stats.reduce((sum, item) => sum + item.focusMinutes, 0);
  const totalDone = stats.reduce((sum, item) => sum + item.doneTasks, 0);
  const activeDays = stats.filter((item) => item.doneTasks || item.focusMinutes || item.wordReviews || item.examReviews || item.memoReviews).length;
  const dueTasks = state.tasks.filter((task) => task.date <= todayKey()).length;
  const doneTasks = state.tasks.filter((task) => task.done).length;
  const completion = dueTasks ? Math.round(doneTasks / dueTasks * 100) : 0;
  const focusRecords = state.focusRecords.filter((record) => keys.includes(record.date));
  const subjectTotals = focusSubjectTotals(focusRecords).slice(0, 5);
  const maxFocus = Math.max(1, ...stats.map((item) => item.focusMinutes));
  const maxDone = Math.max(1, ...stats.map((item) => item.doneTasks));
  const topSubject = subjectTotals[0];
  els.dataDashboard.innerHTML = `
    <section class="dashboard-hero">
      <div>
        <p class="eyebrow">Dashboard</p>
        <h3>\u5b66\u4e60\u6570\u636e\u4eea\u8868\u76d8</h3>
        <span>\u8fd1 7 \u5929\u5b8c\u6210 ${totalDone} \u9879\uff0c\u4e13\u6ce8 ${formatDuration(totalFocus)}\uff0c\u6d3b\u8dc3 ${activeDays}/7 \u5929\u3002</span>
      </div>
      <div class="dashboard-ring" style="--completion:${completion * 3.6}deg">
        <strong>${completion}%</strong>
        <small>\u4efb\u52a1\u5b8c\u6210</small>
      </div>
    </section>
    <section class="dashboard-grid">
      <article>
        <span>\u672c\u5468\u6700\u591a\u79d1\u76ee</span>
        <strong>${topSubject ? htmlEscape(topSubject.name) : "\u6682\u65e0"}</strong>
        <small>${topSubject ? formatDuration(topSubject.minutes) : "\u5b8c\u6210\u8ba1\u65f6\u540e\u4f1a\u663e\u793a"}</small>
      </article>
      <article>
        <span>\u5f85\u529e\u538b\u529b</span>
        <strong>${Math.max(0, dueTasks - doneTasks)}</strong>
        <small>\u5230\u4eca\u5929\u4e3a\u6b62\u672a\u5b8c\u6210</small>
      </article>
      <article>
        <span>\u8fde\u7eed\u6253\u5361</span>
        <strong>${calculateStreak()} \u5929</strong>
        <small>\u5b8c\u6210\u4efb\u52a1\u5373\u8ba1\u5165</small>
      </article>
    </section>
    <section class="dashboard-trend">
      <div class="dashboard-section-head">
        <strong>\u8fd1 7 \u5929\u8d8b\u52bf</strong>
        <span>\u7c89\u8272=\u4efb\u52a1\uff0c\u84dd\u8272=\u4e13\u6ce8</span>
      </div>
      <div class="dashboard-bars">
        ${stats.map((item) => `
          <div class="dashboard-day" title="${item.key} \u00b7 ${item.doneTasks} \u9879 \u00b7 ${formatDuration(item.focusMinutes)}">
            <span class="task-bar" style="height:${Math.max(item.doneTasks ? 12 : 4, item.doneTasks / maxDone * 100)}%"></span>
            <span class="focus-bar" style="height:${Math.max(item.focusMinutes ? 12 : 4, item.focusMinutes / maxFocus * 100)}%"></span>
            <small>${item.key.slice(5).replace("-", "/")}</small>
          </div>
        `).join("")}
      </div>
    </section>
    <section class="dashboard-subjects">
      <div class="dashboard-section-head">
        <strong>\u79d1\u76ee\u5206\u5e03</strong>
        <span>${subjectTotals.length ? "\u8fd1 7 \u5929\u4e13\u6ce8\u5360\u6bd4" : "\u6682\u65e0\u8ba1\u65f6\u8bb0\u5f55"}</span>
      </div>
      ${subjectTotals.length ? subjectTotals.map((item) => `
        <div class="dashboard-subject-row">
          <i style="--subject-color:${item.color}"></i>
          <span>${htmlEscape(item.name)}</span>
          <b>${formatDuration(item.minutes)}</b>
        </div>
      `).join("") : '<div class="empty-state compact-empty"><strong>\u8fd8\u6ca1\u6709\u5b66\u4e60\u5206\u5e03</strong><span>\u5b8c\u6210\u4e00\u6b21\u756a\u8304\u949f\u540e\u4f1a\u663e\u793a\u3002</span></div>'}
    </section>
  `;
}

function renderDataCenter() {
  if (!els.dataGrid) return;
  const doneTasks = state.tasks.filter((task) => task.done).length;
  const totalFocusMinutes = state.focusRecords.reduce((sum, record) => sum + Number(record.minutes || 0), 0);
  const photoCount = state.photoWalls.reduce((sum, wall) => sum + wall.photos.length, 0);
  const payloadSize = new Blob([JSON.stringify(state)]).size;
  const mediaSize = mediaPayloadSize();
  const healthLevel = payloadSize > 8 * 1024 * 1024 ? "danger" : payloadSize > 4 * 1024 * 1024 ? "warn" : "ok";
  const healthText = healthLevel === "danger" ? "\u6570\u636e\u504f\u5927\uff0c\u5efa\u8bae\u5bfc\u51fa\u5907\u4efd\u5e76\u538b\u7f29\u5927\u56fe" : healthLevel === "warn" ? "\u6570\u636e\u6b63\u5728\u53d8\u5927\uff0c\u8bb0\u5f97\u5b9a\u671f\u5907\u4efd" : "\u72b6\u6001\u826f\u597d";
  const cards = [
    ["\u6587\u7ae0", state.posts.length, "\u542b\u8349\u7a3f\u548c\u5df2\u53d1\u5e03"],
    ["\u4efb\u52a1", state.tasks.length, `\u5df2\u5b8c\u6210 ${doneTasks}`],
    ["\u5355\u8bcd", state.words.length, `\u4eca\u65e5\u76ee\u6807 ${state.settings.dailyWordGoal || 30}`],
    ["\u7167\u7247\u5899", state.photoWalls.length, `\u5171 ${photoCount} \u5f20\u7167\u7247`],
    ["\u4e13\u6ce8", state.focusRecords.length, `\u5171 ${formatDuration(totalFocusMinutes)}`],
    ["\u672c\u5730\u6570\u636e", bytesLabel(payloadSize), "\u4fdd\u5b58\u5728\u6d4f\u89c8\u5668\u672c\u5730"]
  ];
  els.dataGrid.innerHTML = cards.map(([label, value, hint]) => `
    <article class="data-card">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${hint}</small>
    </article>
  `).join("");
  if (els.dataHealth) {
    els.dataHealth.innerHTML = `
      <div class="health-head ${healthLevel}">
        <span>\u672c\u5730\u6570\u636e\u5065\u5eb7\u72b6\u6001</span>
        <strong>${healthText}</strong>
      </div>
      <div class="health-grid">
        <div><span>\u6570\u636e\u603b\u91cf</span><strong>${bytesLabel(payloadSize)}</strong><small>IndexedDB + localStorage \u5185\u5bb9\u4f30\u7b97</small></div>
        <div><span>\u5a92\u4f53\u8d44\u6e90</span><strong>${bytesLabel(mediaSize)}</strong><small>\u80cc\u666f\u3001\u5934\u50cf\u3001\u97f3\u4e50\u548c\u7167\u7247</small></div>
        <div><span>\u4e0a\u6b21\u4fdd\u5b58</span><strong>${formatDateTime(state.meta?.lastSavedAt)}</strong><small>\u64cd\u4f5c\u540e\u4f1a\u81ea\u52a8\u66f4\u65b0</small></div>
        <div><span>\u4e0a\u6b21\u5907\u4efd</span><strong>${formatDateTime(state.meta?.lastBackupAt)}</strong><small>\u5efa\u8bae\u5927\u91cf\u4e0a\u4f20\u56fe\u7247\u540e\u5907\u4efd</small></div>
      </div>
    `;
  }
  renderDataDashboard();
  refreshDesktopDataPanel();
}

function countCompletedTasks() {
  return state.tasks.reduce((sum, task) => {
    const subDone = (task.subtasks || []).filter((subtask) => subtask.done).length;
    return sum + (task.done ? 1 : 0) + subDone;
  }, 0);
}

function achievementMetrics() {
  const totalFocus = state.focusRecords.reduce((sum, record) => sum + Number(record.minutes || 0), 0);
  const photoCount = state.photoWalls.reduce((sum, wall) => sum + wall.photos.length, 0);
  const publishedPosts = state.posts.filter((post) => post.status === "published").length;
  const wordReviewed = state.words.filter((word) => Number(word.reviews || 0) > 0).length;
  const completedTasks = countCompletedTasks();
  return {
    postCount: state.posts.length,
    publishedPosts,
    completedTasks,
    taskStreak: calculateStreak(),
    totalFocus,
    focusSessions: state.focusRecords.length,
    subjectCount: normalizeFocusSubjects(state.timer.subjects).length,
    photoCount,
    wallCount: state.photoWalls.length,
    reviewCount: (state.exam.reviews || []).length,
    examStreak: examStudyStreak(),
    reports: (state.exam.reports || []).length,
    wordReviewed
  };
}

function achievementDefinitions() {
  const metrics = achievementMetrics();
  return [
    { id: "first-post", icon: "✎", category: "写作", title: "第一篇笔记", description: "写下第一篇博客，让这个空间真正开始生长。", value: metrics.postCount, target: 1, unit: "篇" },
    { id: "published-5", icon: "文", category: "写作", title: "公开表达者", description: "发布 5 篇文章，形成稳定输出的雏形。", value: metrics.publishedPosts, target: 5, unit: "篇" },
    { id: "task-first", icon: "✓", category: "打卡", title: "今日启动", description: "完成第一个任务，把计划变成行动。", value: metrics.completedTasks, target: 1, unit: "项" },
    { id: "task-30", icon: "清", category: "打卡", title: "清单推进者", description: "累计完成 30 项任务，建立可持续的执行节奏。", value: metrics.completedTasks, target: 30, unit: "项" },
    { id: "streak-7", icon: "火", category: "打卡", title: "连续七天", description: "连续 7 天完成至少一项任务。", value: metrics.taskStreak, target: 7, unit: "天" },
    { id: "focus-60", icon: "◴", category: "专注", title: "专注一小时", description: "累计专注 60 分钟，完成第一次沉浸式学习。", value: metrics.totalFocus, target: 60, unit: "分钟", formatter: formatDuration },
    { id: "focus-600", icon: "时", category: "专注", title: "十小时修炼", description: "累计专注 10 小时，给长期目标打下底座。", value: metrics.totalFocus, target: 600, unit: "分钟", formatter: formatDuration },
    { id: "subject-4", icon: "科", category: "专注", title: "四科就位", description: "保留或配置 4 个学习分类，方便统计复盘。", value: metrics.subjectCount, target: 4, unit: "类" },
    { id: "photo-5", icon: "景", category: "照片墙", title: "灵感收藏家", description: "照片墙累计放入 5 张图片，搭起自己的视觉资料库。", value: metrics.photoCount, target: 5, unit: "张" },
    { id: "wall-2", icon: "墙", category: "照片墙", title: "多面展板", description: "创建 2 面照片墙，按主题整理不同灵感。", value: metrics.wallCount, target: 2, unit: "面" },
    { id: "exam-review-3", icon: "研", category: "考研", title: "复盘启动", description: "完成 3 条考研复盘，让学习反馈可见。", value: metrics.reviewCount, target: 3, unit: "条" },
    { id: "exam-streak-7", icon: "星", category: "考研", title: "考研七日线", description: "连续 7 天留下学习记录，进入稳定备考状态。", value: metrics.examStreak, target: 7, unit: "天" },
    { id: "report-first", icon: "报", category: "考研", title: "第一份周报", description: "生成第一份学习周报，开始用数据看见自己。", value: metrics.reports, target: 1, unit: "份" },
    { id: "word-50", icon: "词", category: "单词", title: "词库开光", description: "至少复习 50 个单词，让词库开始产生记忆曲线。", value: metrics.wordReviewed, target: 50, unit: "个" }
  ];
}

function achievementPercent(item) {
  if (!item.target) return 0;
  return Math.min(100, Math.round((Number(item.value || 0) / item.target) * 100));
}

function formatAchievementValue(item) {
  if (item.formatter) return `${item.formatter(item.value)} / ${item.formatter(item.target)}`;
  return `${Math.min(Number(item.value || 0), item.target)} / ${item.target} ${item.unit || ""}`.trim();
}

function syncAchievements({ notify = false, save = true } = {}) {
  state.achievements = {
    ...structuredClone(defaultState.achievements),
    ...(state.achievements || {}),
    unlocked: state.achievements?.unlocked || []
  };
  const definitions = achievementDefinitions();
  const unlocked = new Set(state.achievements.unlocked);
  const newlyUnlocked = definitions.filter((item) => Number(item.value || 0) >= item.target && !unlocked.has(item.id));
  if (newlyUnlocked.length) {
    state.achievements.unlocked = [...unlocked, ...newlyUnlocked.map((item) => item.id)];
    if (save) api.save(state);
    if (notify) showAchievementToast(newlyUnlocked);
  }
  return { definitions, newlyUnlocked };
}

function showAchievementToast(items) {
  if (!els.achievementToast || !items?.length) return;
  const first = items[0];
  els.achievementToast.innerHTML = `
    <span>${first.icon}</span>
    <div>
      <strong>解锁成就：${htmlEscape(first.title)}</strong>
      <p>${items.length > 1 ? `同时点亮 ${items.length} 枚徽章` : htmlEscape(first.description)}</p>
    </div>
  `;
  els.achievementToast.classList.add("active");
  els.achievementToast.setAttribute("aria-hidden", "false");
  clearTimeout(achievementToastTimer);
  achievementToastTimer = setTimeout(() => {
    els.achievementToast.classList.remove("active");
    els.achievementToast.setAttribute("aria-hidden", "true");
  }, 3600);
}

function renderAchievements() {
  if (!els.achievementGrid || !els.achievementStats) return;
  const { definitions } = syncAchievements({ notify: false, save: true });
  const unlocked = new Set(state.achievements?.unlocked || []);
  const unlockedCount = definitions.filter((item) => unlocked.has(item.id)).length;
  const totalProgress = definitions.length ? Math.round((unlockedCount / definitions.length) * 100) : 0;
  const metrics = achievementMetrics();
  if (els.achievementHeroProgress) els.achievementHeroProgress.textContent = `${totalProgress}%`;
  els.achievementStats.innerHTML = [
    ["已解锁", `${unlockedCount}/${definitions.length}`, "徽章进度"],
    ["累计专注", formatDuration(metrics.totalFocus), `${metrics.focusSessions} 次记录`],
    ["完成任务", `${metrics.completedTasks} 项`, `${metrics.taskStreak} 天连续打卡`],
    ["视觉收藏", `${metrics.photoCount} 张`, `${metrics.wallCount} 面照片墙`]
  ].map(([label, value, hint]) => `
    <article class="achievement-stat">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${hint}</small>
    </article>
  `).join("");
  els.achievementGrid.innerHTML = definitions.map((item) => {
    const isUnlocked = unlocked.has(item.id);
    const percent = achievementPercent(item);
    return `
      <article class="achievement-card ${isUnlocked ? "unlocked" : ""}">
        <div class="achievement-badge-icon">${item.icon}</div>
        <div class="achievement-card-body">
          <div class="achievement-card-head">
            <span>${htmlEscape(item.category)}</span>
            <strong>${isUnlocked ? "已解锁" : `${percent}%`}</strong>
          </div>
          <h3>${htmlEscape(item.title)}</h3>
          <p>${htmlEscape(item.description)}</p>
          <div class="achievement-progress" aria-label="${htmlEscape(item.title)}进度">
            <i style="width:${percent}%"></i>
          </div>
          <small>${formatAchievementValue(item)}</small>
        </div>
      </article>
    `;
  }).join("");
}

function achievementFocusDaysAtLeast(minutes) {
  const byDate = new Map();
  state.focusRecords.forEach((record) => {
    const date = record.date || todayKey();
    byDate.set(date, (byDate.get(date) || 0) + Number(record.minutes || 0));
  });
  return [...byDate.values()].filter((total) => total >= minutes).length;
}

function achievementMetrics() {
  const totalFocus = state.focusRecords.reduce((sum, record) => sum + Number(record.minutes || 0), 0);
  const photoCount = state.photoWalls.reduce((sum, wall) => sum + wall.photos.length, 0);
  const publishedPosts = state.posts.filter((post) => post.status === "published").length;
  const wordReviewed = state.words.filter((word) => Number(word.reviews || 0) > 0).length;
  const completedTasks = countCompletedTasks();
  const memoKnown = (state.exam.memoryItems || []).filter((item) => Number(item.level || 0) >= 4).length;
  return {
    postCount: state.posts.length,
    publishedPosts,
    completedTasks,
    taskStreak: calculateStreak(),
    totalFocus,
    focusSessions: state.focusRecords.length,
    focusDays180: achievementFocusDaysAtLeast(180),
    focusDays360: achievementFocusDaysAtLeast(360),
    subjectCount: normalizeFocusSubjects(state.timer.subjects).length,
    photoCount,
    wallCount: state.photoWalls.length,
    reviewCount: (state.exam.reviews || []).length,
    examStreak: examStudyStreak(),
    reports: (state.exam.reports || []).length,
    memoKnown,
    memoReviews: (state.exam.memoryRecords || []).length,
    wordReviewed
  };
}

function makeAchievementSeries({ id, icon, category, name, description, value, targets, unit, formatter }) {
  const levelNames = ["入门", "稳定", "进阶", "冲刺", "封顶"];
  return targets.map((target, index) => ({
    id: `${id}-${index + 1}`,
    icon,
    category,
    series: name,
    tier: index + 1,
    title: `${name} · ${index + 1}级`,
    description: `${description}（${levelNames[index]}目标）`,
    value,
    target,
    unit,
    formatter
  }));
}

function achievementDefinitions() {
  const metrics = achievementMetrics();
  return [
    ...makeAchievementSeries({
      id: "exam-streak",
      icon: "研",
      category: "考研主线",
      name: "连续备考",
      description: "连续留下真实学习记录，稳住备考节奏",
      value: metrics.examStreak,
      targets: [7, 21, 50, 100, 180],
      unit: "天"
    }),
    ...makeAchievementSeries({
      id: "focus-total",
      icon: "时",
      category: "考研主线",
      name: "累计专注",
      description: "累计番茄钟或正计时学习时长",
      value: metrics.totalFocus,
      targets: [600, 3000, 9000, 24000, 48000],
      unit: "分钟",
      formatter: formatDuration
    }),
    ...makeAchievementSeries({
      id: "deep-days",
      icon: "深",
      category: "考研主线",
      name: "深度学习日",
      description: "单日专注达到 3 小时以上",
      value: metrics.focusDays180,
      targets: [3, 15, 40, 90, 150],
      unit: "天"
    }),
    ...makeAchievementSeries({
      id: "sprint-days",
      icon: "冲",
      category: "考研主线",
      name: "冲刺学习日",
      description: "单日专注达到 6 小时以上",
      value: metrics.focusDays360,
      targets: [1, 7, 21, 60, 120],
      unit: "天"
    }),
    ...makeAchievementSeries({
      id: "task-done",
      icon: "✓",
      category: "执行系统",
      name: "任务清空",
      description: "累计完成主任务和子任务",
      value: metrics.completedTasks,
      targets: [30, 120, 360, 900, 1600],
      unit: "项"
    }),
    ...makeAchievementSeries({
      id: "task-streak",
      icon: "火",
      category: "执行系统",
      name: "打卡不断线",
      description: "连续完成至少一项打卡任务",
      value: metrics.taskStreak,
      targets: [7, 21, 50, 100, 180],
      unit: "天"
    }),
    ...makeAchievementSeries({
      id: "focus-sessions",
      icon: "钟",
      category: "执行系统",
      name: "番茄累积",
      description: "累计完成专注记录次数",
      value: metrics.focusSessions,
      targets: [20, 100, 300, 800, 1500],
      unit: "次"
    }),
    ...makeAchievementSeries({
      id: "exam-review",
      icon: "复",
      category: "复盘系统",
      name: "学习复盘",
      description: "累计写下考研复盘记录",
      value: metrics.reviewCount,
      targets: [10, 40, 100, 220, 400],
      unit: "条"
    }),
    ...makeAchievementSeries({
      id: "weekly-report",
      icon: "报",
      category: "复盘系统",
      name: "周报制度",
      description: "累计生成学习周报",
      value: metrics.reports,
      targets: [1, 4, 12, 24, 40],
      unit: "份"
    }),
    ...makeAchievementSeries({
      id: "memory-known",
      icon: "记",
      category: "复盘系统",
      name: "记忆掌握",
      description: "考研记忆任务达到掌握状态",
      value: metrics.memoKnown,
      targets: [10, 50, 150, 350, 700],
      unit: "条"
    }),
    ...makeAchievementSeries({
      id: "memory-review",
      icon: "曲",
      category: "复盘系统",
      name: "曲线复习",
      description: "累计完成考研记忆任务复习",
      value: metrics.memoReviews,
      targets: [20, 100, 300, 700, 1200],
      unit: "次"
    }),
    ...makeAchievementSeries({
      id: "notes",
      icon: "文",
      category: "资料沉淀",
      name: "学习笔记",
      description: "累计写下博客笔记或资料整理",
      value: metrics.postCount,
      targets: [10, 30, 80, 150, 300],
      unit: "篇"
    }),
    ...makeAchievementSeries({
      id: "published",
      icon: "发",
      category: "资料沉淀",
      name: "公开输出",
      description: "累计发布文章，形成可复用知识库",
      value: metrics.publishedPosts,
      targets: [5, 15, 40, 80, 150],
      unit: "篇"
    }),
    ...makeAchievementSeries({
      id: "gallery",
      icon: "景",
      category: "资料沉淀",
      name: "视觉资料库",
      description: "照片墙累计收集图片素材",
      value: metrics.photoCount,
      targets: [10, 30, 80, 160, 300],
      unit: "张"
    }),
    ...makeAchievementSeries({
      id: "walls",
      icon: "墙",
      category: "资料沉淀",
      name: "主题展板",
      description: "创建不同主题的照片墙",
      value: metrics.wallCount,
      targets: [2, 5, 10, 18, 30],
      unit: "面"
    }),
    ...makeAchievementSeries({
      id: "words",
      icon: "词",
      category: "可选拓展",
      name: "词库复习",
      description: "累计复习单词，适合需要电子词库时使用",
      value: metrics.wordReviewed,
      targets: [100, 500, 1200, 2500, 5000],
      unit: "个"
    })
  ];
}

function renderAchievements() {
  if (!els.achievementGrid || !els.achievementStats) return;
  const { definitions } = syncAchievements({ notify: false, save: true });
  const unlocked = new Set(state.achievements?.unlocked || []);
  const unlockedCount = definitions.filter((item) => unlocked.has(item.id)).length;
  const totalProgress = definitions.length ? Math.round((unlockedCount / definitions.length) * 100) : 0;
  const metrics = achievementMetrics();
  if (els.achievementHeroProgress) els.achievementHeroProgress.textContent = `${totalProgress}%`;
  els.achievementStats.innerHTML = [
    ["长期成就", `${unlockedCount}/${definitions.length}`, "按考研周期分级"],
    ["累计专注", formatDuration(metrics.totalFocus), `目标上限 ${formatDuration(48000)}`],
    ["深度学习日", `${metrics.focusDays180} 天`, "单日 3 小时以上"],
    ["连续备考", `${metrics.examStreak} 天`, "目标上限 180 天"]
  ].map(([label, value, hint]) => `
    <article class="achievement-stat">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${hint}</small>
    </article>
  `).join("");
  els.achievementGrid.innerHTML = definitions.map((item) => {
    const isUnlocked = unlocked.has(item.id);
    const percent = achievementPercent(item);
    return `
      <article class="achievement-card ${isUnlocked ? "unlocked" : ""} tier-${item.tier}">
        <div class="achievement-badge-icon">${item.icon}</div>
        <div class="achievement-card-body">
          <div class="achievement-card-head">
            <span>${htmlEscape(item.category)} / Lv.${item.tier}</span>
            <strong>${isUnlocked ? "已解锁" : `${percent}%`}</strong>
          </div>
          <h3>${htmlEscape(item.title)}</h3>
          <p>${htmlEscape(item.description)}</p>
          <div class="achievement-progress" aria-label="${htmlEscape(item.title)}进度">
            <i style="width:${percent}%"></i>
          </div>
          <small>${formatAchievementValue(item)}</small>
        </div>
      </article>
    `;
  }).join("");
}

function render() {
  if (initialDataLoaded) ensureAutoWeeklyReport();
  applyTheme();
  syncTaskDateInput(activeTaskDate || todayKey());
  renderTags();
  renderPosts();
  renderTasks();
  renderWords();
  renderWordOverview();
  renderTaskViewMode();
  renderPhotos();
  renderArchive();
  renderDataCenter();
  renderProfile();
  renderAchievements();
  renderSettings();
  renderTimer();
  if (els.storageCount) els.storageCount.textContent = `${state.posts.length} \u7bc7\u6587\u7ae0`;
}

function exportBackup() {
  state.meta = { ...(state.meta || {}), lastBackupAt: new Date().toISOString() };
  api.save(state);
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `blog-backup-${todayKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  state = normalizeState(JSON.parse(text));
  event.target.value = "";
  persist();
}

function desktopBridge() {
  return window.astrelDesktop || null;
}

function setDesktopDataStatus(message, type = "") {
  if (!els.desktopDataStatus) return;
  els.desktopDataStatus.textContent = message || "";
  els.desktopDataStatus.dataset.type = type;
}

async function refreshDesktopDataPanel() {
  const desktop = desktopBridge();
  if (!els.desktopDataPanel) return;
  els.desktopDataPanel.hidden = !desktop;
  if (!desktop) return;
  try {
    const info = await desktop.getDataInfo();
    if (els.desktopDataPath) els.desktopDataPath.textContent = info.userData || info.dataDir || "-";
  } catch (error) {
    setDesktopDataStatus(error.message || "\u65e0\u6cd5\u8bfb\u53d6\u684c\u9762\u6570\u636e\u8def\u5f84", "error");
  }
}

async function openDesktopDataDir() {
  const desktop = desktopBridge();
  if (!desktop) return;
  const result = await desktop.openDataDir();
  if (!result?.ok) setDesktopDataStatus(result?.error || "\u6253\u5f00\u6570\u636e\u76ee\u5f55\u5931\u8d25", "error");
  else setDesktopDataStatus("\u5df2\u6253\u5f00\u684c\u9762\u6570\u636e\u76ee\u5f55", "ok");
}

async function createDesktopBackup() {
  const desktop = desktopBridge();
  if (!desktop) return;
  setDesktopDataStatus("\u6b63\u5728\u521b\u5efa\u684c\u9762\u5907\u4efd...", "");
  const result = await desktop.createBackup();
  if (!result?.ok) {
    setDesktopDataStatus(result?.error || "\u5907\u4efd\u5931\u8d25", "error");
    return;
  }
  setDesktopDataStatus(`\u5907\u4efd\u5df2\u4fdd\u5b58\uff1a${result.path}`, "ok");
}

async function restoreDesktopBackup() {
  const desktop = desktopBridge();
  if (!desktop) return;
  const ok = await showConfirm({
    eyebrow: "Desktop",
    title: "\u4ece\u684c\u9762\u5907\u4efd\u6062\u590d\uff1f",
    message: "\u6062\u590d\u524d\u4f1a\u81ea\u52a8\u4fdd\u7559\u4e00\u4efd\u5f53\u524d\u6570\u636e\u7684\u5b89\u5168\u5907\u4efd\u3002\u6062\u590d\u540e\u9875\u9762\u4f1a\u5237\u65b0\u3002",
    okText: "\u9009\u62e9\u5907\u4efd"
  });
  if (!ok) return;
  const result = await desktop.restoreBackup();
  if (result?.canceled) return;
  if (!result?.ok) {
    setDesktopDataStatus(result?.error || "\u6062\u590d\u5931\u8d25", "error");
    return;
  }
  setDesktopDataStatus("\u6062\u590d\u5b8c\u6210\uff0c\u6b63\u5728\u91cd\u65b0\u8f7d\u5165...", "ok");
  setTimeout(() => window.location.reload(), 500);
}

function notifyDesktop(title, body) {
  desktopBridge()?.notify?.({ title, body });
}

function desktopMenuItems(menu) {
  const toggleThemeLabel = state.settings.theme === "dark" ? "\u5207\u6362\u5230\u660e\u4eae\u6a21\u5f0f" : "\u5207\u6362\u5230\u6697\u8272\u6a21\u5f0f";
  const items = {
    file: [
      { label: "\u65b0\u6587\u7ae0", action: () => createPost() },
      { label: "\u521b\u5efa\u684c\u9762\u5907\u4efd", action: createDesktopBackup },
      { label: "\u4ece\u5907\u4efd\u6062\u590d", action: restoreDesktopBackup },
      { label: "\u6253\u5f00\u6570\u636e\u76ee\u5f55", action: openDesktopDataDir },
      { label: "\u9000\u51fa Astrel", danger: true, action: () => desktopBridge()?.quit?.() }
    ],
    edit: [
      { label: "\u5199\u4f5c\u9875", action: () => switchView("editor") },
      { label: "\u6570\u636e\u4e2d\u5fc3", action: () => switchView("data") },
      { label: "\u4e2a\u6027\u8bbe\u7f6e", action: () => switchView("settings") }
    ],
    view: [
      {
        label: toggleThemeLabel,
        action: () => {
          state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
          persist();
        }
      },
      { label: "\u9996\u9875", action: () => switchView("home") },
      { label: "\u5237\u65b0\u5f53\u524d\u9875", action: () => window.location.reload() }
    ],
    help: [
      { label: "\u5173\u4e8e Astrel", action: () => switchView("about") },
      { label: "\u67e5\u770b\u6570\u636e\u8def\u5f84", action: () => switchView("data") },
      { label: "\u6253\u5f00\u6570\u636e\u76ee\u5f55", action: openDesktopDataDir }
    ]
  };
  return items[menu] || [];
}

function closeDesktopMenu() {
  if (!els.desktopMenuPopover) return;
  els.desktopMenuPopover.hidden = true;
  els.desktopMenuPopover.innerHTML = "";
}

function openDesktopMenu(menu, anchor) {
  if (!els.desktopMenuPopover) return;
  const items = desktopMenuItems(menu);
  if (!items.length) return;
  els.desktopMenuPopover.innerHTML = items.map((item, index) => `
    <button class="${item.danger ? "danger" : ""}" data-desktop-menu-action="${index}" type="button">${item.label}</button>
  `).join("");
  els.desktopMenuPopover.dataset.menu = menu;
  els.desktopMenuPopover.hidden = false;
  const rect = anchor.getBoundingClientRect();
  els.desktopMenuPopover.style.left = `${Math.max(8, rect.left)}px`;
  els.desktopMenuPopover.style.top = `${rect.bottom + 6}px`;
}

async function runDesktopMenuAction(index) {
  const menu = els.desktopMenuPopover?.dataset.menu;
  const item = desktopMenuItems(menu)[Number(index)];
  closeDesktopMenu();
  if (!item) return;
  await item.action?.();
}

function wireEvents() {
  if (window.astrelWindow) {
    document.body.classList.add("desktop-app");
    els.desktopTitlebar?.setAttribute("aria-hidden", "false");
    els.windowMinimizeBtn?.addEventListener("click", () => window.astrelWindow.minimize());
    els.windowMaximizeBtn?.addEventListener("click", () => window.astrelWindow.toggleMaximize());
    els.windowCloseBtn?.addEventListener("click", () => window.astrelWindow.close());
    els.desktopTitlebar?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-desktop-menu]");
      if (!button) return;
      event.stopPropagation();
      if (!els.desktopMenuPopover?.hidden && els.desktopMenuPopover.dataset.menu === button.dataset.desktopMenu) {
        closeDesktopMenu();
        return;
      }
      openDesktopMenu(button.dataset.desktopMenu, button);
    });
    els.desktopMenuPopover?.addEventListener("click", (event) => {
      const action = event.target.closest("[data-desktop-menu-action]");
      if (!action) return;
      runDesktopMenuAction(action.dataset.desktopMenuAction);
    });
    document.addEventListener("pointerdown", (event) => {
      if (els.desktopMenuPopover?.hidden) return;
      if (event.target.closest(".desktop-menu-popover, .desktop-titlebar")) return;
      closeDesktopMenu();
    });
  }
  window.addEventListener("pointermove", updateMagicCursor, { passive: true });
  window.addEventListener("pointerleave", hideMagicCursor);
  window.addEventListener("pointerdown", (event) => spawnCursorRipple(event.clientX, event.clientY), { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) renderTimer();
  });
  els.sidebarToggle?.addEventListener("click", () => {
    state.settings.sidebarCollapsed = !state.settings.sidebarCollapsed;
    applyTheme();
    api.save(state);
  });
  els.appConfirmCancelBtn.addEventListener("click", () => closeConfirm(false));
  els.appConfirmOkBtn.addEventListener("click", () => closeConfirm(true));
  els.appConfirmModal.addEventListener("click", (event) => {
    if (event.target === els.appConfirmModal) closeConfirm(false);
  });
  els.appInputCancelBtn.addEventListener("click", () => closeInputModal(null));
  els.appInputOkBtn.addEventListener("click", () => closeInputModal(els.appInputControl.value));
  els.appInputModal.addEventListener("click", (event) => {
    if (event.target === els.appInputModal) closeInputModal(null);
  });
  els.appInputModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeInputModal(null);
    if (event.key === "Enter" && event.target === els.appInputControl) closeInputModal(els.appInputControl.value);
  });
  $$(".nav-item").forEach((item) => item.addEventListener("click", () => switchView(item.dataset.view)));
  $("#newPostBtn").addEventListener("click", createPost);
  els.backToPostsBtn.addEventListener("click", () => switchView("home"));
  els.editCurrentPostBtn.addEventListener("click", () => switchView("editor"));
  els.deleteReaderPostBtn.addEventListener("click", deleteCurrentPost);
  els.pinPostBtn.addEventListener("click", () => {
    const post = state.posts.find((item) => item.id === activePostId);
    if (!post) return;
    post.pinned = !post.pinned;
    persist();
    renderReader();
  });
  els.favoritePostBtn.addEventListener("click", () => {
    const post = state.posts.find((item) => item.id === activePostId);
    if (!post) return;
    post.favorite = !post.favorite;
    persist();
    renderReader();
  });
  els.focusReadBtn.addEventListener("click", () => {
    state.settings.readerFocusMode = !state.settings.readerFocusMode;
    api.save(state);
    renderReader();
  });
  els.readerFocusExitBtn.addEventListener("click", () => {
    state.settings.readerFocusMode = false;
    api.save(state);
    renderReader();
  });
  els.prevPostBtn.addEventListener("click", () => {
    const posts = orderedPosts();
    const prev = posts[posts.findIndex((post) => post.id === activePostId) - 1];
    if (!prev) return;
    activePostId = prev.id;
    renderReader();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  els.nextPostBtn.addEventListener("click", () => {
    const posts = orderedPosts();
    const next = posts[posts.findIndex((post) => post.id === activePostId) + 1];
    if (!next) return;
    activePostId = next.id;
    renderReader();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#themeToggle").addEventListener("click", () => {
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    persist();
  });
  els.avatarButton.addEventListener("click", () => switchView("about"));
  els.profileAvatarButton.addEventListener("click", openAvatarConfirm);
  els.cancelAvatarChangeBtn.addEventListener("click", closeAvatarConfirm);
  els.confirmAvatarChangeBtn.addEventListener("click", () => {
    closeAvatarConfirm();
    els.avatarUpload.click();
  });
  els.avatarConfirmModal.addEventListener("click", (event) => {
    if (event.target === els.avatarConfirmModal) closeAvatarConfirm();
  });
  els.avatarUpload.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    await openAvatarCrop(file);
  });
  els.cancelAvatarCropBtn.addEventListener("click", closeAvatarCrop);
  els.resetCropBtn.addEventListener("click", resetAvatarCrop);
  els.saveAvatarCropBtn.addEventListener("click", saveAvatarCrop);
  els.cropStage.addEventListener("pointerdown", (event) => {
    if (!avatarCrop) return;
    avatarCrop.dragging = true;
    avatarCrop.startX = event.clientX;
    avatarCrop.startY = event.clientY;
    avatarCrop.startOffsetX = avatarCrop.offsetX;
    avatarCrop.startOffsetY = avatarCrop.offsetY;
    els.cropStage.setPointerCapture?.(event.pointerId);
  });
  window.addEventListener("pointermove", (event) => {
    if (!avatarCrop?.dragging) return;
    avatarCrop.offsetX = avatarCrop.startOffsetX + event.clientX - avatarCrop.startX;
    avatarCrop.offsetY = avatarCrop.startOffsetY + event.clientY - avatarCrop.startY;
    applyCropTransform();
  });
  window.addEventListener("pointerup", () => {
    if (avatarCrop) avatarCrop.dragging = false;
  });
  window.addEventListener("scroll", () => {
    updateReaderProgress();
    updateSettingsNavHighlight();
  }, { passive: true });
  els.cropStage.addEventListener("wheel", (event) => {
    if (!avatarCrop) return;
    event.preventDefault();
    const zoomStep = Math.max(avatarCrop.minScale * 0.08, 0.025);
    avatarCrop.scale += event.deltaY < 0 ? zoomStep : -zoomStep;
    applyCropTransform();
  });
  els.searchInput.addEventListener("input", renderPosts);
  els.tagFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tag]");
    if (!button) return;
    activeTag = button.dataset.tag;
    render();
  });
  document.addEventListener("click", (event) => {
    const menuAction = event.target.closest("[data-task-menu-action]");
    if (menuAction && activeTaskMenuTarget) {
      const action = menuAction.dataset.taskMenuAction;
      const target = activeTaskMenuTarget;
      hideTaskContextMenu();
      if (action === "add-subtask") promptAddSubtask(target.id);
      if (action === "edit-task") promptEditTask(target.id);
      if (action === "move-date") promptMoveTaskDate(target.id);
      if (action === "change-type") promptChangeTaskType(target.id);
      if (action === "change-subject") promptChangeTaskSubject(target.id);
      if (action === "start-focus") startFocusFromTask(target.id);
      if (action.startsWith("priority-")) setTaskPriority(target.id, action.replace("priority-", ""));
      if (action === "toggle-pin") toggleTaskPinned(target.id);
      if (action === "delete-task") deleteTask(target.id);
      if (action === "edit-subtask") promptEditSubtask(target.id);
      if (action === "delete-subtask") deleteSubtask(target.id);
      return;
    }
    if (!event.target.closest("#taskContextMenu")) hideTaskContextMenu();
    const edit = event.target.closest("[data-edit]");
    if (edit) {
      activePostId = edit.dataset.edit;
      switchView("editor");
    }
    const read = event.target.closest("[data-read]");
    if (read) {
      activePostId = read.dataset.read;
      switchView("reader");
    }
    const profileRead = event.target.closest("[data-profile-read]");
    if (profileRead) {
      activePostId = profileRead.dataset.profileRead;
      switchView("reader");
    }
    const taskDelete = event.target.closest("[data-task-delete]");
    if (taskDelete) {
      deleteTask(taskDelete.dataset.taskDelete);
      return;
    }
    const taskCollapse = event.target.closest("[data-task-collapse]");
    if (taskCollapse && taskCollapse.textContent.trim()) {
      toggleTaskCollapsed(taskCollapse.dataset.taskCollapse);
      return;
    }
    const photoDelete = event.target.closest("[data-photo-delete]");
    if (photoDelete) {
      const wall = activeWall();
      wall.photos = wall.photos.filter((photo) => photo.id !== photoDelete.dataset.photoDelete);
      persist();
      return;
    }
    const wallButton = event.target.closest("[data-wall-id]");
    if (wallButton) {
      if (event.detail > 1) return;
      els.photoWall.classList.add("switching");
      setTimeout(() => {
        state.activePhotoWallId = wallButton.dataset.wallId;
        persist();
        requestAnimationFrame(() => els.photoWall.classList.remove("switching"));
      }, 160);
    }
  });
  document.addEventListener("dblclick", (event) => {
    const taskTitle = event.target.closest("[data-task-edit]");
    if (taskTitle) {
      event.preventDefault();
      promptEditTask(taskTitle.dataset.taskEdit);
      return;
    }
    const subtaskTitle = event.target.closest("[data-subtask-edit]");
    if (subtaskTitle) {
      event.preventDefault();
      promptEditSubtask(subtaskTitle.dataset.subtaskEdit);
      return;
    }
    const wallButton = event.target.closest("[data-wall-id]");
    if (wallButton) {
      event.preventDefault();
      renameWall(wallButton.dataset.wallId);
    }
  });
  document.addEventListener("change", (event) => {
    const subtaskToggle = event.target.closest("[data-subtask-toggle]");
    if (subtaskToggle) {
      const { subtask } = findSubtask(subtaskToggle.dataset.subtaskToggle);
      if (subtask) {
        subtask.done = subtaskToggle.checked;
        subtask.completedDate = subtask.done ? todayKey() : "";
      }
      persist();
      return;
    }
    const toggle = event.target.closest("[data-task-toggle]");
    if (!toggle) return;
    const task = findTask(toggle.dataset.taskToggle);
    if (task) {
      task.done = toggle.checked;
      task.completedDate = task.done ? todayKey() : "";
    }
    persist();
  });
  document.addEventListener("contextmenu", (event) => {
    const subtask = event.target.closest(".subtask-item");
    if (subtask) {
      const input = subtask.querySelector("[data-subtask-toggle]");
      if (!input) return;
      event.preventDefault();
      showTaskContextMenu(event, { type: "subtask", id: input.dataset.subtaskToggle });
      return;
    }
    const taskItem = event.target.closest(".task-item");
    if (taskItem) {
      const input = taskItem.querySelector("[data-task-toggle]");
      if (!input) return;
      event.preventDefault();
      showTaskContextMenu(event, { type: "task", id: input.dataset.taskToggle });
    }
  });
  window.addEventListener("resize", hideTaskContextMenu);
  window.addEventListener("scroll", hideTaskContextMenu, { passive: true });
  els.taskList.addEventListener("dragstart", handleTaskDragStart);
  els.taskList.addEventListener("dragover", handleTaskDragOver);
  els.taskList.addEventListener("drop", handleTaskDrop);
  els.taskList.addEventListener("dragend", handleTaskDragEnd);
  [els.postTitle, els.postSummary, els.postTags, els.postCategory, els.postStatus, els.postDate, els.markdownInput].forEach((input) => {
    input.addEventListener("input", scheduleAutoSave);
    input.addEventListener("change", scheduleAutoSave);
  });
  els.postForm.addEventListener("submit", savePost);
  els.deletePostBtn.addEventListener("click", () => {
    deleteCurrentPost();
  });
  els.checkinForm.addEventListener("submit", addTask);
  els.checkinDate.addEventListener("change", () => {
    jumpToTaskDate(els.checkinDate.value || todayKey());
  });
  els.tomorrowTaskBtn?.addEventListener("click", () => {
    jumpToTaskDate(todayKey(addDays(new Date(), 1)));
    els.tomorrowTaskBtn.classList.add("is-active");
    setTimeout(() => els.tomorrowTaskBtn?.classList.remove("is-active"), 420);
  });
  els.wordAddForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const word = els.wordText.value.trim();
    const meaning = els.wordMeaning.value.trim();
    if (!word || !meaning) return;
    const item = { id: crypto.randomUUID(), word, meaning, example: els.wordExample.value.trim(), level: 0, reviews: 0, nextReview: todayKey(), lastReview: "" };
    state.words.unshift(item);
    activeWordId = item.id;
    activeWordLibraryPage = 1;
    wordRevealed = false;
    els.wordText.value = "";
    els.wordMeaning.value = "";
    els.wordExample.value = "";
    invalidateWordFamiliarityCache();
    persist();
  });
  els.wordImportInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const records = parseWordImport(await file.text(), file.name);
      const count = importWords(records);
      els.wordImportStatus.textContent = `已导入 ${count} 个新单词`;
      event.target.value = "";
      activeWordLibraryPage = 1;
      activeWordOverviewPage = 1;
      persist();
    } catch (error) {
      els.wordImportStatus.textContent = error.message || "导入失败，请检查格式";
      event.target.value = "";
    }
  });
  els.wordExportBtn.addEventListener("click", exportWords);
  els.wordSearchInput.addEventListener("input", () => {
    activeWordLibraryPage = 1;
    renderWordLibrary();
  });
  els.wordLibraryPager.addEventListener("click", (event) => {
    const button = event.target.closest("[data-word-library-page]");
    if (!button || button.disabled) return;
    activeWordLibraryPage += button.dataset.wordLibraryPage === "next" ? 1 : -1;
    renderWordLibrary();
  });
  els.wordOverviewSearch.addEventListener("input", () => {
    activeWordOverviewPage = 1;
    renderWordOverview();
  });
  els.wordOverviewFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-overview-filter]");
    if (!button) return;
    activeWordOverviewFilter = button.dataset.overviewFilter;
    activeWordOverviewPage = 1;
    renderWordOverview();
  });
  els.wordOverviewPager.addEventListener("click", (event) => {
    const button = event.target.closest("[data-overview-page]");
    if (!button || button.disabled) return;
    activeWordOverviewPage += button.dataset.overviewPage === "next" ? 1 : -1;
    renderWordOverview();
  });
  els.wordOverviewList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-overview-study]");
    if (!button) return;
    activeWordId = button.dataset.overviewStudy;
    wordRevealed = false;
    switchView("words");
  });
  els.resetWordMemoryBtn.addEventListener("click", async () => {
    const ok = await showConfirm({
      eyebrow: "\u5355\u8bcd",
      title: "\u6e05\u7a7a\u80cc\u8bf5\u8bb0\u5f55\uff1f",
      message: "\u5355\u8bcd\u672c\u8eab\u4f1a\u4fdd\u7559\uff0c\u4f46\u719f\u6089\u5ea6\u3001\u590d\u4e60\u8ba1\u5212\u548c\u8bb0\u5fc6\u66f2\u7ebf\u4f1a\u91cd\u7f6e\u3002",
      okText: "\u6e05\u7a7a",
      danger: true
    });
    if (!ok) return;
    state.words = state.words.map((word) => ({
      ...word,
      level: 0,
      reviews: 0,
      wrongCount: 0,
      nextReview: todayKey(),
      lastReview: ""
    }));
    state.wordCheckins = [];
    state.wordReviewRecords = [];
    state.wordNewStudyRecords = [];
    activeWordId = state.words[0]?.id || null;
    activeWordOverviewPage = 1;
    wordRevealed = false;
    invalidateWordFamiliarityCache();
    persist();
  });
  els.backToWordStudyBtn.addEventListener("click", () => switchView("words"));
  els.wordLibraryList.addEventListener("click", async (event) => {
    const study = event.target.closest("[data-word-study]");
    const reset = event.target.closest("[data-word-reset]");
    const remove = event.target.closest("[data-word-delete]");
    if (study) {
      activeWordId = study.dataset.wordStudy;
      wordRevealed = false;
      renderWords();
      return;
    }
    if (reset) {
      const word = state.words.find((item) => item.id === reset.dataset.wordReset);
      if (!word) return;
      Object.assign(word, { level: 0, reviews: 0, wrongCount: 0, nextReview: todayKey(), lastReview: "" });
      state.wordNewStudyRecords = (state.wordNewStudyRecords || []).filter((record) => record.wordId !== word.id);
      activeWordId = word.id;
      activeWordLibraryPage = 1;
      wordRevealed = false;
      invalidateWordFamiliarityCache();
      persist();
      return;
    }
    if (remove) {
      const word = state.words.find((item) => item.id === remove.dataset.wordDelete);
      if (!word) return;
      const ok = await showConfirm({
        eyebrow: "\u5355\u8bcd",
        title: "\u5220\u9664\u5355\u8bcd\uff1f",
        message: `\u5220\u9664\u5355\u8bcd\u300c${word.word}\u300d\u5417\uff1f\u5b83\u7684\u590d\u4e60\u8bb0\u5f55\u4e5f\u4f1a\u79fb\u9664\u3002`,
        okText: "\u5220\u9664",
        danger: true
      });
      if (!ok) return;
      state.words = state.words.filter((item) => item.id !== word.id);
      state.wordNewStudyRecords = (state.wordNewStudyRecords || []).filter((record) => record.wordId !== word.id);
      state.wordReviewRecords = (state.wordReviewRecords || []).filter((record) => record.wordId !== word.id);
      activeWordId = state.words[0]?.id || null;
      activeWordLibraryPage = Math.max(1, activeWordLibraryPage);
      invalidateWordFamiliarityCache();
      persist();
    }
  });
  $$(".word-filterbar button").forEach((button) => {
    button.addEventListener("click", () => {
      activeWordMode = button.dataset.wordMode;
      activeWordId = null;
      wordRevealed = false;
      renderWords();
    });
  });
  els.revealWordBtn.addEventListener("click", () => {
    wordRevealed = !wordRevealed;
    renderWords();
  });
  els.againWordBtn.addEventListener("click", () => reviewWord("again"));
  els.hardWordBtn.addEventListener("click", () => reviewWord("hard"));
  els.knownWordBtn.addEventListener("click", () => reviewWord("known"));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.settings.readerFocusMode) {
      state.settings.readerFocusMode = false;
      api.save(state);
      applyTheme();
      if (currentView === "reader") renderReader();
      return;
    }
    if (currentView !== "words") return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.target.closest?.("input, textarea, select, [contenteditable='true']")) return;
    if (event.code === "Space" || event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      if (!wordRevealed) {
        wordRevealed = true;
        renderWords();
      }
      return;
    }
    const map = { ArrowLeft: "again", ArrowUp: "hard", ArrowRight: "known" };
    const quality = map[event.key];
    if (!quality) return;
    event.preventDefault();
    reviewWord(quality);
  });
  $$(".tick-nav").forEach((item) => item.addEventListener("click", () => {
    activeTaskView = "list";
    activeTaskFilter = item.dataset.taskFilter;
    activeTaskType = "";
    if (activeTaskFilter === "today") syncTaskDateInput(todayKey());
    renderTasks();
    renderTaskViewMode();
  }));
  $$(".tick-list").forEach((item) => item.addEventListener("click", () => {
    activeTaskView = "list";
    activeTaskType = item.dataset.taskType;
    activeTaskFilter = "";
    renderTasks();
    renderTaskViewMode();
  }));
  els.clearDoneBtn.addEventListener("click", () => {
    state.tasks = state.tasks.filter((task) => !task.done);
    persist();
  });
  els.taskListViewBtn.addEventListener("click", () => {
    activeTaskView = "list";
    renderTaskViewMode();
    renderTasks();
  });
  els.taskMonthViewBtn.addEventListener("click", () => {
    activeTaskView = "month";
    activeTaskFilter = "";
    activeTaskType = "";
    renderTaskViewMode();
  });
  els.taskScheduleViewBtn.addEventListener("click", () => {
    activeTaskView = "schedule";
    activeTaskFilter = "";
    activeTaskType = "";
    renderTaskViewMode();
  });
  els.examTargetForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.exam.targetDate = els.examTargetDate.value || state.exam.targetDate || todayKey();
    state.exam.goalText = els.examGoalText.value.trim();
    persist();
  });
  els.examFocusToggleBtn?.addEventListener("click", () => {
    state.exam.focusMode = !state.exam.focusMode;
    if (state.exam.focusMode) {
      musicAudio.pause();
      stopDefaultMusic();
      musicPlaying = false;
    }
    persist();
  });
  els.examReportBtn?.addEventListener("click", createExamWeeklyReport);
  els.examReportList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-exam-report-open]");
    if (!button) return;
    const post = state.posts.find((item) => item.id === button.dataset.examReportOpen);
    if (!post) return;
    activePostId = post.id;
    switchView("reader");
  });
  els.examReviewForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const content = els.examReviewContent.value.trim();
    if (!content) return;
    state.exam.reviews.unshift({
      id: crypto.randomUUID(),
      date: els.examReviewDate.value || todayKey(),
      type: els.examReviewType.value,
      content,
      next: els.examReviewNext.value.trim(),
      createdAt: Date.now()
    });
    els.examReviewContent.value = "";
    els.examReviewNext.value = "";
    persist();
  });
  els.examReviewList?.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-exam-review-delete]");
    if (!remove) return;
    state.exam.reviews = state.exam.reviews.filter((item) => item.id !== remove.dataset.examReviewDelete);
    persist();
  });
  els.examMemoryForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = els.examMemoryTitle.value.trim();
    const content = els.examMemoryContent.value.trim();
    if (!title || !content) return;
    state.exam.memoryItems.unshift({
      id: crypto.randomUUID(),
      title,
      subject: els.examMemorySubject.value.trim(),
      content,
      level: 0,
      reviews: 0,
      nextReview: todayKey(),
      lastReview: "",
      createdAt: Date.now()
    });
    els.examMemoryTitle.value = "";
    els.examMemorySubject.value = "";
    els.examMemoryContent.value = "";
    persist();
  });
  els.examMemoryList?.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-exam-memory-delete]");
    if (remove) {
      state.exam.memoryItems = state.exam.memoryItems.filter((item) => item.id !== remove.dataset.examMemoryDelete);
      state.exam.memoryRecords = state.exam.memoryRecords.filter((record) => record.itemId !== remove.dataset.examMemoryDelete);
      persist();
      return;
    }
    const qualityButton = event.target.closest("[data-exam-memory-quality]");
    if (!qualityButton) return;
    reviewExamMemory(qualityButton.dataset.memoryId, qualityButton.dataset.examMemoryQuality);
  });
  els.examHeatmapMode?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-heatmap-mode]");
    if (!button) return;
    state.exam.heatmapMode = button.dataset.heatmapMode;
    persist();
  });
  els.prevMonthBtn.addEventListener("click", () => {
    currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1);
    renderTaskViewMode();
  });
  els.nextMonthBtn.addEventListener("click", () => {
    currentMonthDate = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1);
    renderTaskViewMode();
  });
  els.todayMonthBtn.addEventListener("click", () => {
    currentMonthDate = new Date();
    renderTaskViewMode();
  });
  $("#photoUpload").addEventListener("change", uploadPhotos);
  els.addPhotoWallBtn.addEventListener("click", () => {
    const nextIndex = state.photoWalls.length + 1;
    const wall = { id: crypto.randomUUID(), name: `照片墙 ${nextIndex}`, photos: [] };
    state.photoWalls.push(wall);
    state.activePhotoWallId = wall.id;
    persist();
  });
  els.renameWallBtn.addEventListener("click", () => renameWall(activeWall().id));
  els.duplicateWallBtn.addEventListener("click", duplicateCurrentWall);
  els.deleteWallBtn.addEventListener("click", deleteCurrentWall);
  els.photoWall.addEventListener("pointerdown", beginDrag);
  els.photoWall.addEventListener("contextmenu", (event) => {
    const card = event.target.closest(".photo-card");
    if (!card || event.target.closest("[data-photo-delete], [data-photo-resize], [data-photo-rotate]")) return;
    event.preventDefault();
    if (movePhotoLayer(card.dataset.photoId, -1)) persist();
  });
  window.addEventListener("pointermove", moveDrag);
  window.addEventListener("pointerup", endDrag);
  els.aboutForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.profile = {
      name: els.profileName.value.trim() || "关于我",
      bio: els.profileBio.value.trim(),
      links: els.profileLinks.value.trim()
    };
    persist();
  });
  els.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.settings.blogName = els.blogName.value.trim() || "星屑笔记";
    state.settings.blogSignature = els.blogSignature.value.trim() || "Local-first Blog Studio";
    state.settings.bgOpacity = Number(els.bgOpacity.value);
    state.settings.uiOpacity = Number(els.uiOpacity.value);
    state.settings.blurAmount = Number(els.blurAmount.value);
    state.settings.bodyFontSize = Number(els.bodyFontSize.value);
    state.settings.dailyWordGoal = Math.max(1, Number(els.dailyWordGoal.value) || 30);
    state.settings.bgMode = els.bgMode.value;
    state.settings.bgPosition = els.bgPosition.value;
    persist();
  });
  els.bgOpacity.addEventListener("input", () => {
    state.settings.bgOpacity = Number(els.bgOpacity.value);
    applyTheme();
  });
  els.uiOpacity.addEventListener("input", () => {
    state.settings.uiOpacity = Number(els.uiOpacity.value);
    applyTheme();
  });
  els.blurAmount.addEventListener("input", () => {
    state.settings.blurAmount = Number(els.blurAmount.value);
    applyTheme();
  });
  els.bodyFontSize.addEventListener("input", () => {
    state.settings.bodyFontSize = Number(els.bodyFontSize.value);
    applyTheme();
  });
  els.dailyWordGoal.addEventListener("change", () => {
    state.settings.dailyWordGoal = Math.max(1, Number(els.dailyWordGoal.value) || 30);
    persist();
  });
  els.wordDailyGoal?.addEventListener("change", () => {
    state.settings.dailyWordGoal = Math.max(1, Number(els.wordDailyGoal.value) || 30);
    if (els.dailyWordGoal) els.dailyWordGoal.value = state.settings.dailyWordGoal;
    persist();
  });
  els.musicToggleBtn.addEventListener("click", () => {
    toggleMusic().catch(() => {
      musicPlaying = false;
      setUploadStatus(els.musicStatus, "音乐播放失败，请换一个音频文件", "error");
    });
  });
  els.musicUpload.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    state.settings.musicSrc = await api.uploadDataUrl("music", file.name, dataUrl);
    state.settings.musicName = file.name;
    event.target.value = "";
    musicAudio.pause();
    stopDefaultMusic();
    musicPlaying = false;
    persist();
  });
  els.musicVolume.addEventListener("input", () => {
    state.settings.musicVolume = Number(els.musicVolume.value);
    musicAudio.volume = state.settings.musicVolume;
    persist();
  });
  els.clearMusicBtn.addEventListener("click", () => {
    state.settings.musicSrc = "";
    state.settings.musicName = "默认轻音乐";
    musicAudio.pause();
    stopDefaultMusic();
    musicPlaying = false;
    persist();
  });
  [els.bgMode, els.bgPosition].forEach((control) => {
    control.addEventListener("change", () => {
      state.settings.bgMode = els.bgMode.value;
      state.settings.bgPosition = els.bgPosition.value;
      persist();
    });
  });
  els.backgroundUpload.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploadStatus(els.backgroundStatus, "正在处理背景图片...");
    try {
      const processed = await imageFileToDataUrl(file, { maxEdge: 1200, quality: 0.78 });
      state.settings.background = await api.uploadDataUrl("backgrounds", file.name, processed);
      state.settings.bgOpacity = Math.max(Number(state.settings.bgOpacity) || 0.86, 0.86);
      state.settings.bgMode = "character";
      state.settings.bgPosition = "right bottom";
      event.target.value = "";
      const saved = persist();
      setUploadStatus(els.backgroundStatus, saved ? "背景已应用，如果仍不明显可以切换为铺满屏幕。" : "背景已显示，但本地保存空间不足，请换小图。", saved ? "ok" : "error");
    } catch (error) {
      setUploadStatus(els.backgroundStatus, error.message || "背景上传失败", "error");
      event.target.value = "";
    }
  });
  els.clearBackgroundBtn.addEventListener("click", () => {
    state.settings.background = "";
    persist();
  });
  els.pomodoroModeBtn.addEventListener("click", () => {
    if (state.timer.mode === "pomodoro") return;
    stopTimer();
    state.timer.mode = "pomodoro";
    timerRemaining = timerFocusSeconds();
    persist();
  });
  els.stopwatchModeBtn.addEventListener("click", () => {
    if (state.timer.mode === "stopwatch") return;
    stopTimer();
    state.timer.mode = "stopwatch";
    persist();
  });
  els.timerStartBtn.addEventListener("click", () => {
    if (timerRunning) {
      stopTimer();
      renderTimer();
      return;
    }
    startTimer();
    renderTimer();
  });
  els.timerSaveBtn.addEventListener("click", () => {
    syncTimerClock();
    if (timerElapsed <= 0) return;
    stopTimer();
    completeFocus(Math.max(1, Math.round(timerElapsed / 60)));
    timerElapsed = 0;
    renderTimer();
  });
  els.timerResetBtn.addEventListener("click", () => {
    stopTimer();
    activeFocusTaskId = null;
    timerRemaining = Number(state.timer.focusMinutes || 25) * 60;
    timerElapsed = 0;
    renderTimer();
  });
  [els.focusMinutes, els.breakMinutes].forEach((input) => {
    input.addEventListener("change", () => {
      state.timer.focusMinutes = Math.max(1, Number(els.focusMinutes.value) || 25);
      state.timer.breakMinutes = Math.max(1, Number(els.breakMinutes.value) || 5);
      if (!timerRunning && state.timer.mode === "pomodoro") {
        timerRemaining = state.timer.focusMinutes * 60;
      }
      persist();
    });
  });
  els.focusSubjectSelect.addEventListener("change", () => {
    state.timer.activeSubjectId = els.focusSubjectSelect.value;
    persist();
  });
  els.focusChartDate.addEventListener("change", renderTimer);
  els.focusRangeSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("[data-focus-range]");
    if (!button) return;
    activeFocusRange = button.dataset.focusRange;
    renderTimer();
  });
  els.addFocusSubjectBtn.addEventListener("click", () => {
    const name = els.focusSubjectName.value.trim();
    if (!name) return;
    state.timer.subjects = normalizeFocusSubjects(state.timer.subjects);
    const id = `custom-${Date.now().toString(36)}`;
    state.timer.subjects.push({
      id,
      name,
      color: focusSubjectColor(state.timer.subjects.length),
      locked: false
    });
    state.timer.activeSubjectId = id;
    els.focusSubjectName.value = "";
    persist();
  });
  els.focusSubjectName.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    els.addFocusSubjectBtn.click();
  });
  els.focusSubjectList.addEventListener("click", async (event) => {
    const select = event.target.closest("[data-focus-subject-select]");
    const remove = event.target.closest("[data-focus-subject-delete]");
    if (select) {
      state.timer.activeSubjectId = select.dataset.focusSubjectSelect;
      persist();
      return;
    }
    if (!remove) return;
    const subject = state.timer.subjects.find((item) => item.id === remove.dataset.focusSubjectDelete);
    if (!subject || subject.locked) return;
    const ok = await showConfirm({
      eyebrow: "Focus",
      title: "删除学习种类？",
      message: `删除「${subject.name}」后，历史记录会保留它原来的名称和颜色。`,
      okText: "删除",
      danger: true
    });
    if (!ok) return;
    state.timer.subjects = state.timer.subjects.filter((item) => item.id !== subject.id);
    if (state.timer.activeSubjectId === subject.id) state.timer.activeSubjectId = state.timer.subjects[0]?.id || "math";
    persist();
  });
  els.clearFocusRecordsBtn.addEventListener("click", () => {
    state.focusRecords = [];
    persist();
  });
  $$(".settings-nav button").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".settings-nav button").forEach((item) => item.classList.toggle("active", item === button));
      document.getElementById(button.dataset.settingsTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  els.exportBtn.addEventListener("click", exportBackup);
  els.exportAllDataBtn.addEventListener("click", exportBackup);
  els.openDesktopDataBtn?.addEventListener("click", openDesktopDataDir);
  els.desktopBackupBtn?.addEventListener("click", createDesktopBackup);
  els.desktopRestoreBtn?.addEventListener("click", restoreDesktopBackup);
  els.clearFocusDataBtn.addEventListener("click", async () => {
    const ok = await showConfirm({
      eyebrow: "\u6570\u636e",
      title: "\u6e05\u7a7a\u4e13\u6ce8\u8bb0\u5f55\uff1f",
      message: "\u6240\u6709\u756a\u8304\u949f\u548c\u4e13\u6ce8\u65f6\u957f\u8bb0\u5f55\u90fd\u4f1a\u88ab\u79fb\u9664\u3002",
      okText: "\u6e05\u7a7a",
      danger: true
    });
    if (!ok) return;
    state.focusRecords = [];
    persist();
  });
  els.clearDoneTasksBtn.addEventListener("click", async () => {
    const ok = await showConfirm({
      eyebrow: "\u6570\u636e",
      title: "\u6e05\u7a7a\u5df2\u5b8c\u6210\u4efb\u52a1\uff1f",
      message: "\u5df2\u5b8c\u6210\u7684\u4efb\u52a1\u4f1a\u4ece\u6253\u5361\u5217\u8868\u4e2d\u79fb\u9664\uff0c\u672a\u5b8c\u6210\u4efb\u52a1\u4f1a\u4fdd\u7559\u3002",
      okText: "\u6e05\u7a7a",
      danger: true
    });
    if (!ok) return;
    state.tasks = state.tasks.filter((task) => !task.done);
    persist();
  });
  els.resetDataBtn.addEventListener("click", async () => {
    const ok = await showConfirm({
      eyebrow: "\u5371\u9669\u64cd\u4f5c",
      title: "\u91cd\u7f6e\u5168\u90e8\u6570\u636e\uff1f",
      message: "\u6587\u7ae0\u3001\u6253\u5361\u3001\u7167\u7247\u5899\u3001\u5355\u8bcd\u548c\u8bbe\u7f6e\u90fd\u4f1a\u6062\u590d\u5230\u521d\u59cb\u72b6\u6001\u3002\u5efa\u8bae\u5148\u5bfc\u51fa\u5907\u4efd\u3002",
      okText: "\u91cd\u7f6e",
      danger: true
    });
    if (!ok) return;
    state = normalizeState(structuredClone(defaultState));
    activePostId = state.posts[0]?.id || null;
    activeWordId = state.words[0]?.id || null;
    persist();
    switchView("home");
  });
  els.importInput.addEventListener("change", importBackup);
}

function beginDrag(event) {
  if (event.button !== 0) return;
  const card = event.target.closest(".photo-card");
  if (!card || event.target.closest("[data-photo-delete]")) return;
  const photo = activeWall().photos.find((item) => item.id === card.dataset.photoId);
  if (!photo) return;
  const rect = card.getBoundingClientRect();
  const wallRect = els.photoWall.getBoundingClientRect();
  const isResize = Boolean(event.target.closest("[data-photo-resize]"));
  const isRotate = Boolean(event.target.closest("[data-photo-rotate]"));
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  dragState = {
    id: photo.id,
    mode: isRotate ? "rotate" : isResize ? "resize" : "move",
    startX: event.clientX,
    startY: event.clientY,
    startPhotoX: photo.x || 0,
    startPhotoY: photo.y || 0,
    startWidth: photo.width,
    startHeight: photo.height || photo.width,
    aspectRatio: photo.aspectRatio || photo.width / (photo.height || photo.width) || 1,
    centerX,
    centerY,
    startRotation: photo.rotation || 0,
    startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180 / Math.PI,
    offsetX: event.clientX - wallRect.left - (photo.x || 0),
    offsetY: event.clientY - wallRect.top - (photo.y || 0),
    moved: false
  };
  card.setPointerCapture?.(event.pointerId);
}

function moveDrag(event) {
  if (!dragState) return;
  if (Math.abs(event.clientX - dragState.startX) > 3 || Math.abs(event.clientY - dragState.startY) > 3) {
    dragState.moved = true;
  }
  const wallRect = els.photoWall.getBoundingClientRect();
  const photo = activeWall().photos.find((item) => item.id === dragState.id);
  if (!photo) return;
  const card = $(`[data-photo-id="${photo.id}"]`);
  if (dragState.mode === "rotate") {
    const angle = Math.atan2(event.clientY - dragState.centerY, event.clientX - dragState.centerX) * 180 / Math.PI;
    photo.rotation = Math.round(dragState.startRotation + angle - dragState.startAngle);
    if (card) card.style.setProperty("--photo-rotation", `${photo.rotation}deg`);
  } else if (dragState.mode === "resize") {
    const delta = Math.max(event.clientX - dragState.startX, event.clientY - dragState.startY);
    const nextWidth = Math.max(110, Math.min(620, dragState.startWidth + delta));
    photo.width = nextWidth;
    photo.height = Math.max(70, Math.round(nextWidth / dragState.aspectRatio));
    if (card) {
      card.style.width = `${photo.width}px`;
      card.style.height = `${photo.height}px`;
    }
  } else {
    photo.x = Math.max(0, Math.min(wallRect.width - photo.width, event.clientX - wallRect.left - dragState.offsetX));
    photo.y = Math.max(0, Math.min(wallRect.height - (photo.height || photo.width), event.clientY - wallRect.top - dragState.offsetY));
    if (card) {
      card.style.left = `${photo.x}px`;
      card.style.top = `${photo.y}px`;
    }
  }
}

function endDrag() {
  if (!dragState) return;
  const shouldRaiseLayer = dragState.mode === "move" && !dragState.moved;
  const photoId = dragState.id;
  dragState = null;
  if (shouldRaiseLayer) {
    if (movePhotoLayer(photoId, 1)) persist();
    return;
  }
  api.save(state);
}

wireEvents();
api.loadFull()
  .then(async (fullState) => {
    if (!fullState) {
      api.saveFull(state).catch(() => {});
    } else {
      state = normalizeState(fullState);
    }
    const serverState = await api.loadServer();
    if (serverState) {
      state = normalizeState(serverState);
    } else if (api.serverReady) {
      api.saveServer(state).catch(() => {});
    }
    initialDataLoaded = true;
    render();
    switchView(currentView);
    initMusicAutoplay();
  })
  .catch((error) => {
    console.error("IndexedDB load failed", error);
    initialDataLoaded = true;
    render();
    switchView(currentView);
    initMusicAutoplay();
  });
