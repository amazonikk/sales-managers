// =====================================================
// MONTH TABS
// =====================================================
// Формат вкладок у Google Sheets: "06/2026", "07/2026", "08/2026"
// Тут задаємо діапазон місяців, які дашборд буде пробувати читати.
//
// Важливо:
// якщо вкладка ще не створена в Google Sheets — код її просто пропустить.
// Коли ти створиш нову вкладку, наприклад "08/2026", вона автоматично підтягнеться,
// якщо цей місяць входить у діапазон нижче.
const MONTH_TABS = generateMonthTabs("06/2026", "12/2026");

// =====================================================
// CONFIG
// =====================================================
const CONFIG = {
  managers: [
    {
      name: "Вова",
      sheetId: "18qXgAeBLSTCXON_dyRRPsffxJOrNadlaXYZlZq3RgXs",
      sheetTabs: MONTH_TABS
    },
    {
      name: "Бек",
      sheetId: "1hBZD4O4eO95kauZA-dnWHDVAbEmuw3qToqdhgnYf2hk",
      sheetTabs: MONTH_TABS
    },
    {
      name: "Максим",
      sheetId: "1VIrQHz4U3IhZ_FE_m9-jg8mZdrLukgtYgXwENGA66Bs",
      sheetTabs: MONTH_TABS
    },
    {
      name: "Руслан",
      sheetId: "1xVil9pW_2406goqECY8vLKRN2Liu8UOfVhLEBmM4nYM",
      sheetTabs: MONTH_TABS
    },
    {
      name: "Саша",
      sheetId: "1YUtZdwIAH8HZPO8K7Ocp1JPRaf0EGkcLe6WWZCU1Ovo",
      sheetTabs: MONTH_TABS
    },
    {
      name: "Sid",
      sheetId: "1xr1P3NTY0hAxa9tB-Maen4unn_tkyZgCbi4vJJ16QXI",
      sheetTabs: MONTH_TABS
    },
    {
      name: "Oumaima",
      sheetId: "1S8VYkGncjGSncHfpXb0OhA8qzBSn5oSWAQF-p-LLZ4c",
      sheetTabs: MONTH_TABS
    },
    {
      name: "M'hammed",
      sheetId: "1NEViDBeyAeBi0o4Q513tqtPzar5jsx2q1CPCwPIctUM",
      sheetTabs: MONTH_TABS
    },
    {
      name: "Arda",
      sheetId: "1b4M6sle0tHZq51QVvIPWaj-4bK_RaKc8MZsXKkpq_50",
      sheetTabs: MONTH_TABS
    }
  ],

  // Індекси колонок у Google Sheets. A = 0, B = 1, C = 2...
  columns: {
    date: 0,          // A
    calls: 3,         // D — Кол-во звонков общее везде
    callsLong: 4,     // E — Кол-во звонков более 1 мин
    messagesNoCall: 5,// F — Кол-во сообщений людей без звонка
    newCrm: 6,        // G — Кол-во новых людей в срм
    nonTarget: 7,     // H — Кол-во нецелевых звонков/сообщений
    salesPlan: 8,     // I — Кол-во продаж план (Общее)
    salesAgreed: 9,   // J — Договоренность о приезде / оплате
    salesFact: 22     // W — Кол-во продаж факт Общее
  }
};

// =====================================================
// STATE
// =====================================================
let rawRows = [];
let planRows = [];
let filteredRows = [];
let filteredPlanRows = [];
let timelineChart = null;
let managerChart = null;

const $ = (id) => document.getElementById(id);

// =====================================================
// HELPERS
// =====================================================
function generateMonthTabs(start, end) {
  const [startMonth, startYear] = start.split("/").map(Number);
  const [endMonth, endYear] = end.split("/").map(Number);

  const result = [];
  let current = new Date(startYear, startMonth - 1, 1);
  const last = new Date(endYear, endMonth - 1, 1);

  while (current <= last) {
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const year = current.getFullYear();
    result.push(`${month}/${year}`);
    current.setMonth(current.getMonth() + 1);
  }

  return result;
}

function setStatus(text) {
  $("status").textContent = text;
}

function cellText(cell) {
  if (!cell) return "";
  return String(cell.v ?? cell.f ?? "").trim();
}

function numberValue(cell) {
  if (!cell) return 0;

  const value = cell.v ?? cell.f ?? 0;

  if (typeof value === "number") return value;

  const normalized = String(value)
    .replace(/\s/g, "")
    .replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseGoogleDate(cell) {
  if (!cell) return null;

  const value = cell.v ?? cell.f ?? cell;

  if (value instanceof Date) return value;

  if (typeof value === "string") {
    const clean = value.trim();

    // Формат Google Visualization API: Date(2026,5,1)
    const gviz = clean.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);
    if (gviz) {
      const year = Number(gviz[1]);
      const month = Number(gviz[2]); // 0-based
      const day = Number(gviz[3]);
      return new Date(year, month, day);
    }

    // Формати 01.06.2026 / 01-06-2026 / 01/06/2026
    const european = clean.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
    if (european) {
      const day = Number(european[1]);
      const month = Number(european[2]) - 1;
      const year = Number(european[3]);
      return new Date(year, month, day);
    }

    // Якщо це тижневий рядок типу "01-05.06.2026 факт" — ігноруємо як денний рядок
    return null;
  }

  return null;
}

function parsePlanRange(cell) {
  const text = cellText(cell).toLowerCase();

  // Планові рядки мають виглядати приблизно так:
  // 01-05.06.2026 план
  // 08-12.06.2026 план
  if (!text.includes("план")) return null;

  const range = text.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);
  if (!range) return null;

  const startDay = Number(range[1]);
  const endDay = Number(range[2]);
  const month = Number(range[3]) - 1;
  const year = Number(range[4]);

  const startDate = new Date(year, month, startDay);
  const endDate = new Date(year, month, endDay);

  return {
    startDate,
    endDate,
    startISO: toISODate(startDate),
    endISO: toISODate(endDate)
  };
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatPlanNumber(value) {
  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: value % 1 ? 1 : 0,
    maximumFractionDigits: 1
  }).format(value || 0);
}

function formatPercent(value) {
  return `${new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value || 0)}%`;
}

function formatPlanFactPercent(fact, plan) {
  if (!plan) return "—";
  return formatPercent((fact / plan) * 100);
}

function safeConversion(sales, calls) {
  if (!calls) return 0;
  return (sales / calls) * 100;
}

function safePlanFact(fact, plan) {
  if (!plan) return 0;
  return (fact / plan) * 100;
}

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sunday, 1 Monday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysInclusive(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return Math.max(0, Math.round((end - start) / 86400000) + 1);
}

function overlapDays(aStart, aEnd, bStart, bEnd) {
  const start = new Date(Math.max(aStart.getTime(), bStart.getTime()));
  const end = new Date(Math.min(aEnd.getTime(), bEnd.getTime()));

  if (end < start) return 0;
  return daysInclusive(start, end);
}

function getDateRangeFromISO(fromISO, toISO) {
  return {
    startDate: new Date(`${fromISO}T00:00:00`),
    endDate: new Date(`${toISO}T00:00:00`)
  };
}

function getCurrentWeekRange() {
  const today = new Date();
  const start = getWeekStart(today);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    from: toISODate(start),
    to: toISODate(end)
  };
}

function getCurrentMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    from: toISODate(start),
    to: toISODate(end)
  };
}

function getCurrentYearRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), 0, 1);
  const end = new Date(today.getFullYear(), 11, 31);

  return {
    from: toISODate(start),
    to: toISODate(end)
  };
}

function setQuickRange(rangeType) {
  let range;

  if (rangeType === "week") {
    range = getCurrentWeekRange();
    $("groupBy").value = "day";
  }

  if (rangeType === "month") {
    range = getCurrentMonthRange();
    $("groupBy").value = "day";
  }

  if (rangeType === "year") {
    range = getCurrentYearRange();
    $("groupBy").value = "month";
  }

  if (!range) return;

  $("dateFrom").value = range.from;
  $("dateTo").value = range.to;

  document.querySelectorAll(".quick-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.range === rangeType);
  });

  applyFilters();
}

function getGroupKey(date, groupBy) {
  if (groupBy === "day") return toISODate(date);

  if (groupBy === "week") {
    const start = getWeekStart(date);
    return toISODate(start);
  }

  if (groupBy === "month") {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  return toISODate(date);
}

function getGroupDateRange(periodKey, groupBy) {
  const startDate = new Date(`${periodKey}T00:00:00`);

  if (groupBy === "day") {
    return { startDate, endDate: new Date(startDate) };
  }

  if (groupBy === "week") {
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return { startDate, endDate };
  }

  if (groupBy === "month") {
    const [year, month] = periodKey.split("-").map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    return { startDate: monthStart, endDate: monthEnd };
  }

  return { startDate, endDate: new Date(startDate) };
}

function formatGroupLabel(key, groupBy) {
  if (groupBy === "month") {
    const [y, m] = key.split("-");
    return `${m}.${y}`;
  }

  const date = new Date(`${key}T00:00:00`);

  if (groupBy === "week") {
    const end = new Date(date);
    end.setDate(date.getDate() + 6);
    return `${formatDate(date)} — ${formatDate(end)}`;
  }

  return formatDate(date);
}

function sumRows(rows) {
  return rows.reduce((acc, row) => {
    acc.calls += row.calls;
    acc.callsLong += row.callsLong;
    acc.messagesNoCall += row.messagesNoCall;
    acc.newCrm += row.newCrm;
    acc.nonTarget += row.nonTarget;
    acc.salesPlan += row.salesPlan;
    acc.salesAgreed += row.salesAgreed;
    acc.salesFact += row.salesFact;
    return acc;
  }, {
    calls: 0,
    callsLong: 0,
    messagesNoCall: 0,
    newCrm: 0,
    nonTarget: 0,
    salesPlan: 0,
    salesAgreed: 0,
    salesFact: 0
  });
}

function sumPlansForRange(rows, startDate, endDate) {
  return rows.reduce((acc, row) => {
    const totalPlanDays = daysInclusive(row.startDate, row.endDate);
    const overlap = overlapDays(row.startDate, row.endDate, startDate, endDate);

    if (!totalPlanDays || !overlap) return acc;

    const ratio = overlap / totalPlanDays;

    acc.callsPlan += row.callsPlan * ratio;
    acc.salesPlan += row.salesPlan * ratio;

    return acc;
  }, {
    callsPlan: 0,
    salesPlan: 0
  });
}

// =====================================================
// GOOGLE SHEETS FETCH
// =====================================================
async function fetchSheet(manager, sheetName) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${manager.sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

    const response = await fetch(url);
    const text = await response.text();

    const jsonText = text
      .replace(/^[\s\S]*?google\.visualization\.Query\.setResponse\(/, "")
      .replace(/\);?\s*$/, "");

    const data = JSON.parse(jsonText);

    // Якщо вкладки немає або Google повернув помилку — просто пропускаємо цей місяць
    if (data.status === "error") {
      console.warn(`Пропущено: ${manager.name} / ${sheetName}`, data.errors);
      return { facts: [], plans: [] };
    }

    if (!data.table || !data.table.rows) {
      console.warn(`Порожня або недоступна вкладка: ${manager.name} / ${sheetName}`);
      return { facts: [], plans: [] };
    }

    const facts = [];
    const plans = [];

    data.table.rows.forEach((r) => {
      const factRow = normalizeRow(manager.name, sheetName, r);
      if (factRow) facts.push(factRow);

      const planRow = normalizePlanRow(manager.name, sheetName, r);
      if (planRow) plans.push(planRow);
    });

    return { facts, plans };
  } catch (error) {
    console.warn(`Не вдалося прочитати: ${manager.name} / ${sheetName}`, error);
    return { facts: [], plans: [] };
  }
}

function normalizeRow(managerName, sheetName, googleRow) {
  const c = googleRow.c || [];
  const cols = CONFIG.columns;

  const date = parseGoogleDate(c[cols.date]);

  // Беремо тільки денні рядки з реальною датою.
  // Рядки план/факт по тижнях автоматично пропускаються.
  if (!date) return null;

  return {
    manager: managerName,
    sheet: sheetName,
    date,
    dateISO: toISODate(date),

    calls: numberValue(c[cols.calls]),
    callsLong: numberValue(c[cols.callsLong]),
    messagesNoCall: numberValue(c[cols.messagesNoCall]),
    newCrm: numberValue(c[cols.newCrm]),
    nonTarget: numberValue(c[cols.nonTarget]),
    salesPlan: numberValue(c[cols.salesPlan]),
    salesAgreed: numberValue(c[cols.salesAgreed]),
    salesFact: numberValue(c[cols.salesFact])
  };
}

function normalizePlanRow(managerName, sheetName, googleRow) {
  const c = googleRow.c || [];
  const cols = CONFIG.columns;
  const range = parsePlanRange(c[cols.date]);

  if (!range) return null;

  return {
    manager: managerName,
    sheet: sheetName,
    startDate: range.startDate,
    endDate: range.endDate,
    startISO: range.startISO,
    endISO: range.endISO,
    callsPlan: numberValue(c[cols.calls]),
    salesPlan: numberValue(c[cols.salesPlan])
  };
}

async function loadData() {
  setStatus("Завантаження даних...");

  const tasks = [];

  CONFIG.managers.forEach((manager) => {
    manager.sheetTabs.forEach((sheetName) => {
      tasks.push(fetchSheet(manager, sheetName));
    });
  });

  const results = await Promise.all(tasks);

  rawRows = results.flatMap((r) => r.facts).sort((a, b) => a.date - b.date);
  planRows = results.flatMap((r) => r.plans).sort((a, b) => a.startDate - b.startDate);

  if (!rawRows.length) {
    throw new Error(
      "Не знайдено жодного денного рядка з датою. Перевір назви вкладок, доступ до Google Sheets і формат дат у колонці A."
    );
  }

  initFilters();
  applyFilters();

  const loadedTabs = [...new Set(rawRows.map((r) => r.sheet))].join(", ");
  setStatus(`Оновлено: ${new Date().toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })} · Листи: ${loadedTabs}`);
}

// =====================================================
// FILTERS
// =====================================================
function initFilters() {
  const managerSelect = $("managerFilter");

  managerSelect.innerHTML = `<option value="all">Всі менеджери</option>`;
  CONFIG.managers.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.name;
    opt.textContent = m.name;
    managerSelect.appendChild(opt);
  });

  const dates = rawRows.map((r) => r.dateISO).sort();
  $("dateFrom").value = dates[0];
  $("dateTo").value = dates[dates.length - 1];
}

function applyFilters() {
  const manager = $("managerFilter").value;
  const dateFrom = $("dateFrom").value;
  const dateTo = $("dateTo").value;

  const selectedStart = new Date(`${dateFrom}T00:00:00`);
  const selectedEnd = new Date(`${dateTo}T00:00:00`);

  filteredRows = rawRows.filter((row) => {
    if (manager !== "all" && row.manager !== manager) return false;
    if (dateFrom && row.dateISO < dateFrom) return false;
    if (dateTo && row.dateISO > dateTo) return false;
    return true;
  });

  filteredPlanRows = planRows.filter((row) => {
    if (manager !== "all" && row.manager !== manager) return false;
    return overlapDays(row.startDate, row.endDate, selectedStart, selectedEnd) > 0;
  });

  renderDashboard();
}

function resetFilters() {
  $("managerFilter").value = "all";
  $("groupBy").value = "day";

  const dates = rawRows.map((r) => r.dateISO).sort();
  $("dateFrom").value = dates[0];
  $("dateTo").value = dates[dates.length - 1];

  applyFilters();
}

// =====================================================
// RENDER
// =====================================================
function renderDashboard() {
  renderKpis();
  renderTimelineChart();
  renderManagerChart();
  renderTable();
}

function renderKpis() {
  const totals = sumRows(filteredRows);
  const conversion = safeConversion(totals.salesFact, totals.calls);

  const dateFrom = $("dateFrom").value;
  const dateTo = $("dateTo").value;
  const { startDate, endDate } = getDateRangeFromISO(dateFrom, dateTo);
  const planTotals = sumPlansForRange(filteredPlanRows, startDate, endDate);

  $("kpiCalls").textContent = formatNumber(totals.calls);
  $("kpiCallsLong").textContent = formatNumber(totals.callsLong);
  $("kpiSalesFact").textContent = formatNumber(totals.salesFact);
  $("kpiConversion").textContent = formatPercent(conversion);

  if ($("kpiCallsPlanFact")) {
    $("kpiCallsPlanFact").textContent = formatPlanFactPercent(totals.calls, planTotals.callsPlan);
  }

  if ($("kpiCallsPlanFactNote")) {
    $("kpiCallsPlanFactNote").textContent = `План ${formatPlanNumber(planTotals.callsPlan)} / факт ${formatNumber(totals.calls)}`;
  }

  if ($("kpiSalesPlanFact")) {
    $("kpiSalesPlanFact").textContent = formatPlanFactPercent(totals.salesFact, planTotals.salesPlan);
  }

  if ($("kpiSalesPlanFactNote")) {
    $("kpiSalesPlanFactNote").textContent = `План ${formatPlanNumber(planTotals.salesPlan)} / факт ${formatNumber(totals.salesFact)}`;
  }
}

function groupByPeriod(rows) {
  const groupBy = $("groupBy").value;
  const map = new Map();

  rows.forEach((row) => {
    const key = getGroupKey(row.date, groupBy);

    if (!map.has(key)) {
      map.set(key, {
        key,
        label: formatGroupLabel(key, groupBy),
        rows: []
      });
    }

    map.get(key).rows.push(row);
  });

  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

function groupByManager(rows) {
  const map = new Map();

  rows.forEach((row) => {
    if (!map.has(row.manager)) {
      map.set(row.manager, []);
    }

    map.get(row.manager).push(row);
  });

  return [...map.entries()].map(([manager, rows]) => ({
    manager,
    ...sumRows(rows)
  }));
}

function renderTimelineChart() {
  const groups = groupByPeriod(filteredRows);
  const labels = groups.map((g) => g.label);
  const calls = groups.map((g) => sumRows(g.rows).calls);
  const sales = groups.map((g) => sumRows(g.rows).salesFact);
  const conversion = groups.map((g) => {
    const total = sumRows(g.rows);
    return safeConversion(total.salesFact, total.calls);
  });

  const ctx = $("timelineChart");

  if (timelineChart) timelineChart.destroy();

  timelineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Дзвінки",
          data: calls,
          tension: 0.35,
          borderWidth: 3
        },
        {
          label: "Продажі факт",
          data: sales,
          tension: 0.35,
          borderWidth: 3
        },
        {
          label: "Конверсія, %",
          data: conversion,
          tension: 0.35,
          borderWidth: 3,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          position: "bottom"
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.label.includes("%")) {
                return `${ctx.dataset.label}: ${formatPercent(ctx.raw)}`;
              }
              return `${ctx.dataset.label}: ${formatNumber(ctx.raw)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true
        },
        y1: {
          beginAtZero: true,
          position: "right",
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            callback: (value) => `${value}%`
          }
        }
      }
    }
  });
}

function renderManagerChart() {
  const groups = groupByManager(filteredRows);
  const labels = groups.map((g) => g.manager);
  const calls = groups.map((g) => g.calls);
  const sales = groups.map((g) => g.salesFact);
  const conversion = groups.map((g) => safeConversion(g.salesFact, g.calls));

  const ctx = $("managerChart");

  if (managerChart) managerChart.destroy();

  managerChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Дзвінки",
          data: calls
        },
        {
          label: "Продажі факт",
          data: sales
        },
        {
          label: "Конверсія, %",
          data: conversion,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.label.includes("%")) {
                return `${ctx.dataset.label}: ${formatPercent(ctx.raw)}`;
              }
              return `${ctx.dataset.label}: ${formatNumber(ctx.raw)}`;
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true
        },
        y1: {
          beginAtZero: true,
          position: "right",
          grid: {
            drawOnChartArea: false
          },
          ticks: {
            callback: (value) => `${value}%`
          }
        }
      }
    }
  });
}

function renderTable() {
  const groupBy = $("groupBy").value;
  const map = new Map();

  filteredRows.forEach((row) => {
    const periodKey = getGroupKey(row.date, groupBy);
    const key = `${periodKey}__${row.manager}`;

    if (!map.has(key)) {
      map.set(key, {
        periodKey,
        period: formatGroupLabel(periodKey, groupBy),
        manager: row.manager,
        rows: []
      });
    }

    map.get(key).rows.push(row);
  });

  const grouped = [...map.values()]
    .sort((a, b) => {
      const byPeriod = a.periodKey.localeCompare(b.periodKey);
      if (byPeriod !== 0) return byPeriod;
      return a.manager.localeCompare(b.manager);
    })
    .map((g) => {
      const factTotals = sumRows(g.rows);
      const range = getGroupDateRange(g.periodKey, groupBy);
      const managerPlans = filteredPlanRows.filter((p) => p.manager === g.manager);
      const planTotals = sumPlansForRange(managerPlans, range.startDate, range.endDate);

      return {
        ...g,
        ...factTotals,
        callsPlan: planTotals.callsPlan,
        salesPlanTotal: planTotals.salesPlan,
        callsPlanFact: safePlanFact(factTotals.calls, planTotals.callsPlan),
        salesPlanFact: safePlanFact(factTotals.salesFact, planTotals.salesPlan)
      };
    });

  $("rowsCount").textContent = `${grouped.length} рядків`;

  const tbody = $("dataTable");
  tbody.innerHTML = "";

  if (!grouped.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12">Немає даних за вибраним фільтром.</td>
      </tr>
    `;
    return;
  }

  grouped.forEach((row) => {
    const conversion = safeConversion(row.salesFact, row.calls);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.period}</td>
      <td><strong>${row.manager}</strong></td>
      <td>${formatNumber(row.calls)}</td>
      <td>${formatNumber(row.callsLong)}</td>
      <td>${formatNumber(row.newCrm)}</td>
      <td>${formatNumber(row.salesAgreed)}</td>
      <td><strong>${formatNumber(row.salesFact)}</strong></td>
      <td class="positive">${formatPercent(conversion)}</td>
      <td>${formatPlanNumber(row.callsPlan)}</td>
      <td class="plan-fact-cell">${formatPlanFactPercent(row.calls, row.callsPlan)}</td>
      <td>${formatPlanNumber(row.salesPlanTotal)}</td>
      <td class="plan-fact-cell">${formatPlanFactPercent(row.salesFact, row.salesPlanTotal)}</td>
    `;

    tbody.appendChild(tr);
  });
}

// =====================================================
// EVENTS
// =====================================================
["managerFilter", "dateFrom", "dateTo", "groupBy"].forEach((id) => {
  $(id).addEventListener("change", applyFilters);
});

$("resetBtn").addEventListener("click", resetFilters);

$("reloadBtn").addEventListener("click", async () => {
  try {
    await loadData();
  } catch (error) {
    console.error(error);
    setStatus("Помилка завантаження");
    alert(error.message);
  }
});

document.querySelectorAll(".quick-btn").forEach((button) => {
  button.addEventListener("click", () => {
    setQuickRange(button.dataset.range);
  });
});

["dateFrom", "dateTo"].forEach((id) => {
  $(id).addEventListener("change", () => {
    document.querySelectorAll(".quick-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
  });
});

// =====================================================
// START
// =====================================================
loadData().catch((error) => {
  console.error(error);
  setStatus("Помилка завантаження");

  alert(
    "Не вдалося завантажити Google Sheets.\n\n" +
    "Перевір:\n" +
    "1. Таблиці доступні для перегляду за посиланням.\n" +
    "2. Назви вкладок у форматі 06/2026, 07/2026.\n" +
    "3. Дати в колонці A мають бути реальними датами.\n" +
    "4. Структура колонок не змінилася.\n\n" +
    error.message
  );
});
