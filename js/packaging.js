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

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}