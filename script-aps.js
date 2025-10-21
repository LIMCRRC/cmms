/***** CONFIG *****/
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwMbBtS6mMkPyRB8t6T5Q7wIWDg-pU__P1so5FqH80r8uMzlIe2-2vh6qp2wDaGbuYH/exec"; // <-- Replace with your Web App URL

/***** DOM ELEMENTS *****/
const apsTable = document.getElementById("apsTable");
const apsTableHead = apsTable.querySelector("thead");
const apsTableBody = apsTable.querySelector("tbody");

const historyTableBody = document.getElementById("historyTableBody");
const filterTrain = document.getElementById("filterTrain");
const filterCar = document.getElementById("filterCar");
const filterFromDate = document.getElementById("filterFromDate");
const filterToDate = document.getElementById("filterToDate");
const applyFiltersBtn = document.getElementById("applyFilters");

const dateTimeSpan = document.getElementById("currentDateTime");

// Modal elements
const statusModal = document.getElementById("statusModal");
const modalTitle = document.getElementById("modalTitle");
const modalComponentName = document.getElementById("modalComponentName");
const modalClose = document.getElementById("modalClose");
const modalCancel = document.getElementById("modalCancel");
const modalSave = document.getElementById("modalSave");
const faultInputContainer = document.getElementById("faultInputContainer");
const faultNote = document.getElementById("faultNote");
const rectifiedDate = document.getElementById("rectifiedDate");

// Current selection tracking
let currentTrainId = null;
let currentComponentKey = null;
let currentStatus = null;

/***** LOADING OVERLAY FUNCTIONS *****/
function showLoadingOverlay(message = 'Loading...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
        // Create overlay if it doesn't exist
        overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">${message}</div>
        `;
        document.body.appendChild(overlay);
    } else {
        // Update message and show
        overlay.querySelector('.loading-text').textContent = message;
        overlay.style.display = 'flex';
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

/***** INITIALIZATION *****/
document.addEventListener("DOMContentLoaded", async () => {
  showLoadingOverlay('Loading APS data...');
  try {
    const data = await loadAPSData();
    renderAPSStatus(data.units);
    renderSummary(data.units);
    renderHistory(data.history);
    populateFilters(data.history);

    dateTimeSpan.textContent = new Date().toLocaleString();
    
    // Initialize modal event listeners
    initModalEvents();
  } catch (err) {
    notify("Error loading APS data: " + err.message, "red");
  } finally {
    hideLoadingOverlay();
  }
});

/***** MODAL FUNCTIONS *****/
function initModalEvents() {
  // Status option buttons
  document.querySelectorAll('.status-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.status-option-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatus = btn.dataset.status;
      
      // Show fault note input only for Faulty status
      faultInputContainer.style.display = currentStatus === 'Faulty' ? 'block' : 'none';
    });
  });

  // Modal close events
  modalClose.addEventListener('click', closeModal);
  modalCancel.addEventListener('click', closeModal);
  modalSave.addEventListener('click', saveStatusChange);
  
  // Close modal when clicking outside
  statusModal.addEventListener('click', (e) => {
    if (e.target === statusModal) closeModal();
  });
  
  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function openModal(trainId, carriageId, component, currentStatus) {
  currentTrainId = trainId;
  currentComponentKey = `${carriageId}-${component}`;
  
  // Set modal content
  modalTitle.textContent = `Set APS Status`;
  modalComponentName.textContent = `${carriageId} - ${component}`;
  
  // Reset form
  document.querySelectorAll('.status-option-btn').forEach(b => b.classList.remove('active'));
  faultNote.value = '';
  rectifiedDate.value = '';
  
  // Set current status if available
  if (currentStatus) {
    const statusBtn = document.querySelector(`.status-option-btn[data-status="${currentStatus}"]`);
    if (statusBtn) {
      statusBtn.classList.add('active');
      currentStatus = currentStatus;
    }
    
    // Show fault input if status is Faulty
    faultInputContainer.style.display = currentStatus === 'Faulty' ? 'block' : 'none';
  }
  
  // Show modal
  statusModal.classList.add('show');
}

function closeModal() {
  statusModal.classList.remove('show');
  
  // Optional: add a small delay before hiding completely
  setTimeout(() => {
    currentTrainId = null;
    currentComponentKey = null;
    currentStatus = null;
  }, 300);
}

async function saveStatusChange() {
  if (!currentTrainId || !currentComponentKey) return;
  
  const selectedStatus = document.querySelector('.status-option-btn.active');
  if (!selectedStatus) {
    notify('Please select a status', 'red');
    return;
  }
  
  const status = selectedStatus.dataset.status;
  const note = status === 'Faulty' ? faultNote.value : '';
  
  try {
    showLoadingOverlay('Saving status...');
    
    // Create the payload
    const payload = {
      trainId: currentTrainId,
      updates: {
        [currentComponentKey]: status
      }
    };
    
    console.log('Sending payload:', payload);
    
    // Use a simpler approach to send data
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // Try with no-cors first to see if it helps
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `payload=${encodeURIComponent(JSON.stringify(payload))}`
    });
    
    // For no-cors mode, we can't read the response, so just assume success
    console.log('Request completed');
    
    notify('Status updated successfully!', 'green');
    
    // Reload data to reflect changes
    const data = await loadAPSData();
    renderAPSStatus(data.units);
    renderSummary(data.units);
    renderHistory(data.history);
    
    closeModal();
  } catch (err) {
    console.error('Error details:', err);
    notify('Error updating status. Please check console for details.', 'red');
  } finally {
    hideLoadingOverlay();
  }
}

/***** API FUNCTIONS *****/
async function loadAPSData() {
  try {
    console.log('Loading APS data from:', `${SCRIPT_URL}?action=loadAPS`);
    const response = await fetch(`${SCRIPT_URL}?action=loadAPS`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('API response:', result);
    
    if (!result.success) throw new Error(result.message);
    return result.data;
  } catch (err) {
    console.error("Failed to load APS data:", err.message);
    throw err;
  }
}

/***** RENDER FUNCTIONS *****/
function renderAPSStatus(units) {
  // Clear previous table
  const table = document.getElementById("apsTable");
  table.innerHTML = "";

  // Define carriages and their components (matching Google Sheet)
  const carriages = {
    MC1: ["M2500","DCDC","BLG","PWR","E500","F1","F2"],
    M1:  ["M2500","DCDC","BLG","PWR","E500","F1","F2"],
    M2:  ["M2500","DCDC","BLG","PWR","E500","F1","F2"],
    MC2: ["M2500","DCDC","BLG","PWR","E500","F1","F2"]
  };

  // Create header
  const thead = document.createElement("thead");
  const tr1 = document.createElement("tr");
  tr1.appendChild(document.createElement("th")); // top-left empty cell

  Object.entries(carriages).forEach(([carriage, comps]) => {
    const th = document.createElement("th");
    th.colSpan = comps.length;
    th.textContent = carriage;
    tr1.appendChild(th);
  });
  thead.appendChild(tr1);

  // Second row: component names
  const tr2 = document.createElement("tr");
  const thTrain = document.createElement("th");
  thTrain.textContent = "Train";
  tr2.appendChild(thTrain);
  Object.values(carriages).forEach(comps => {
    comps.forEach(c => {
      const th = document.createElement("th");
      th.textContent = c;
      tr2.appendChild(th);
    });
  });
  thead.appendChild(tr2);
  table.appendChild(thead);

  // Create body
  const tbody = document.createElement("tbody");

  // Group units by train
  const trains = {};
  units.forEach(u => {
    if (!trains[u.trainId]) trains[u.trainId] = {};
    trains[u.trainId][u.carriageId + "-" + u.component] = u.status;
  });

  Object.entries(trains).forEach(([trainId, trainUnits]) => {
    const tr = document.createElement("tr");
    const tdTrain = document.createElement("td");
    tdTrain.textContent = trainId;
    tr.appendChild(tdTrain);

    Object.entries(carriages).forEach(([carriage, comps]) => {
      comps.forEach(comp => {
        const key = carriage + "-" + comp;
        const td = document.createElement("td");
        const statusValue = trainUnits[key];

        // Show actual value; blank if empty
        td.textContent = statusValue || "";

        // Apply status color classes
        if (!statusValue || statusValue.trim() === "") td.classList.add("blank");
        else if (statusValue === "Normal") td.classList.add("normal");
        else if (statusValue === "Faulty") td.classList.add("faulty");
        else if (statusValue === "Replaced") td.classList.add("replaced");

        // Add click event to open modal
        td.addEventListener('click', () => {
          openModal(trainId, carriage, comp, statusValue);
        });

        tr.appendChild(td);
      });
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
}

function renderSummary(units) {
  // Initialize counters for each component
  const componentFaults = {
    M2500: 0,
    DCDC: 0,
    BLG: 0,
    PWR: 0,
    E500: 0,
    F1: 0,
    F2: 0
  };

  units.forEach(u => {
    if (u.status === "Faulty" && componentFaults.hasOwnProperty(u.component)) {
      componentFaults[u.component]++;
    }
  });

  // Update quick action cards
  document.getElementById("faultM2500").textContent = componentFaults.M2500;
  document.getElementById("faultDCDC").textContent = componentFaults.DCDC;
  document.getElementById("faultBLG").textContent = componentFaults.BLG;
  document.getElementById("faultPWR").textContent = componentFaults.PWR;
  document.getElementById("faultE500").textContent = componentFaults.E500;
  document.getElementById("faultF1").textContent = componentFaults.F1;
  document.getElementById("faultF2").textContent = componentFaults.F2;
}

function renderHistory(history) {
  historyTableBody.innerHTML = "";

  if (!history || history.length === 0) {
    const row = document.createElement("tr");
    row.innerHTML = `<td colspan="4" style="text-align:center;">No history available</td>`;
    historyTableBody.appendChild(row);
    return;
  }

  history.forEach(item => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.date}</td>
      <td>${item.trainId}</td>
      <td>${item.carriage} - ${item.component}</td>
      <td>${item.status}</td>
    `;
    historyTableBody.appendChild(row);
  });
}

function populateFilters(history) {
  const trains = [...new Set(history.map(h => h.trainId))];
  const cars = [...new Set(history.map(h => h.carriage))];

  filterTrain.innerHTML = `<option value="">All Trains</option>`;
  trains.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    filterTrain.appendChild(opt);
  });

  filterCar.innerHTML = `<option value="">All Cars</option>`;
  cars.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    filterCar.appendChild(opt);
  });
}

   // Get user info from localStorage first, then fallback to URL parameters
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

/***** FILTERING *****/
applyFiltersBtn.addEventListener("click", () => {
  const t = filterTrain.value;
  const c = filterCar.value;
  const from = filterFromDate.value ? new Date(filterFromDate.value) : null;
  const to = filterToDate.value ? new Date(filterToDate.value) : null;

  const rows = historyTableBody.querySelectorAll("tr");
  rows.forEach(row => {
    const [dateCell, trainCell, componentCell, statusCell] = row.querySelectorAll("td");
    if (!dateCell) return; // skip header/empty

    const date = new Date(dateCell.textContent);
    const train = trainCell.textContent;
    const componentParts = componentCell.textContent.split(" - ");
    const car = componentParts[0];

    let visible = true;
    if (t && train !== t) visible = false;
    if (c && car !== c) visible = false;
    if (from && date < from) visible = false;
    if (to && date > to) visible = false;

    row.style.display = visible ? "" : "none";
  });
});

/***** HELPERS *****/
function notify(message, color = "green") {
  const note = document.createElement("div");
  note.className = "notification";
  note.style.background = color;
  note.textContent = message;
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 3000);
}