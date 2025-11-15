let players = [];
let roster = [];
const SALARY_CAP = 150000000;

// Money formatter
function money(n) {
    return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function loadCSV() {
    Papa.parse("players.csv", {
        download: true,
        header: true,
        complete: function(results) {
            players = results.data.filter(p => p.Player && p.Salary);

            // Convert salary to number and remove commas/dollar signs
            players.forEach(p => {
                if (p.Salary) {
                    p.Salary = Number(p.Salary.replace(/[\$,]/g, ''));
                }
            });

            renderPlayers();
            updateCap();
        }
    });
}

function renderPlayers() {
    const tbody = document.querySelector("#playersTable tbody");
    tbody.innerHTML = "";

    players.forEach((p, i) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${p.Player}</td>
            <td>${p.Team || ""}</td>
            <td>${p.Pos || ""}</td>
            <td>${money(p.Salary)}</td>
            <td><button class="add" onclick="addPlayer(${i})">Add</button></td>
        `;

        tbody.appendChild(tr);
    });
}

function addPlayer(i) {
    if (roster.length >= 10) return;

    const player = players[i];
    const used = roster.reduce((t, p) => t + p.Salary, 0);

    if (used + player.Salary > SALARY_CAP) return;

    roster.push(player);
    renderRoster();
    updateCap();
}

function removePlayer(i) {
    roster.splice(i, 1);
    renderRoster();
    updateCap();
}

function renderRoster() {
    const tbody = document.querySelector("#rosterTable tbody");
    tbody.innerHTML = "";

    roster.forEach((p, i) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${p.Player}</td>
            <td>${money(p.Salary)}</td>
            <td><button class="remove" onclick="removePlayer(${i})">X</button></td>
        `;

        tbody.appendChild(tr);
    });
}

function updateCap() {
    const used = roster.reduce((t, p) => t + p.Salary, 0);
    const remaining = SALARY_CAP - used;

    document.getElementById("capRemaining").textContent = money(remaining);
}

loadCSV();
