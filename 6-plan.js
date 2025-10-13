    const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxhT84kZVx7cxGnx4xOgRityxr9NyInM2xdTIjJ9IMvb0WuYZwkdEeYK1WRFhC69fScjQ/exec";

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

    function formatDate(date) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    // Format date as dd-mmm-yyyy (e.g., 03-Sep-2025)
    function formatDateDisplay(date) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const day = String(date.getDate()).padStart(2, '0');
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    }

    // Calculate days between two dates
    function daysBetween(date1, date2) {
      const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
      const firstDate = new Date(date1);
      const secondDate = new Date(date2);
      return Math.round(Math.abs((firstDate - secondDate) / oneDay));
    }

    // Generate mock history data (replace with real data from your API)
    function generateHistoryData(trainData) {
      const today = new Date();
      const historyData = [];
      
      for (let t = 1; t <= 38; t++) {
        const trainId = "T" + String(t).padStart(2, "0");
        
        // Find the last maintenance date and type for this train
        let lastMaintenanceDate = null;
        let lastMaintenanceType = "None";
        
        if (trainData[trainId]) {
          // Get all dates for this train and sort them in descending order
          const dates = Object.keys(trainData[trainId]).sort((a, b) => {
            return new Date(b) - new Date(a);
          });
          
          // Find the most recent maintenance date that is today or in the past
          for (const date of dates) {
            const task = trainData[trainId][date];
            const taskDate = new Date(date);
            
            if (taskDate <= today && task) {
              lastMaintenanceDate = date;
              lastMaintenanceType = task;
              break;
            }
          }
        }
        
        // If no maintenance found, use a default date (30 days ago)
        if (!lastMaintenanceDate) {
          const defaultDate = new Date();
          defaultDate.setDate(today.getDate() - 30);
          lastMaintenanceDate = formatDate(defaultDate);
          lastMaintenanceType = "Unknown";
        }
        
        // Calculate days since last maintenance
        const daysSince = daysBetween(lastMaintenanceDate, formatDate(today));
        
        historyData.push({
          trainId,
          lastMaintenanceType,
          lastMaintenanceDate,
          daysSince
        });
      }
      
      return historyData;
    }

    // Build the history table
    function buildHistoryTable(historyData) {
      const tableBody = document.getElementById("historyTableBody");
      tableBody.innerHTML = "";
      
      historyData.forEach(item => {
        const row = document.createElement("tr");
        
        // Apply styling based on days since last maintenance
        let rowClass = "";
        if (item.daysSince > 30) {
          rowClass = "overdue";
        } else if (item.daysSince > 20) {
          rowClass = "warning";
        }
        
        if (rowClass) {
          row.className = rowClass;
        }
        
        row.innerHTML = `
          <td>${item.trainId}</td>
          <td>${item.lastMaintenanceType}</td>
          <td>${formatDateDisplay(new Date(item.lastMaintenanceDate))}</td>
          <td>${item.daysSince}</td>
        `;
        
        tableBody.appendChild(row);
      });
    }

    async function loadData() {
      showLoadingOverlay('Loading maintenance data...');
      try {
        const res = await fetch(SCRIPT_URL);
        const json = await res.json();
        if (json.success) {
          buildMatrix(json.data);
          
          // Generate and display history data
          const historyData = generateHistoryData(json.data);
          buildHistoryTable(historyData);
        } else {
          console.error("Load error:", json.error);
        }
      } catch (err) {
        console.error("Fetch failed:", err);
      } finally {
        hideLoadingOverlay();
      }
    }

    function buildMatrix(trainData) {
      const today = new Date();
      // Use the new formatDateDisplay function for the UI
      document.getElementById("todayDate").innerText = formatDateDisplay(today);

      const body = document.getElementById("maintenanceTableBody");
      const head = document.querySelector(".maintenance-table thead tr");

      body.innerHTML = "";
      head.innerHTML = "<th>SCS No.</th>";

      // Get current month range
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      let dates = [];
      let todayColumnIndex = -1;
      const todayStr = formatDate(today);
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(new Date(d));
        dates.push(dateStr);
        // Format table headers as dd-mmm
        const displayDate = formatDateDisplay(new Date(d)).substring(0, 6);
        
        // Check if this is today's column
        const isToday = dateStr === todayStr;
        const thClass = isToday ? 'today-column' : '';
        
        head.innerHTML += `<th class="${thClass}">${displayDate}</th>`;
        
        // Remember today's column index
        if (isToday) {
          todayColumnIndex = dates.length; // +1 because of the SCS No. column
        }
      }

      // Counters & lists
      let dailyCount = 0, weeklyCount = 0, monthlyCount = 0;
      let dailyList = [], weeklyList = [], monthlyList = [];

      // Build each train row
      for (let t = 1; t <= 38; t++) {
        const trainId = "T" + String(t).padStart(2, "0");
        let rowHTML = `<tr><td>${trainId}</td>`;

        dates.forEach((d, index) => {
          const task = trainData[trainId] ? trainData[trainId][d] || "" : "";

          if (d === todayStr) {
            if (task === "D") { dailyCount++; dailyList.push(trainId); }
            else if (task === "W") { weeklyCount++; weeklyList.push(trainId); }
            else if (task.toUpperCase().includes("M")) { monthlyCount++; monthlyList.push(trainId); }
          }

          let cls = "";
          if (task === "D") cls = "daily";
          else if (task === "W") cls = "weekly";
          else if (task.toUpperCase().includes("M")) cls = "monthly";

          // Add today-column class if this is today's cell
          if (d === todayStr) {
            cls += " today-column";
          }

          rowHTML += `<td class="${cls}">${task}</td>`;
        });

        rowHTML += "</tr>";
        body.innerHTML += rowHTML;
      }

      // Update summary cards
      document.getElementById("dailyToday").innerText = dailyCount;
      document.getElementById("weeklyToday").innerText = weeklyCount;
      document.getElementById("monthlyToday").innerText = monthlyCount;

      document.getElementById("dailyTrains").innerText = dailyList.join(", ") || "-";
      document.getElementById("weeklyTrains").innerText = weeklyList.join(", ") || "-";
      document.getElementById("monthlyTrains").innerText = monthlyList.join(", ") || "-";
      
      // Scroll to today's column if it exists
      if (todayColumnIndex !== -1) {
        setTimeout(() => {
          const tableContainer = document.querySelector('.maintenance-table');
          const todayCell = tableContainer.querySelector(`th:nth-child(${todayColumnIndex + 1})`);
          if (todayCell) {
            todayCell.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }, 100);
      }
    }

    // Get user info from localStorage or URL parameters
    function getUrlParameter(name) {
      name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
      const regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
      const results = regex.exec(location.search);
      return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
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
      loadData();
      
      // Add refresh button functionality
      document.getElementById('refreshBtn').addEventListener('click', loadData);
    });

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.collapsible .collapse-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const parent = this.parentElement;
      parent.classList.toggle('active');
    });
  });
});
