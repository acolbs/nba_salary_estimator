// ---------------- Constants ----------------
let players = [];
let roster = [];
const SALARY_CAP = 150_000_000;

// ---------------- Utility Functions ----------------
function money(n) {
    return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function calculateValuePct(realSalary, estimatedSalary) {
    if (!estimatedSalary || estimatedSalary === 0) return 0;
    return ((realSalary - estimatedSalary) / estimatedSalary) * 100;
}

function getValueColor(valuePct) {
    if (valuePct < -20) return "excellent-value";
    if (valuePct < -10) return "good-value";
    if (valuePct < 10) return "fair-value";
    if (valuePct < 20) return "overpaid";
    return "very-overpaid";
}

function formatValuePct(valuePct) {
    const sign = valuePct > 0 ? "+" : "";
    return `${sign}${valuePct.toFixed(1)}%`;
}

// ---------------- CSV Loading ----------------
function loadCSV() {
    Papa.parse("ACE_MODEL.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(data) {
            players = data.data.map(p => {
                const salary = Number((p.SALARY || "").replace(/["$,\s]/g, '').trim());
                const ace = Number((p.ACE || "").replace(/["$,\s]/g, '').trim());
                const valuePct = calculateValuePct(salary, ace);

                return {
                    Player: (p.Player || "").trim(),
                    Tm: (p.Team || p.Tm || "").trim(),
                    Pos: (p.Pos || "").trim(),
                    SALARY: isNaN(salary) ? 0 : salary,
                    ACE: isNaN(ace) ? 0 : ace,
                    ValuePct: valuePct
                };
            }).filter(p => p.Player && p.SALARY > 0 && p.ACE > 0);

            // sensible default sort: by ACE descending
            players.sort((a, b) => b.ACE - a.ACE);

            renderPlayers();
            updateCap();
            updateRosterSummary();
            renderSalaryChart();
            // precompute GM rankings for the tab
            renderGMRankings();
        },
        error: function(err) {
            console.error("CSV load error:", err);
        }
    });
}

// ---------------- GM CSV LOADING ----------------
let gmData = {}; // team -> GM name

function loadGMCSV() {
    Papa.parse("gms.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(data) {
            data.data.forEach(row => {
                const team = (row.Team || "").trim();
                const GM = (row.GM || "").trim() || "Unknown";
                if (team) gmData[team] = GM;
            });

            // re-render rankings after GM list loads
            renderGMRankings();
        }
    });
}

// ---------------- Render Functions ----------------
function renderPlayers(list = players) {
    const tbody = document.querySelector("#playersTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    list.forEach(p => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${p.Player}</td>
            <td>${p.Tm || "N/A"}</td>
            <td>${p.Pos || "N/A"}</td>
            <td>${money(p.SALARY)}</td>
            <td>${money(p.ACE)}</td>
            <td class="${getValueColor(p.ValuePct)}" title="Real: ${money(p.SALARY)} | ACE: ${money(p.ACE)}">${formatValuePct(p.ValuePct)}</td>
            <td><button class="add" onclick="addPlayerObj('${p.Player.replace(/'/g, "\\'")}')">Add</button></td>
        `;
        tbody.appendChild(tr);
    });

    renderSalaryChart();
}

function renderRoster() {
    const tbody = document.querySelector("#rosterTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    roster.forEach((p, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${p.Player}</td>
            <td>${p.Tm}</td>
            <td>${p.Pos || "N/A"}</td>
            <td>${money(p.SALARY)}</td>
            <td>${money(p.ACE)}</td>
            <td class="${getValueColor(p.ValuePct)}" title="Real: ${money(p.SALARY)} | ACE: ${money(p.ACE)}">${formatValuePct(p.ValuePct)}</td>
            <td><button class="remove" onclick="removePlayer(${i})">X</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// ---------------- Player Manipulation ----------------
function addPlayerObj(playerName) {
    const index = players.findIndex(p => p.Player === playerName);
    if (index === -1) return;

    const player = players[index];
    const used = roster.reduce((t, p) => t + p.ACE, 0);

    if (roster.length >= 10) return alert("Roster is full!");
    if (used + player.ACE > SALARY_CAP) return alert("Not enough cap space!");

    roster.push(player);
    players.splice(index, 1);

    renderPlayers();
    renderRoster();
    updateCap();
    updateRosterSummary();
    renderGMRankings(); // team rankings may change if you treat roster differently
}

function removePlayer(i) {
    const player = roster[i];
    roster.splice(i, 1);

    players.push(player);
    players.sort((a, b) => b.ACE - a.ACE);

    renderPlayers();
    renderRoster();
    updateCap();
    updateRosterSummary();
    renderGMRankings();
}

// ---------------- Cap ----------------
function updateCap() {
    const used = roster.reduce((t, p) => t + p.ACE, 0);
    const el = document.getElementById("capRemaining");
    if (el) el.textContent = money(SALARY_CAP - used);
}

// ---------------- Filters ----------------
function applyFilters() {
    const queryEl = document.getElementById("searchPlayer");
    const query = queryEl ? queryEl.value.toLowerCase() : "";
    const salaryOperator = document.getElementById("salaryOperator").value;
    const salaryValue = Number(document.getElementById("salaryValue").value);
    const valueFilter = document.getElementById("valueFilter").value;
    const positions = Array.from(document.querySelectorAll("#positionFilter input[type='checkbox']"))
        .filter(cb => cb.checked).map(cb => cb.value);

    let filtered = [...players];

    if (query) filtered = filtered.filter(p => p.Player.toLowerCase().includes(query));
    if (!isNaN(salaryValue) && salaryValue > 0) {
        filtered = filtered.filter(p => salaryOperator === ">=" ? p.ACE >= salaryValue : p.ACE <= salaryValue);
    }
    if (positions.length) filtered = filtered.filter(p => positions.includes(p.Pos));

    if (valueFilter !== "all") {
        filtered = filtered.filter(p => {
            if (valueFilter === "underpaid") return p.ValuePct < -10;
            if (valueFilter === "fair") return p.ValuePct >= -10 && p.ValuePct <= 10;
            if (valueFilter === "overpaid") return p.ValuePct > 10;
            return true;
        });
    }

    if (valueFilter === "underpaid") filtered.sort((a, b) => a.ValuePct - b.ValuePct);
    else if (valueFilter === "overpaid") filtered.sort((a, b) => b.ValuePct - a.ValuePct);

    renderPlayers(filtered);
}

function resetFilters() {
    const salaryValueEl = document.getElementById("salaryValue");
    if (salaryValueEl) salaryValueEl.value = "";
    document.getElementById("salaryOperator").value = ">=";
    document.getElementById("valueFilter").value = "all";
    document.querySelectorAll("#positionFilter input[type='checkbox']").forEach(cb => cb.checked = false);
    const searchEl = document.getElementById("searchPlayer");
    if (searchEl) searchEl.value = "";
    renderPlayers();
}

// ---------------- Roster Summary ----------------
function updateRosterSummary() {
    const count = pos => roster.filter(p => p.Pos === pos).length;
    document.getElementById("totalPlayers").textContent = roster.length;
    document.getElementById("pgCount").textContent = count("PG");
    document.getElementById("sgCount").textContent = count("SG");
    document.getElementById("sfCount").textContent = count("SF");
    document.getElementById("pfCount").textContent = count("PF");
    document.getElementById("cCount").textContent = count("C");

    const avgValueEl = document.getElementById("avgValue");
    if (roster.length > 0) {
        const avgValue = roster.reduce((sum, p) => sum + p.ValuePct, 0) / roster.length;
        avgValueEl.textContent = formatValuePct(avgValue);
        avgValueEl.className = getValueColor(avgValue);
    } else {
        avgValueEl.textContent = "0.0%";
        avgValueEl.className = "";
    }
}

// ---------------- Salary Chart ----------------
// ---------------- Salary Chart ----------------
function renderSalaryChart() {
    const canvas = document.getElementById('salaryChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const dataPoints = players.map(p => ({
        x: p.SALARY,
        y: p.ACE,
        label: p.Player
    }));

    if (window.salaryChartInstance) window.salaryChartInstance.destroy();

    // Determine diagonal line slope for salary = value
    const maxSalary = Math.max(...dataPoints.map(p => p.x)) * 1.1;
    const maxACE = Math.max(...dataPoints.map(p => p.y)) * 1.1;

    window.salaryChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Player Salary vs ACE',
                data: dataPoints,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: c => `${c.raw.label}: Real ${money(c.raw.x)}, ACE ${money(c.raw.y)}`
                    }
                }
            },
            scales: {
                x: { 
                    title: { display: true, text: 'Current Salary' },
                    ticks: { callback: value => `$${(value/1e6).toFixed(1)}M` },
                    min: 0,
                    max: maxSalary
                },
                y: { 
                    title: { display: true, text: 'ACE Estimated Salary' },
                    ticks: { callback: value => `$${(value/1e6).toFixed(1)}M` },
                    min: 0,
                    max: maxACE
                }
            },
            animation: false
        },
        plugins: [{
            id: 'breakEvenShading',
            beforeDatasetsDraw(chart) {
                const {ctx, chartArea: {left, top, right, bottom}, scales: {x, y}} = chart;
                const maxXY = Math.max(maxSalary, maxACE);

                ctx.save();

                // GREEN shading ABOVE the line (underpaid players - good value)
                ctx.fillStyle = 'rgba(0,200,0,0.15)';
                ctx.beginPath();
                ctx.moveTo(left, top);
                ctx.lineTo(x.getPixelForValue(maxXY), y.getPixelForValue(maxXY));
                ctx.lineTo(x.getPixelForValue(0), y.getPixelForValue(0));
                ctx.lineTo(left, y.getPixelForValue(0));
                ctx.closePath();
                ctx.fill();

                // RED shading BELOW the line (overpaid players)
                ctx.fillStyle = 'rgba(200,0,0,0.15)';
                ctx.beginPath();
                ctx.moveTo(x.getPixelForValue(0), y.getPixelForValue(0));
                ctx.lineTo(x.getPixelForValue(maxXY), y.getPixelForValue(maxXY));
                ctx.lineTo(right, bottom);
                ctx.lineTo(x.getPixelForValue(0), bottom);
                ctx.closePath();
                ctx.fill();

                // Diagonal line (draw AFTER shading so it's on top)
                ctx.beginPath();
                ctx.moveTo(x.getPixelForValue(0), y.getPixelForValue(0));
                ctx.lineTo(x.getPixelForValue(maxXY), y.getPixelForValue(maxXY));
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 4;
                ctx.stroke();

                ctx.restore();
            }
        }]
    });
}

// ---------------- GM Rankings ----------------
function renderGMRankings() {
    // Build mapping of team -> {count, totalValue}
    const teamMap = {};

    function cleanTeam(t) {
        return (t || "Unknown")
            .replace(/\s*\d+TM/gi, "") // remove 2TM, 3TM, etc.
            .trim();
    }

    [...players, ...roster].forEach(p => {
        const team = cleanTeam(p.Tm);

        // Skip empty-team results so the "Unknown / 49 players" row disappears
        if (!team) return;

        if (!teamMap[team]) teamMap[team] = { count: 0, totalValue: 0 };
        teamMap[team].count++;
        teamMap[team].totalValue += p.ValuePct;
    });

    let rankings = Object.entries(teamMap).map(([team, data]) => {
        const GM = gmData[team] || "Unknown";
        const avgValue = data.count ? data.totalValue / data.count : 0;
        return { team, GM, count: data.count, avgValue };
    });

    // Sort by avgValue first; tie-break by players counted (descending)
    rankings.sort((a, b) => {
    const aVal = Math.round(a.avgValue * 10) / 10; // round to 1 decimal place
    const bVal = Math.round(b.avgValue * 10) / 10;
    if (aVal === bVal) {
        return b.count - a.count; // more players higher
    }
    return aVal - bVal;
});




    const tbody = document.querySelector("#gmTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    rankings.forEach((r, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${r.GM}</td>
            <td>${r.team}</td>
            <td>${r.count}</td>
            <td class="${getValueColor(r.avgValue)}">${formatValuePct(r.avgValue)}</td>
        `;
        tbody.appendChild(tr);
    });
}




// ---------------- Tabs ----------------
function openTab(tabId, btn) {
    document.querySelectorAll(".tabcontent").forEach(c => c.style.display = "none");
    document.querySelectorAll(".tablink").forEach(b => b.classList.remove("active"));

    const tab = document.getElementById(tabId);
    if (tab) tab.style.display = "block";
    if (btn) btn.classList.add("active");

    if (tabId === "graphTab" && window.salaryChartInstance) window.salaryChartInstance.update();
    if (tabId === "gmTab") renderGMRankings();
    if (tabId === "teamPieTab") renderTeamPieCharts();
}

// ---------------- Event Listeners ----------------
function attachEventListeners() {
    const searchEl = document.getElementById("searchPlayer");
    if (searchEl) searchEl.addEventListener("input", applyFilters);

    const applyBtn = document.getElementById("applyFiltersBtn");
    if (applyBtn) applyBtn.addEventListener("click", applyFilters);

    const resetBtn = document.getElementById("resetFiltersBtn");
    if (resetBtn) resetBtn.addEventListener("click", resetFilters);
}

window.addEventListener("DOMContentLoaded", () => {
    attachEventListeners();
    loadCSV();      // loads players
    loadGMCSV();    // loads GMs
    const firstBtn = document.querySelector(".tablink");
    if (firstBtn) firstBtn.click();
});

// ---------------- Team Pie Charts ----------------
function renderTeamPieCharts() {
    const container = document.getElementById('teamPieCharts');
    if (!container) return;
    container.innerHTML = ""; // Clear old charts

    // Fixed bright color palette
    const brightColors = [
        "#FF4C4C", "#FFA500", "#FFD700", "#32CD32", "#008000",
        "#00CED1", "#00FFFF", "#87CEEB", "#0000FF", "#800080",
        "#FF00FF", "#FF69B4", "#A52A2A", "#FFD700", "#FF8C00"
    ];

    // Group players by team
    const teamMap = {};
    [...players, ...roster].forEach(p => {
        const team = (p.Tm || "Unknown").replace(/\s*\d+TM/gi, "").trim();
        if (!team || team === "Unknown") return;
        if (!teamMap[team]) teamMap[team] = [];
        teamMap[team].push(p);
    });

    Object.entries(teamMap).forEach(([team, teamPlayers]) => {
        const labels = teamPlayers.map(p => p.Player);

        // Percentages for pie charts
        const totalSalary = teamPlayers.reduce((sum, p) => sum + p.SALARY, 0);
        const totalACE = teamPlayers.reduce((sum, p) => sum + p.ACE, 0);
        const currentData = teamPlayers.map(p => (p.SALARY / totalSalary) * 100);
        const estimatedData = teamPlayers.map(p => (p.ACE / totalACE) * 100);

        // Assign colors from brightColors cyclically
        const colorMap = {};
        labels.forEach((player, i) => {
            colorMap[player] = brightColors[i % brightColors.length];
        });
        const colors = labels.map(p => colorMap[p]);

        // Outer wrapper rectangle
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'flex-start';
        wrapper.style.justifyContent = 'space-between';
        wrapper.style.padding = '16px';
        wrapper.style.border = '2px solid #444';
        wrapper.style.borderRadius = '12px';
        wrapper.style.backgroundColor = '#1e1e1e';
        wrapper.style.marginBottom = '24px';

        // Current chart
        const currentDiv = document.createElement('div');
        currentDiv.style.textAlign = 'center';
        const currentTitle = document.createElement('h4');
        currentTitle.textContent = team + " - Current";
        currentTitle.style.margin = "0 0 12px 0";
        const canvasCurrent = document.createElement('canvas');
        canvasCurrent.width = 250;
        canvasCurrent.height = 250;
        currentDiv.appendChild(currentTitle);
        currentDiv.appendChild(canvasCurrent);

        // Legend between charts
        const legendDiv = document.createElement('div');
        legendDiv.style.color = '#fff';
        legendDiv.style.fontSize = '14px';
        legendDiv.style.margin = '0 16px';
        legendDiv.style.whiteSpace = 'pre-line';
        labels.forEach(player => {
            const line = document.createElement('div');
            line.textContent = `■ ${player}`;
            line.style.color = colorMap[player];
            legendDiv.appendChild(line);
        });

        // Estimated chart
        const estDiv = document.createElement('div');
        estDiv.style.textAlign = 'center';
        const estTitle = document.createElement('h4');
        estTitle.textContent = team + " - Estimated";
        estTitle.style.margin = "0 0 12px 0";
        const canvasEstimated = document.createElement('canvas');
        canvasEstimated.width = 250;
        canvasEstimated.height = 250;
        estDiv.appendChild(estTitle);
        estDiv.appendChild(canvasEstimated);

        // Append all to wrapper
        wrapper.appendChild(currentDiv);
        wrapper.appendChild(legendDiv);
        wrapper.appendChild(estDiv);
        container.appendChild(wrapper);

        // Current salary pie (percentages)
        new Chart(canvasCurrent.getContext('2d'), {
            type: 'pie',
            data: { labels, datasets: [{ data: currentData, backgroundColor: colors, borderWidth: 1 }] },
            options: {
                responsive: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.label}: ${ctx.raw.toFixed(1)}%`
                        }
                    }
                }
            }
        });

        // Estimated salary pie (percentages)
        new Chart(canvasEstimated.getContext('2d'), {
            type: 'pie',
            data: { labels, datasets: [{ data: estimatedData, backgroundColor: colors, borderWidth: 1 }] },
            options: {
                responsive: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.label}: ${ctx.raw.toFixed(1)}%`
                        }
                    }
                }
            }
        });
    });
}









// helper: random color generator
function randomColor(alpha = 1) {
    const r = Math.floor(Math.random() * 200 + 30);
    const g = Math.floor(Math.random() * 200 + 30);
    const b = Math.floor(Math.random() * 200 + 30);
    return `rgba(${r},${g},${b},${alpha})`;
}
