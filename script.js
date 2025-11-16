let players = [];
let roster = [];
const SALARY_CAP = 150000000;

function money(n) {
    return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// Calculate value percentage (negative = underpaid/good value, positive = overpaid)
function calculateValuePct(realSalary, estimatedSalary) {
    if (!estimatedSalary || estimatedSalary === 0) return 0;
    return ((realSalary - estimatedSalary) / estimatedSalary) * 100;
}

// Get color class based on value
function getValueColor(valuePct) {
    if (valuePct < -20) return "excellent-value"; 
    if (valuePct < -10) return "good-value";      
    if (valuePct < 10) return "fair-value";       
    if (valuePct < 20) return "overpaid";         
    return "very-overpaid";                       
}

// Format value percentage
function formatValuePct(valuePct) {
    const sign = valuePct > 0 ? "+" : "";
    return `${sign}${valuePct.toFixed(1)}%`;
}

// Load ACE_MODEL.csv
function loadCSV() {
    Papa.parse("ACE_MODEL.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(data) {
            console.log("Loaded ACE_MODEL.csv");

            players = data.data.map(p => {
                const playerName = (p.Player || "").trim();

                const salaryStr = (p.SALARY || "").replace(/["$,\s]/g, '').trim();
                const aceStr = (p.ACE || "").replace(/["$,\s]/g, '').trim();

                const salary = Number(salaryStr);
                const ace = Number(aceStr);

                const team = (p.Team || p.Tm || "").trim();
                const pos = (p.Pos || "").trim();

                const valuePct = calculateValuePct(salary, ace);

                return {
                    Player: playerName,
                    Tm: team,
                    Pos: pos,
                    SALARY: salary,
                    ACE: isNaN(ace) ? 0 : ace,
                    ValuePct: valuePct
                };
            }).filter(p => p.Player && p.SALARY > 0 && p.ACE > 0);

            console.log("Processed players:", players.slice(0, 10));
            console.log("Total players loaded:", players.length);

            renderPlayers();
            updateCap();
            updateRosterSummary();
        },
        error: function(error) {
            console.error("Error loading ACE_MODEL.csv:", error);
        }
    });
}

// Render players table
function renderPlayers(list = players) {
    const tbody = document.querySelector("#playersTable tbody");
    tbody.innerHTML = "";

    list.forEach(p => {
        const tr = document.createElement("tr");
        const valueColor = getValueColor(p.ValuePct);
        const valueText = formatValuePct(p.ValuePct);

        tr.innerHTML = `
            <td>${p.Player}</td>
            <td>${p.Tm || "N/A"}</td>
            <td>${p.Pos || "N/A"}</td>
            <td>${money(p.SALARY)}</td>
            <td>${money(p.ACE)}</td>
            <td class="${valueColor}" title="Real: ${money(p.SALARY)} | ACE: ${money(p.ACE)}">${valueText}</td>
            <td><button class="add" onclick="addPlayerObj('${p.Player.replace(/'/g, "\\'")}')">Add</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// Add player
function addPlayerObj(playerName) {
    const index = players.findIndex(p => p.Player === playerName);
    if (index === -1) return;

    const player = players[index];
    const used = roster.reduce((t, p) => t + p.ACE, 0);

    if (roster.length >= 10) {
        alert("Roster is full! Maximum 10 players allowed.");
        return;
    }

    if (used + player.ACE > SALARY_CAP) {
        alert("Not enough cap space! This would exceed the salary cap.");
        return;
    }

    roster.push(player);
    players.splice(index, 1);

    renderPlayers();
    renderRoster();
    updateCap();
    updateRosterSummary();
}

// Render roster
function renderRoster() {
    const tbody = document.querySelector("#rosterTable tbody");
    tbody.innerHTML = "";

    roster.forEach((p, i) => {
        const tr = document.createElement("tr");
        const valueColor = getValueColor(p.ValuePct);
        const valueText = formatValuePct(p.ValuePct);

        tr.innerHTML = `
            <td>${p.Player}</td>
            <td>${p.Tm}</td>
            <td>${p.Pos || "N/A"}</td>
            <td>${money(p.SALARY)}</td>
            <td>${money(p.ACE)}</td>
            <td class="${valueColor}" title="Real: ${money(p.SALARY)} | ACE: ${money(p.ACE)}">${valueText}</td>
            <td><button class="remove" onclick="removePlayer(${i})">X</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// Remove player and re-insert into sorted players list
function removePlayer(i) {
    const player = roster[i];
    roster.splice(i, 1);

    // Add back to main players list
    players.push(player);

    // Sort players by ACE descending (or ascending if you prefer)
    players.sort((a, b) => b.ACE - a.ACE);

    renderPlayers();
    renderRoster();
    updateCap();
    updateRosterSummary();
}

// Update salary cap
function updateCap() {
    const used = roster.reduce((t, p) => t + p.ACE, 0);
    document.getElementById("capRemaining").textContent = money(SALARY_CAP - used);
}

// Filters/Search
function applyFilters() {
    const query = document.getElementById("searchPlayer").value.toLowerCase();
    const salaryOperator = document.getElementById("salaryOperator").value;
    const salaryValue = Number(document.getElementById("salaryValue").value);
    const valueFilter = document.getElementById("valueFilter").value;
    const positionCheckboxes = document.querySelectorAll("#positionFilter input[type='checkbox']");
    const positions = Array.from(positionCheckboxes).filter(cb => cb.checked).map(cb => cb.value);

    let filtered = [...players];

    if (query) filtered = filtered.filter(p => p.Player.toLowerCase().includes(query));

    // Salary filter uses ACE now
    if (!isNaN(salaryValue) && salaryValue > 0) {
        if (salaryOperator === ">=") filtered = filtered.filter(p => p.ACE >= salaryValue);
        else if (salaryOperator === "<=") filtered = filtered.filter(p => p.ACE <= salaryValue);
    }

    if (positions.length > 0) filtered = filtered.filter(p => positions.includes(p.Pos));

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

// Reset filters
function resetFilters() {
    document.getElementById("salaryValue").value = "";
    document.getElementById("salaryOperator").value = ">=";
    document.getElementById("valueFilter").value = "all";

    const positionCheckboxes = document.querySelectorAll("#positionFilter input[type='checkbox']");
    positionCheckboxes.forEach(cb => cb.checked = false);

    document.getElementById("searchPlayer").value = "";
    renderPlayers();
}

// Roster summary
function updateRosterSummary() {
    document.getElementById("totalPlayers").textContent = roster.length;
    document.getElementById("pgCount").textContent = roster.filter(p => p.Pos === "PG").length;
    document.getElementById("sgCount").textContent = roster.filter(p => p.Pos === "SG").length;
    document.getElementById("sfCount").textContent = roster.filter(p => p.Pos === "SF").length;
    document.getElementById("pfCount").textContent = roster.filter(p => p.Pos === "PF").length;
    document.getElementById("cCount").textContent = roster.filter(p => p.Pos === "C").length;

    if (roster.length > 0) {
        const avgValue = roster.reduce((sum, p) => sum + p.ValuePct, 0) / roster.length;
        const avgValueEl = document.getElementById("avgValue");
        avgValueEl.textContent = formatValuePct(avgValue);
        avgValueEl.className = getValueColor(avgValue);
    } else {
        document.getElementById("avgValue").textContent = "0.0%";
        document.getElementById("avgValue").className = "";
    }
}

// Event listeners
document.getElementById("searchPlayer").addEventListener("input", applyFilters);
document.getElementById("applyFiltersBtn").addEventListener("click", applyFilters);
document.getElementById("resetFiltersBtn").addEventListener("click", resetFilters);

// Load CSV on page load
window.addEventListener("DOMContentLoaded", loadCSV);
