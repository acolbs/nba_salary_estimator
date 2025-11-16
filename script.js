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
                    SALARY: salary,
                    ACE: isNaN(ace) ? 0 : ace,
                    ValuePct: valuePct
                };
            }).filter(p => p.Player && p.SALARY > 0 && p.ACE > 0);

            renderPlayers();
            updateCap();
            updateRosterSummary();
            renderSalaryChart();
        },
        error: console.error
    });
}

// ---------------- Render Functions ----------------
function renderPlayers(list = players) {
    const tbody = document.querySelector("#playersTable tbody");
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
}

// ---------------- Cap ----------------
function updateCap() {
    const used = roster.reduce((t, p) => t + p.ACE, 0);
    document.getElementById("capRemaining").textContent = money(SALARY_CAP - used);
}

// ---------------- Filters ----------------
function applyFilters() {
    const query = document.getElementById("searchPlayer").value.toLowerCase();
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
    document.getElementById("salaryValue").value = "";
    document.getElementById("salaryOperator").value = ">=";
    document.getElementById("valueFilter").value = "all";
    document.querySelectorAll("#positionFilter input[type='checkbox']").forEach(cb => cb.checked = false);
    document.getElementById("searchPlayer").value = "";
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

// ---------------- Event Listeners ----------------
document.getElementById("searchPlayer").addEventListener("input", applyFilters);
document.getElementById("applyFiltersBtn").addEventListener("click", applyFilters);
document.getElementById("resetFiltersBtn").addEventListener("click", resetFilters);
window.addEventListener("DOMContentLoaded", loadCSV);

// ---------------- Salary Chart ----------------
function renderSalaryChart() {
    const ctx = document.getElementById('salaryChart').getContext('2d');

    const dataPoints = players.map(p => ({
        x: p.SALARY,
        y: p.ACE,
        label: p.Player
    }));

    if (window.salaryChartInstance) window.salaryChartInstance.destroy();

    window.salaryChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: [{ label: 'Player Salary vs ACE', data: dataPoints, backgroundColor: 'rgba(75,192,192,0.7)', pointRadius: 6 }] },
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
                x: { title: { display: true, text: 'Current Salary' } },
                y: { title: { display: true, text: 'ACE Estimated Salary' } }
            }
        }
    });
}

// ---------------- Tabs ----------------
function openTab(tabId, btn) {
    document.querySelectorAll(".tabcontent").forEach(c => c.style.display = "none");
    document.querySelectorAll(".tablink").forEach(b => b.classList.remove("active"));

    document.getElementById(tabId).style.display = "block";
    btn.classList.add("active");

    if (tabId === "graph" && window.salaryChartInstance) window.salaryChartInstance.update();
}

// Open Home tab by default
document.addEventListener("DOMContentLoaded", () => {
    document.querySelector(".tablink").click();
});
