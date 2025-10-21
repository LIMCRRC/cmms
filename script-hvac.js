const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwlrmHWqmh382drr95zJxE_Oxu_181YpjO3gXA24qTXYeIow3xDHkWJIB2MiBxohlC0EA/exec';

let trainData = [];
let rectificationHistory = [];
let currentCell = null;
let currentSection = 'END1';

const cars = ['MC1', 'T1', 'M1', 'M2', 'T2', 'MC2'];
const units = ['U1', 'U2'];
const sections = ['END1', 'END2'];

// Fault codes per unit and section
const faultCodes = {
  U1: { END1: ["EF11","CF11","CP11","HPS11","LPS11"], END2: ["EF12","CF12","CP12","HPS12","LPS12"] },
  U2: { END1: ["EF21","CF21","CP21","HPS21","LPS21"], END2: ["EF22","CF22","CP22","HPS22","LPS22"] }
};

// Loading overlay functions
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

// Toast notification
function showNotification(message, isError = false) {
  const existing = document.getElementById('statusNotification');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'statusNotification';
  el.className = 'notification';
  el.textContent = message;
  el.style.backgroundColor = isError ? '#e53e3e' : '#38a169';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// Fetch HVAC and history data
async function fetchData() {
  try {
    showLoadingOverlay('Loading HVAC data...');
    const res = await fetch(`${SCRIPT_URL}?action=loadHVAC`);
    const json = await res.json();
    if (json.success) {
      trainData = json.data.data || [];
      rectificationHistory = json.data.history || [];
      renderTrainTable();
      updateStats();
      renderHistoryTable();
      populateFilterDropdowns();
      document.getElementById('currentDateTime').textContent = new Date().toLocaleString();
    } else showNotification('Failed to load data: ' + json.message, true);
  } catch (err) {
    console.error(err);
    showNotification('Error loading data. Check connection.', true);
  } finally { hideLoadingOverlay(); }
}

// Render train table
function renderTrainTable() {
  const tbody = document.querySelector('#faultTable tbody');
  tbody.innerHTML = '';
  for (let i = 1; i <= 38; i++) {
    addSetRow(tbody, 'T' + i.toString().padStart(2,'0'));
  }
  applyColorCoding();
}

// Add single train set row
function addSetRow(tbody, setNumber) {
  const row = document.createElement('tr');
  row.dataset.set = setNumber;

  // Set cell
  const setCell = document.createElement('td');
  setCell.textContent = setNumber;
  row.appendChild(setCell);

  // Cells for each car/unit/section (2 sections per unit)
  cars.forEach(car => {
    units.forEach(unit => {
      sections.forEach(section => {
        const cell = document.createElement('td');
        cell.className = 'status-cell';
        cell.dataset.car = car;
        cell.dataset.unit = unit;
        cell.dataset.section = section;
        cell.textContent = '-';
        cell.addEventListener('click', () => openStatusModal(cell));
        row.appendChild(cell);
      });
    });
  });

  tbody.appendChild(row);
}

// Summarize unit status across sections
function summarizeUnit(unitObj) {
  if (!unitObj) return { status:'', text:'-' };
  const s1 = unitObj.END1?.status || '';
  const s2 = unitObj.END2?.status || '';
  const f1 = unitObj.END1?.faultCode || '';
  const f2 = unitObj.END2?.faultCode || '';
  if (s1 === 'Faulty' || s2 === 'Faulty') return { status:'Faulty', text: s1==='Faulty' ? `${f1 || 'Fault (E1)'} (E1)` : `${f2 || 'Fault (E2)'} (E2)` };
  if (s1 === 'Repaired' || s2 === 'Repaired') return { status:'Repaired', text:'Repaired' };
  if (s1 === 'Normal' || s2 === 'Normal') return { status:'Normal', text:'Normal' };
  return { status:'', text:'-' };
}

// Apply color coding
function applyColorCoding() {
  document.querySelectorAll('#faultTable td.status-cell').forEach(cell => {
    const trainId = parseInt(cell.closest('tr').dataset.set.substring(1));
    const car = cell.dataset.car;
    const unit = cell.dataset.unit;
    const section = cell.dataset.section;
    const train = trainData.find(t => t.id === trainId);
    const comp = train?.cars?.[car]?.[unit]?.[section];
    cell.dataset.status = comp?.status || '';
    cell.className = 'status-cell';
    if (comp?.status) cell.classList.add(comp.status.toLowerCase());
    cell.textContent = comp?.status==='Faulty' ? comp.faultCode : comp?.status || '-';
  });
}

// Open modal
function openStatusModal(cell) {
  currentCell = cell;
  currentSection = cell.dataset.section;
  const trainId = parseInt(cell.closest('tr').dataset.set.substring(1));
  const car = cell.dataset.car;
  const unit = cell.dataset.unit;

  document.getElementById('modalTitle').textContent = `Train ${trainId} ${car} - ${unit} (${currentSection})`;

  // Reset buttons
  document.querySelectorAll('.status-option-btn, .section-option-btn').forEach(b => b.classList.remove('selected','active'));
  document.querySelector(`.section-option-btn[data-section="${currentSection}"]`)?.classList.add('active');

  // Populate fault codes
  populateFaultCodes(unit, currentSection);

  // Load existing rectified date
  const rectifiedDate = trainData.find(t => t.id===trainId)?.cars?.[car]?.[unit]?.[currentSection]?.rectifiedDate;
  document.getElementById('rectifiedDate').value = rectifiedDate ? new Date(rectifiedDate).toISOString().slice(0,16) : '';
  document.getElementById('faultCodesContainer').style.display = cell.dataset.status==='Faulty' ? 'block' : 'none';

  // Status selection
  document.querySelectorAll('.status-option-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.status-option-btn').forEach(b => b.classList.remove('selected','active'));
      btn.classList.add('selected','active');
      document.getElementById('faultCodesContainer').style.display = btn.dataset.status==='Faulty' ? 'block' : 'none';
    };
  });

  // Section switching
  document.querySelectorAll('.section-option-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.section-option-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentSection = btn.dataset.section;
      const rectDate = trainData.find(t=>t.id===trainId)?.cars?.[car]?.[unit]?.[currentSection]?.rectifiedDate;
      document.getElementById('rectifiedDate').value = rectDate ? new Date(rectDate).toISOString().slice(0,16) : '';
      populateFaultCodes(unit, currentSection);
    };
  });

  document.getElementById('statusModal').style.display = 'flex';
}

// Populate fault codes grid
function populateFaultCodes(unit, section) {
  const grid = document.getElementById('faultCodesGrid');
  grid.innerHTML = '';
  (faultCodes[unit]?.[section] || []).forEach(code => {
    const btn = document.createElement('button');
    btn.className = 'fault-code-btn';
    btn.textContent = code;
    btn.dataset.code = code;
    btn.onclick = () => {
      document.querySelectorAll('.fault-code-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
    };
    grid.appendChild(btn);
  });
}

// Save status
async function saveStatusChange() {
  if (!currentCell) return;
  const selectedOption = document.querySelector('.status-option-btn.selected');
  if (!selectedOption) return showNotification('Please select a status', true);

  const trainId = parseInt(currentCell.closest('tr').dataset.set.substring(1));
  const car = currentCell.dataset.car;
  const unit = currentCell.dataset.unit;
  const newStatus = selectedOption.dataset.status;

  let faultCode = '';
  const rectifiedDate = newStatus==='Repaired' ? (document.getElementById('rectifiedDate').value || new Date().toISOString()) : null;

  if (newStatus==='Faulty') {
    const codeBtn = document.querySelector('.fault-code-btn.active');
    if (!codeBtn) return showNotification('Select a fault code', true);
    faultCode = codeBtn.dataset.code;
  }

  try {
    showLoadingOverlay('Saving status...');
    const payload = { action:'saveHVAC', trainId, car, unit, section:currentSection, status:newStatus, faultCode, rectifiedDate };
    const json = await fetch(SCRIPT_URL, { method:'POST', body:JSON.stringify(payload) }).then(r=>r.json());
    if (json.success) { await fetchData(); closeStatusModal(); showNotification('Status updated!'); }
    else showNotification('Failed to save: ' + json.message, true);
  } catch(err) {
    console.error(err);
    showNotification('Error saving data', true);
  } finally { hideLoadingOverlay(); }
}

// Render rectification history
function renderHistoryTable() {
  const tbody = document.getElementById('historyTableBody');
  tbody.innerHTML = '';
  const filteredHistory = filterHistory();
  if (!filteredHistory.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No matching records found</td></tr>';
    return;
  }
  filteredHistory.forEach(item=>{
    const dateStr = new Date(item.date).toLocaleString();
    tbody.insertAdjacentHTML('beforeend',`
      <tr>
        <td>${dateStr}</td>
        <td>T${item.trainId.toString().padStart(2,'0')}</td>
        <td>${item.car}</td>
        <td>${item.unit}</td>
        <td>${item.section || ''}</td>
        <td>${item.faultCode || ''}</td>
        <td><span class="status-badge ${item.status.toLowerCase()}">${item.status}</span></td>
      </tr>
    `);
  });
}

// Filter history
function filterHistory() {
  const trainFilter = document.getElementById('filterTrain').value;
  const unitFilter = document.getElementById('filterUnit').value;
  const fromDate = document.getElementById('filterFromDate').valueAsDate;
  const toDate = document.getElementById('filterToDate').valueAsDate;
  const adjustedToDate = toDate ? new Date(toDate.setHours(23,59,59,999)) : null;

  return rectificationHistory.filter(item=>{
    if (trainFilter && item.trainId !== parseInt(trainFilter)) return false;
    if (unitFilter && item.unit!==unitFilter) return false;
    const itemDate = new Date(item.date);
    if (fromDate && itemDate<fromDate) return false;
    if (adjustedToDate && itemDate>adjustedToDate) return false;
    return true;
  });
}

// Populate train dropdowns
function populateFilterDropdowns() {
  const trainSelect = document.getElementById('filterTrain');
  while (trainSelect.options.length > 1) trainSelect.remove(1);
  for (let i=1;i<=38;i++){
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `T${i.toString().padStart(2,'0')}`;
    trainSelect.appendChild(opt);
  }
  const today = new Date();
  const past30 = new Date(); past30.setDate(today.getDate()-30);
  document.getElementById('filterFromDate').valueAsDate = past30;
  document.getElementById('filterToDate').valueAsDate = today;
}

function closeStatusModal() {
  document.getElementById('statusModal').style.display = 'none';
  currentCell = null;
  currentSection = 'END1';
}

// Update stats dashboard
function updateStats() {
  let normal=0, faulty=0, repaired=0;
  const affectedTrains = new Set();
  trainData.forEach(train=>{
    let hasIssues=false;
    cars.forEach(car=>units.forEach(unit=>sections.forEach(sec=>{
      const comp = train?.cars?.[car]?.[unit]?.[sec];
      if(!comp) return;
      if(comp.status==='Normal') normal++;
      else if(comp.status==='Faulty') { faulty++; hasIssues=true; }
      else if(comp.status==='Repaired') { repaired++; hasIssues=true; }
    })));
    if(hasIssues) affectedTrains.add(train.id);
  });
  document.getElementById('normalCount').textContent=normal;
  document.getElementById('faultyCount').textContent=faulty;
  document.getElementById('repairedCount').textContent=repaired;
  document.getElementById('affectedTrains').textContent=affectedTrains.size;
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

// Init
document.addEventListener('DOMContentLoaded',()=>{
  fetchData();
  document.getElementById('hvacBtn').classList.add('active');

  document.getElementById('refreshBtn').addEventListener('click',e=>{e.preventDefault(); fetchData();});
  document.getElementById('modalCancel').addEventListener('click',closeStatusModal);
  document.getElementById('modalSave').addEventListener('click',saveStatusChange);
  document.getElementById('modalClose').addEventListener('click',closeStatusModal);
  document.getElementById('applyFilters').addEventListener('click',renderHistoryTable);
  document.getElementById('statusModal').addEventListener('click',e=>{if(e.target.id==='statusModal') closeStatusModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape') closeStatusModal();});
});