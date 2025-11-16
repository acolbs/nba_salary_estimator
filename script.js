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
    if (valuePct < -20) return "excellent-value"; // Underpaid by 20%+
    if (valuePct < -10) return "good-value";      // Underpaid by 10-20%
    if (valuePct < 10) return "fair-value";       // Within 10%
    if (valuePct < 20) return "overpaid";         // Overpaid by 10-20%
    return "very-overpaid";                       // Overpaid by 20%+
}

// Format value percentage
function formatValuePct(valuePct) {
    const sign = valuePct > 0 ? "+" : "";
    return `${sign}${valuePct.toFixed(1)}%`;
}

// Load both CSV files
function loadCSV() {
    // First load the real salaries from players.csv
    Papa.parse("players.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(realSalariesData) {
            console.log("Loaded players.csv (real salaries)");
            
            // Then load the estimated salaries
            Papa.parse("estimated.csv", {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: function(estimatedData) {
                    console.log("Loaded estimated.csv (estimated salaries)");
                    
                    // Create a map of player names to real salaries
                    const realSalariesMap = {};
                    realSalariesData.data.forEach(p => {
                        const playerName = (p.Player || "").trim();
                        const salaryStr = (p.Salary || "").replace(/["$,\s]/g, '').trim();
                        const salary = Number(salaryStr);
                        
                        if (playerName && !isNaN(salary) && salary > 0) {
                            realSalariesMap[playerName] = {
                                salary: salary,
                                team: (p.Tm || "").trim()
                            };
                        }
                    });
                    
                    console.log("Real salaries mapped:", Object.keys(realSalariesMap).length, "players");
                    
                    // Now process estimated salaries and merge with real salaries
                    players = estimatedData.data.map(p => {
                        const playerName = (p.Player || "").trim();
                        const estimatedSalaryStr = (p.Salary || "").replace(/["$,\s]/g, '').trim();
                        const estimatedSalary = Number(estimatedSalaryStr);
                        
                        // Get real salary from players.csv
                        const realData = realSalariesMap[playerName];
                        const realSalary = realData ? realData.salary : 0;
                        const team = (p.Team || p.Tm || (realData ? realData.team : "")).trim();
                        
                        // Calculate value percentage
                        const valuePct = calculateValuePct(realSalary, estimatedSalary);
                        
                        return {
                            Player: playerName,
                            Tm: team,
                            Pos: (p.Pos || "").trim(),
                            Salary: realSalary, // REAL salary from players.csv
                            EstimatedSalary: isNaN(estimatedSalary) ? 0 : estimatedSalary, // ESTIMATED from estimated.csv
                            ValuePct: valuePct
                        };
                    }).filter(p => p.Player && p.Salary > 0 && p.EstimatedSalary > 0);
                    
                    console.log("Processed players:", players.slice(0, 10));
                    console.log("Total players loaded:", players.length);
                    
                    renderPlayers();
                    updateCap();
                    updateRosterSummary();
                },
                error: function(error) {
                    console.error("Error loading estimated.csv:", error);
                }
            });
        },
        error: function(error) {
            console.error("Error loading players.csv:", error);
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
            <td>${money(p.Salary)}</td>
            <td class="${valueColor}" title="Real: ${money(p.Salary)} | Est: ${money(p.EstimatedSalary)}">${valueText}</td>
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
    const used = roster.reduce((t, p) => t + p.Salary, 0);
    
    if (roster.length >= 10) {
        alert("Roster is full! Maximum 10 players allowed.");
        return;
    }
    
    if (used + player.Salary > SALARY_CAP) {
        alert("Not enough cap space! This would exceed the salary cap.");
        return;
    }

    // Add to roster
    roster.push(player);

    // Remove from main players list
    players.splice(index, 1);

    // Rerender tables
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
            <td>${money(p.Salary)}</td>
            <td class="${valueColor}" title="Real: ${money(p.Salary)} | Est: ${money(p.EstimatedSalary)}">${valueText}</td>
            <td><button class="remove" onclick="removePlayer(${i})">X</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// Remove player
function removePlayer(i) {
    const player = roster[i];
    roster.splice(i, 1);
    players.push(player); // add back to main players

    renderPlayers();
    renderRoster();
    updateCap();
    updateRosterSummary();
}

// Update salary cap
function updateCap() {
    const used = roster.reduce((t, p) => t + p.Salary, 0);
    document.getElementById("capRemaining").textContent = money(SALARY_CAP - used);
}

// Search & Filters
function applyFilters() {
    const query = document.getElementById("searchPlayer").value.toLowerCase();
    const salaryOperator = document.getElementById("salaryOperator").value;
    const salaryValue = Number(document.getElementById("salaryValue").value);
    
    // Get value filter
    const valueFilter = document.getElementById("valueFilter").value;

    // Get checked positions
    const positionCheckboxes = document.querySelectorAll("#positionFilter input[type='checkbox']");
    const positions = Array.from(positionCheckboxes)
                           .filter(cb => cb.checked)
                           .map(cb => cb.value);

    let filtered = [...players];

    // Search filter
    if (query) {
        filtered = filtered.filter(p => p.Player.toLowerCase().includes(query));
    }

    // Salary filter (using REAL salary)
    if (!isNaN(salaryValue) && salaryValue > 0) {
        if (salaryOperator === ">=") {
            filtered = filtered.filter(p => p.Salary >= salaryValue);
        } else if (salaryOperator === "<=") {
            filtered = filtered.filter(p => p.Salary <= salaryValue);
        }
    }

    // Position filter
    if (positions.length > 0) {
        filtered = filtered.filter(p => positions.includes(p.Pos));
    }
    
    // Value filter
    if (valueFilter !== "all") {
        filtered = filtered.filter(p => {
            if (valueFilter === "underpaid") return p.ValuePct < -10;
            if (valueFilter === "fair") return p.ValuePct >= -10 && p.ValuePct <= 10;
            if (valueFilter === "overpaid") return p.ValuePct > 10;
            return true;
        });
    }
    
    // Sort by value percentage based on filter
    if (valueFilter === "underpaid") {
        // Sort underpaid: most negative (best value) first
        filtered.sort((a, b) => a.ValuePct - b.ValuePct);
    } else if (valueFilter === "overpaid") {
        // Sort overpaid: most positive (worst value) first
        filtered.sort((a, b) => b.ValuePct - a.ValuePct);
    }

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
    
    // Position counts
    document.getElementById("pgCount").textContent = roster.filter(p => p.Pos === "PG").length;
    document.getElementById("sgCount").textContent = roster.filter(p => p.Pos === "SG").length;
    document.getElementById("sfCount").textContent = roster.filter(p => p.Pos === "SF").length;
    document.getElementById("pfCount").textContent = roster.filter(p => p.Pos === "PF").length;
    document.getElementById("cCount").textContent = roster.filter(p => p.Pos === "C").length;
    
    // Calculate average value
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