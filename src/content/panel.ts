import type { PlanRow } from "../lib/flatten";
import { downloadCsv } from "../lib/csv";

interface Col {
  key: keyof PlanRow;
  label: string;
  numeric?: boolean;
  money?: boolean;
}

const COLUMNS: Col[] = [
  { key: "name", label: "Plan" },
  { key: "issuer", label: "Issuer" },
  { key: "metal", label: "Metal" },
  { key: "type", label: "Type" },
  { key: "premium", label: "Premium", numeric: true, money: true },
  { key: "premium_w_credit", label: "Premium w/ Credit", numeric: true, money: true },
  { key: "deductible", label: "Deductible", numeric: true, money: true },
  { key: "moop", label: "Max Out-of-Pocket", numeric: true, money: true },
  { key: "oopc", label: "Est. Monthly OOPC", numeric: true, money: true },
  { key: "quality_rating", label: "Stars", numeric: true },
  { key: "hsa_eligible", label: "HSA" },
];

// Rendered inside a shadow root so the host page's CSS can't reach it.
const CSS = `
:host { all: initial; }
.wrap { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,.45); font-family: system-ui, sans-serif; }
.modal { position: absolute; inset: 24px; background: #fff; border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.3); }
.bar { display: flex; gap: 12px; align-items: center; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; }
.bar h1 { font-size: 15px; margin: 0; }
.bar .count { color: #6b7280; font-size: 13px; white-space: nowrap; }
.bar input { flex: 1; padding: 6px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
.bar button { padding: 6px 12px; border: 1px solid #d1d5db; background: #f9fafb; border-radius: 6px; cursor: pointer; font-size: 14px; }
.bar button.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
.scroll { flex: 1; overflow: auto; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #f0f0f0; white-space: nowrap; }
th { position: sticky; top: 0; background: #f9fafb; cursor: pointer; user-select: none; }
th.sorted::after { content: " \\25B2"; }
th.sorted.desc::after { content: " \\25BC"; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
tr:hover td { background: #f5f8ff; }
a { color: #2563eb; }
`;

export function renderPanel(rows: PlanRow[]): void {
  document.getElementById("hgpe-panel")?.remove();

  const host = document.createElement("div");
  host.id = "hgpe-panel";
  const root = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);

  const style = document.createElement("style");
  style.textContent = CSS;
  root.appendChild(style);

  const wrap = document.createElement("div");
  wrap.className = "wrap";
  root.appendChild(wrap);

  let sortKey: keyof PlanRow = "premium_w_credit";
  let sortAsc = true;
  let filter = "";

  const money = (v: unknown) =>
    typeof v === "number" ? "$" + v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "";

  function visible(): PlanRow[] {
    const f = filter.trim().toLowerCase();
    const out = rows.filter(
      (r) => !f || `${r.name} ${r.issuer} ${r.metal} ${r.type}`.toLowerCase().includes(f),
    );
    out.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""));
      return sortAsc ? cmp : -cmp;
    });
    return out;
  }

  function draw(): void {
    const list = visible();
    const head = COLUMNS.map((c) => {
      const cls = [c.numeric ? "num" : "", c.key === sortKey ? `sorted${sortAsc ? "" : " desc"}` : ""]
        .join(" ")
        .trim();
      return `<th class="${cls}" data-key="${c.key}">${c.label}</th>`;
    }).join("");

    const bodyRows = list
      .map(
        (r) =>
          "<tr>" +
          COLUMNS.map((c) => {
            const v = r[c.key];
            let cell: string;
            if (c.key === "name") {
              // Link the plan name to its healthcare.gov page; fall back to the
              // Summary of Benefits & Coverage PDF if we couldn't build the URL.
              const href = r.plan_url || r.benefits_url;
              cell = href
                ? `<a href="${href}" target="_blank" rel="noopener">${esc(r.name)}</a>`
                : esc(r.name);
            } else if (c.money) {
              cell = money(v);
            } else if (typeof v === "boolean") {
              cell = v ? "Yes" : "";
            } else {
              cell = esc(v == null ? "" : String(v));
            }
            return `<td class="${c.numeric ? "num" : ""}">${cell}</td>`;
          }).join("") +
          "</tr>",
      )
      .join("");

    wrap.innerHTML = `
      <div class="modal">
        <div class="bar">
          <h1>HealthCare.gov Plan Explorer</h1>
          <span class="count">${list.length} of ${rows.length} plans</span>
          <input type="search" placeholder="Filter by plan, issuer, metal, type…" />
          <button class="primary" data-act="csv">Export CSV</button>
          <button data-act="close">Close</button>
        </div>
        <div class="scroll">
          <table><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody></table>
        </div>
      </div>`;

    const input = wrap.querySelector("input") as HTMLInputElement;
    input.value = filter;
    input.addEventListener("input", () => {
      filter = input.value;
      draw();
      const next = wrap.querySelector("input") as HTMLInputElement;
      next.focus();
      next.setSelectionRange(next.value.length, next.value.length);
    });

    wrap.querySelectorAll<HTMLElement>("th[data-key]").forEach((th) =>
      th.addEventListener("click", () => {
        const k = th.dataset.key as keyof PlanRow;
        if (k === sortKey) sortAsc = !sortAsc;
        else {
          sortKey = k;
          sortAsc = true;
        }
        draw();
      }),
    );

    wrap.querySelector('[data-act="csv"]')?.addEventListener("click", () => downloadCsv(visible()));
    wrap.querySelector('[data-act="close"]')?.addEventListener("click", () => host.remove());
  }

  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) host.remove();
  });

  draw();
}

function esc(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );
}
