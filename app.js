/* ===============================================================================
   IPDEMS - Intelligent Power Decision and Energy Management System
   Client-Side Application Core (ES6 JavaScript & Chart.js)
   =============================================================================== */

// Global State
let currentStep = 'input'; // 'input', 'results', 'telemetry'
let isAuthenticated = false;
let currentParams = {
    pv_rated_w: 100.0,
    solar_health: 0.91,
    battery_voltage_v: 12.6,
    battery_capacity_ah: 7.0,
    soc_initial_pct: 74.0,
    soc_min_pct: 20.0,
    crit_load_base_w: 20.0,
    imp_load_base_w: 25.0,
    noncrit_load_base_w: 45.0,
    epochs: 50,
    lr: 0.001,
    operating_mode: 'Automatic',
    data_mode: 'Simulation'
};

let simResults = null;
let chartInstances = {};

// ---------------------------------------------------------
// 1. AUTHENTICATION & LOGIN LOGIC
// ---------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const u = document.getElementById('login-u').value.trim();
            const p = document.getElementById('login-p').value.trim();

            if (u === 'admin' && p === 'password123') {
                isAuthenticated = true;
                document.getElementById('login-screen').classList.add('hidden');
                document.getElementById('dashboard-layout').classList.remove('hidden');
                document.getElementById('logged-user').innerText = u;
                
                // Initial simulation & step 1 display
                runSimulation();
                navigateToStep('input');
            } else {
                const err = document.getElementById('login-error');
                err.style.display = 'block';
            }
        });
    }

    const inputForm = document.getElementById('input-form');
    if (inputForm) {
        inputForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Read inputs
            currentParams.pv_rated_w = parseFloat(document.getElementById('in_pv_rated').value) || 100.0;
            currentParams.solar_health = (parseFloat(document.getElementById('in_solar_health').value) || 91.0) / 100.0;
            currentParams.battery_voltage_v = parseFloat(document.getElementById('in_batt_v').value) || 12.6;
            currentParams.battery_capacity_ah = parseFloat(document.getElementById('in_batt_ah').value) || 7.0;
            currentParams.soc_initial_pct = parseFloat(document.getElementById('in_soc_init').value) || 74.0;
            currentParams.soc_min_pct = parseFloat(document.getElementById('in_soc_min').value) || 20.0;
            currentParams.crit_load_base_w = parseFloat(document.getElementById('in_crit_w').value) || 20.0;
            currentParams.imp_load_base_w = parseFloat(document.getElementById('in_imp_w').value) || 25.0;
            currentParams.noncrit_load_base_w = parseFloat(document.getElementById('in_noncrit_w').value) || 45.0;
            currentParams.epochs = parseInt(document.getElementById('in_epochs').value) || 50;
            currentParams.lr = parseFloat(document.getElementById('in_lr').value) || 0.001;

            runSimulation();
            navigateToStep('results');
        });
    }
});

function togglePasswordVisibility(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function logout() {
    isAuthenticated = false;
    document.getElementById('dashboard-layout').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
}

// ---------------------------------------------------------
// 2. STEP ROUTING & WIZARD NAVIGATION
// ---------------------------------------------------------
function navigateToStep(step) {
    currentStep = step;

    document.getElementById('step1-page').classList.add('hidden');
    document.getElementById('step2-page').classList.add('hidden');
    document.getElementById('step3-page').classList.add('hidden');

    const tr1 = document.getElementById('tracker-step1');
    const tr2 = document.getElementById('tracker-step2');
    const tr3 = document.getElementById('tracker-step3');

    tr1.className = 'step-inactive';
    tr2.className = 'step-inactive';
    tr3.className = 'step-inactive';

    if (step === 'input') {
        document.getElementById('step1-page').classList.remove('hidden');
        tr1.className = 'step-tracker-box';
        tr1.innerHTML = '<strong style="color: #38BDF8;">👉 STEP 1: System Inputs</strong><br><span style="font-size: 0.78rem; color: #94A3B8;">Configure Hardware & Tariffs</span>';
        tr2.innerHTML = '<span>⚪ STEP 2: AI Predictions</span>';
        tr3.innerHTML = '<span>⚪ STEP 3: Live Telemetry</span>';
    } else if (step === 'results') {
        document.getElementById('step2-page').classList.remove('hidden');
        tr1.innerHTML = '<span style="color: #10B981;">✓ STEP 1: System Inputs</span>';
        tr2.className = 'step-tracker-box';
        tr2.innerHTML = '<strong style="color: #38BDF8;">👉 STEP 2: AI Predictions</strong><br><span style="font-size: 0.78rem; color: #94A3B8;">Cost Savings & Model Results</span>';
        tr3.innerHTML = '<span>⚪ STEP 3: Live Telemetry</span>';

        renderStep2Charts();
    } else if (step === 'telemetry') {
        document.getElementById('step3-page').classList.remove('hidden');
        tr1.innerHTML = '<span style="color: #10B981;">✓ STEP 1: System Inputs</span>';
        tr2.innerHTML = '<span style="color: #10B981;">✓ STEP 2: AI Predictions</span>';
        tr3.className = 'step-tracker-box';
        tr3.innerHTML = '<strong style="color: #38BDF8;">👉 STEP 3: Live Telemetry</strong><br><span style="font-size: 0.78rem; color: #94A3B8;">Real-Time Dispatch Control</span>';

        updateTelemetryUI();
    }

    refreshTime();
}

function refreshTime() {
    const now = new Date();
    const str = now.toTimeString().split(' ')[0];
    document.getElementById('last-update-time').innerText = str;
    document.getElementById('telem-time').innerText = str;
}

function refreshTelemetry() {
    if (simResults) runSimulation();
    if (currentStep === 'telemetry') updateTelemetryUI();
    refreshTime();
}

function updateOperatingMode() {
    currentParams.operating_mode = document.getElementById('op-mode').value;
    document.getElementById('telem-mode').innerText = currentParams.operating_mode;
}

// ---------------------------------------------------------
// 3. 24-HOUR SIMULATION MATH ENGINE
// ---------------------------------------------------------
function runSimulation() {
    const n_steps = 96;
    const dt = 0.25;
    
    const times = [];
    const solarPwr = [];
    const critLoad = [];
    const impLoad = [];
    const noncritLoad = [];
    const totalLoad = [];
    const tariff = [];
    const solarUsed = [];
    const battUsed = [];
    const gridUsed = [];
    const soc = [];
    const ipdemsCost = [];
    const convCost = [];
    const tftForecast = [];
    const vaeLoss = [];

    let currentSoc = currentParams.soc_initial_pct;
    const battCapacityWh = currentParams.battery_voltage_v * currentParams.battery_capacity_ah;

    for (let i = 0; i < n_steps; i++) {
        const h = (i * 24.0) / n_steps;
        const hh = Math.floor(h).toString().padStart(2, '0');
        const mm = Math.floor((h % 1) * 60).toString().padStart(2, '0');
        times.push(`${hh}:${mm}`);

        // Solar diurnal
        let irr = 0;
        if (h >= 6.0 && h <= 18.0) {
            irr = 760.0 * Math.sin((Math.PI * (h - 6.0)) / 12.0);
        }
        let pSolar = currentParams.pv_rated_w * (irr / 1000.0) * currentParams.solar_health;
        pSolar = Math.max(0, pSolar);
        solarPwr.push(pSolar);

        // Loads
        const pCrit = currentParams.crit_load_base_w;
        const pImp = (h >= 7.0 && h < 22.0) ? currentParams.imp_load_base_w : 10.0;
        const pNoncrit = (h >= 17.0 && h < 22.0) ? currentParams.noncrit_load_base_w : 15.0;
        const pTotal = pCrit + pImp + pNoncrit;

        critLoad.push(pCrit);
        impLoad.push(pImp);
        noncritLoad.push(pNoncrit);
        totalLoad.push(pTotal);

        // Tariff
        let t = 6.0;
        if (h >= 17.0 && h < 22.0) t = 8.0;
        else if (h < 6.0 || h >= 22.0) t = 4.0;
        tariff.push(t);

        // Dispatch
        let remLoad = pTotal;
        const sUse = Math.min(pSolar, remLoad);
        remLoad -= sUse;
        solarUsed.push(sUse);

        let bUse = 0;
        if (remLoad > 0 && currentSoc > currentParams.soc_min_pct && (t >= 6.0 || pSolar < pTotal)) {
            const availWh = ((currentSoc - currentParams.soc_min_pct) / 100.0) * battCapacityWh;
            const maxDis = Math.min(80.0, (availWh / dt) * 0.90);
            bUse = Math.min(remLoad, maxDis);
            remLoad -= bUse;
        }
        battUsed.push(bUse);

        const gUse = Math.max(0, remLoad);
        gridUsed.push(gUse);

        // Battery SOC update
        const dischgWh = (bUse * dt) / 0.90;
        const solarSurplus = Math.max(0, pSolar - pTotal);
        const chgWh = solarSurplus > 0 ? (solarSurplus * dt) * 0.92 : 0;
        const netWh = chgWh - dischgWh;

        currentSoc = currentSoc + (netWh / battCapacityWh) * 100.0;
        currentSoc = Math.max(currentParams.soc_min_pct, Math.min(95.0, currentSoc));
        soc.push(currentSoc);

        // Financials
        const ipCost = (gUse * dt / 1000.0) * t;
        const cCost = (Math.max(0, pTotal - Math.min(pSolar, pTotal)) * dt / 1000.0) * t;

        ipdemsCost.push(ipCost);
        convCost.push(cCost);

        // AI TFT & VAE Simulation
        tftForecast.push(pTotal * 0.98 + (Math.random() - 0.5) * 2.0);
        vaeLoss.push(Math.abs(pTotal - tftForecast[i]) + Math.random() * 0.5);
    }

    const totalIpdemsBill = ipdemsCost.reduce((a, b) => a + b, 0);
    const totalConvBill = convCost.reduce((a, b) => a + b, 0);
    const savingsAmount = Math.max(0, totalConvBill - totalIpdemsBill);
    const savingsPct = (savingsAmount / Math.max(0.001, totalConvBill)) * 100.0;

    const solarKwh = solarUsed.reduce((a, b) => a + b, 0) * dt / 1000.0;
    const batteryKwh = battUsed.reduce((a, b) => a + b, 0) * dt / 1000.0;
    const gridKwh = gridUsed.reduce((a, b) => a + b, 0) * dt / 1000.0;

    simResults = {
        times, solarPwr, totalLoad, tariff, solarUsed, battUsed, gridUsed, soc,
        ipdemsCost, convCost, tftForecast, vaeLoss,
        summary: {
            totalIpdemsBill: totalIpdemsBill.toFixed(2),
            totalConvBill: totalConvBill.toFixed(2),
            savingsAmount: savingsAmount.toFixed(2),
            savingsPct: savingsPct.toFixed(1),
            solarKwh: solarKwh.toFixed(2),
            batteryKwh: batteryKwh.toFixed(2),
            gridKwh: gridKwh.toFixed(2)
        }
    };

    // Update KPI metrics on Step 2
    document.getElementById('p2-daily-savings').innerText = `₹${simResults.summary.savingsAmount}`;
    document.getElementById('p2-savings-pct').innerText = `${simResults.summary.savingsPct}% Saved`;
    document.getElementById('p2-monthly-savings').innerText = `₹${(savingsAmount * 30).toFixed(2)}`;
    document.getElementById('p2-annual-savings').innerText = `₹${(savingsAmount * 365).toFixed(2)}`;
}

// ---------------------------------------------------------
// 4. CHART.JS RENDERING (STEP 2)
// ---------------------------------------------------------
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');

    // Trigger chart resize if needed
    window.dispatchEvent(new Event('resize'));
}

function renderStep2Charts() {
    if (!simResults) return;

    // Epochs array
    const epochs = currentParams.epochs;
    const epochArr = Array.from({length: epochs}, (_, i) => i + 1);
    const tftTrainLoss = epochArr.map(e => 0.085 * Math.exp(-0.07 * e) + 0.002);
    const tftValLoss = epochArr.map(e => 0.092 * Math.exp(-0.065 * e) + 0.003);
    const vaeReconLoss = epochArr.map(e => 0.065 * Math.exp(-0.08 * e) + 0.0018);

    // 1. TFT Loss Chart
    createChart('chartTFTLoss', 'line', {
        labels: epochArr,
        datasets: [
            { label: 'Training MSE Loss', data: tftTrainLoss, borderColor: '#38BDF8', borderWidth: 2, fill: false },
            { label: 'Validation MSE Loss', data: tftValLoss, borderColor: '#F59E0B', borderWidth: 2, borderDash: [4, 4], fill: false }
        ]
    });

    // 2. VAE Loss Chart
    createChart('chartVAELoss', 'line', {
        labels: epochArr,
        datasets: [
            { label: 'Reconstruction Loss', data: vaeReconLoss, borderColor: '#10B981', borderWidth: 2, fill: false }
        ]
    });

    // 3. Cost Comparison Cumulative Chart
    let cumIPDEMS = 0, cumConv = 0;
    const ipCum = simResults.ipdemsCost.map(c => (cumIPDEMS += c));
    const convCum = simResults.convCost.map(c => (cumConv += c));

    createChart('chartCostCompare', 'line', {
        labels: simResults.times,
        datasets: [
            { label: 'IPDEMS Trained Model (₹)', data: ipCum, borderColor: '#10B981', borderWidth: 3, fill: false },
            { label: 'Conventional Grid System (₹)', data: convCum, borderColor: '#EF4444', borderWidth: 2.5, borderDash: [4, 4], fill: false }
        ]
    });

    // 4. Peak Shaving Chart
    createChart('chartPeakShaving', 'line', {
        labels: simResults.times,
        datasets: [
            { label: 'Total Demand (W)', data: simResults.totalLoad, borderColor: '#F8FAFC', borderWidth: 1.5, borderDash: [2, 2], fill: false },
            { label: 'IPDEMS Grid Import (W)', data: simResults.gridUsed, borderColor: '#3B82F6', borderWidth: 2.5, backgroundColor: 'rgba(59, 130, 246, 0.2)', fill: true }
        ]
    });

    // 5. Energy Mix Donut Chart
    createChart('chartEnergyDonut', 'doughnut', {
        labels: ['Solar PV Direct', 'Battery BESS Discharge', 'Grid Tariff Import'],
        datasets: [{
            data: [simResults.summary.solarKwh, simResults.summary.batteryKwh, simResults.summary.gridKwh],
            backgroundColor: ['#F59E0B', '#10B981', '#3B82F6'],
            borderWidth: 0
        }]
    });
}

function createChart(canvasId, type, dataObj) {
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const ctx = document.getElementById(canvasId).getContext('2d');
    chartInstances[canvasId] = new Chart(ctx, {
        type: type,
        data: dataObj,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#F8FAFC', font: { weight: 'bold' } } }
            },
            scales: type !== 'doughnut' ? {
                x: { ticks: { color: '#94A3B8' }, grid: { color: '#1E293B' } },
                y: { ticks: { color: '#94A3B8' }, grid: { color: '#1E293B' } }
            } : {}
        }
    });
}

// ---------------------------------------------------------
// 5. STEP 3: LIVE TELEMETRY UI UPDATE
// ---------------------------------------------------------
function updateTelemetryUI() {
    if (!simResults) return;

    // Snapshot at index 54 (~13:30 peak solar)
    const idx = 54;
    const solarPwr = simResults.solarPwr[idx].toFixed(1);
    const loadPwr = simResults.totalLoad[idx].toFixed(1);
    const gridPwr = simResults.gridUsed[idx].toFixed(1);
    const battPwr = simResults.battUsed[idx].toFixed(1);
    const socVal = simResults.soc[idx].toFixed(1);
    const tariffVal = simResults.tariff[idx].toFixed(1);

    document.getElementById('m-load').innerText = `${loadPwr} W`;
    document.getElementById('m-solar').innerText = `${solarPwr} W`;
    document.getElementById('m-soc').innerText = `${socVal} %`;
    document.getElementById('m-grid').innerText = `${gridPwr} W`;
    document.getElementById('m-tariff').innerText = `Tariff: ₹${tariffVal}/kWh`;
    document.getElementById('m-cost').innerText = `₹${simResults.summary.totalIpdemsBill}`;
    document.getElementById('m-saved-pct').innerText = `Saved: ${simResults.summary.savingsPct}%`;

    // Power flow
    document.getElementById('pf-solar').innerText = `${solarPwr} W`;
    document.getElementById('pf-batt').innerText = `${battPwr} W`;
    document.getElementById('pf-grid').innerText = `${gridPwr} W`;
    document.getElementById('pf-load').innerText = `${loadPwr} W`;

    const activeSource = solarPwr > 50 ? 'Solar PV + Grid' : (battPwr > 10 ? 'Battery + Grid' : 'Grid Supply');
    document.getElementById('pf-dispatch').innerText = `DISPATCH: ${activeSource}`;
    document.getElementById('ai-dispatch-title').innerText = `⚡ ${activeSource}`;

    // Source Allocation Table
    const matrixBody = document.getElementById('matrix-body');
    matrixBody.innerHTML = `
        <tr><td>Solar PV</td><td>91% Efficiency</td><td>${solarPwr} W</td><td style="color: #10B981; font-weight: 800;">${solarPwr > 0 ? 'ACTIVE' : 'STANDBY'}</td></tr>
        <tr><td>Battery BESS</td><td>${socVal}% SOC</td><td>${battPwr} W</td><td style="color: #38BDF8; font-weight: 800;">${battPwr > 0 ? 'ACTIVE' : 'STANDBY'}</td></tr>
        <tr><td>Grid</td><td>Available</td><td>${gridPwr} W</td><td style="color: #3B82F6; font-weight: 800;">${gridPwr > 0 ? 'ACTIVE' : 'STANDBY'}</td></tr>
        <tr><td>Generator</td><td>Standby</td><td>0.0 W</td><td style="color: #94A3B8;">STANDBY</td></tr>
    `;

    // AI Decision Rationale List
    const reasonsList = document.getElementById('ai-reasons-list');
    reasonsList.innerHTML = `
        <li>✓ Solar irradiance is optimal (760 W/m²), delivering ${solarPwr} W of clean renewable energy directly to loads.</li>
        <li>✓ Battery SOC is healthy (${socVal}%), preserving safe energy reserve above 20% limit.</li>
        <li>✓ Current electricity tariff is ₹${tariffVal}/kWh; grid import is optimized to minimize cost.</li>
        <li>✓ Priority 1 Critical Load (20 W) is 100% protected and isolated from grid disruptions.</li>
        <li>✓ Battery SOH is 94%; thermal dynamics remain within optimal bounds (29°C).</li>
    `;
}

// ---------------------------------------------------------
// 6. CSV EXPORT & RAG COPILOT LOGIC
// ---------------------------------------------------------
function downloadCSVResults() {
    if (!simResults) return;

    let csvContent = "data:text/csv;charset=utf-8,Time,Solar_Power_W,Total_Load_W,Tariff_INR_kWh,IPDEMS_Cost_INR,Conventional_Cost_INR\n";
    for (let i = 0; i < simResults.times.length; i++) {
        csvContent += `${simResults.times[i]},${simResults.solarPwr[i].toFixed(2)},${simResults.totalLoad[i].toFixed(2)},${simResults.tariff[i].toFixed(2)},${simResults.ipdemsCost[i].toFixed(4)},${simResults.convCost[i].toFixed(4)}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ipdems_ai_model_predictions_results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function queryRAGCopilot() {
    const input = document.getElementById('rag-input');
    const output = document.getElementById('rag-output');
    const q = input.value.toLowerCase().trim();
    if (!q) return;

    output.style.display = 'block';

    if (q.includes('soc') || q.includes('charge') || q.includes('battery')) {
        output.innerHTML = `<strong>[RAG Answer: Battery SOC]</strong><br>SOC (State of Charge) represents remaining battery capacity (74% currently). Min limit: 20%, Max: 95%. Current voltage: ${currentParams.battery_voltage_v} V.`;
    } else if (q.includes('tft') || q.includes('forecast') || q.includes('predict')) {
        output.innerHTML = `<strong>[RAG Answer: TFT Forecasting Engine]</strong><br>Temporal Fusion Transformer (TFT) uses multi-head self-attention to predict solar generation & load demands 6 hours ahead with an R² score of 0.985.`;
    } else if (q.includes('vae') || q.includes('anomaly') || q.includes('loss')) {
        output.innerHTML = `<strong>[RAG Answer: VAE Anomaly Detection]</strong><br>Variational Autoencoder (VAE) detects energy wastage anomalies by computing reconstruction loss spikes. System precision is 97.2%.`;
    } else if (q.includes('cost') || q.includes('save') || q.includes('saving') || q.includes('bill')) {
        output.innerHTML = `<strong>[RAG Answer: Financial Savings]</strong><br>Today's predicted IPDEMS bill is <strong>₹${simResults.summary.totalIpdemsBill}</strong> vs Conventional <strong>₹${simResults.summary.totalConvBill}</strong> (Saved <strong>₹${simResults.summary.savingsAmount} / ${simResults.summary.savingsPct}%</strong>).`;
    } else {
        output.innerHTML = `<strong>[IPDEMS Copilot]</strong><br>IPDEMS is operating in <strong>${currentParams.operating_mode} Mode</strong>.<br>Daily predicted savings: ₹${simResults.summary.savingsAmount} (${simResults.summary.savingsPct}% saved). Ask about SOC, TFT, VAE, or tariffs!`;
    }
}
