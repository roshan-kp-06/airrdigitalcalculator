const STORAGE_KEY = "airr-new-ads-forecast-v2";

const inputFields = [
  { key: "adSpend", label: "Ad spend", type: "currency" },
  { key: "costPerBookedMeeting", label: "Cost per booked meeting", type: "currency" },
  { key: "showRate", label: "Show rate", type: "percent" },
  { key: "qualifiedRate", label: "Qualified rate", type: "percent" },
  { key: "closeRate", label: "Close rate", type: "percent" },
  { key: "aov", label: "Average order value", type: "currency" },
  { key: "ltv", label: "Lifetime value", type: "currency" },
];

const scenarioDefaults = {
  expected: {
    name: "Expected",
    pill: "Base case",
    summary: "A realistic first-launch forecast for a company with no paid acquisition history.",
    description: "Use this as the default sales-call view for likely pipeline, revenue, and return.",
    values: {
      adSpend: 30000,
      costPerBookedMeeting: 300,
      showRate: 65,
      qualifiedRate: 55,
      closeRate: 20,
      aov: 5000,
      ltv: 12000,
    },
  },
  underperforming: {
    name: "Underperforming",
    pill: "Risk case",
    summary: "A cautious model for a slower first launch where signal takes longer to develop.",
    description: "Use this to show the downside case while still grounding the economics in the funnel.",
    values: {
      adSpend: 30000,
      costPerBookedMeeting: 420,
      showRate: 55,
      qualifiedRate: 45,
      closeRate: 15,
      aov: 5000,
      ltv: 12000,
    },
  },
  overperforming: {
    name: "Overperforming",
    pill: "Upside case",
    summary: "An upside model when the offer, audience, creative, and sales process connect quickly.",
    description: "Use this to show the opportunity if early campaign performance beats expectations.",
    values: {
      adSpend: 30000,
      costPerBookedMeeting: 190,
      showRate: 75,
      qualifiedRate: 65,
      closeRate: 25,
      aov: 5000,
      ltv: 12000,
    },
  },
};

let appState = loadState();

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
});

function loadState() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored?.scenarios && stored?.activeScenario) {
      return {
        activeScenario: stored.activeScenario,
        scenarios: mergeScenarios(stored.scenarios),
      };
    }
  } catch {
    // Ignore invalid local data and fall back to defaults.
  }

  return {
    activeScenario: "expected",
    scenarios: structuredClone(scenarioDefaults),
  };
}

function mergeScenarios(storedScenarios) {
  const merged = structuredClone(scenarioDefaults);
  Object.keys(merged).forEach((id) => {
    if (storedScenarios[id]?.values) {
      merged[id].values = {
        ...merged[id].values,
        ...storedScenarios[id].values,
      };
    }
  });
  return merged;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function rate(value) {
  return (Number(value) || 0) / 100;
}

function divide(numerator, denominator) {
  return denominator > 0 ? numerator / denominator : 0;
}

function calculate(values) {
  const safe = (value) => Math.max(Number(value) || 0, 0);
  const adSpend = safe(values.adSpend);
  const bookedMeetings = divide(adSpend, safe(values.costPerBookedMeeting));
  const shownMeetings = bookedMeetings * rate(values.showRate);
  const qualifiedMeetings = shownMeetings * rate(values.qualifiedRate);
  const closedCustomers = qualifiedMeetings * rate(values.closeRate);
  const totalCashCollected = closedCustomers * safe(values.aov);
  const contractedRevenue = closedCustomers * safe(values.aov);
  const totalLtvRevenue = closedCustomers * safe(values.ltv);

  return {
    bookedMeetings,
    shownMeetings,
    qualifiedMeetings,
    closedCustomers,
    totalCashCollected,
    contractedRevenue,
    totalLtvRevenue,
    cac: divide(adSpend, closedCustomers),
    cashRoas: divide(totalCashCollected, adSpend),
    contractedRevenueRoas: divide(contractedRevenue, adSpend),
    ltvRoas: divide(totalLtvRevenue, adSpend),
  };
}

function formatValue(value, format) {
  if (!Number.isFinite(value)) return format === "currency" ? "$0" : "0";
  if (format === "currency") return currencyFormatter.format(value);
  if (format === "multiple") return `${value.toFixed(2)}x`;
  return numberFormatter.format(value);
}

function renderTabs() {
  const tabs = document.getElementById("scenario-tabs");
  tabs.innerHTML = Object.entries(appState.scenarios)
    .map(
      ([id, scenario]) => `
        <button class="tab-button ${id === appState.activeScenario ? "active" : ""}" type="button" data-scenario="${id}">
          ${scenario.name}
        </button>
      `
    )
    .join("");
}

function renderInputs() {
  const values = appState.scenarios[appState.activeScenario].values;
  document.getElementById("input-fields").innerHTML = inputFields
    .map((field) => {
      const inputClass = field.type === "currency" ? "currency" : "percent";
      const prefix = field.type === "currency" ? '<span>$</span>' : "";
      const suffix = field.type === "percent" ? '<span class="suffix">%</span>' : "";

      return `
        <div class="field">
          <label for="${field.key}">${field.label}</label>
          <div class="input-shell">
            ${prefix}
            <input
              id="${field.key}"
              class="${inputClass}"
              type="number"
              min="0"
              step="${field.type === "percent" ? "1" : "100"}"
              value="${values[field.key]}"
              data-key="${field.key}"
            />
            ${suffix}
          </div>
        </div>
      `;
    })
    .join("");
}

function resultRow(label, value, format = "number", tone = "") {
  return `
    <div class="result-row ${tone}">
      <span>${label}</span>
      <strong>${formatValue(value, format)}</strong>
    </div>
  `;
}

function resultSection(title, rows) {
  return `
    <section class="result-section">
      <h3>${title}</h3>
      <div class="result-list">${rows.join("")}</div>
    </section>
  `;
}

function renderResults() {
  const scenario = appState.scenarios[appState.activeScenario];
  const results = calculate(scenario.values);

  document.getElementById("scenario-title").textContent = scenario.name;
  document.getElementById("scenario-pill").textContent = scenario.pill;
  document.getElementById("scenario-summary").textContent = scenario.summary;
  document.getElementById("scenario-description").textContent = scenario.description;

  document.getElementById("results-sections").innerHTML = [
    resultSection("Meeting Funnel", [
      resultRow("Booked Meetings", results.bookedMeetings),
      resultRow("Shown Meetings", results.shownMeetings),
      resultRow("Qualified Meetings", results.qualifiedMeetings),
      resultRow("Closed Customers", results.closedCustomers),
    ]),
    resultSection("Revenue Totals", [
      resultRow("Total Cash Collected", results.totalCashCollected, "currency", "money"),
      resultRow("Contracted Revenue", results.contractedRevenue, "currency", "money"),
      resultRow("Total LTV Revenue", results.totalLtvRevenue, "currency", "money"),
    ]),
    resultSection("ROI", [
      resultRow("CAC", results.cac, "currency"),
      resultRow("Cash ROAS", results.cashRoas, "multiple", "multiple"),
      resultRow("Contracted Revenue ROAS", results.contractedRevenueRoas, "multiple", "multiple"),
      resultRow("LTV ROAS", results.ltvRoas, "multiple", "multiple"),
    ]),
  ].join("");
}

function bindInputEvents() {
  document.querySelectorAll("input[data-key]").forEach((input) => {
    input.addEventListener("input", (event) => {
      appState.scenarios[appState.activeScenario].values[event.target.dataset.key] = Number(event.target.value);
      saveState();
      renderResults();
    });
  });
}

function render() {
  renderTabs();
  renderInputs();
  renderResults();
  bindInputEvents();
}

document.getElementById("scenario-tabs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-scenario]");
  if (!button) return;
  appState.activeScenario = button.dataset.scenario;
  saveState();
  render();
});

document.getElementById("reset-scenario").addEventListener("click", () => {
  appState.scenarios[appState.activeScenario] = structuredClone(scenarioDefaults[appState.activeScenario]);
  saveState();
  render();
});

document.getElementById("copy-summary").addEventListener("click", async () => {
  const scenario = appState.scenarios[appState.activeScenario];
  const results = calculate(scenario.values);
  const summary = [
    `Ads Forecast Calculator - ${scenario.name}`,
    `Ad spend: ${formatValue(scenario.values.adSpend, "currency")}`,
    `Cost per booked meeting: ${formatValue(scenario.values.costPerBookedMeeting, "currency")}`,
    `Booked meetings: ${formatValue(results.bookedMeetings, "number")}`,
    `Shown meetings: ${formatValue(results.shownMeetings, "number")}`,
    `Qualified meetings: ${formatValue(results.qualifiedMeetings, "number")}`,
    `Closed customers: ${formatValue(results.closedCustomers, "number")}`,
    `Total cash collected: ${formatValue(results.totalCashCollected, "currency")}`,
    `Contracted revenue: ${formatValue(results.contractedRevenue, "currency")}`,
    `Total LTV revenue: ${formatValue(results.totalLtvRevenue, "currency")}`,
    `CAC: ${formatValue(results.cac, "currency")}`,
    `Cash ROAS: ${formatValue(results.cashRoas, "multiple")}`,
    `Contracted revenue ROAS: ${formatValue(results.contractedRevenueRoas, "multiple")}`,
    `LTV ROAS: ${formatValue(results.ltvRoas, "multiple")}`,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(summary);
    showToast("Forecast copied");
  } catch {
    showToast("Copy unavailable");
  }
});

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 1800);
}

render();
