// ============================================================
// GLC Packaging Dashboard — confirmed/packed orders + bulk pack
// ============================================================

const client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

let currentUser = null;
let allOrders = [];
let activeFilter = "all";
let searchTerm = "";
let selectedIds = new Set();

document.addEventListener("DOMContentLoaded", boot);

async function boot() {
  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }
  currentUser = session.user;

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single();

  if (profileError || !profile) {
    console.error("Profile fetch failed:", profileError);
    window.location.href = "index.html";
    return;
  }

  if (profile.role !== "packaging" && profile.role !== "admin") {
    window.location.href = "dashboard.html";
    return;
  }

  document.getElementById("userEmail").textContent = currentUser.email;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await client.auth.signOut();
    window.location.href = "index.html";
  });

  document.getElementById("refreshBtn").addEventListener("click", loadOrders);

  document.getElementById("searchInput").addEventListener("input", (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderOrders();
  });

  document.querySelectorAll(".filter-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      activeFilter = btn.dataset.filter;
      renderOrders();
    });
  });

  document.getElementById("selectAllCheckbox").addEventListener("change", (e) => {
    const visibleOrders = getFilteredOrders();
    if (e.target.checked) {
      visibleOrders.forEach((o) => selectedIds.add(o.id));
    } else {
      visibleOrders.forEach((o) => selectedIds.delete(o.id));
    }
    renderOrders();
  });

  document.getElementById("markPackedBtn").addEventListener("click", markSelectedAsPacked);
  document.getElementById("exportBtn").addEventListener("click", exportAndPrint);

  await loadOrders();
}

async function loadOrders() {
  document.getElementById("ordersList").textContent = "Loading...";
  const { data, error } = await client
    .from("orders")
    .select("*")
    .in("status", ["confirmed", "packed"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Load orders failed:", error);
    document.getElementById("ordersList").innerHTML = `<p class="muted">Error loading orders. Refresh kore dekho.</p>`;
    return;
  }

  allOrders = data || [];
  selectedIds.clear();
  renderOrders();
}

function getFilteredOrders() {
  return allOrders.filter((o) => {
    if (activeFilter !== "all" && o.status !== activeFilter) return false;
    if (searchTerm) {
      const haystack = `${o.customer_name} ${o.phone}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });
}

function renderOrders() {
  const list = getFilteredOrders();

  document.getElementById("statConfirmed").textContent = allOrders.filter((o) => o.status === "confirmed").length;
  document.getElementById("statPacked").textContent = allOrders.filter((o) => o.status === "packed").length;

  const container = document.getElementById("ordersList");

  if (list.length === 0) {
    container.innerHTML = `<p class="muted">Kono order nai ei filter e.</p>`;
    updateBulkBar();
    return;
  }

  container.innerHTML = list
    .map((o) => {
      const checked = selectedIds.has(o.id) ? "checked" : "";
      return `
        <div class="order-card-row" data-id="${o.id}">
          <input type="checkbox" class="order-checkbox" data-id="${o.id}" ${checked} />
          <div style="flex:1; min-width:0;">
            <div class="order-card-row__top">
              <span class="status-badge status-badge--${o.status}">${o.status === "packed" ? "PACKED" : "CONFIRMED"}</span>
              <p class="order-card-row__name">${escapeHtml(o.customer_name)}</p>
            </div>
            <p class="order-card-row__meta">${escapeHtml(o.phone)} · ${escapeHtml(o.district)} · ${o.quantity} pcs · ৳${o.grand_total}</p>
            <p class="order-card-row__address">${escapeHtml(o.address)}</p>
          </div>
        </div>
      `;
    })
    .join("");

  container.querySelectorAll(".order-checkbox").forEach((cb) => {
    cb.addEventListener("change", (e) => {
      const id = Number(e.target.dataset.id);
      if (e.target.checked) {
        selectedIds.add(id);
      } else {
        selectedIds.delete(id);
      }
      updateBulkBar();
    });
  });

  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById("bulkActionBar");
  const count = selectedIds.size;
  document.getElementById("selectedCount").textContent = `${count} selected`;
  bar.classList.toggle("active", count > 0);

  const eligible = [...selectedIds].some((id) => {
    const order = allOrders.find((o) => o.id === id);
    return order && order.status === "confirmed";
  });
  document.getElementById("markPackedBtn").disabled = !eligible;
  document.getElementById("exportBtn").disabled = count === 0;
}

async function markSelectedAsPacked() {
  const idsToUpdate = [...selectedIds].filter((id) => {
    const order = allOrders.find((o) => o.id === id);
    return order && order.status === "confirmed";
  });

  if (idsToUpdate.length === 0) return;

  const btn = document.getElementById("markPackedBtn");
  btn.disabled = true;
  btn.textContent = "Updating...";

  const { error } = await client
    .from("orders")
    .update({
      status: "packed",
      packed_at: new Date().toISOString(),
      last_updated_by: currentUser.email,
    })
    .in("id", idsToUpdate);

  btn.textContent = "Mark Selected as Packed";

  if (error) {
    console.error("Bulk pack update failed:", error);
    alert("Update failed: " + error.message);
    btn.disabled = false;
    return;
  }

  await loadOrders();
}

function exportAndPrint() {
  const orders = [...selectedIds]
    .map((id) => allOrders.find((o) => o.id === id))
    .filter(Boolean);

  if (orders.length === 0) return;

  const slipsHtml = orders
    .map(
      (o) => `
        <div class="slip">
          <div class="slip__brand">GLC <span>Germany Life Care</span></div>
          <div class="slip__row"><span>Order</span><b>#${o.id}</b></div>
          <div class="slip__row"><span>Name</span><b>${escapeHtml(o.customer_name)}</b></div>
          <div class="slip__row"><span>Phone</span><b>${escapeHtml(o.phone)}</b></div>
          <div class="slip__row"><span>District</span><b>${escapeHtml(o.district)}</b></div>
          <div class="slip__address"><span>Address</span><p>${escapeHtml(o.address)}</p></div>
          <div class="slip__row"><span>Quantity</span><b>${o.quantity} pcs</b></div>
          <div class="slip__row slip__cod"><span>COD Amount</span><b>৳${o.grand_total}</b></div>
        </div>
      `
    )
    .join("");

  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="UTF-8" />
      <title>Packing Slips — GLC</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 16px; color: #1c1c1e; }
        .slips-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .slip { border: 1.5px dashed #999; border-radius: 8px; padding: 14px 16px; page-break-inside: avoid; break-inside: avoid; }
        .slip__brand { font-weight: 800; font-size: 16px; color: #C81E2C; margin-bottom: 10px; }
        .slip__brand span { font-weight: 600; font-size: 11px; color: #6B6F72; margin-left: 6px; }
        .slip__row { display: flex; justify-content: space-between; font-size: 13.5px; margin-bottom: 6px; border-bottom: 1px dotted #ddd; padding-bottom: 4px; }
        .slip__row span { color: #6B6F72; }
        .slip__address { font-size: 13.5px; margin-bottom: 6px; }
        .slip__address span { color: #6B6F72; display: block; margin-bottom: 2px; }
        .slip__address p { margin: 0; font-weight: 600; }
        .slip__cod { border-bottom: none; margin-top: 4px; padding-top: 6px; border-top: 1.5px solid #1c1c1e; }
        .slip__cod b { font-size: 16px; color: #C81E2C; }
        @media print { @page { margin: 10mm; } }
      </style>
    </head>
    <body>
      <div class="slips-grid">${slipsHtml}</div>
      <script>
        window.onload = function () { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}