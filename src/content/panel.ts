import type { CostExamples, PlanRow } from "../lib/flatten";
import { downloadCsv } from "../lib/csv";

type Kind = "money" | "bool" | "link" | "text";

interface Col {
  key: keyof PlanRow;
  label: string;
  kind?: Kind; // default "text"
  numeric?: boolean; // right-align + numeric sort
  linkText?: string; // anchor text for kind: "link"
  def?: boolean; // visible by default
}

const ALL_COLUMNS: Col[] = [
  { key: "name", label: "Plan", def: true },
  { key: "issuer", label: "Issuer", def: true },
  { key: "metal", label: "Metal", def: true },
  { key: "type", label: "Type", def: true },
  { key: "premium", label: "Premium", kind: "money", numeric: true },
  { key: "premium_w_credit", label: "Premium w/ Credit", kind: "money", numeric: true, def: true },
  { key: "deductible", label: "Deductible", kind: "money", numeric: true, def: true },
  { key: "moop", label: "Max Out-of-Pocket", kind: "money", numeric: true, def: true },
  { key: "oopc", label: "Est. Monthly OOPC", kind: "money", numeric: true, def: true },
  { key: "pcp", label: "Primary Care", def: true },
  { key: "specialist", label: "Specialist", def: true },
  { key: "er", label: "Emergency Room", def: true },
  { key: "generic_drug", label: "Generic Drugs", def: true },
  { key: "specialist_referral", label: "Referral Req'd", kind: "bool" },
  { key: "sbc_baby", label: "Childbirth (est.)", kind: "money", numeric: true },
  { key: "sbc_diabetes", label: "Diabetes/yr (est.)", kind: "money", numeric: true },
  { key: "sbc_fracture", label: "Fracture (est.)", kind: "money", numeric: true },
  { key: "quality_rating", label: "Stars", numeric: true, def: true },
  { key: "hsa_eligible", label: "HSA", kind: "bool", def: true },
  { key: "formulary_url", label: "Drug List", kind: "link", linkText: "Formulary" },
  { key: "network_url", label: "Providers", kind: "link", linkText: "Network" },
  { key: "benefits_url", label: "SBC", kind: "link", linkText: "PDF" },
];

const SBC_KEYS: (keyof PlanRow)[] = ["sbc_baby", "sbc_diabetes", "sbc_fracture"];
const STORAGE_KEY = "plan-explorer.visibleColumns";

function loadVisible(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set(ALL_COLUMNS.filter((c) => c.def).map((c) => c.key as string));
}

function saveVisible(keys: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    /* ignore */
  }
}

// Rendered inside a shadow root so the host page's CSS can't reach it.
const CSS = `
:host { all: initial; }
.wrap { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,.45); font-family: system-ui, sans-serif; }
.modal { position: absolute; inset: 24px; background: #fff; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.3); }
.bar { display: flex; gap: 12px; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
.bar h1 { font-size: 15px; margin: 0; white-space: nowrap; }
.bar .count { color: #6b7280; font-size: 13px; white-space: nowrap; }
.bar input.filter { flex: 1; min-width: 120px; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
.bar button { padding: 6px 12px; border: 1px solid #d1d5db; background: #f9fafb; border-radius: 6px; cursor: pointer; font-size: 14px; white-space: nowrap; }
.bar button.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.cols { position: relative; }
.colsMenu { position: absolute; right: 0; top: calc(100% + 4px); background: #fff; border: 1px solid #d1d5db; border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,.18); padding: 6px; max-height: 60vh; overflow: auto; z-index: 1; min-width: 200px; }
.colsMenu label { display: flex; gap: 8px; align-items: center; padding: 5px 8px; font-size: 13px; border-radius: 4px; cursor: pointer; }
.colsMenu label:hover { background: #f3f4f6; }
.scroll { flex: 1; overflow: auto; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; white-space: nowrap; }
th { position: sticky; top: 0; background: #f9fafb; cursor: pointer; user-select: none; }
th.sorted::after { content: " \\25B2"; }
th.sorted.desc::after { content: " \\25BC"; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
tr:hover td { background: #f5f8ff; }
a { color: #2563eb; }
.disclaimer { padding: 7px 16px; border-top: 1px solid #e5e7eb; background: #f9fafb; color: #6b7280; font-size: 11px; line-height: 1.4; }
`;

type Enrich = (
  onProgress: (loaded: number, total: number) => void,
) => Promise<Record<string, CostExamples>>;

export function renderPanel(rows: PlanRow[], enrich?: Enrich): void {
  document.getElementById("plan-explorer-panel")?.remove();

  const host = document.createElement("div");
  host.id = "plan-explorer-panel";
  const root = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);

  const style = document.createElement("style");
  style.textContent = CSS;
  root.appendChild(style);

  const visibleKeys = loadVisible();
  let sortKey: keyof PlanRow = "premium_w_credit";
  let sortAsc = true;
  let filter = "";

  // Build the shell once; only the head/body/count are re-rendered on change.
  const wrap = document.createElement("div");
  wrap.className = "wrap";
  wrap.innerHTML = `<div class="modal">
      <div class="bar">
        <h1>Plan Explorer for HealthCare.gov</h1>
        <span class="count"></span>
        <input class="filter" type="search" placeholder="Filter by plan, issuer, metal, type…" />
        ${enrich ? '<button class="loadCosts">Load cost examples</button>' : ""}
        <div class="cols">
          <button class="colsBtn">Columns ▾</button>
          <div class="colsMenu" hidden></div>
        </div>
        <button class="primary csv">Export CSV</button>
        <button class="close">Close</button>
      </div>
      <div class="scroll"><table><thead></thead><tbody></tbody></table></div>
      <div class="disclaimer">Independent tool — not affiliated with, endorsed by, or operated by HealthCare.gov, CMS, or the U.S. government. Always confirm details on HealthCare.gov before enrolling.</div>
    </div>`;
  root.appendChild(wrap);
  const countEl = root.querySelector(".count") as HTMLElement;
  const filterEl = root.querySelector(".filter") as HTMLInputElement;
  const thead = root.querySelector("thead") as HTMLElement;
  const tbody = root.querySelector("tbody") as HTMLElement;
  const colsBtn = root.querySelector(".colsBtn") as HTMLElement;
  const colsMenu = root.querySelector(".colsMenu") as HTMLElement;
  const loadBtn = root.querySelector(".loadCosts") as HTMLButtonElement | null;

  const cols = (): Col[] => ALL_COLUMNS.filter((c) => visibleKeys.has(c.key as string));
  const money = (v: unknown) =>
    typeof v === "number" ? "$" + v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "";

  function visibleRows(): PlanRow[] {
    const f = filter.trim().toLowerCase();
    const out = rows.filter(
      (r) => !f || `${r.name} ${r.issuer} ${r.metal} ${r.type}`.toLowerCase().includes(f),
    );
    out.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else if (av == null || av === "") cmp = bv == null || bv === "" ? 0 : 1; // blanks last
      else if (bv == null || bv === "") cmp = -1;
      else cmp = String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return out;
  }

  function cell(r: PlanRow, c: Col): string {
    const v = r[c.key];
    let inner: string;
    if (c.key === "name") {
      const href = r.plan_url || r.benefits_url;
      inner = href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(r.name)}</a>` : esc(r.name);
    } else if (c.kind === "link") {
      inner = v ? `<a href="${esc(String(v))}" target="_blank" rel="noopener">${esc(c.linkText || "Link")}</a>` : "";
    } else if (c.kind === "money") {
      inner = money(v);
    } else if (c.kind === "bool") {
      inner = v ? "Yes" : "";
    } else {
      inner = esc(v == null ? "" : String(v));
    }
    return `<td class="${c.numeric ? "num" : ""}">${inner}</td>`;
  }

  function renderHead(): void {
    thead.innerHTML =
      "<tr>" +
      cols()
        .map((c) => {
          const cls = [c.numeric ? "num" : "", c.key === sortKey ? `sorted${sortAsc ? "" : " desc"}` : ""]
            .join(" ")
            .trim();
          return `<th class="${cls}" data-key="${c.key}">${esc(c.label)}</th>`;
        })
        .join("") +
      "</tr>";
  }

  function renderBody(): void {
    const list = visibleRows();
    countEl.textContent = `${list.length} of ${rows.length} plans`;
    const active = cols();
    tbody.innerHTML = list
      .map((r) => "<tr>" + active.map((c) => cell(r, c)).join("") + "</tr>")
      .join("");
  }

  function drawTable(): void {
    renderHead();
    renderBody();
  }

  function renderColsMenu(): void {
    colsMenu.innerHTML = ALL_COLUMNS.map((c) => {
      const checked = visibleKeys.has(c.key as string) ? "checked" : "";
      return `<label><input type="checkbox" data-key="${c.key}" ${checked}/> ${esc(c.label)}</label>`;
    }).join("");
  }

  // --- events ---
  filterEl.addEventListener("input", () => {
    filter = filterEl.value;
    renderBody();
  });

  thead.addEventListener("click", (e) => {
    const th = (e.target as HTMLElement).closest("th[data-key]") as HTMLElement | null;
    if (!th) return;
    const k = th.dataset.key as keyof PlanRow;
    if (k === sortKey) sortAsc = !sortAsc;
    else {
      sortKey = k;
      sortAsc = true;
    }
    drawTable();
  });

  colsBtn.addEventListener("click", () => {
    colsMenu.hidden = !colsMenu.hidden;
  });
  colsMenu.addEventListener("change", (e) => {
    const cb = e.target as HTMLInputElement;
    const k = cb.dataset.key;
    if (!k) return;
    if (cb.checked) visibleKeys.add(k);
    else visibleKeys.delete(k);
    saveVisible(visibleKeys);
    drawTable();
  });

  root.querySelector(".csv")?.addEventListener("click", () => {
    downloadCsv(visibleRows(), cols().map((c) => c.key));
  });
  root.querySelector(".close")?.addEventListener("click", () => host.remove());
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) host.remove();
    else if (!colsMenu.hidden && !(e.target as HTMLElement).closest(".cols")) colsMenu.hidden = true;
  });

  loadBtn?.addEventListener("click", async () => {
    if (!enrich) return;
    loadBtn.disabled = true;
    try {
      const result = await enrich((n, total) => {
        loadBtn.textContent = `Loading costs ${n}/${total}…`;
      });
      const index = new Map(rows.map((r) => [r.id, r] as const));
      for (const [id, ce] of Object.entries(result)) {
        const r = index.get(id);
        if (r) Object.assign(r, ce);
      }
      SBC_KEYS.forEach((k) => visibleKeys.add(k as string));
      saveVisible(visibleKeys);
      renderColsMenu();
      drawTable();
      loadBtn.remove();
    } catch (err) {
      loadBtn.disabled = false;
      loadBtn.textContent = "Load cost examples";
      alert(`Plan Explorer: ${(err as Error).message}`);
    }
  });

  renderColsMenu();
  drawTable();
}

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}
