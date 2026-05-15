// --- GLOBAL APPLICATION STATE ---
let deviceStats = { total: 0, online: 0, offline: 0, normal: 0, alarm: 0 };
const deviceStates = new Map(); // Tracks dynamic state per EUI { online: bool, alarm: bool }
let currentViewEUI = null;
let allNetworkDevices = []; // Stores the master list for the Network tab

const deviceDataHistory = {};
const MAX_HISTORY = 20; 

// Top Right Clock
setInterval(() => { document.getElementById('datetime').innerText = new Date().toLocaleString(); }, 1000);

function updateDeviceStatsUI() {
    document.getElementById('stat-total').innerText = deviceStats.total;
    document.getElementById('stat-online').innerText = deviceStats.online;
    document.getElementById('stat-offline').innerText = deviceStats.offline;
    document.getElementById('stat-normal').innerText = deviceStats.normal;
    document.getElementById('stat-alarm').innerText = deviceStats.alarm;
}

// Fetch Initial Devices and Draw Network Topology
fetch('/api/devices').then(res => res.json()).then(devices => {
    allNetworkDevices = devices; // Save globally for the Network Grid
    deviceStats.total = devices.length;
    deviceStats.total = devices.length; 
    deviceStats.offline = devices.length; 
    
    // 1. Plot all the physical map markers & initialize state tracking
    devices.forEach(device => {
        deviceStates.set(device.eui, { online: false, alarm: false }); // Initialize state
        
        var popupHTML = `<div class="popup-content"><h3>${device.model_name}</h3><p><strong>EUI:</strong> ${device.eui}</p><p><strong>Status:</strong> <span style="color: grey;">Offline</span></p></div>`;
        var marker = L.marker([device.lat, device.lng], {icon: offlineIcon}).addTo(map);
        marker.bindPopup(popupHTML); 
        markers[device.eui] = marker;
    });
    
    updateDeviceStatsUI();

    // 2. Mathematical Topology Builder (The Spider Web)
    const rootEui = 'bc8d9d318b84a523'; 
    const rootDevice = devices.find(d => d.eui === rootEui) || devices[0];

    function getDistance(d1, d2) {
        return Math.sqrt(Math.pow(d1.lat - d2.lat, 2) + Math.pow(d1.lng - d2.lng, 2));
    }

    devices.forEach(d => d.distToRoot = getDistance(d, rootDevice));

    devices.forEach(device => {
        if (device.eui === rootDevice.eui) return; 

        let closestParent = null;
        let minDistanceToParent = Infinity;

        devices.forEach(potentialParent => {
            if (potentialParent.distToRoot < device.distToRoot) {
                let distToPotential = getDistance(device, potentialParent);
                if (distToPotential < minDistanceToParent) {
                    minDistanceToParent = distToPotential;
                    closestParent = potentialParent;
                }
            }
        });

        if (closestParent) {
            L.polyline(
                [[device.lat, device.lng], [closestParent.lat, closestParent.lng]],
                { color: '#2c3e50', weight: 3, dashArray: '6, 8', opacity: 0.85 }
            ).addTo(map);
        }
    });
});

// --- UI VIEW TOGGLES ---
function showMap() {
    currentViewEUI = null;
    // Hide everything else
    document.getElementById('device-view').style.display = 'none';
    document.getElementById('network-view').style.display = 'none';
    document.getElementById('settings-view').style.display = 'none'; // <-- FIXED
    
    // Show Map
    document.getElementById('map-view').style.display = 'flex';
    
    document.querySelectorAll('.sidebar .menu-item').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-map').classList.add('active');
    setTimeout(() => { map.invalidateSize(); }, 100); 
}

window.showNetwork = function() {
    // Hide everything else
    document.getElementById('map-view').style.display = 'none';
    document.getElementById('device-view').style.display = 'none';
    document.getElementById('settings-view').style.display = 'none'; // <-- FIXED
    
    // Show Network
    document.getElementById('network-view').style.display = 'flex';
    
    document.querySelectorAll('.sidebar .menu-item').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-network').classList.add('active');

    renderNetworkGrid();
};

window.openDevicePage = function(eui, model) {
    currentViewEUI = eui;
    // Hide everything else
    document.getElementById('map-view').style.display = 'none'; 
    document.getElementById('network-view').style.display = 'none'; 
    document.getElementById('settings-view').style.display = 'none'; // <-- FIXED
    
    // Show Device Detail View
    document.getElementById('device-view').style.display = 'flex'; 
    
    document.querySelectorAll('.sidebar .menu-item').forEach(el => el.classList.remove('active'));
    
    document.getElementById('detail-model').innerText = model; 
    document.getElementById('detail-eui').innerText = eui;
    
    if (deviceDataHistory[eui]) {
        const hist = deviceDataHistory[eui];
        document.getElementById('telemetry-body').innerHTML = hist.tableRows.join('');
        powerChart.data.labels = hist.timestamps; powerChart.data.datasets[0].data = hist.power[0]; powerChart.data.datasets[1].data = hist.power[1];
        rippleChart.data.labels = hist.timestamps; rippleChart.data.datasets[0].data = hist.ripple[0];
        rfChart.data.labels = hist.timestamps; rfChart.data.datasets[0].data = hist.rf[0];
    }
    powerChart.update(); rippleChart.update(); rfChart.update();
};

function renderNetworkGrid() {
    const grid = document.getElementById('amp-grid');
    grid.innerHTML = ''; // Clear existing cards

    allNetworkDevices.forEach((device, index) => {
        // Calculate dynamic hardware info based on the requirements
        const serialNum = "0526" + String(index + 1).padStart(4, '0'); // 05260001, 05260002...
        const partName = "AFM BR";
        const partNum = "AFM8-BR51TC2RT0";
        const fwVer = "167";

        // Check live state from the MQTT tracking map
        const state = deviceStates.get(device.eui) || { online: false, alarm: false };

        let cardClass = '';
        let imgClass = 'amp-img';
        let btnDisabled = 'disabled';
        let btnText = 'Offline (Cannot Scan)';

        if (state.online) {
            btnDisabled = '';
            btnText = '📡 Run Frequency Sweep';
            if (state.alarm) {
                cardClass = 'alarm';
            } else {
                cardClass = 'online';
            }
        } else {
            imgClass += ' offline'; // Greys out the image
        }

        const cardHTML = `
            <div class="amp-card ${cardClass}">
                <div class="status-dot"></div>
                <h3 style="color: #38b298; margin-bottom: 5px;">${device.model_name}</h3>
                <p style="font-size: 11px; color: #888;">EUI: ${device.eui}</p>

                <img src="https://acicomms.com/wp-content/uploads/elementor/thumbs/SDLE1.8-993-rj8f4wsd0g4dyfzmgf1f29cha6m5rfwxhfsw07c9ai.png" class="${imgClass}">

                <div class="hw-details">
                    <strong>Part Name:</strong> ${partName}<br>
                    <strong>Part No:</strong> ${partNum}<br>
                    <strong>S/N:</strong> ${serialNum}<br>
                    <strong>FW Ver:</strong> ${fwVer}
                </div>

                <button class="btn-scan" ${btnDisabled} onclick="openSpectrumModal('${device.eui}', '${serialNum}')">${btnText}</button>
            </div>
        `;
        grid.innerHTML += cardHTML;
    });
}

// --- DEVICE SETTINGS LOGIC ---
window.showSettings = function() {
    // Hide all other views
    document.getElementById('map-view').style.display = 'none';
    document.getElementById('device-view').style.display = 'none';
    document.getElementById('network-view').style.display = 'none';

    // Show Settings View
    document.getElementById('settings-view').style.display = 'flex';

    // Update Sidebar
    document.querySelectorAll('.sidebar .menu-item').forEach(el => el.classList.remove('active'));
    document.getElementById('nav-settings').classList.add('active');

    renderSettingsDeviceList();
};

function renderSettingsDeviceList() {
    const listContainer = document.getElementById('settings-device-list');
    listContainer.innerHTML = '';

    allNetworkDevices.forEach(device => {
        const state = deviceStates.get(device.eui) || { online: false, alarm: false };
        const statusColor = state.online ? (state.alarm ? '#dc3545' : '#28a745') : '#6c757d';

        const item = document.createElement('div');
        item.className = 'device-select-item';
        item.innerHTML = `
            <div>
                <div style="font-weight: bold; color: #333; font-size: 14px;">${device.model_name}</div>
                <div style="font-size: 11px; color: #888; font-family: monospace;">${device.eui}</div>
            </div>
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${statusColor};"></div>
        `;

        // When a device is clicked, open the config form on the right
        item.onclick = () => openDeviceConfig(device, item, state);
        listContainer.appendChild(item);
    });
}

function openDeviceConfig(device, element, state) {
    // Highlight the selected item in the list
    document.querySelectorAll('.device-select-item').forEach(el => el.classList.remove('active'));
    element.classList.add('active');

    // Show the form
    document.getElementById('settings-form-container').style.display = 'flex';

    // Populate Headers
    document.getElementById('config-model').innerText = device.model_name;
    document.getElementById('config-eui').innerText = device.eui;

    const badge = document.getElementById('config-status-badge');
    if (!state.online) {
        badge.innerText = 'Offline'; badge.style.background = '#6c757d';
    } else if (state.alarm) {
        badge.innerText = 'Alarm Active'; badge.style.background = '#dc3545';
    } else {
        badge.innerText = 'Online'; badge.style.background = '#28a745';
    }
}

window.sendConfiguration = function(event) {
    event.preventDefault(); // Stop the page from reloading

    const eui = document.getElementById('config-eui').innerText;
    const btn = event.target.querySelector('button[type="submit"]');

    // UI Feedback
    const originalText = btn.innerText;
    btn.innerText = "⏳ Encoding COBS & Transmitting...";
    btn.style.background = "#f1c40f";

    // In a real environment, you would compile the form values into Hex,
    // encode them using COBS (e.g., 0x03 0xB0...), and POST to your Node.js MQTT broker.

    setTimeout(() => {
        btn.innerText = "✅ Payload Queued Successfully!";
        btn.style.background = "#28a745";

        // Reset button after 3 seconds
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.background = "#38b298";
        }, 3000);
    }, 1500);
}

// --- LIVE WEBSOCKET LOGIC ---
const socket = io();

socket.on('telemetry_update', function(data) {
    const tel = data.telemetry;
    const hasAlarm = tel.status_code === 2;
    
    // 1. Update state tracking for this specific device
    deviceStates.set(data.eui, { online: true, alarm: hasAlarm });
    
    // 2. Recalculate Live Stats
    let online = 0, normal = 0, alarm = 0;
    deviceStates.forEach(state => {
        if (state.online) {
            online++;
            if (state.alarm) alarm++;
            else normal++;
        }
    });
    
    deviceStats.online = online;
    deviceStats.offline = deviceStats.total - online;
    deviceStats.normal = normal;
    deviceStats.alarm = alarm;
    updateDeviceStatsUI();

    const timeNow = new Date().toLocaleTimeString();
    
    const alarms = tel.alarms || tel; 
    let alarmBadges = '';
    if (alarms.power_anomaly) alarmBadges += '<span class="alarm-badge">Power</span>';
    if (alarms.temp_critical) alarmBadges += '<span class="alarm-badge">Temp</span>';
    if (alarms.rf_low_unlock) alarmBadges += '<span class="alarm-badge">RF L-Unlk</span>';
    if (alarms.rf_high_unlock) alarmBadges += '<span class="alarm-badge">RF H-Unlk</span>';
    if (!hasAlarm && !alarmBadges) alarmBadges = '<span style="color: #28a745; font-weight: bold;">OK</span>';

    const rowColorClass = hasAlarm ? 'alarm-row' : '';
    const newRow = `
        <tr class="${rowColorClass}">
            <td>${timeNow}</td>
            <td style="color: ${hasAlarm ? '#dc3545' : '#28a745'}; font-weight: bold;">${tel.status_code === 1 ? 'Normal' : 'Alarm'}</td>
            <td style="color: ${alarms.temp_critical ? '#dc3545' : '#444'}; font-weight: bold;">${tel.temperature_c}</td>
            <td style="color: ${alarms.power_anomaly ? '#dc3545' : '#444'}; font-weight: bold;">${Number(tel.rail_24v).toFixed(2)}</td>
            <td>${tel.ripple_24v_mv}</td>
            <td>${Number(tel.rf_output_dbmv).toFixed(1)}</td>
            <td>${tel.work_mode || '-'}</td>
            <td>${tel.dfu_type || '-'}</td>
            <td>${tel.pilot_low_pwr !== undefined ? Number(tel.pilot_low_pwr).toFixed(1) : '-'}</td>
            <td>${tel.pilot_high_pwr !== undefined ? Number(tel.pilot_high_pwr).toFixed(1) : '-'}</td>
            <td>${tel.out_slope !== undefined ? Number(tel.out_slope).toFixed(1) : '-'}</td>
            <td>${tel.usr_pilot_low !== undefined ? Number(tel.usr_pilot_low).toFixed(1) : '-'}</td>
            <td>${tel.usr_pilot_high !== undefined ? Number(tel.usr_pilot_high).toFixed(1) : '-'}</td>
            <td>${tel.pilot_low_freq || '-'}</td>
            <td>${tel.pilot_high_freq || '-'}</td>
            <td style="color: ${alarms.rf_low_unlock ? '#dc3545' : '#444'};">${alarms.rf_low_unlock ? 'Unlock' : 'Lock'}</td>
            <td style="color: ${alarms.rf_high_unlock ? '#dc3545' : '#444'};">${alarms.rf_high_unlock ? 'Unlock' : 'Lock'}</td>
            <td>${alarmBadges}</td>
        </tr>
    `;

    if (!deviceDataHistory[data.eui]) {
        deviceDataHistory[data.eui] = { tableRows: [], timestamps: [], rawObjects: [], power: [[], []], ripple: [[]], rf: [[]] };
    }

    const hist = deviceDataHistory[data.eui];
    hist.tableRows.unshift(newRow);
    hist.rawObjects.push(tel); 

    if (hist.tableRows.length > MAX_HISTORY) {
        hist.tableRows.pop();
        hist.rawObjects.shift(); 
    }

    hist.timestamps.push(timeNow);
    hist.power[0].push(tel.rail_24v); hist.power[1].push(tel.temperature_c);
    hist.ripple[0].push(tel.ripple_24v_mv); hist.rf[0].push(tel.rf_output_dbmv);

    if (hist.timestamps.length > MAX_HISTORY) {
        hist.timestamps.shift(); 
        hist.power.forEach(arr => arr.shift()); 
        hist.ripple.forEach(arr => arr.shift()); 
        hist.rf.forEach(arr => arr.shift());
    }

    if (currentViewEUI === data.eui) {
        document.getElementById('telemetry-body').innerHTML = hist.tableRows.join('');
        
        powerChart.data.labels = hist.timestamps; powerChart.data.datasets[0].data = hist.power[0]; powerChart.data.datasets[1].data = hist.power[1];
        rippleChart.data.labels = hist.timestamps; rippleChart.data.datasets[0].data = hist.ripple[0];
        rfChart.data.labels = hist.timestamps; rfChart.data.datasets[0].data = hist.rf[0];
        powerChart.update(); rippleChart.update(); rfChart.update();
        
        if(document.getElementById('chartModal').style.display === 'flex' && modalChartInstance) {
            const activeKey = modalChartInstance.data.datasets[0].label;
            openModalChart(Object.keys(tel).find(k => activeKey.includes(k) || activeKey.includes('Temp') && k==='temperature_c' || activeKey.includes('24V Rail') && k==='rail_24v' || activeKey.includes('Ripple') && k==='ripple_24v_mv' || activeKey.includes('Output Power') && k==='rf_output_dbmv' || activeKey.includes('Pilot Low Pwr') && k==='pilot_low_pwr' || activeKey.includes('Pilot High Pwr') && k==='pilot_high_pwr' || activeKey.includes('Slope') && k==='out_slope' || activeKey.includes('Usr P-Low') && k==='usr_pilot_low' || activeKey.includes('Usr P-High') && k==='usr_pilot_high'), activeKey);
        }
    }

    var popupHTML = `
        <div class="popup-content">
            <h3>${data.model}</h3>
            <p><strong>EUI:</strong> ${data.eui}</p>
            <p><strong>Status:</strong> <span style="color: ${hasAlarm ? '#dc3545' : '#28a745'}; font-weight: bold;">${hasAlarm ? 'ALARM' : 'Normal'}</span></p>
            <hr>
            <p><strong>24V Rail:</strong> ${Number(tel.rail_24v).toFixed(2)} V</p>
            <p><strong>Temp:</strong> ${tel.temperature_c} °C</p>
            <p><strong>RF Output:</strong> ${Number(tel.rf_output_dbmv).toFixed(1)} dBmV</p>
            <button class="btn-view" onclick="window.openDevicePage('${data.eui}', '${data.model}')">View Detailed Telemetry</button>
        </div>
    `;

    if (markers[data.eui]) {
        markers[data.eui].setIcon(hasAlarm ? warningIcon : onlineIcon);
        markers[data.eui].setPopupContent(popupHTML);
    }

    if (document.getElementById('network-view').style.display === 'flex') renderNetworkGrid();
});

