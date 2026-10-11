const STARTING_BUDGET = 10000;

function freshState() {
  return {
    day: 1,
    spent: 0,
    goal: 1500,
    expenses: [],
    subscriptions: {
      spotify: false,
      netflix: false
    },
    lastSimulation: null
  };
}

let state = freshState();

const $ = id => document.getElementById(id);

const money = amount =>
  "₹" + Math.round(amount).toLocaleString("en-IN");

function subscriptionCost() {
  return (state.subscriptions.spotify ? 149 : 0) +
         (state.subscriptions.netflix ? 101 : 0);
}

function balance() {
  return STARTING_BUDGET -
         state.spent -
         subscriptionCost();
}

function dailyAllowance() {
  const daysLeft = Math.max(1, 31 - state.day);
  return Math.max(0, balance() - state.goal) / daysLeft;
}

function healthScore() {
  const currentBalance = balance();

  if (currentBalance < 0) return 0;

  const score = 100 -
    (state.spent / STARTING_BUDGET) * 35 -
    (subscriptionCost() / STARTING_BUDGET) * 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function render() {
  $("budget").textContent = money(STARTING_BUDGET);
  $("balance").textContent = money(balance());
  $("allowance").textContent = money(dailyAllowance());
  $("health").textContent = healthScore() + "/100";

  $("subscriptionTotal").textContent =
    "Monthly total: " + money(subscriptionCost());

  $("spotify").checked = state.subscriptions.spotify;
  $("netflix").checked = state.subscriptions.netflix;
  $("goalInput").value = state.goal;

  $("goalStatus").textContent =
    money(state.goal) + " protected for savings";

  $("activityList").innerHTML = state.expenses.length
    ? state.expenses.map((expense, index) => `
        <div>
          <span>${escapeHTML(expense.name)}</span>
          <span>${money(expense.amount)}
            <button data-delete="${index}">Remove</button>
          </span>
        </div>
      `).join("")
    : "<p>No expenses yet. Your full budget is available.</p>";

  document.querySelectorAll("[data-delete]").forEach(button => {
    button.onclick = () => {
      const expense = state.expenses[Number(button.dataset.delete)];
      state.spent -= expense.amount;
      state.expenses.splice(Number(button.dataset.delete), 1);
      render();
      save();
    };
  });

  save();
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function save() {
  try {
    localStorage.setItem("paisapilot-state", JSON.stringify(state));
  } catch (error) {
    console.warn("Could not save local progress.", error);
  }
}

function addExpense() {
  const name = $("expenseName").value.trim();
  const amount = Number($("expenseAmount").value);

  if (!name || !Number.isFinite(amount) || amount <= 0) {
    alert("Enter an expense name and a valid amount.");
    return;
  }

  if (amount > balance()) {
    alert("This expense exceeds your available balance.");
    return;
  }

  state.spent += amount;
  state.expenses.unshift({ name, amount, day: state.day });

  $("expenseName").value = "";
  $("expenseAmount").value = "";

  render();
}

function simulateDecision() {
  const name = $("decisionName").value.trim();
  const amount = Number($("decisionAmount").value);
  const emergency = $("includeEmergency").checked ? 500 : 0;

  if (!name || !Number.isFinite(amount) || amount < 0) {
    alert("Enter a decision name and a valid cost.");
    return;
  }

  const projectedBalance = balance() - amount - emergency;
  const projectedDaily =
    Math.max(0, projectedBalance - state.goal) /
    Math.max(1, 30 - state.day);

  state.lastSimulation = {
    name,
    amount,
    emergency
  };

  $("simulationResult").textContent =
    "Balance after decision: " + money(projectedBalance) +
    " | Safe daily allowance: " + money(projectedDaily) +
    " | Risk: " +
    (projectedBalance < 0 ? "High" :
     projectedBalance < state.goal ? "Elevated" : "Lower");

  save();
}

function commitDecision() {
  const decision = state.lastSimulation;

  if (!decision) {
    alert("Simulate a decision first.");
    return;
  }

  const total = decision.amount + decision.emergency;

  if (total > balance()) {
    alert("This decision exceeds your available balance.");
    return;
  }

  if (decision.amount > 0) {
    state.expenses.unshift({
      name: decision.name,
      amount: decision.amount,
      day: state.day
    });
    state.spent += decision.amount;
  }

  if (decision.emergency > 0) {
    state.expenses.unshift({
      name: "Unexpected emergency",
      amount: decision.emergency,
      day: state.day
    });
    state.spent += decision.emergency;
  }

  state.lastSimulation = null;
  $("simulationResult").textContent = "Decision committed.";
  render();
}

function resetDemo() {
  if (!confirm("Reset everything to a fresh ₹10,000 budget on Day 1?")) {
    return;
  }

  state = freshState();

  $("expenseName").value = "";
  $("expenseAmount").value = "";
  $("decisionName").value = "";
  $("decisionAmount").value = "";
  $("includeEmergency").checked = false;
  $("simulationResult").textContent = "";

  render();
}

$("addExpenseBtn").addEventListener("click", addExpense);
$("simulateBtn").addEventListener("click", simulateDecision);
$("applyBtn").addEventListener("click", commitDecision);
$("resetBtn").addEventListener("click", resetDemo);

$("saveGoalBtn").addEventListener("click", () => {
  const goal = Number($("goalInput").value);

  if (!Number.isFinite(goal) || goal < 0 || goal > STARTING_BUDGET) {
    alert("Choose a savings goal between ₹0 and ₹10,000.");
    return;
  }

  state.goal = goal;
  render();
});

$("spotify").addEventListener("change", event => {
  state.subscriptions.spotify = event.target.checked;
  render();
});

$("netflix").addEventListener("change", event => {
  state.subscriptions.netflix = event.target.checked;
  render();
});

document.querySelectorAll("[data-tab]").forEach(button => {
  button.addEventListener("click", () => {
    const tab = button.dataset.tab;

    const destinations = {
      Overview: "budget",
      Activity: "activityList",
      Decisions: "decisionName",
      Goals: "goalInput",
      Subscriptions: "spotify",
      Health: "health"
    };

    $(destinations[tab]).scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  });
});

// Restore progress on page reload.
try {
  const saved = localStorage.getItem("paisapilot-state");

  if (saved) {
    const parsed = JSON.parse(saved);

    if (
      parsed &&
      parsed.day >= 1 &&
      parsed.day <= 30 &&
      Array.isArray(parsed.expenses) &&
      parsed.subscriptions
    ) {
      state = {
        ...freshState(),
        ...parsed
      };
    }
  }
} catch (error) {
  console.warn("Starting a fresh demo.", error);
}

render();
