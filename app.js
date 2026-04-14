const STORAGE_KEY = "yaseru-app-state";
const MEAL_LABELS = {
  unrecorded: "未記録",
  ate: "食べた",
  light: "控えめ",
};
const SNACK_LABELS = {
  none: "なし",
  little: "少し",
  much: "あり",
};
const EXERCISE_LABELS = {
  none: "未選択",
  walk: "散歩",
  strength: "筋トレ",
  cardio: "有酸素",
  stretch: "ストレッチ",
  other: "その他",
};
const SLEEP_LABELS = {
  good: "良い",
  normal: "普通",
  bad: "悪い",
};

const defaultDailyRecord = () => ({
  weight: null,
  meals: {
    breakfast: "unrecorded",
    lunch: "unrecorded",
    dinner: "unrecorded",
  },
  snackLevel: "none",
  waterCups: 0,
  exerciseDone: false,
  exerciseType: "none",
  exerciseMinutes: 0,
  steps: 0,
  sleepHours: 0,
  bedtime: "",
  wakeTime: "",
  sleepQuality: "normal",
});

const state = loadState();
const ui = mapUi();

initializeForms();
bindModalEvents();
bindServiceWorker();
refreshAll();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { profile: null, entries: {} };
    }

    const parsed = JSON.parse(raw);
    return {
      profile: parsed.profile ?? null,
      entries: parsed.entries ?? {},
    };
  } catch (error) {
    return { profile: null, entries: {} };
  }
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
    targetWeight: document.getElementById("targetWeight"),
    weightProgress: document.getElementById("weightProgress"),
    mealScore: document.getElementById("mealScore"),
    exerciseScore: document.getElementById("exerciseScore"),
    sleepScore: document.getElementById("sleepScore"),
    mealStatusLine: document.getElementById("mealStatusLine"),
    snackStatusLine: document.getElementById("snackStatusLine"),
    exerciseStatusLine: document.getElementById("exerciseStatusLine"),
    stepsStatusLine: document.getElementById("stepsStatusLine"),
    sleepStatusLine: document.getElementById("sleepStatusLine"),
    sleepDetailLine: document.getElementById("sleepDetailLine"),
    setupForm: document.getElementById("setupForm"),
    weightForm: document.getElementById("weightForm"),
    mealForm: document.getElementById("mealForm"),
    exerciseForm: document.getElementById("exerciseForm"),
    sleepForm: document.getElementById("sleepForm"),
    setupError: document.getElementById("setupError"),
    historyList: document.getElementById("historyList"),
    historySparkline: document.getElementById("historySparkline"),
    historyItemTemplate: document.getElementById("historyItemTemplate"),
  };
}

function initializeForms() {
  const today = getLocalDateKey(new Date());
  const targetDefaultDate = new Date();
  targetDefaultDate.setDate(targetDefaultDate.getDate() + 60);

  ui.setupForm.elements.targetDate.min = today;
  ui.setupForm.elements.targetDate.value = getLocalDateKey(targetDefaultDate);

  ui.setupForm.addEventListener("submit", handleSetupSubmit);
  ui.weightForm.addEventListener("submit", handleWeightSubmit);
  ui.mealForm.addEventListener("submit", handleMealSubmit);
  ui.exerciseForm.addEventListener("submit", handleExerciseSubmit);
  ui.sleepForm.addEventListener("submit", handleSleepSubmit);
}

function bindModalEvents() {
  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      const modalId = button.getAttribute("data-open-modal");
      if (modalId === "history-modal") {
        renderHistory();
      }
      fillFormDefaults(modalId);
      openModal(modalId);
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeActiveModal);
  });
}

function bindServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => null);
  }
}

function handleSetupSubmit(event) {
  event.preventDefault();

  const formData = new FormData(event.currentTarget);
  const profile = {
    currentWeightStart: Number(formData.get("currentWeightStart")),
    targetWeight: Number(formData.get("targetWeight")),
    targetDate: String(formData.get("targetDate")),
    dailyExerciseGoalMinutes: Number(formData.get("dailyExerciseGoalMinutes")),
    dailyStepGoal: Number(formData.get("dailyStepGoal")),
    dailySleepGoalHours: Number(formData.get("dailySleepGoalHours")),
  };

  const validation = validateProfile(profile);
  if (validation) {
    ui.setupError.textContent = validation;
    return;
  }

  ui.setupError.textContent = "";
  state.profile = profile;
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
  closeActiveModal();
  refreshAll();
}

function handleMealSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const entry = getTodayEntry();
  entry.meals.breakfast = String(formData.get("breakfast"));
  entry.meals.lunch = String(formData.get("lunch"));
  entry.meals.dinner = String(formData.get("dinner"));
  entry.snackLevel = String(formData.get("snackLevel"));
  entry.waterCups = Number(formData.get("waterCups"));
  setTodayEntry(entry);
  closeActiveModal();
  refreshAll();
}

function handleExerciseSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const entry = getTodayEntry();
  entry.exerciseDone = String(formData.get("exerciseDone")) === "true";
  entry.exerciseType = String(formData.get("exerciseType"));
  entry.exerciseMinutes = Number(formData.get("exerciseMinutes"));
  entry.steps = Number(formData.get("steps"));
  setTodayEntry(entry);
  closeActiveModal();
  refreshAll();
}

function handleSleepSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const entry = getTodayEntry();
  entry.sleepHours = Number(formData.get("sleepHours"));
  entry.bedtime = String(formData.get("bedtime"));
  entry.wakeTime = String(formData.get("wakeTime"));
  entry.sleepQuality = String(formData.get("sleepQuality"));
  setTodayEntry(entry);
  closeActiveModal();
  refreshAll();
}

function validateProfile(profile) {
  if (profile.targetWeight >= profile.currentWeightStart) {
    return "目標体重は現在体重より小さくしてください。";
  }

  const today = new Date();
  const target = new Date(`${profile.targetDate}T00:00:00`);
  const diffDays = Math.ceil((target - today) / 86400000);

  if (Number.isNaN(target.getTime()) || diffDays < 1) {
    return "目標期限は今日より先の日付にしてください。";
  }

  const totalLoss = profile.currentWeightStart - profile.targetWeight;
  if (diffDays > 0 && totalLoss / diffDays > 0.15) {
    return "短期間で大きく減らす目標です。無理のない範囲で見直してください。";
  }

  return "";
}

function refreshAll() {
  if (!state.profile) {
    openModal("setup-modal");
  }

  const todayEntry = getTodayEntry();
  const scores = calculateScores(todayEntry, state.profile);
  renderHeader(todayEntry, scores);
  renderCards(todayEntry, scores);
}

function renderHeader(entry, scores) {
  const profile = state.profile;

  if (!profile) {
    ui.remainingWeight.textContent = "-";
    ui.remainingDays.textContent = "-";
    ui.goalCaption.textContent = "まずは目標を決めましょう";
    ui.currentWeight.textContent = "- kg";
    ui.targetWeight.textContent = "- kg";
    ui.weightProgress.textContent = "0%";
    ui.overallScore.textContent = "0%";
    setProgress(0);
    return;
  }

  const effectiveWeight =
    entry.weight ?? getLatestWeight() ?? profile.currentWeightStart;
  const remainingWeight = Math.max(effectiveWeight - profile.targetWeight, 0);
  const remainingDays = Math.max(getDaysRemaining(profile.targetDate), 0);
  const progressWeight = calculateWeightProgress(effectiveWeight, profile);

  ui.remainingWeight.textContent = remainingWeight.toFixed(1);
  ui.remainingDays.textContent = String(remainingDays);
  ui.goalCaption.textContent =
    remainingWeight <= 0
      ? "目標達成です。次の目標を設定しましょう"
      : `${effectiveWeight.toFixed(1)}kg からあと ${remainingWeight.toFixed(1)}kg`;
  ui.currentWeight.textContent = `${effectiveWeight.toFixed(1)} kg`;
  ui.targetWeight.textContent = `${profile.targetWeight.toFixed(1)} kg`;
  ui.weightProgress.textContent = `${progressWeight}%`;
  ui.overallScore.textContent = `${scores.overall}%`;
  setProgress(scores.overall);
}

function renderCards(entry, scores) {
  ui.mealScore.textContent = `${scores.meal}%`;
  ui.exerciseScore.textContent = `${scores.exercise}%`;
  ui.sleepScore.textContent = `${scores.sleep}%`;

  ui.mealStatusLine.textContent = `朝 ${MEAL_LABELS[entry.meals.breakfast]} / 昼 ${MEAL_LABELS[entry.meals.lunch]} / 夜 ${MEAL_LABELS[entry.meals.dinner]}`;
  ui.snackStatusLine.textContent = `間食: ${SNACK_LABELS[entry.snackLevel]} / 水分: ${entry.waterCups}杯`;

  ui.exerciseStatusLine.textContent = entry.exerciseDone
    ? `${EXERCISE_LABELS[entry.exerciseType]} ${entry.exerciseMinutes}分`
    : "まだ運動は未記録です";
  ui.stepsStatusLine.textContent = `歩数: ${entry.steps.toLocaleString("ja-JP")}歩`;

  ui.sleepStatusLine.textContent =
    entry.sleepHours > 0
      ? `${entry.sleepHours}時間 / ${SLEEP_LABELS[entry.sleepQuality]}`
      : "昨夜の睡眠を記録しましょう";
  ui.sleepDetailLine.textContent =
    entry.bedtime && entry.wakeTime
      ? `${entry.bedtime} 就寝 / ${entry.wakeTime} 起床`
      : "目標睡眠に近づけることが最優先です";
}

function fillFormDefaults(modalId) {
  const profile = state.profile;
  const entry = getTodayEntry();

  if (modalId === "setup-modal" && profile) {
    ui.setupForm.elements.currentWeightStart.value = profile.currentWeightStart;
    ui.setupForm.elements.targetWeight.value = profile.targetWeight;
    ui.setupForm.elements.targetDate.value = profile.targetDate;
    ui.setupForm.elements.dailyExerciseGoalMinutes.value =
      profile.dailyExerciseGoalMinutes;
    ui.setupForm.elements.dailyStepGoal.value = profile.dailyStepGoal;
    ui.setupForm.elements.dailySleepGoalHours.value =
      profile.dailySleepGoalHours;
  }

  if (modalId === "weight-modal") {
    ui.weightForm.elements.weight.value =
      entry.weight ?? getLatestWeight() ?? profile?.currentWeightStart ?? "";
  }

  if (modalId === "meal-modal") {
    ui.mealForm.elements.breakfast.value = entry.meals.breakfast;
    ui.mealForm.elements.lunch.value = entry.meals.lunch;
    ui.mealForm.elements.dinner.value = entry.meals.dinner;
    ui.mealForm.elements.snackLevel.value = entry.snackLevel;
    ui.mealForm.elements.waterCups.value = entry.waterCups;
  }

  if (modalId === "exercise-modal") {
    ui.exerciseForm.elements.exerciseDone.value = String(entry.exerciseDone);
    ui.exerciseForm.elements.exerciseType.value = entry.exerciseType;
    ui.exerciseForm.elements.exerciseMinutes.value = String(entry.exerciseMinutes);
    ui.exerciseForm.elements.steps.value = String(entry.steps);
  }

  if (modalId === "sleep-modal") {
    ui.sleepForm.elements.sleepHours.value = String(entry.sleepHours || 7);
    ui.sleepForm.elements.bedtime.value = entry.bedtime || "23:30";
    ui.sleepForm.elements.wakeTime.value = entry.wakeTime || "06:30";
    ui.sleepForm.elements.sleepQuality.value = entry.sleepQuality;
  }
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

function getTodayEntry() {
  const todayKey = getLocalDateKey(new Date());
  return normalizeEntry(state.entries[todayKey]);
}

function setTodayEntry(entry) {
  const todayKey = getLocalDateKey(new Date());
  state.entries[todayKey] = normalizeEntry(entry);
  saveState();
}

function normalizeEntry(entry) {
  const base = defaultDailyRecord();
  if (!entry) {
    return base;
  }

  return {
    ...base,
    ...entry,
    meals: {
      ...base.meals,
      ...(entry.meals ?? {}),
    },
  };
}

function calculateScores(entry, profile) {
  if (!profile) {
    return { meal: 0, exercise: 0, sleep: 0, overall: 0 };
  }

  let mealScore = 0;
  const mealValues = Object.values(entry.meals);
  const recordedMeals = mealValues.filter((value) => value !== "unrecorded").length;
  mealScore += Math.round((recordedMeals / 3) * 60);
  if (entry.snackLevel === "none") {
    mealScore += 20;
  } else if (entry.snackLevel === "little") {
    mealScore += 10;
  }
  mealScore += Math.min(Math.round((entry.waterCups / 6) * 20), 20);
  mealScore = Math.min(mealScore, 100);

  let exerciseScore = 0;
  if (entry.exerciseDone) {
    exerciseScore += 30;
  }
  exerciseScore += Math.min(
    Math.round((entry.exerciseMinutes / profile.dailyExerciseGoalMinutes) * 40),
    40
  );
  exerciseScore += Math.min(
    Math.round((entry.steps / profile.dailyStepGoal) * 30),
    30
  );
  exerciseScore = Math.min(exerciseScore, 100);

  let sleepScore = 0;
  sleepScore += Math.min(
    Math.round((entry.sleepHours / profile.dailySleepGoalHours) * 70),
    70
  );
  if (entry.sleepQuality === "good") {
    sleepScore += 30;
  } else if (entry.sleepQuality === "normal") {
    sleepScore += 18;
  } else if (entry.sleepHours > 0) {
    sleepScore += 8;
  }
  sleepScore = Math.min(sleepScore, 100);

  return {
    meal: mealScore,
    exercise: exerciseScore,
    sleep: sleepScore,
    overall: Math.round((mealScore + exerciseScore + sleepScore) / 3),
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

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderHistory() {
  const recent = buildRecentHistory();
  ui.historyList.innerHTML = "";

  recent.forEach((item) => {
    const fragment = ui.historyItemTemplate.content.cloneNode(true);
    fragment.querySelector(".history-date").textContent = formatDateLabel(item.date);
    fragment.querySelector(
      ".history-meta"
    ).textContent = `${item.weightLabel} / 食事 ${item.scores.meal}% / 運動 ${item.scores.exercise}% / 睡眠 ${item.scores.sleep}%`;
    fragment.querySelector(".history-score").textContent = `${item.scores.overall}%`;
    ui.historyList.appendChild(fragment);
  });

  drawSparkline(recent);
}

function buildRecentHistory() {
  const profile = state.profile;
  const days = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const dateKey = getLocalDateKey(date);
    const entry = normalizeEntry(state.entries[dateKey]);
    const scores = calculateScores(entry, profile);

    days.push({
      date: dateKey,
      entry,
      scores,
      weightLabel:
        typeof entry.weight === "number" && entry.weight > 0
          ? `${entry.weight.toFixed(1)}kg`
          : "体重未記録",
    });
  }

  return days;
}

function drawSparkline(recent) {
  const svg = ui.historySparkline;
  svg.innerHTML = "";

  const weights = recent
    .map((item) => item.entry.weight)
    .filter((weight) => typeof weight === "number" && weight > 0);

  if (weights.length === 0) {
    svg.innerHTML =
      '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#637167" font-size="14">体重記録がたまるとここに推移が出ます</text>';
    return;
  }

  const availableWeights = recent.map((item) => {
    if (typeof item.entry.weight === "number" && item.entry.weight > 0) {
      return item.entry.weight;
    }
    return null;
  });

  let lastKnown = weights[0];
  const normalizedWeights = availableWeights.map((weight) => {
    if (weight !== null) {
      lastKnown = weight;
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

  const guide = document.createElementNS("http://www.w3.org/2000/svg", "line");
  guide.setAttribute("x1", "16");
  guide.setAttribute("x2", "304");
  guide.setAttribute("y1", "92");
  guide.setAttribute("y2", "92");
  guide.setAttribute("stroke", "rgba(43, 123, 132, 0.16)");
  guide.setAttribute("stroke-width", "2");
  svg.appendChild(guide);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "#2b7b84");
  path.setAttribute("stroke-width", "4");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);

  points.forEach(([x, y]) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", x.toFixed(2));
    circle.setAttribute("cy", y.toFixed(2));
    circle.setAttribute("r", "4");
    circle.setAttribute("fill", "#d66c3d");
    svg.appendChild(circle);
  });
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
