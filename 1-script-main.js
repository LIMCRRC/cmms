const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwBLMe78h5a6XvhBolUZMe1VLot-MiAEmuAsDnZXtbLxMGkNsw4D7KQrVn7nS1yWCwi/exec";

// Loading Overlay Functions
function showLoadingOverlay(message = 'Loading...') {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.querySelector('.loading-text').textContent = message;
    overlay.style.display = 'flex';
  }
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

// Format date as yyyy-mm-dd
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Format date as dd-mmm-yyyy (e.g., 03-Sep-2025)
function formatDateDisplay(date) {
  // Check if date is valid
  if (!date || isNaN(date.getTime())) {
    return "No date";
  }
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(date.getDate()).padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// Format date for display (DD/MM/YYYY)
function formatDateForDisplay(date) {
  // Check if date is valid
  if (!date || isNaN(date.getTime())) {
    return "-";
  }
  
  return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
}

// Parse date string safely
function safeParseDate(dateString) {
  if (!dateString) return null;
  
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

// Get URL parameter
function getUrlParameter(name) {
  name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
  const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
  const results = regex.exec(location.search);
  return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// Update maintenance plan summary cards
function updateSummaryCards(trainData) {
  const today = new Date();
  document.getElementById("todayDate").innerText = formatDateDisplay(today);
  const todayStr = formatDate(today);

  // Counters & lists
  let dailyCount = 0, weeklyCount = 0, monthlyCount = 0;
  let dailyList = [], weeklyList = [], monthlyList = [];

  // Count maintenance tasks for today
  for (let t = 1; t <= 38; t++) {
    const trainId = "T" + String(t).padStart(2, "0");
    
    if (trainData[trainId] && trainData[trainId][todayStr]) {
      const task = trainData[trainId][todayStr];
      
      if (task === "D") { 
        dailyCount++; 
        dailyList.push(trainId); 
      }
      else if (task === "W") { 
        weeklyCount++; 
        weeklyList.push(trainId); 
      }
      else if (task && task.toUpperCase().includes("M")) { 
        monthlyCount++; 
        monthlyList.push(trainId); 
      }
    }
  }

  // Update summary cards
  document.getElementById("dailyToday").innerText = dailyCount;
  document.getElementById("weeklyToday").innerText = weeklyCount;
  document.getElementById("monthlyToday").innerText = monthlyCount;

  document.getElementById("dailyTrains").innerText = dailyList.join(", ") || "-";
  document.getElementById("weeklyTrains").innerText = weeklyList.join(", ") || "-";
  document.getElementById("monthlyTrains").innerText = monthlyList.join(", ") || "-";
}

// Update dashboard stats
function updateDashboardStats(data) {
  const totalTrains = data.length;
  const inService = data.filter(train => train.Status === 'In Service').length;
  const inMaintenance = data.filter(train => train.Status === 'Maintenance').length;
  const detained = data.filter(train => train.Status === 'Detained').length;
  const nonActive = data.filter(train => train.Status === 'Non-Active').length;
  
  document.getElementById('totalTrains').textContent = totalTrains;
  document.getElementById('inService').textContent = inService;
  document.getElementById('inMaintenance').textContent = inMaintenance;
  document.getElementById('detained').textContent = detained;
  document.getElementById('nonActive').textContent = nonActive;
}

// Populate train cards with additional status information
function populateTrainCards(data) {
  const grid = document.getElementById('trainCardsGrid');
  grid.innerHTML = '';
  
  data.forEach(train => {
    const card = document.createElement('div');
    card.className = 'train-card';
    card.dataset.status = train.Status;
    
    let statusClass = '';
    if (train.Status === 'In Service') {
      statusClass = 'status-service';
    } else if (train.Status === 'Maintenance') {
      statusClass = 'status-maintenance';
    } else if (train.Status === 'Detained') {
      statusClass = 'status-detained';
    } else if (train.Status === 'Non-Active') {
      statusClass = 'status-nonactive';
    }
    
    // Format dates safely
    const formatStatusDate = (dateString) => {
      if (!dateString) return '-';
      const date = safeParseDate(dateString);
      return date ? formatDateForDisplay(date) : '-';
    };
    
    // Only show detained/resume dates for detained or non-active trains
    const showStatusDates = train.Status === 'Detained' || train.Status === 'Non-Active';
    
    card.innerHTML = ` 
      <div class="train-id">${train.TrainSet}</div>
      <div class="train-status ${statusClass}">${train.Status}</div>
      <div class="train-mileage">
        <i class="fas fa-tachometer-alt"></i> ${train.Mileage || 'N/A'} km
      </div>
      <div class="train-status-info">
        ${showStatusDates ? `
        <div class="status-info-row">
          <span class="status-info-label">From:</span>
          <span class="status-info-value">${formatStatusDate(train.DetainedDate)}</span>
        </div>
        <div class="status-info-row">
          <span class="status-info-label">To:</span>
          <span class="status-info-value">${formatStatusDate(train.ResumeDate)}</span>
        </div>
        ` : ''}
        <div class="status-info-row">
          <span class="status-info-label">Remarks:</span>
          <span class="status-info-value">${train.Remarks || '-'}</span>
        </div>
      </div>
    `;
    
    grid.appendChild(card);
  });
  
  // Initialize status filter buttons (unchanged)
  document.querySelectorAll('.status-filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.status-filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      const status = this.dataset.status;
      filterTrainCards(status);
    });
  });
}

function filterTrainCards(status) {
  const cards = document.querySelectorAll('.train-card');
  
  cards.forEach(card => {
    if (status === 'all' || card.dataset.status === status) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

// Load all data for the overview page
async function loadOverviewData() {
  showLoadingOverlay('Loading overview data...');
  try {
    // Load maintenance plan data - FIXED: Use the correct action parameter
    const planRes = await fetch(`${SCRIPT_URL}?action=getMaintenancePlan`);
    const planJson = await planRes.json();
    
    if (planJson.status === 'success') {
      updateSummaryCards(planJson.data);
    } else {
      console.error("Plan load error:", planJson.message);
    }
    
    // Load train status data
    const statusRes = await fetch(`${SCRIPT_URL}?action=getTrainStatus`);
    const statusJson = await statusRes.json();
    
    if (statusJson.status === 'success') {
      updateDashboardStats(statusJson.data);
      populateTrainCards(statusJson.data);
    } else {
      console.error("Status load error:", statusJson.message);
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  } finally {
    hideLoadingOverlay();
  }
}

// Set user info on page load
document.addEventListener('DOMContentLoaded', () => {
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
  
  // Load data after setting user info
  loadOverviewData();
  
  // Add refresh button functionality
  document.getElementById('refreshBtn').addEventListener('click', loadOverviewData);
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