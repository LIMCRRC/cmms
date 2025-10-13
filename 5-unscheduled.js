// unscheduled.js
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwNMI0o58DDVkFqhzTjtnfwp9Y8khc16vdE3k7jkbyCjfqwcLMl-rRXGzsA3hQTckIeRA/exec";

// Show today’s date
const date = new Date();
document.getElementById("todayDate").textContent =
  `${date.getDate().toString().padStart(2, '0')}-${date.toLocaleString('en-US', { month: 'short' })}-${date.getFullYear()}`;

let chartPriceByPeriod, chartCountByPeriod, chartByTrain, chartByItem;

// ---------- Utilities ----------
function parsePrice(str) {
  if (!str) return 0;
  return Number(str.toString().replace(/[^0-9.-]+/g, "")) || 0;
}

function normalizePeriod(str) {
  if (!str) return "";
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const m = d.toLocaleDateString("en-US", { month: "short" });
    const y = d.getFullYear().toString().slice(-2);
    return `${m}-${y}`;
  }
  return str;
}

function sortPeriods(periods) {
  const monthOrder = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
  };
  
  return periods.sort((a, b) => {
    const [monthA, yearA] = a.split('-');
    const [monthB, yearB] = b.split('-');
    
    // Compare years first
    if (yearA !== yearB) {
      return parseInt(yearA) - parseInt(yearB);
    }
    
    // If same year, compare months
    return monthOrder[monthA] - monthOrder[monthB];
  });
}

async function fetchUnscheduledData() {
  try {
    const res = await fetch(SCRIPT_URL);
    const json = await res.json();
    const rows = json.data || [];
    // normalize Period
    rows.forEach(r => {
      r.Period = normalizePeriod(r.Period);
    });
    return rows;
  } catch (err) {
    console.error("Error fetching unscheduled data:", err);
    return [];
  }
}

function groupSum(arr, key, valFn) {
  const out = {};
  arr.forEach(d => {
    const k = d[key] || "Unknown";
    const v = valFn(d);
    out[k] = (out[k] || 0) + v;
  });
  return out;
}

function groupCount(arr, key) {
  const out = {};
  arr.forEach(d => {
    const k = d[key] || "Unknown";
    out[k] = (out[k] || 0) + 1;
  });
  return out;
}

function createBarChart(ctx, labels, values, labelText, color = "#6F8FAF", filterKey = null) {
  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: labelText,
        data: values,
        backgroundColor: color
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const label = chart.data.labels[idx];
        let records = [];
        if (filterKey) {
          records = window.unscheduledData.filter(d => d[filterKey] === label);
        }
        if (records.length) openRecordsModal(records);
      }
    }
  });
  return chart;
}

// ---------- Dashboard Update ----------
function updateDashboard(data) {
  // --- Summary cards ---
  const total = data.length;
  const newItems = data.filter(d => (d["New/Repaired"] || "").toLowerCase().includes("new")).length;
  const repairedItems = data.filter(d => (d["New/Repaired"] || "").toLowerCase().includes("repair")).length;
  const totalAmount = data.reduce((sum, d) => sum + parsePrice(d["Price"]), 0);

  document.getElementById("TotalUnscheduled").textContent = total;
  document.getElementById("NewCount").textContent = newItems;
  document.getElementById("RepairedCount").textContent = repairedItems;
  document.getElementById("TotalAmount").textContent = "RM" + totalAmount.toLocaleString();

  // --- Price by Period ---
const priceByPeriod = groupSum(data, "Period", d => parsePrice(d["Price"]));
const periodLabels1 = sortPeriods(Object.keys(priceByPeriod)); // Changed this line
if (chartPriceByPeriod) chartPriceByPeriod.destroy();
chartPriceByPeriod = createBarChart(
  document.getElementById("priceByPeriod"),
  periodLabels1,
  periodLabels1.map(l => priceByPeriod[l]),
  "Total Price by Period",
  "#A7C7E7",
  "Period"
);

// --- Count by Period ---
const countByPeriod = groupCount(data, "Period");
const periodLabels2 = sortPeriods(Object.keys(countByPeriod)); // Changed this line
if (chartCountByPeriod) chartCountByPeriod.destroy();
chartCountByPeriod = createBarChart(
  document.getElementById("countByPeriod"),
  periodLabels2,
  periodLabels2.map(l => countByPeriod[l]),
  "Unscheduled Works by Period",
  "#6F8FAF",
  "Period"
);

  // --- Count by Train ---
  const countByTrain = groupCount(data, "Train No.");
  const trainLabels = Object.keys(countByTrain).sort();
  if (chartByTrain) chartByTrain.destroy();
  chartByTrain = createBarChart(
    document.getElementById("unscheduledByTrain"),
    trainLabels,
    trainLabels.map(l => countByTrain[l]),
    "Unscheduled Works by Train",
    "#5DADE2",
    "Train No."
  );

  // Save global
  window.unscheduledData = data;
  // Update filters + Item chart
  populatePeriodFilterForItem(data);
  updateItemChart(data);
}

// ---------- Period Filter for Item Chart ----------
function populatePeriodFilterForItem(data) {
  const periodSet = [...new Set(data.map(d => d["Period"]))].filter(Boolean);
  const periodSel = document.getElementById("periodFilterItem");
  periodSel.innerHTML = '<option value="all">All</option>';
  sortPeriods(periodSet).forEach(p => {  // Changed this line
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    periodSel.appendChild(opt);
  });
}

function updateItemChart(data) {
  const periodFilter = document.getElementById("periodFilterItem").value;
  let filtered = data;
  if (periodFilter !== "all") filtered = filtered.filter(d => d["Period"] === periodFilter);

  const countByItem = groupCount(filtered, "Item Name");
  const itemLabels = Object.keys(countByItem).sort();
  const itemValues = itemLabels.map(l => countByItem[l]);

  if (chartByItem) chartByItem.destroy();
  chartByItem = createBarChart(
    document.getElementById("unscheduledByItem"),
    itemLabels,
    itemValues,
    "Unscheduled Works by Item",
    "#45B39D",
    "Item Name"
  );
}

document.getElementById("periodFilterItem").addEventListener("change", () => updateItemChart(window.unscheduledData));

// ---------- Cell formatters for Modal ----------
function formatDateCell(val) {
  if (!val) return "";
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = d.toLocaleDateString("en-US", { month: "short" });
    const yy = d.getFullYear().toString().slice(-2);
    return `${dd}-${mm}-${yy}`;
  }
  return val;
}

function formatTimeCell(val) {
  if (!val) return "";
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }
  return val;
}

// ---------- Modal ----------
let currentRecords = [];
let currentPage = 1;
const rowsPerPage = 10;

function openRecordsModal(records) {
  currentRecords = records;
  currentPage = 1;
  renderRecordsTable();
  document.getElementById("recordsModal").style.display = "flex";
}

function closeRecordsModal() {
  document.getElementById("recordsModal").style.display = "none";
}

function renderRecordsTable() {
  const tbody = document.getElementById("recordsTableBody");
  const thead = document.getElementById("recordsTableHead");
  tbody.innerHTML = "";
  thead.innerHTML = "";

  if (!currentRecords.length) return;

  const allColumns = Object.keys(currentRecords[0]);

  const trHead = document.createElement("tr");
  allColumns.forEach(col => trHead.innerHTML += `<th>${col}</th>`);
  thead.appendChild(trHead);

  const start = (currentPage - 1) * rowsPerPage;
  const end = Math.min(start + rowsPerPage, currentRecords.length);

  for (let i = start; i < end; i++) {
    const r = currentRecords[i];
    const tr = document.createElement("tr");
    allColumns.forEach(col => {
      let val = r[col] || "";
      if (col.toLowerCase().includes("date")) {
        val = formatDateCell(val);
      } else if (col.toLowerCase().includes("time")) {
        val = formatTimeCell(val);
      }
      tr.innerHTML += `<td>${val}</td>`;
    });
    tbody.appendChild(tr);
  }

  document.getElementById("pageInfo").textContent =
    `Page ${currentPage} of ${Math.ceil(currentRecords.length / rowsPerPage)}`;
  document.getElementById("prevPageBtn").disabled = currentPage === 1;
  document.getElementById("nextPageBtn").disabled = end >= currentRecords.length;
}

document.getElementById("prevPageBtn").onclick = () => {
  if (currentPage > 1) { currentPage--; renderRecordsTable(); }
};
document.getElementById("nextPageBtn").onclick = () => {
  if (currentPage * rowsPerPage < currentRecords.length) { currentPage++; renderRecordsTable(); }
};

document.getElementById("recordsModal").addEventListener("click", e => {
  if (e.target === document.getElementById("recordsModal")) closeRecordsModal();
});

// ---------- Init ----------
async function initDashboard() {
  const overlay = document.getElementById("loadingOverlay");
  overlay.style.display = "flex";

  const data = await fetchUnscheduledData();
  if (!data.length) { overlay.style.display = "none"; return; }

  updateDashboard(data);
  overlay.style.display = "none";
}

document.getElementById("cardTotal").addEventListener("click", () => openRecordsModal(window.unscheduledData));
document.getElementById("cardNew").addEventListener("click", () => {
  const recs = window.unscheduledData.filter(d => (d["New/Repaired"] || "").toLowerCase().includes("new"));
  openRecordsModal(recs);
});
document.getElementById("cardRepaired").addEventListener("click", () => {
  const recs = window.unscheduledData.filter(d => (d["New/Repaired"] || "").toLowerCase().includes("repair"));
  openRecordsModal(recs);
});
document.getElementById("cardAmount").addEventListener("click", () => openRecordsModal(window.unscheduledData));

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.collapsible .collapse-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const parent = this.parentElement;
      parent.classList.toggle('active');
    });
  });
});

initDashboard();