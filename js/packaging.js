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
  document.getElementById("shipAndPrintBtn").addEventListener("click", readyToShipAndPrint);

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

  const shipEligible = [...selectedIds].some((id) => {
    const order = allOrders.find((o) => o.id === id);
    return order && order.status === "packed" && !order.consignment_id;
  });
  document.getElementById("shipAndPrintBtn").disabled = !shipEligible;
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

async function readyToShipAndPrint() {
  const idsToShip = [...selectedIds].filter((id) => {
    const order = allOrders.find((o) => o.id === id);
    return order && order.status === "packed" && !order.consignment_id;
  });

  if (idsToShip.length === 0) return;

  const btn = document.getElementById("shipAndPrintBtn");
  btn.disabled = true;
  btn.textContent = "প্রসেস হচ্ছে...";

  const shippedOrders = [];

  for (const id of idsToShip) {
    const order = allOrders.find((o) => o.id === id);
    const advanceType = order.advance_type || "none";
    let codAmount;
    if (advanceType === "full") codAmount = 0;
    else if (advanceType === "delivery_only") codAmount = order.product_total;
    else codAmount = order.grand_total;

    try {
      const res = await fetch("/api/steadfast-create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice: String(order.id),
          recipient_name: order.customer_name,
          recipient_phone: order.phone,
          recipient_address: `${order.address}, ${order.district}`,
          cod_amount: codAmount,
          note: `Qty: ${order.quantity}`,
        }),
      });
      const data = await res.json();

      if (data.status !== 200 || !data.consignment) {
        throw new Error(data.message || "Steadfast error");
      }

      const { consignment_id, tracking_code, status } = data.consignment;

      await client
        .from("orders")
        .update({
          consignment_id: String(consignment_id),
          tracking_code,
          steadfast_status: status || "in_review",
          status: "ready_to_ship",
          shipped_at: new Date().toISOString(),
          last_updated_by: currentUser.email,
        })
        .eq("id", order.id);

      shippedOrders.push({ ...order, consignment_id: String(consignment_id) });
    } catch (err) {
      console.error(`Shipment creation failed for order #${order.id}:`, err);
      alert(`Order #${order.id}: Shipment তৈরি ব্যর্থ হয়েছে — ${err.message || "Unknown error"}`);
    }
  }

  btn.textContent = "🚚 Ready to Ship + প্রিন্ট লেবেল";

  if (shippedOrders.length > 0) {
    printLabels(shippedOrders);
  }

  await loadOrders();
}

function printLabels(orders) {
  const labelsHtml = orders
    .map((o) => {
      const created = new Date(o.created_at);
      const pad = (n) => String(n).padStart(2, "0");
      const orderDate = `${created.getFullYear()}-${pad(created.getMonth() + 1)}-${pad(created.getDate())} ${pad(created.getHours())}:${pad(created.getMinutes())}:${pad(created.getSeconds())}`;
      const yy = String(created.getFullYear()).slice(-2);
      const invoiceNo = `${yy}${pad(created.getMonth() + 1)}${pad(created.getDate())}${String(o.id).padStart(4, "0")}`;

      return `
        <div class="label">
          <div class="label__brand">${escapeHtml(CONFIG.COMPANY_NAME)}</div>
          <div class="label__block">
            <p><b>${escapeHtml(o.customer_name)}</b></p>
            <p>Address: ${escapeHtml(o.address)}, ${escapeHtml(o.district)}</p>
            <p>Phone: ${escapeHtml(o.phone)}</p>
            <p>Order Date: ${orderDate}</p>
          </div>
          <div class="label__block">
            <p><b>${escapeHtml(CONFIG.COMPANY_NAME)}</b></p>
            <p>Address: ${escapeHtml(CONFIG.COMPANY_ADDRESS)}</p>
            <p>Phone: ${escapeHtml(CONFIG.COMPANY_PHONE)}</p>
            <p>Invoice No: ${invoiceNo}</p>
          </div>
          <div class="label__parcel">Parcel ID: <b>${escapeHtml(o.consignment_id || "—")}</b></div>
          <table class="label__table">
            <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
            <tbody>
              <tr>
                <td>${escapeHtml(CONFIG.PRODUCT_NAME)}</td>
                <td>${o.quantity}</td>
                <td>${CONFIG.MRP_PRICE}</td>
                <td>${o.product_total}</td>
              </tr>
            </tbody>
          </table>
          <div class="label__totals">
            <p>Subtotal: ${o.product_total} Tk</p>
            <p>Delivery: ${o.delivery_charge} Tk</p>
            <p class="label__grand">Total: ${o.grand_total} Tk</p>
          </div>
        </div>
      `;
    })
    .join("");

  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="bn">
    <head>
      <meta charset="UTF-8" />
      <title>Shipping Labels — GLC</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #1c1c1e; }
        .label { width: 3in; height: 4in; padding: 8px 10px; page-break-after: always; break-after: page; overflow: hidden; }
        .label:last-child { page-break-after: auto; break-after: auto; }
        .label__brand { font-weight: 800; font-size: 13px; text-align: center; border-bottom: 1.5px solid #1c1c1e; padding-bottom: 4px; margin-bottom: 6px; }
        .label__block { font-size: 9.5px; line-height: 1.4; border-bottom: 1px dashed #999; padding-bottom: 5px; margin-bottom: 5px; }
        .label__block p { margin: 0 0 1px; }
        .label__parcel { font-size: 10px; font-weight: 700; text-align: center; border: 1.5px solid #1c1c1e; border-radius: 4px; padding: 3px; margin-bottom: 6px; }
        .label__table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 6px; }
        .label__table th, .label__table td { border-bottom: 1px solid #ccc; padding: 2px 3px; text-align: left; }
        .label__table th:nth-child(2), .label__table td:nth-child(2),
        .label__table th:nth-child(3), .label__table td:nth-child(3),
        .label__table th:nth-child(4), .label__table td:nth-child(4) { text-align: right; }
        .label__totals { font-size: 9.5px; text-align: right; }
        .label__totals p { margin: 1px 0; }
        .label__grand { font-weight: 800; font-size: 11px; border-top: 1.5px solid #1c1c1e; padding-top: 3px; margin-top: 3px !important; }
        @media print { @page { size: 3in 4in; margin: 0; } }
      </style>
    </head>
    <body>
      ${labelsHtml}
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