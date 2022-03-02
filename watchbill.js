import GLPK from './glpk.js/dist/index.js';

let numWatchstanders;
let startDate;
let endDate;
let numdays;
let daysOffBetweenDuty;
let allWatchstanders = [];
let scheduleConflicts = [];
let dayCosts = [];

function buildInputTable() {
    numWatchstanders = document.getElementById("numWatchstanders").value;
    startDate = new Date(document.getElementById("startDate").value);
    endDate = new Date(document.getElementById("endDate").value);
    daysOffBetweenDuty = document.getElementById('daysOffBetweenDuty').value;
    numdays = 1 + Math.floor((endDate.getTime()-startDate.getTime())/(1000*60*60*24));
    let inputTable = document.createElement('table');
    let thead = document.createElement('thead');
    let tbody = document.createElement('tbody');
    let weekday_row = document.createElement('tr');
    weekday_row.appendChild(document.createElement('th'));
    let weekday_list = ["S","M","T","W","R","F","S"];
    for (let i = startDate; i <= new Date(endDate.getTime()+1000*60*60*24); i = new Date(i.getTime() + 1000*60*60*24)) {
        let heading = document.createElement('th');
        heading.innerHTML = weekday_list[i.getUTCDay()];
        weekday_row.appendChild(heading);
    }
    thead.appendChild(weekday_row);
    let day_off_row = document.createElement('tr');
    let first_box = document.createElement('th');
    first_box.innerHTML = 'Day Off?'
    day_off_row.appendChild(first_box);
    let counter = 0;
    for (let i = startDate; i <= new Date(endDate.getTime()+1000*60*60*24); i = new Date(i.getTime() + 1000*60*60*24)) {
        let heading = document.createElement('th');
        let box = document.createElement('input');
        box.type = 'checkbox';
        box.id = "do"+counter
        box.checked = i.getUTCDay() == 6 || i.getUTCDay() == 0;
        heading.appendChild(box);
        day_off_row.appendChild(heading);
        counter += 1;
    }
    thead.appendChild(day_off_row);
    let date_row = document.createElement('tr');
    first_box = document.createElement('th');
    first_box.innerHTML = 'Name';
    date_row.appendChild(first_box);
    for (let i = startDate; i <= new Date(endDate.getTime()+1000*60*60*24); i = new Date(i.getTime() + 1000*60*60*24)) {
        let heading = document.createElement('th');
        heading.innerHTML = i.getUTCDate();
        date_row.appendChild(heading);
    }
    thead.appendChild(date_row);
    for (let i = 0; i < numWatchstanders; i++) {
        let row = document.createElement('tr');
        let inputBox = document.createElement('td');
        inputBox.innerHTML = '<input type="text" id = "name' + i + '" value = "Watchstander' + i + '">';
        row.appendChild(inputBox);
        for (let j = 0; j < numdays; j++) {
            let check = document.createElement('td');
            check.innerHTML = '<input type = "checkbox" id = "scw' + i + 'd' + j + '">';
            row.appendChild(check);
        }
        tbody.appendChild(row);
    }
    inputTable.appendChild(thead);
    inputTable.appendChild(tbody);
    document.getElementById('tableHolder').replaceChildren(inputTable);
    let br = document.createElement('br');
    document.getElementById('tableHolder').appendChild(br);
    let solveButton = document.createElement('button');
    solveButton.innerHTML = "Solve";
    solveButton.onclick = solveLP;
    document.getElementById('tableHolder').appendChild(solveButton);
}

function parseInputTable() {
    allWatchstanders = [];
    scheduleConflicts = [];
    dayCosts = []
    for (let i = 0; i < numWatchstanders; i++) {
        allWatchstanders.push(document.getElementById('name'+i).value);
        scheduleConflicts.push([]);
        for (let j = 0; j < numdays; j++) {
            scheduleConflicts[i].push(document.getElementById('scw'+i+'d'+j).checked);
        }
    }
    for (let i = 0; i < numdays; i++) {
        let day_off = document.getElementById('do'+ i).checked;
        let next_day_off = document.getElementById('do' + (i+1)).checked;
        if (day_off) {
            if (next_day_off) {
                dayCosts.push(7); // saturday
            } else {
                dayCosts.push(6); // sunday
            }
        } else {
            if (next_day_off) {
                dayCosts.push(5); // friday
            } else {
                dayCosts.push(4); // weekday
            }
        }
    }
}

document.getElementById('buildButton').onclick = buildInputTable;

function generateLP() {
    (async () => {
        const glpk = await GLPK();
        // whether watchstander a works on day b is a boolean variable wadb


        // a callback to print our schedule
        function print(res) {
            for (let i=0; i< numWatchstanders; i++) {
                for (let j=0; j< numdays; j++) {
                    document.getElementById('wb_w'+i+'d'+j).innerHTML = "";
                    if (res.result.vars['w'+i+'d'+j] == 1) {
                        document.getElementById('wb_w'+i+'d'+j).innerHTML = "X";
                        console.log('w'+i+'d'+j);
                    }
                }
            }
            const el = window.document.getElementById('out');
            el.innerHTML = JSON.stringify(res, null, 2);
        };

        let lp = {
            name: 'LP',
            objective: {
                direction: glpk.GLP_MIN,
                name: 'deal_spread',
                vars: [
                    { name: 'worst_deal', coef: 1.0},
                    { name: 'best_deal', coef: -1.0}
                ]
            },
            subjectTo: [],
            binaries: []
        }

        // all wadb are boolean variables
        for (let i = 0; i < numWatchstanders; i++) {
            for (let j = 0; j < numdays; j++) {
                lp.binaries.push('w'+i+'d'+j);
            }
        }

        // only one watchstander works per day
        for (let i = 0; i < numdays; i++) {
            let dayConstraint = {
                name: 'day'+i,
                vars: [],
                bnds: {type: glpk.GLP_FX, lb: 1.0}
            }
            for (let j = 0; j < numWatchstanders; j++) {
                dayConstraint.vars.push({ name: 'w'+j+'d'+i, coef: 1})
            }
            lp.subjectTo.push(dayConstraint);
        }

        // constrain worst_deal and best_deal
        for (let i = 0; i < numWatchstanders; i ++) {
            let worstDealConstraint = {
                name: 'worstdeal' + i,
                vars: [{ name: 'worst_deal', coef: 1}],
                bnds: {type:glpk.GLP_LO, lb: 0}
            };
            let bestDealConstraint = {
                name: 'bestdeal' + i,
                vars: [{ name: 'best_deal', coef: 1}],
                bnds: {type:glpk.GLP_UP, ub: 0}
            };
            for (let j = 0; j < numdays; j++) {
                worstDealConstraint.vars.push({ name: 'w'+i+'d'+j, coef: -dayCosts[j]});
                bestDealConstraint.vars.push({ name: 'w'+i+'d'+j, coef: -dayCosts[j]});
            }
            lp.subjectTo.push(worstDealConstraint);
            lp.subjectTo.push(bestDealConstraint);
        }

        // watchstanders don't work on schedule conflicts
        for (let i = 0; i < numWatchstanders; i++) {
            for (let j = 0; j < numdays; j++) {
                if (scheduleConflicts[i][j]) {
                    lp.subjectTo.push(
                        {
                            name: 'scw' + i + 'd' + j,
                            vars: [{ name: 'w' + i + 'd' + j, coef: 1}],
                            bnds: {type:glpk.GLP_FX, ub: 0, lb: 0}
                        }
                    )
                }
            }
        }

        // apply minimum days off between duty days
        for (let i = 0; i < numWatchstanders; i++) {
            for (let j = 0; j < numdays; j++) {
                let minDaysConstraint = {
                    name: 'mindaysw' + i + 'd' + j,
                    vars: [],
                    bnds: {type:glpk.GLP_UP, ub: 1, lb: 0}
                };
                for (let k = j; (k < numdays) && (k-j <= daysOffBetweenDuty); k++) {
                    minDaysConstraint.vars.push({ name: 'w'+i+'d'+ k, coef: 1});
                }
                lp.subjectTo.push(minDaysConstraint);
            }
        }

        // options
        const opt = {
            msglev: glpk.GLP_MSG_OFF,
        };

        // solve once, to determine the minimum spread
        glpk.solve(lp, opt)
            .then(res => finalSolve(res))
            .catch(err => console.log(err));

        // solve the second time, inside a callback. This time, we're minimizing the minimum absolute deviation, and using the minimum spread as a constraint
        function finalSolve(result) {  
            print(result);
            
            let minSpread = result.result.z;
            
            // add the minimum spread as a constraint
            lp.subjectTo.push({
                name: 'minSpreadConstraint',
                vars: [
                    { name: 'worst_deal', coef: 1.0},
                    { name: 'best_deal', coef: -1.0}
                ],
                bnds: {type: glpk.GLP_FX, lb: minSpread}
            });
            
            // new objective function for the mean absolute difference
            let mad = {
                direction: glpk.GLP_MIN,
                name: 'MAD',
                vars: []
            }

            let avgBadness = 0;
            for (let i = 0; i < numdays; i++) {
                avgBadness += dayCosts[i]/numWatchstanders;
            }

            for (let i = 0; i < numWatchstanders; i++)
            {
                mad.vars.push({name: 'ad' + i, coef: 1.0});
                let adConstraintPos = {
                    name: 'ad' + i + 'constraintPos',
                    vars: [{ name: 'ad'+i, coef: 1.0 }],
                    bnds: {type: glpk.GLP_LO, lb: + avgBadness}
                };
                let adConstraintNeg = {
                    name: 'ad' + i + 'constraintNeg',
                    vars: [{ name: 'ad'+i, coef: 1.0 }],
                    bnds: {type: glpk.GLP_LO, lb: - avgBadness}
                };
                for (let j = 0; j < numdays; j++) {
                    adConstraintPos.vars.push({name: 'w'+i+'d'+j, coef: dayCosts[j]});
                    adConstraintNeg.vars.push({name: 'w'+i+'d'+j, coef: -dayCosts[j]});
                }
                lp.subjectTo.push(adConstraintPos);
                lp.subjectTo.push(adConstraintNeg);            
            }

            lp.objective = mad;

            glpk.solve(lp, opt)
            .then(res => print(res))
            .catch(err => console.log(err));

        }

        //window.document.getElementById('cplex').innerHTML = await glpk.write(lp);
    })();
}

function buildOutputTable() {
    let outputTable = document.createElement('table');
    let thead = document.createElement('thead');
    let tbody = document.createElement('tbody');
    let weekday_row = document.createElement('tr');
    weekday_row.appendChild(document.createElement('th'));
    let weekday_list = ["S","M","T","W","R","F","S"];
    for (let i = startDate; i <= new Date(endDate.getTime()+1000*60*60*24); i = new Date(i.getTime() + 1000*60*60*24)) {
        let heading = document.createElement('th');
        heading.innerHTML = weekday_list[i.getUTCDay()];
        weekday_row.appendChild(heading);
    }
    thead.appendChild(weekday_row);
    let date_row = document.createElement('tr');
    let first_box = document.createElement('th');
    first_box.innerHTML = 'Name';
    date_row.appendChild(first_box);
    for (let i = startDate; i <= new Date(endDate.getTime()+1000*60*60*24); i = new Date(i.getTime() + 1000*60*60*24)) {
        let heading = document.createElement('th');
        heading.innerHTML = i.getUTCDate();
        date_row.appendChild(heading);
    }
    thead.appendChild(date_row);
    for (let i = 0; i < numWatchstanders; i++) {
        let row = document.createElement('tr');
        let nameBox = document.createElement('td');
        nameBox.innerHTML = allWatchstanders[i];
        row.appendChild(nameBox);
        for (let j = 0; j < numdays; j++) {
            let watchBox = document.createElement('td');
            watchBox.id = 'wb_w'+i+'d'+j;
            row.appendChild(watchBox);
        }
        tbody.appendChild(row);
    }
    outputTable.appendChild(thead);
    outputTable.appendChild(tbody);
    document.getElementById('tableOut').replaceChildren(outputTable);
}

function solveLP() {
    buildOutputTable();
    parseInputTable();
    generateLP();
}
