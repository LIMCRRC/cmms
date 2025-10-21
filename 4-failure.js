// failure.js - Complete revised version
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHdGZgbb-koV0qK7qF9MJmPTtxPxy4OB6Ep-u6XN_X0T-5VStlH0j5rDyF227ucdL5/exec";
const date = new Date();
Chart.register(ChartDataLabels);

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
  // Find the highest stacked total per label
  const totals = labels.map((_, i) =>
    datasets.reduce((sum, ds) => sum + (ds.data[i] || 0), 0)
  );
  const maxValue = Math.max(...totals);
  const paddedMax = Math.ceil(maxValue * 1.2); // extend 20% higher to fit datalabels

  const chart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { right: 60, top: 10 } // right padding for label space
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { boxWidth: 12, padding: 20 }
        },
        tooltip: { mode: "index", intersect: false },
        datalabels: {
          anchor: "end",
          align: "end",
          clamp: false,
          clip: false, // allow outside plotting area
          color: "#000",
          font: { weight: "bold", size: 10 },
          formatter: (value, context) => {
            const index = context.dataIndex;
            const total = context.chart.data.datasets.reduce(
              (sum, ds) => sum + ds.data[index],
              0
            );
            // Only show total on top bar
            return context.datasetIndex === context.chart.data.datasets.length - 1
              ? total
              : "";
          }
        }
      },
      scales: {
        x: { stacked: true },
        y: {
          stacked: true,
          beginAtZero: true,
          suggestedMax: paddedMax, // increase axis ceiling
          ticks: {
            stepSize: Math.max(1, Math.ceil(paddedMax / 20)),
            callback: v => (v % 1 === 0 ? v : null)
          }
        }
      },
      elements: {
        bar: {
          borderSkipped: false,
          borderRadius: 0,
          clip: false // prevents cropping of tall bars
        }
      },
      onClick: (evt, elements) => {
        if (!elements.length) return;

        const idx = elements[0].index;
        const label = chart.data.labels[idx];

        // Get which fault types are currently checked for this chart
        const selectedTypes = getSelectedFaults(chartId);

        // Filter records by both label (Train/System/Month) and Fault type
        const records = window.failureData.filter(d => {
          let matchLabel = false;
          if (chartId.includes("Train")) matchLabel = d.Train === label;
          else if (chartId.includes("System")) matchLabel = d.System === label;
          else if (chartId.includes("Month")) {
            const formatted = new Date(d.Period).toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit"
            });
            matchLabel = formatted === label;
          }
          return matchLabel && selectedTypes.includes(d.Fault);
        });

        openRecordsModal(records);
      }
    },
    plugins: [ChartDataLabels]
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

  // --- Failures by System (sorted descending by total) ---
  const systemData = groupByType(filtered, "System");

  // Compute totals for sorting
  const sortedSystems = Object.keys(systemData).sort((a, b) => {
    const totalA = Object.values(systemData[a]).reduce((sum, v) => sum + v, 0);
    const totalB = Object.values(systemData[b]).reduce((sum, v) => sum + v, 0);
    return totalB - totalA; // descending order
  });

  const selectedSystemFaults = getSelectedFaults("failuresBySystem");
  if (chartFailuresBySystem) chartFailuresBySystem.destroy();
  chartFailuresBySystem = createStackedChart(document.getElementById("failuresBySystem"),sortedSystems,createFilteredDataset(sortedSystems, systemData, selectedSystemFaults),"failuresBySystem");

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

// Enhanced form validation
function validateForm(formData) {
  const errors = [];
  
  // Required field validation
  const requiredFields = ['Year', 'Period', 'Fault', 'Date', 'Train', 'System'];
  requiredFields.forEach(field => {
    if (!formData[field] || formData[field].trim() === '') {
      errors.push(`${field} is required`);
    }
  });
  
  // Year validation
  if (formData.Year && !/^\d{4}$/.test(formData.Year)) {
    errors.push('Year must be a 4-digit number');
  }
  
  // Period validation (MMM-YY format)
  if (formData.Period && !/^[A-Za-z]{3}-\d{2}$/.test(formData.Period)) {
    errors.push('Period must be in MMM-YY format (e.g., Aug-24)');
  }
  
  // Date validation
  if (formData.Date) {
    const date = new Date(formData.Date);
    if (isNaN(date.getTime())) {
      errors.push('Date must be a valid date');
    }
  }
  
  return errors;
}

// Show form message
function showFormMessage(message, type) {
  const messageDiv = document.getElementById('formMessage');
  messageDiv.innerHTML = message;
  messageDiv.className = `form-message ${type}`;
  messageDiv.style.display = 'block';
  
  // Auto-hide success messages after 5 seconds
  if (type === 'success') {
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, 5000);
  }
}

// Auto-populate current date and period
function autoPopulateCurrentDate() {
  const now = new Date();
  
  // Set current date
  const dateInput = document.querySelector('input[name="Date"]');
  if (dateInput && !dateInput.value) {
    dateInput.valueAsDate = now;
  }
  
  // Set current year
  const yearInput = document.querySelector('input[name="Year"]');
  if (yearInput && !yearInput.value) {
    yearInput.value = now.getFullYear().toString();
  }
  
  // Set current period
  const periodInput = document.querySelector('input[name="Period"]');
  if (periodInput && !periodInput.value) {
    const month = now.toLocaleString('en-US', { month: 'short' });
    const year = now.getFullYear().toString().slice(-2);
    periodInput.value = `${month}-${year}`;
  }
}

// Export data functionality
function exportToCSV(data, filename) {
  if (!data.length) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header] || '';
        // Handle values that might contain commas
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Add export button to the page
function addExportButton() {
  // Check if export button already exists
  if (document.getElementById('exportBtn')) return;
  
  const exportBtn = document.createElement('button');
  exportBtn.id = 'exportBtn';
  exportBtn.className = 'btn btn-secondary';
  exportBtn.innerHTML = '<i class="fas fa-download"></i> Export Data';
  exportBtn.style.marginLeft = '10px';
  
  exportBtn.addEventListener('click', () => {
    const selectedPeriod = document.getElementById('periodFilter').value;
    const filteredData = selectedPeriod === 'all' 
      ? window.failureData 
      : window.failureData.filter(d => d.Period === selectedPeriod);
    
    const periodLabel = selectedPeriod === 'all' 
      ? 'all_periods' 
      : selectedPeriod.replace(/[^a-zA-Z0-9]/g, '_');
    
    exportToCSV(filteredData, `failure_data_${periodLabel}`);
  });
  
  // Add the button next to the period filter
  const filterSection = document.querySelector('.filter-section');
  filterSection.appendChild(exportBtn);
}

// Enhanced modal with search
function openRecordsModal(records, title = 'Records') {
  currentRecords = records;
  currentPage = 1;
  
  // Update modal title
  document.querySelector('#recordsModal .dialog-message strong').textContent = title;
  
  renderRecordsTable();
  document.getElementById("recordsModal").style.display = "flex";
  
  // Add search functionality if not already present
  addSearchToModal();
}

function addSearchToModal() {
  const modalContent = document.querySelector('#recordsModal .dialog-content');
  
  // Check if search already exists
  if (document.getElementById('recordsSearch')) return;
  
  const searchDiv = document.createElement('div');
  searchDiv.style.marginBottom = '10px';
  searchDiv.innerHTML = `
    <input type="text" id="recordsSearch" placeholder="Search records..." 
           style="padding: 5px; width: 100%; border: 1px solid #ccc; border-radius: 4px;">
  `;
  
  modalContent.insertBefore(searchDiv, document.getElementById('recordsTableContainer'));
  
  // Add search functionality
  document.getElementById('recordsSearch').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    if (searchTerm.trim() === '') {
      renderRecordsTable();
      return;
    }
    
    const filteredRecords = currentRecords.filter(record => 
      Object.values(record).some(value => 
        String(value).toLowerCase().includes(searchTerm)
      )
    );
    
    // Create a temporary copy for pagination
    const originalRecords = [...currentRecords];
    currentRecords = filteredRecords;
    currentPage = 1;
    renderRecordsTable();
    currentRecords = originalRecords;
  });
}

// ---------------------- Modal & Pagination ----------------------
let currentRecords = [];
let currentPage = 1;
const firstPageRows = 10;
const subsequentPageRows = 10;

function closeRecordsModal(){
  document.getElementById("recordsModal").style.display = "none";
  // Remove search input when closing modal
  const searchInput = document.getElementById('recordsSearch');
  if (searchInput) {
    searchInput.remove();
  }
}

function renderRecordsTable(){
  const tbody = document.getElementById("recordsTableBody");
  const thead = document.getElementById("recordsTableHead");
  tbody.innerHTML = "";
  thead.innerHTML = "";

  if(!currentRecords.length) {
    const noDataRow = document.createElement('tr');
    noDataRow.innerHTML = `<td colspan="100" style="text-align: center; padding: 20px;">No records found</td>`;
    tbody.appendChild(noDataRow);
    return;
  }

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
document.getElementById("prevPageBtn").onclick = () => { 
  if(currentPage > 1){ 
    currentPage--; 
    renderRecordsTable(); 
  }
};

document.getElementById("nextPageBtn").onclick = () => {
  const totalPages = Math.ceil((currentRecords.length - firstPageRows) / subsequentPageRows + 1);
  if(currentPage < totalPages){ 
    currentPage++; 
    renderRecordsTable(); 
  }
};

// ---------------------- Initialize Dashboard ----------------------
async function initDashboard(){
  setUserInfo(); // Set user info on page load
  
  const overlay = document.getElementById("loadingOverlay");
  overlay.style.display="flex";

  const data = await fetchFailureData();
  if(!data.length){ 
    overlay.style.display="none"; 
    return; 
  }

  window.failureData = data;
  populatePeriodFilter(data);
  updateCharts(data,"all");
  
  // Add export button
  addExportButton();

  document.getElementById("periodFilter").addEventListener("change", e => {
    updateCharts(data, e.target.value);
  });

  overlay.style.display="none";
}

// ---------------------- Event Listeners ----------------------

// Checkbox filter listeners
document.querySelectorAll(".faultFilter").forEach(cb=>{
  cb.addEventListener("change",()=>{
    const selectedPeriod = document.getElementById("periodFilter").value;
    if(window.failureData) updateCharts(window.failureData, selectedPeriod);
  });
});

// Tab switching functionality
document.getElementById('tabInfo').addEventListener('click', function() {
  this.classList.add('active');
  document.getElementById('tabInput').classList.remove('active');
  document.getElementById('dataInputSection').style.display = 'none';
  // Show the charts and summary section
  document.querySelector('.dashboard-stats').style.display = 'flex';
  document.querySelectorAll('.card').forEach(card => card.style.display = 'block');
});

document.getElementById('tabInput').addEventListener('click', function() {
  this.classList.add('active');
  document.getElementById('tabInfo').classList.remove('active');
  document.getElementById('dataInputSection').style.display = 'block';
  // Hide the charts and summary section
  document.querySelector('.dashboard-stats').style.display = 'none';
  document.querySelectorAll('.card').forEach(card => card.style.display = 'none');
  
  // Auto-populate current date
  autoPopulateCurrentDate();
});

// Enhanced form submission
document.getElementById('failureForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const form = e.target;
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  
  // Validate form
  const errors = validateForm(data);
  if (errors.length > 0) {
    showFormMessage(errors.join('<br>'), 'error');
    return;
  }
  
  // Show loading state
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Submitting...';
  submitBtn.disabled = true;
  
  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    const result = await response.json();
    
    if (result.success) {
      showFormMessage('Record submitted successfully!', 'success');
      form.reset();
      
      // Refresh the charts with new data
      setTimeout(() => {
        initDashboard();
      }, 1000);
    } else {
      showFormMessage(`Error: ${result.error}`, 'error');
    }
  } catch (error) {
    showFormMessage(`Network error: ${error.message}`, 'error');
  } finally {
    // Restore button state
    submitBtn.textContent = originalText;
    submitBtn.disabled = false;
  }
});

// Apply modal function on summary cards
document.getElementById("cardMajor").addEventListener("click", () => {
  const records = window.failureData.filter(d => d.Fault === "Major");
  openRecordsModal(records, "Major Failures");
});

document.getElementById("cardMinor").addEventListener("click", () => {
  const records = window.failureData.filter(d => d.Fault === "Minor");
  openRecordsModal(records, "Minor Failures");
});

document.getElementById("cardOmitted").addEventListener("click", () => {
  const records = window.failureData.filter(d => d.Fault === "Omitted");
  openRecordsModal(records, "Omitted Failures");
});

// Close modal when clicking outside content
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