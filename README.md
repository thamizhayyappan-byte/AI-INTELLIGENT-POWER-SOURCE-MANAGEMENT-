# ⚡ IPDEMS - Intelligent Power Decision & Energy Management System

**Adaptive Multi-Source Energy Management Platform**

This standalone web application runs 100% in the browser (**HTML5, CSS3, ES6 JavaScript, Chart.js**) without requiring Python or Streamlit. It can be hosted for free on **GitHub Pages** to get a public shareable URL.

---

## 🌟 Key Features

1. **🔐 Login / Authentication Screen**: Secure credentials (`admin` / `password123`) with show/hide password toggle.
2. **🎛️ Step 1: User Input & System Configuration**: Custom hardware inputs (Solar PV capacity, Battery Ah/Voltage, Tariffs, Load Demands, AI Epochs/Learning Rate).
3. **📈 Step 2: AI Predictions & Cost Savings Results**:
   - 5 KPI metric cards (Daily, Monthly, Annual savings, TFT R² 98.5%, VAE Precision 97.2%).
   - 4 Interactive tabs: TFT & VAE Epoch Loss curves, 24-Hour Cost Comparison chart, Peak-Shaving area chart, Energy Mix donut chart, CSV data download, and RAG Copilot assistant.
4. **⚡ Step 3: Live Telemetry & Control Center**: Real-time Power Flow Schematic, top 6 KPI cards, AI decision rationale explainer, and priority load shedding toggles.

---

## 🚀 How to Publish to GitHub Pages & Get a Public Link

Follow these steps to upload the dashboard to GitHub and publish it online:

### Step 1: Initialize Git in your folder
Open Command Prompt / Terminal in this folder:
```cmd
cd /d C:\Users\thami\.gemini\antigravity\scratch\ipdems_dashboard
git init
git add .
git commit -m "Deploy IPDEMS Standalone Web App"
```

### Step 2: Create a Repository on GitHub
1. Go to [GitHub.com](https://github.com) and click **New Repository**.
2. Name your repository (e.g. `ipdems-dashboard`).
3. Keep it **Public** and do not add a README (since we already have one). Click **Create repository**.

### Step 3: Push code to GitHub
Run the following commands in Command Prompt (replace `YOUR-USERNAME` with your GitHub username):
```cmd
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/ipdems-dashboard.git
git push -u origin main
```

### Step 4: Enable GitHub Pages
1. On your GitHub repository page, click **Settings** (top tab).
2. On the left sidebar, click **Pages**.
3. Under **Build and deployment > Branch**:
   - Select **`main`** branch and **`/(root)`** folder.
   - Click **Save**.
4. Wait 1–2 minutes! GitHub will generate your live public link:
   👉 **`https://YOUR-USERNAME.github.io/ipdems-dashboard/`**

---

## 💻 Local Offline Usage

You can also run the app offline anytime by double-clicking `index.html` in Windows Explorer or opening it directly in Chrome/Edge/Firefox!
