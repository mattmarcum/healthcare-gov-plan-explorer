import { fetchAllPlans, fetchPlanDetail } from "../lib/api";
import { costExamples, toRow, type CostExamples } from "../lib/flatten";
import { getAppContext } from "../lib/session";
import type { AppContext, RawPlan } from "../lib/types";
import { renderPanel } from "./panel";

const BTN_ID = "hgpe-launch";
const LABEL = "Compare all plans";

function addButton(): void {
  if (document.getElementById(BTN_ID)) return;
  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.textContent = LABEL;
  Object.assign(btn.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "2147483646",
    padding: "10px 16px",
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    font: "600 14px system-ui, sans-serif",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,.25)",
  } as Partial<CSSStyleDeclaration>);
  btn.addEventListener("click", run);
  document.body.appendChild(btn);
}

async function run(): Promise<void> {
  const btn = document.getElementById(BTN_ID) as HTMLButtonElement;
  btn.disabled = true;
  try {
    btn.textContent = "Reading application…";
    const ctx = await getAppContext();
    const plans = await fetchAllPlans(ctx.apiBase, ctx.search, (n, total) => {
      btn.textContent = `Loading plans ${n}/${total}…`;
    });
    renderPanel(
      plans.map((p) => toRow(p, ctx)),
      makeEnrich(ctx, plans),
    );
  } catch (err) {
    alert(`Plan Explorer: ${(err as Error).message}`);
  } finally {
    btn.textContent = LABEL;
    btn.disabled = false;
  }
}

// Builds the on-demand "Load cost examples" pass: fetch each plan's detail
// (which carries the SBC coverage-example costs the bulk search omits) with a
// small concurrency cap, returning a planId -> cost-examples map.
function makeEnrich(ctx: AppContext, plans: RawPlan[]) {
  return async (onProgress: (loaded: number, total: number) => void) => {
    const ids = plans.map((p) => p.id);
    const result: Record<string, CostExamples> = {};
    let done = 0;
    await pool(ids, 6, async (id) => {
      try {
        result[id] = costExamples(await fetchPlanDetail(ctx.apiBase, ctx.search, id));
      } catch {
        /* skip plans that fail; leave their cost cells blank */
      }
      onProgress(++done, ids.length);
    });
    return result;
  };
}

/** Run `worker` over `items` with at most `size` in flight at once. */
async function pool<T>(items: T[], size: number, worker: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) await worker(items[i++]);
  });
  await Promise.all(runners);
}

addButton();

// The site is a single-page app that swaps views without reloading, which can
// remove our button. Re-add it whenever the DOM changes (cheap idempotent check).
new MutationObserver(() => addButton()).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
