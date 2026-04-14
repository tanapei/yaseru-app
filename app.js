const STORAGE_KEY = "yaseru-app-state";
const PLAN_VERSION = "2026-04-15-checklist-v4";
const TODAY_TARGET_DATE = "2026-05-15";
const TASK_GROUPS = {
  meal: ["mealProtein", "mealNoDrink", "mealNoLateSnack"],
  exercise: ["exercisePlank", "exerciseLegRaise", "exerciseSquat", "exerciseSteps"],
  sleep: ["sleepHours", "sleepBedtime", "sleepNoScreen"],
};
const TONE_COLORS = {
  meal: "#ff8c5a",
  move: "#28b88e",
  sleep: "#4d8dff",
};
const DEFAULT_PROFILE = {
  age: 29,
  sex: "male",
  currentWeightStart: 66.5,
  targetWeight: 62.5,
  targetDate: TODAY_TARGET_DATE,
  dailyStepGoal: 8000,
  dailySleepGoalHours: 7.5,
  bedtimeTarget: "00:30",
  planVersion: PLAN_VERSION,
};

const state = loadState();
const ui = mapUi();

bindServiceWorker();
initializeForms();
bindModalEvents();
bindTaskEvents();
refreshAll();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { profile: { ...DEFAULT_PROFILE }, entries: {} };
    }

    const parsed = JSON.parse(raw);
    return {
      profile: migrateProfile(parsed.profile),
      entries: migrateEntries(parsed.entries),
    };
  } catch (error) {
    return { profile: { ...DEFAULT_PROFILE }, entries: {} };
  }
}

function migrateProfile(profile) {
  if (!profile || profile.planVersion !== PLAN_VERSION) {
    return { ...DEFAULT_PROFILE };
  }

  return {
    ...DEFAULT_PROFILE,
    ...profile,
  };
}

function migrateEntries(entries) {
  const safeEntries = entries && typeof entries === "object" ? entries : {};
  return Object.fromEntries(
    Object.entries(safeEntries).map(([date, entry]) => [date, normalizeEntry(entry)])
  );
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function mapUi() {
  return {
    remainingWeight: document.getElementById("remainingWeight"),
    remainingDays: document.getElementById("remainingDays"),
    goalCaption: document.getElementById("goalCaption"),
    overallScore: document.getElementById("overallScore"),
    progressCircle: document.getElementById("progressCircle"),
    currentWeight: document.getElementById("currentWeight"),
    weightProgress: document.getElementById("weightProgress"),
    clearCount: document.getElementById("clearCount"),
    trendCaption: document.getElementById("trendCaption"),
    miniWeightTrend: document.getElementById("miniWeightTrend"),
    mealCount: document.getElementById("mealCount"),
    exerciseCount: document.getElementById("exerciseCount"),
    sleepCount: document.getElementById("sleepCount"),
    mealTasks: document.getElementById("mealTasks"),
    exerciseTasks: document.getElementById("exerciseTasks"),
    sleepTasks: document.getElementById("sleepTasks"),
    mealCard: document.getElementById("mealCard"),
    exerciseCard: document.getElementById("exerciseCard"),
    sleepCard: document.getElementById("sleepCard"),
    setupForm: document.getElementById("setupForm"),
    weightForm: document.getElementById("weightForm"),
    setupError: document.getElementById("setupError"),
    historyList: document.getElementById("historyList"),
    historySparkline: document.getElementById("historySparkline"),
    historyItemTemplate: document.getElementById("historyItemTemplate"),
  };
}

function initializeForms() {
  ui.setupForm.elements.targetDate.min = getLocalDateKey(new Date());
  fillSetupForm();
  fillWeightForm();

  ui.setupForm.addEventListener("submit", handleSetupSubmit);
  ui.weightForm.addEventListener("submit", handleWeightSubmit);
}

function bindModalEvents() {
  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const modalId = button.getAttribute("data-open-modal");
      if (modalId === "history-modal") {
        renderHistory();
      }
      if (modalId === "setup-modal") {
        fillSetupForm();
      }
      if (modalId === "weight-modal") {
        fillWeightForm();
      }
      openModal(modalId);
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeActiveModal);
  });
}

function bindTaskEvents() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-task-id]");
    if (!button) {
      return;
    }

    toggleTask(button.getAttribute("data-task-id"), button);
  });
}

function bindServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .register("./sw.js")
      .then((registration) => {
        registration.update().catch(() => null);

        let hasPendingRefresh = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (hasPendingRefresh) {
            return;
          }
          hasPendingRefresh = true;
          window.location.reload();
        });
      })
      .catch(() => null);
  }
}

function refreshAll() {
  renderHero();
  renderTaskGroups();
}

function renderHero() {
  const profile = state.profile;
  const todayEntry = getTodayEntry();
  const todayScore = calculateScore(todayEntry);
  const effectiveWeight =
    todayEntry.weight ?? getLatestWeight() ?? profile.currentWeightStart;
  const remainingWeight = Math.max(effectiveWeight - profile.targetWeight, 0);
  const daysRemaining = Math.max(getDaysRemaining(profile.targetDate), 0);
  const weightProgress = calculateWeightProgress(effectiveWeight, profile);
  const recentWeights = buildRecentHistory();
  const latestWeightedDay = [...recentWeights]
    .reverse()
    .find((item) => typeof item.weight === "number" && item.weight > 0);

  ui.remainingWeight.textContent = remainingWeight.toFixed(1);
  ui.remainingDays.textContent = String(daysRemaining);
  ui.goalCaption.textContent = `${profile.currentWeightStart.toFixed(1)} → ${profile.targetWeight.toFixed(1)}`;
  ui.currentWeight.textContent = `${effectiveWeight.toFixed(1)} kg`;
  ui.weightProgress.textContent = `${weightProgress}%`;
  ui.clearCount.textContent = `${todayScore.done} / ${todayScore.total}`;
  ui.overallScore.textContent = `${todayScore.percent}%`;
  ui.trendCaption.textContent = latestWeightedDay
    ? latestWeightedDay.weightLabel
    : "7 days";
  setProgress(todayScore.percent);
  drawMiniWeightTrend(recentWeights);
}

function renderTaskGroups() {
  const entry = getTodayEntry();
  const taskDefinitions = getTaskDefinitions(new Date(), state.profile);

  renderTaskList("meal", ui.mealTasks, ui.mealCount, ui.mealCard, entry, taskDefinitions);
  renderTaskList(
    "exercise",
    ui.exerciseTasks,
    ui.exerciseCount,
    ui.exerciseCard,
    entry,
    taskDefinitions
  );
  renderTaskList("sleep", ui.sleepTasks, ui.sleepCount, ui.sleepCard, entry, taskDefinitions);
}

function renderTaskList(category, container, countNode, cardNode, entry, taskDefinitions) {
  const taskIds = TASK_GROUPS[category];
  const doneCount = taskIds.filter((taskId) => entry.tasks[taskId]).length;
  countNode.textContent = `${doneCount}/${taskIds.length}`;
  cardNode.classList.toggle("is-hot", doneCount === taskIds.length);

  container.innerHTML = "";

  taskIds.forEach((taskId) => {
    const definition = taskDefinitions[taskId];
    const button = document.createElement("button");
    button.type = "button";
    button.className = `task-toggle ${definition.tone}`;
    button.setAttribute("data-task-id", taskId);
    button.setAttribute("aria-pressed", entry.tasks[taskId] ? "true" : "false");

    if (entry.tasks[taskId]) {
      button.classList.add("checked");
    }

    const label = document.createElement("span");
    label.className = "task-label";
    label.textContent = definition.label;
    button.appendChild(label);
    container.appendChild(button);
  });
}

function getTaskDefinitions(date, profile) {
  return {
    mealProtein: {
      label: "たんぱく質1品 x 3",
      tone: "meal",
    },
    mealNoDrink: {
      label: "甘い飲み物 0",
      tone: "meal",
    },
    mealNoLateSnack: {
      label: "遅い夜は ご飯半分",
      tone: "meal",
    },
    exercisePlank: {
      label: "プランク 60秒 x 3",
      tone: "move",
    },
    exerciseLegRaise: {
      label: "レッグレイズ 15回 x 3",
      tone: "move",
    },
    exerciseSquat: {
      label: "スクワット 20回 x 3",
      tone: "move",
    },
    exerciseSteps: {
      label: `${profile.dailyStepGoal.toLocaleString("ja-JP")}歩`,
      tone: "move",
    },
    sleepHours: {
      label: `${profile.dailySleepGoalHours}時間`,
      tone: "sleep",
    },
    sleepBedtime: {
      label: `${profile.bedtimeTarget}まで`,
      tone: "sleep",
    },
    sleepNoScreen: {
      label: "寝る前30分 OFF",
      tone: "sleep",
    },
  };
}

function handleSetupSubmit(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const profile = {
    age: Number(formData.get("age")),
    sex: String(formData.get("sex")),
    currentWeightStart: Number(formData.get("currentWeightStart")),
    targetWeight: Number(formData.get("targetWeight")),
    targetDate: String(formData.get("targetDate")),
    dailyStepGoal: Number(formData.get("dailyStepGoal")),
    dailySleepGoalHours: Number(formData.get("dailySleepGoalHours")),
    bedtimeTarget: DEFAULT_PROFILE.bedtimeTarget,
    planVersion: PLAN_VERSION,
  };

  const validation = validateProfile(profile);
  if (validation) {
    ui.setupError.textContent = validation;
    return;
  }

  state.profile = profile;
  ui.setupError.textContent = "";
  saveState();
  refreshAll();
  closeActiveModal();
}

function handleWeightSubmit(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const entry = getTodayEntry();
  entry.weight = Number(formData.get("weight"));
  setTodayEntry(entry);
  refreshAll();
  closeActiveModal();
}

function toggleTask(taskId, button) {
  const entry = getTodayEntry();
  entry.tasks[taskId] = !entry.tasks[taskId];
  setTodayEntry(entry);
  refreshAll();

  const freshButton = document.querySelector(`[data-task-id="${taskId}"]`);
  if (freshButton && entry.tasks[taskId]) {
    createSparkBurst(
      freshButton,
      freshButton.classList.contains("meal")
        ? "meal"
        : freshButton.classList.contains("move")
          ? "move"
          : "sleep"
    );
  }
}

function createSparkBurst(button, tone) {
  const color = TONE_COLORS[tone] ?? "#f8b731";

  for (let index = 0; index < 6; index += 1) {
    const spark = document.createElement("span");
    spark.className = "spark";
    spark.style.background = color;
    spark.style.left = `${18 + Math.random() * 60}%`;
    spark.style.top = `${20 + Math.random() * 50}%`;
    spark.style.setProperty("--dx", `${-28 + Math.random() * 56}px`);
    spark.style.setProperty("--dy", `${-36 + Math.random() * 24}px`);
    button.appendChild(spark);
    window.setTimeout(() => spark.remove(), 620);
  }
}

function fillSetupForm() {
  const profile = state.profile;
  ui.setupForm.elements.age.value = profile.age;
  ui.setupForm.elements.sex.value = profile.sex;
  ui.setupForm.elements.currentWeightStart.value = profile.currentWeightStart;
  ui.setupForm.elements.targetWeight.value = profile.targetWeight;
  ui.setupForm.elements.targetDate.value = profile.targetDate;
  ui.setupForm.elements.dailyStepGoal.value = profile.dailyStepGoal;
  ui.setupForm.elements.dailySleepGoalHours.value = profile.dailySleepGoalHours;
}

function fillWeightForm() {
  const latestWeight =
    getTodayEntry().weight ?? getLatestWeight() ?? state.profile.currentWeightStart;
  ui.weightForm.elements.weight.value = latestWeight;
}

function validateProfile(profile) {
  if (profile.targetWeight >= profile.currentWeightStart) {
    return "目標体重は開始体重より小さくしてください。";
  }

  const today = new Date();
  const target = new Date(`${profile.targetDate}T00:00:00`);
  const diffDays = Math.ceil((target - today) / 86400000);
  if (Number.isNaN(target.getTime()) || diffDays < 1) {
    return "目標期限は今日より先にしてください。";
  }

  return "";
}

function openModal(modalId) {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  });

  const modal = document.getElementById(modalId);
  if (!modal) {
    return;
  }

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function closeActiveModal() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  });
}

function defaultDailyRecord() {
  return {
    weight: null,
    tasks: {
      mealProtein: false,
      mealNoDrink: false,
      mealNoLateSnack: false,
      exercisePlank: false,
      exerciseLegRaise: false,
      exerciseSquat: false,
      exerciseSteps: false,
      sleepHours: false,
      sleepBedtime: false,
      sleepNoScreen: false,
    },
  };
}

function normalizeEntry(entry) {
  const base = defaultDailyRecord();
  return {
    weight:
      typeof entry?.weight === "number" && Number.isFinite(entry.weight)
        ? entry.weight
        : null,
    tasks: {
      ...base.tasks,
      ...(entry?.tasks ?? {}),
    },
  };
}

function getTodayEntry() {
  const todayKey = getLocalDateKey(new Date());
  return normalizeEntry(state.entries[todayKey]);
}

function setTodayEntry(entry) {
  const todayKey = getLocalDateKey(new Date());
  state.entries[todayKey] = normalizeEntry(entry);
  saveState();
}

function calculateScore(entry) {
  const taskIds = Object.values(TASK_GROUPS).flat();
  const done = taskIds.filter((taskId) => entry.tasks[taskId]).length;
  const total = taskIds.length;
  return {
    done,
    total,
    percent: Math.round((done / total) * 100),
  };
}

function calculateWeightProgress(currentWeight, profile) {
  const total = profile.currentWeightStart - profile.targetWeight;
  const done = profile.currentWeightStart - currentWeight;
  if (total <= 0) {
    return 0;
  }
  return Math.min(Math.max(Math.round((done / total) * 100), 0), 100);
}

function setProgress(value) {
  const circumference = 301.59;
  const clamped = Math.min(Math.max(value, 0), 100);
  const offset = circumference - (circumference * clamped) / 100;
  ui.progressCircle.style.strokeDashoffset = String(offset);

  if (clamped >= 67) {
    ui.progressCircle.style.stroke = "#28b88e";
  } else if (clamped >= 34) {
    ui.progressCircle.style.stroke = "#f8b731";
  } else {
    ui.progressCircle.style.stroke = "#ff8c5a";
  }
}

function getDaysRemaining(targetDate) {
  const today = new Date();
  const target = new Date(`${targetDate}T23:59:59`);
  return Math.ceil((target - today) / 86400000);
}

function getLatestWeight() {
  const datedEntries = Object.entries(state.entries)
    .map(([date, entry]) => [date, normalizeEntry(entry)])
    .filter(([, entry]) => typeof entry.weight === "number" && entry.weight > 0)
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (datedEntries.length === 0) {
    return null;
  }

  return datedEntries[datedEntries.length - 1][1].weight;
}

function renderHistory() {
  const recent = buildRecentHistory();
  ui.historyList.innerHTML = "";

  recent.forEach((item) => {
    const fragment = ui.historyItemTemplate.content.cloneNode(true);
    fragment.querySelector(".history-date").textContent = formatDateLabel(item.date);
    fragment.querySelector(".history-meta").textContent =
      `${item.weightLabel} / ${item.done} / ${item.total}`;
    fragment.querySelector(".history-score").textContent = `${item.percent}%`;
    ui.historyList.appendChild(fragment);
  });

  drawSparkline(recent);
}

function buildRecentHistory() {
  const days = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const dateKey = getLocalDateKey(date);
    const entry = normalizeEntry(state.entries[dateKey]);
    const score = calculateScore(entry);

    days.push({
      date: dateKey,
      done: score.done,
      total: score.total,
      percent: score.percent,
      weightLabel:
        typeof entry.weight === "number" && entry.weight > 0
          ? `${entry.weight.toFixed(1)}kg`
          : "--",
      weight: entry.weight,
    });
  }

  return days;
}

function drawSparkline(recent) {
  const svg = ui.historySparkline;
  svg.innerHTML = "";

  const weights = recent
    .map((item) => item.weight)
    .filter((weight) => typeof weight === "number" && weight > 0);

  if (weights.length === 0) {
    svg.innerHTML =
      '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#6e6a63" font-size="14">体重を入れると推移が出ます</text>';
    return;
  }

  let lastKnown = weights[0];
  const normalizedWeights = recent.map((item) => {
    if (typeof item.weight === "number" && item.weight > 0) {
      lastKnown = item.weight;
    }
    return lastKnown;
  });

  const min = Math.min(...normalizedWeights);
  const max = Math.max(...normalizedWeights);
  const span = Math.max(max - min, 1);
  const points = normalizedWeights.map((weight, index) => {
    const x = 20 + (index * 280) / Math.max(normalizedWeights.length - 1, 1);
    const y = 92 - ((weight - min) / span) * 64;
    return [x, y];
  });
  const pathData = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#4d8dff");
  path.setAttribute("stroke-width", "4");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);

  points.forEach(([x, y]) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x.toFixed(2));
    circle.setAttribute("cy", y.toFixed(2));
    circle.setAttribute("r", "4");
    circle.setAttribute("fill", "#f8b731");
    svg.appendChild(circle);
  });
}

function drawMiniWeightTrend(recent) {
  const svg = ui.miniWeightTrend;
  svg.innerHTML = "";

  const weights = recent
    .map((item) => item.weight)
    .filter((weight) => typeof weight === "number" && weight > 0);

  if (weights.length === 0) {
    svg.innerHTML =
      '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#6e6a63" font-size="10">no data</text>';
    return;
  }

  let lastKnown = weights[0];
  const normalizedWeights = recent.map((item) => {
    if (typeof item.weight === "number" && item.weight > 0) {
      lastKnown = item.weight;
    }
    return lastKnown;
  });

  const min = Math.min(...normalizedWeights);
  const max = Math.max(...normalizedWeights);
  const span = Math.max(max - min, 1);
  const points = normalizedWeights.map((weight, index) => {
    const x = 12 + (index * 216) / Math.max(normalizedWeights.length - 1, 1);
    const y = 50 - ((weight - min) / span) * 34;
    return [x, y];
  });
  const pathData = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#f15a29");
  path.setAttribute("stroke-width", "3.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);

  points.forEach(([x, y], index) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x.toFixed(2));
    circle.setAttribute("cy", y.toFixed(2));
    circle.setAttribute("r", index === points.length - 1 ? "4" : "2.6");
    circle.setAttribute("fill", index === points.length - 1 ? "#28b88e" : "#f8b731");
    svg.appendChild(circle);
  });
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}
