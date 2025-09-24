// failure.js - Updated with period formatting fix
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwM4Sy3aMuLWQRmXOs40Bdrc5SxTQePTvThHqs_LJ47yGC9LWo-8Snwaii9kro4Vx7u/exec";
const date = new Date();
// Use local date for display
document.getElementById("todayDate").textContent = 
  `${date.getDate().toString().padStart(2, '0')}-${date.toLocaleString('en-US', { month: 'short' })}-${date.getFullYear()}`;

let chartFailuresByTrain, chartFailuresBySystem, chartFailuresByMonth, chartFailuresByTrainHistorical;

// Utility function to format dates correctly from Google Sheets
function formatDateFromSheet(dateString, isPeriod = false) {
  if (!dateString) return '';
  
  // If it's a period value, format it as MMM-YY (e.g., Aug-25)
  if (isPeriod && typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      const dateObj = new Date(dateString);
      // Check if it's a valid date
      if (!isNaN(dateObj.getTime())) {
        const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
        const year = dateObj.getFullYear().toString().slice(-2);
        return `${month}-${year}`;
      }
    } catch (e) {
      console.error('Error formatting period:', e);
    }
    return dateString; // Return original if formatting fails
  }
  
  // If it's a regular date string from Google Sheets
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
    // Check if it's a full ISO string with time
    if (dateString.includes('T')) {
      // Parse as UTC and convert to local date
      const dateObj = new Date(dateString);
      return dateObj.toLocaleDateString('en-CA'); // YYYY-MM-DD format
    } else {
      // It's already just a date string without time
      return dateString;
    }
  }
  return dateString;
}

// Get URL parameter
function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  const results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Set user info on page load
function setUserInfo() {
  const name = localStorage.getItem('userFullName') || 
              getUrlParameter('name') || 
              localStorage.getItem('maintenanceUser') || 
              'Guest';
              
  const position = localStorage.getItem('userActualPosition') || 
                  getUrlParameter('position') || 
                  localStorage.getItem('userPosition') || 
                  'Maintenance Staff';
  
  document.getElementById('loggedInName').textContent = name;
  document.getElementById('loggedInPosition').textContent = position;
}

// Fetch failure data
async function fetchFailureData() {
  try {
    const res = await fetch(SCRIPT_URL);
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.error("Error fetching failure data:", err);
    return [];
  }
}

// Group data by key
function groupByType(arr, key) {
  const result = {};
  arr.forEach(item => {
    const label = item[key];
    const type = item.Fault;
    if (!result[label]) result[label] = { Major: 0, Minor: 0, Omitted: 0 };
    result[label][type] = (result[label][type] || 0) + 1;
  });
  return result;
}

// Populate period filter
function populatePeriodFilter(data) {
  const periods = [...new Set(data.map(d => d.Period))];
  const filter = document.getElementById("periodFilter");
  filter.innerHTML = '<option value="all">All</option>';
  periods.sort((a, b) => new Date(a) - new Date(b)).forEach(p => {
    const d = new Date(p);
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    filter.appendChild(opt);
  });
}

// Get selected checkboxes for chart
function getSelectedFaults(chartId) {
  return Array.from(document.querySelectorAll(`.faultFilter[data-chart="${chartId}"]:checked`)).map(cb => cb.value);
}

// Create stacked bar chart
function createStackedChart(ctx, labels, datasets, chartId) {
  // Calculate max value across all datasets
  let maxValue = 0;
  datasets.forEach(dataset => {
    const datasetMax = Math.max(...dataset.data);
    if (datasetMax > maxValue) maxValue = datasetMax;
  });
  
  // Add padding (about 10% or at least 2 units)
  const paddedMax = Math.max(Math.ceil(maxValue * 1.1), maxValue + 2);
  
  const chart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { 
        legend: { 
          position: "bottom",
          labels: {
            boxWidth: 12,
            padding: 20
          }
        }, 
        tooltip: { mode: "index", intersect: false } 
      },
      scales: { 
        x: { stacked: true }, 
        y: { 
          stacked: true, 
          beginAtZero: true, 
          suggestedMax: paddedMax,
          ticks: { 
            stepSize: Math.max(1, Math.ceil(paddedMax / 20)),
            callback: function(value) {
              if (value % 1 === 0) {
                return value;
              }
            }
          }
        } 
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;
        const idx = elements[0].index;
        const label = chart.data.labels[idx];
        // Filter records by clicked bar
        const records = window.failureData.filter(d => {
          if(chartId.includes("Train")) return d.Train === label;
          if(chartId.includes("System")) return d.System === label;
          if(chartId.includes("Month")) return new Date(d.Period).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) === label;
          return false;
        });
        openRecordsModal(records);
      }
    }
  });
  return chart;
}

// Filter dataset based on selected checkboxes
function createFilteredDataset(labels, dataByType, selectedTypes) {
  const colors = { Major: "#6F8FAF", Minor: "#A7C7E7", Omitted: "#cccccc" };
  return selectedTypes.map(type => ({
    label: type,
    data: labels.map(l => dataByType[l][type] || 0),
    backgroundColor: colors[type]
  }));
}

// Update all charts and summary cards
function updateCharts(data, selectedPeriod) {
  const filtered = selectedPeriod === "all" ? data : data.filter(d => d.Period === selectedPeriod);

  // --- Failures by Train ---
  const trainData = groupByType(filtered, "Train");
  const trainLabels = Object.keys(trainData).sort((a, b) => parseInt(a.replace("T", "")) - parseInt(b.replace("T", "")));
  const selectedTrainFaults = getSelectedFaults("failuresByTrain");
  if(chartFailuresByTrain) chartFailuresByTrain.destroy();
  chartFailuresByTrain = createStackedChart(document.getElementById("failuresByTrain"), trainLabels, createFilteredDataset(trainLabels, trainData, selectedTrainFaults), "failuresByTrain");

  // --- Failures by System ---
  const systemData = groupByType(filtered, "System");
  const systemLabels = Object.keys(systemData);
  const selectedSystemFaults = getSelectedFaults("failuresBySystem");
  if(chartFailuresBySystem) chartFailuresBySystem.destroy();
  chartFailuresBySystem = createStackedChart(document.getElementById("failuresBySystem"), systemLabels, createFilteredDataset(systemLabels, systemData, selectedSystemFaults), "failuresBySystem");

  // --- Failures by Month ---
  const monthData = groupByType(data, "Period");
  const monthKeys = Object.keys(monthData).sort((a,b)=> new Date(a)-new Date(b));
  const monthLabels = monthKeys.map(d => new Date(d).toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
  const selectedMonthFaults = getSelectedFaults("failuresByMonth");
  if(chartFailuresByMonth) chartFailuresByMonth.destroy();
  chartFailuresByMonth = createStackedChart(document.getElementById("failuresByMonth"), monthLabels, createFilteredDataset(monthKeys, monthData, selectedMonthFaults), "failuresByMonth");

  // --- Total Failures by Train Historical ---
  const totalTrainData = groupByType(data, "Train");
  const trainOverallLabels = Object.keys(totalTrainData).sort((a,b)=>parseInt(a.replace("T",""))-parseInt(b.replace("T","")));
  const selectedHistoricalFaults = getSelectedFaults("failuresByTrainHistorical");
  if(chartFailuresByTrainHistorical) chartFailuresByTrainHistorical.destroy();
  chartFailuresByTrainHistorical = createStackedChart(document.getElementById("failuresByTrainHistorical"), trainOverallLabels, createFilteredDataset(trainOverallLabels, totalTrainData, selectedHistoricalFaults), "failuresByTrainHistorical");

  // --- Summary cards ---
  document.getElementById("MajorFailure").textContent = data.filter(d=>d.Fault==="Major").length;
  document.getElementById("MinorFailure").textContent = data.filter(d=>d.Fault==="Minor").length;
  document.getElementById("OmittedFailure").textContent = data.filter(d=>d.Fault==="Omitted").length;
}

// Checkbox filter listeners
document.querySelectorAll(".faultFilter").forEach(cb=>{
  cb.addEventListener("change",()=>{
    const selectedPeriod = document.getElementById("periodFilter").value;
    if(window.failureData) updateCharts(window.failureData, selectedPeriod);
  });
});

// ---------------------- Modal & Pagination ----------------------
let currentRecords = [];
let currentPage = 1;
const firstPageRows = 10;
const subsequentPageRows = 10;

function openRecordsModal(records){
  currentRecords = records;
  currentPage = 1;
  renderRecordsTable();
  document.getElementById("recordsModal").style.display = "flex";
}

function closeRecordsModal(){
  document.getElementById("recordsModal").style.display = "none";
}

function renderRecordsTable(){
  const tbody = document.getElementById("recordsTableBody");
  const thead = document.getElementById("recordsTableHead");
  tbody.innerHTML = "";
  thead.innerHTML = "";

  if(!currentRecords.length) return;
 // Get first 26 columns (A-Z) but skip column L (index 11)
  const allColumns = Object.keys(currentRecords[0])
    .slice(0,26)
    .filter((col, idx) => idx !== 11);

  // Table Header
  const trHead = document.createElement("tr");
  allColumns.forEach(col => trHead.innerHTML += `<th>${col}</th>`);
  thead.appendChild(trHead);

  // Determine rows for current page
  let rowsPerPage = currentPage === 1 ? firstPageRows : subsequentPageRows;
  let startIndex = currentPage === 1 ? 0 : firstPageRows + (currentPage-2)*subsequentPageRows;
  let endIndex = Math.min(startIndex + rowsPerPage, currentRecords.length);

  // Populate rows
  for(let i = startIndex; i < endIndex; i++){
    const r = currentRecords[i];
    const tr = document.createElement("tr");
    allColumns.forEach(col => {
      let val = r[col] || "";
      // Format period values specifically
      if (col === "Period") {
        val = formatDateFromSheet(val, true); // true indicates this is a period value
      } else {
        // Format date strings with proper timezone handling
        val = formatDateFromSheet(val);
      }
      tr.innerHTML += `<td>${val}</td>`;
    });
    tbody.appendChild(tr);
  }

  // Update pagination info
  const pageInfo = document.getElementById("pageInfo");
  const totalPages = Math.ceil((currentRecords.length - firstPageRows) / subsequentPageRows + 1);
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

  // Enable/disable buttons
  document.getElementById("prevPageBtn").disabled = currentPage === 1;
  document.getElementById("nextPageBtn").disabled = currentPage === totalPages;

  // Adjust modal size dynamically
  const modalContent = document.querySelector("#recordsModal .dialog-content");
  modalContent.style.maxHeight = "70vh"; // limit height to 70% of viewport
  modalContent.style.overflowY = "auto";
}

// Pagination button listeners
document.getElementById("prevPageBtn").onclick = () => { if(currentPage > 1){ currentPage--; renderRecordsTable(); }};
document.getElementById("nextPageBtn").onclick = () => {
  const totalPages = Math.ceil((currentRecords.length - firstPageRows) / subsequentPageRows + 1);
  if(currentPage < totalPages){ currentPage++; renderRecordsTable(); }
};

// Close modal
function closeRecordsModal(){
  document.getElementById("recordsModal").style.display = "none";
}

// Pagination buttons
document.getElementById("prevPageBtn").addEventListener("click", () => {
  if(currentPage > 1){
    currentPage--;
    renderRecordsTable();
  }
});
document.getElementById("nextPageBtn").addEventListener("click", () => {
  const totalPages = Math.ceil((currentRecords.length - firstPageRows) / subsequentPageRows) + 1;
  if(currentPage < totalPages){
    currentPage++;
    renderRecordsTable();
  }
});

// ---------------------- Initialize Dashboard ----------------------
async function initDashboard(){
  setUserInfo(); // Set user info on page load
  
  const overlay = document.getElementById("loadingOverlay");
  overlay.style.display="flex";

  const data = await fetchFailureData();
  if(!data.length){ overlay.style.display="none"; return; }

  window.failureData = data;
  populatePeriodFilter(data);
  updateCharts(data,"all");

  document.getElementById("periodFilter").addEventListener("change", e => {
    updateCharts(data, e.target.value);
  });

  overlay.style.display="none";
}

// --- Apply modal function on summary cards ---
document.getElementById("cardMajor").addEventListener("click", () => {
  const records = window.failureData.filter(d => d.Fault === "Major");
  openRecordsModal(records);
});

document.getElementById("cardMinor").addEventListener("click", () => {
  const records = window.failureData.filter(d => d.Fault === "Minor");
  openRecordsModal(records);
});

document.getElementById("cardOmitted").addEventListener("click", () => {
  const records = window.failureData.filter(d => d.Fault === "Omitted");
  openRecordsModal(records);
});

// --- Close modal when clicking outside content ---
document.getElementById("recordsModal").addEventListener("click", (e) => {
  if (e.target === document.getElementById("recordsModal")) {
    closeRecordsModal();
  }
});

// Add refresh button functionality
document.getElementById('refreshBtn').addEventListener('click', () => {
  initDashboard();
});

// Fix for collapsible sidebar items
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.collapsible .collapse-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const parent = this.parentElement;
      parent.classList.toggle('active');
    });
  });
});

// Initialize the dashboard
initDashboard();