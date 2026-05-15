// Global Chart Variables
let powerChart, rippleChart, rfChart, modalChartInstance;

function initCharts() {
    const commonOptions = { responsive: true, maintainAspectRatio: false, animation: { duration: 400 }, plugins: { legend: { position: 'top', labels: { boxWidth: 12 } } }, scales: { x: { display: false } } };
    
    const ctxPower = document.getElementById('chartPower').getContext('2d');
    powerChart = new Chart(ctxPower, { type: 'line', data: { labels: [], datasets: [{ label: '24V Rail (V)', borderColor: '#007bff', backgroundColor: 'rgba(0,123,255,0.1)', fill: true, data: [], yAxisID: 'y', tension: 0.2 }, { label: 'Temp (°C)', borderColor: '#dc3545', data: [], yAxisID: 'y1', tension: 0.2 }]}, options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: true, text: 'Power Input & Thermal' } }, scales: { x: { display: false }, y: { type: 'linear', position: 'left', min: 20, max: 30 }, y1: { type: 'linear', position: 'right', min: 0, max: 80, grid: { drawOnChartArea: false } } } } });
    
    const ctxRipple = document.getElementById('chartRipple').getContext('2d');
    rippleChart = new Chart(ctxRipple, { type: 'line', data: { labels: [], datasets: [{ label: '24V Ripple (mV)', borderColor: '#fd7e14', backgroundColor: 'rgba(253,126,20,0.1)', fill: true, data: [], tension: 0.2 }]}, options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: true, text: 'Voltage Stability (Ripple)' } }, scales: { x: { display: false }, y: { min: 0, max: 1000 } } } });
    
    const ctxRF = document.getElementById('chartRF').getContext('2d');
    rfChart = new Chart(ctxRF, { type: 'line', data: { labels: [], datasets: [{ label: 'RF Output (dBmV)', borderColor: '#6f42c1', backgroundColor: 'rgba(111,66,193,0.1)', fill: true, data: [], tension: 0.2 }]}, options: { ...commonOptions, plugins: { ...commonOptions.plugins, title: { display: true, text: 'Total RF Output Power' } }, scales: { x: { display: false }, y: { min: 20, max: 80 } } } });
}

// Initialize the 3 main charts on page load
initCharts(); 

// --- MODAL CHART LOGIC ---
function openModalChart(dataKey, title) {
    if(!currentViewEUI || !deviceDataHistory[currentViewEUI]) return;
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('chartModal').style.display = 'flex';
    
    const hist = deviceDataHistory[currentViewEUI];
    const plotData = hist.rawObjects.map(obj => obj[dataKey]);

    const ctx = document.getElementById('modalCanvas').getContext('2d');
    if(modalChartInstance) modalChartInstance.destroy();
    modalChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: hist.timestamps, datasets: [{ label: title, borderColor: '#38b298', backgroundColor: 'rgba(56, 178, 152, 0.2)', fill: true, data: plotData, tension: 0.2, pointRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: true }, y: { suggestedMin: Math.min(...plotData)-5, suggestedMax: Math.max(...plotData)+5 } } }
    });
}

function closeModal() { 
    document.getElementById('chartModal').style.display = 'none'; 
}

// --- RF SPECTRUM SCANNER LOGIC ---
let spectrumChartInstance;

function openSpectrumModal(eui, sn) {
    document.getElementById('spectrumSubtitle').innerText = `Target S/N: ${sn} | Transponder EUI: ${eui}`;
    document.getElementById('spectrumModal').style.display = 'flex';

    // 1. Generate the Mathematical Spectrum Data (Mimicking the real HFC sweep)
    const labels = [];
    const inputPwr = [];
    const outputPwr = [];

    // Frequencies from 111 MHz to 1785 MHz (6MHz spacing)
for (let f = 111; f <= 1785; f += 6) {
        labels.push(f);
        
        if ((f > 603 && f < 619) || (f > 1111 && f < 1131)) {
            inputPwr.push(null);
            outputPwr.push(null);
        } else {
            // Realistic HFC Sweep: Upward Tilt + Standing Wave (Sine/Cosine) + Micro Noise
            let standingWave = Math.sin(f / 60) * 1.2 + Math.cos(f / 200) * 0.8;
            let microNoise = Math.random() * 0.3 - 0.15;
            
            // Output Power: Steeper tilt, higher baseline
            let outBase = 35 + ((f - 111) / 1674) * 15; 
            outputPwr.push(outBase + standingWave + microNoise);
            
            // Input Power: Flatter tilt, lower baseline, slightly dampened wave
            let inBase = 15 + ((f - 111) / 1674) * 8; 
            inputPwr.push(inBase + (standingWave * 0.8) + microNoise);
        }
    }

    // 2. Render the Dark Mode Chart
    const ctx = document.getElementById('spectrumCanvas').getContext('2d');
    if (spectrumChartInstance) spectrumChartInstance.destroy();

    Chart.defaults.color = '#aaaaaa'; // Dark mode text
    spectrumChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Input Power (輸入)',
                    backgroundColor: '#f1c40f', // Yellow
                    data: inputPwr,
                    barPercentage: 1.0,
                    categoryPercentage: 1.0
                },
                {
                    label: 'Output Power (輸出)',
                    backgroundColor: '#3498db', // Blue
                    data: outputPwr,
                    barPercentage: 1.0,
                    categoryPercentage: 1.0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            scales: {
                x: {
                    grid: { color: '#333' },
                    ticks: { maxTicksLimit: 10 }
                },
                y: {
                    grid: { color: '#333' },
                    min: 0,
                    max: 80,
                    title: { display: true, text: 'Power (dBmV)' }
                }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

function closeSpectrumModal() {
    document.getElementById('spectrumModal').style.display = 'none';
}


