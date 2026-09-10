// =========================================================================
// GLC Dashboard — order list + status management
// =========================================================================

const client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const STATUS_LABELS = {
  pending_confirmation: "Pending",
  followup: "Followup",
  confirmed: "Confirmed",
  packed: "Packed",
  ready_to_ship: "Ready To Ship",
  shipped: "Shipped",
  hold_by_courier: "Hold By Courier",
  delivered: "Delivered",
  payment_received: "Payment Received",
  returned: "Returned",
  cancelled: "Canceled",
  unresolved: "Unresolved",
};

let currentUser = null;
let currentUserRole = null;
let allOrders = [];
let allLeads = [];
let allCancelledLeads = [];
let allFollowupLeads = [];
let activeFilter = "all";
let searchTerm = "";
let currentModalOrder = null;
let currentModalLead = null;

document.addEventListener("DOMContentLoaded", boot);

async function boot() {
  const { data: { session } } = await client.auth.getSession();
  if (!session) {
    window.location.href = "index.html";
    return;
  }
  currentUser = session.user;
  document.getElementById("userEmail").textContent = currentUser.email;

  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single();

  if (profile) currentUserRole = profile.role;

  if (profile && profile.role === "admin") {
    document.getElementById("steadfastBalance").hidden = false;
    loadSteadfastBalance();
  }

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await client.auth.signOut();
    window.location.href = "index.html";
  });

  document.getElementById("refreshBtn").addEventListener("click", () => {
    if (activeFilter === "leads") loadLeads();
    else if (activeFilter === "lead_followup") loadFollowupLeads();
    else if (activeFilter === "cancelled_leads") loadCancelledLeads();
    else loadOrders();
  });
  document.getElementById("searchBox").addEventListener("input", (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    if (activeFilter === "leads") renderLeadsList();
    else if (activeFilter === "lead_followup") renderFollowupLeadsList();
    else if (activeFilter === "cancelled_leads") renderCancelledLeadsList();
    else render();
  });

  document.querySelectorAll(".filter-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      activeFilter = btn.dataset.status;
      if (activeFilter === "leads") {
        loadLeads();
      } else if (activeFilter === "lead_followup") {
        loadFollowupLeads();
      } else if (activeFilter === "cancelled_leads") {
        loadCancelledLeads();
      } else {
        render();
      }
    });
  });

  document.getElementById("modalBackdrop").addEventListener("click", closeModal);
  document.getElementById("modalClose").addEventListener("click", closeModal);
  document.getElementById("leadModalBackdrop").addEventListener("click", closeLeadModal);
  document.getElementById("leadModalClose").addEventListener("click", closeLeadModal);

  await loadOrders();
}

async function loadSteadfastBalance() {
  const el = document.getElementById("steadfastBalance");
  if (!el) return;
  try {
    const res = await fetch("/api/steadfast-balance");
    const data = await res.json();
    if (typeof data.current_balance === "number") {
      const bal = data.current_balance;
      el.textContent = `Steadfast: ৳${bal}`;
      el.style.color = bal < 0 ? "var(--danger)" : "var(--success)";
      el.style.fontWeight = "700";
    } else {
      el.textContent = "Steadfast: N/A";
    }
  } catch (err) {
    console.error("Steadfast balance fetch failed:", err);
    el.textContent = "Steadfast: Error";
  }
}

async function loadOrders() {
  document.getElementById("loadingMsg").hidden = false;
  const { data, error } = await client
    .from("orders")
    .select("*")
    .order("created_at", { ascending: true });

  document.getElementById("loadingMsg").hidden = true;

  if (error) {
    console.error(error);
    alert(t("loadError"));
    return;
  }

  allOrders = data || [];
  updateStats();
  if (activeFilter !== "leads") render();
}

async function loadLeads() {
  document.getElementById("loadingMsg").hidden = false;
  const { data, error } = await client
    .from("leads")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  document.getElementById("loadingMsg").hidden = true;

  if (error) {
    console.error(error);
    alert(t("loadError"));
    return;
  }

  allLeads = data || [];
  renderLeadsList();
}

async function loadCancelledLeads() {
  document.getElementById("loadingMsg").hidden = false;
  const { data, error } = await client
    .from("leads")
    .select("*")
    .eq("status", "cancelled")
    .order("created_at", { ascending: true });

  document.getElementById("loadingMsg").hidden = true;

  if (error) {
    console.error(error);
    alert(t("loadError"));
    return;
  }

  allCancelledLeads = data || [];
  renderCancelledLeadsList();
}

async function loadFollowupLeads() {
  document.getElementById("loadingMsg").hidden = false;
  const { data, error } = await client
    .from("leads")
    .select("*")
    .eq("status", "followup")
    .order("created_at", { ascending: true });

  document.getElementById("loadingMsg").hidden = true;

  if (error) {
    console.error(error);
    alert(t("loadError"));
    return;
  }

  allFollowupLeads = data || [];
  renderFollowupLeadsList();
}

function renderLeadsList() {
  let list = allLeads;
  if (searchTerm) {
    list = list.filter(l =>
      (l.customer_name || "").toLowerCase().includes(searchTerm) ||
      (l.phone || "").includes(searchTerm)
    );
  }

  const wrap = document.getElementById("ordersList");
  const emptyMsg = document.getElementById("emptyMsg");
  wrap.innerHTML = "";

  if (list.length === 0) {
    emptyMsg.textContent = t("noLeads");
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  list.forEach(lead => wrap.appendChild(renderLeadCard(lead)));
}

function renderLeadCard(lead) {
  const card = document.createElement("div");
  card.className = "order-card-row";
  card.innerHTML = `
    <div class="order-card-row__main">
      <div class="order-card-row__top">
        <span class="status-badge status-badge--pending_confirmation">${t("leadBadge")}</span>
        <span class="order-card-row__time">${formatDate(lead.created_at)}</span>
      </div>
      <h3 class="order-card-row__name">${escapeHtml(lead.customer_name)}</h3>
      <p class="order-card-row__meta">${escapeHtml(lead.phone)}${lead.district ? " · " + escapeHtml(lead.district) : ""}${lead.quantity ? " · " + lead.quantity + " " + t("pcs") : ""}</p>
      <p class="order-card-row__address">${escapeHtml(lead.address || "")}</p>
    </div>
    <div class="order-card-row__actions">
      <button type="button" class="btn btn--ghost btn--sm" data-copy-phone="${escapeAttr(lead.phone)}">${t("copyNumber")}</button>
      <button type="button" class="btn btn--ghost btn--sm" data-followup-lead="${lead.id}">${t("followupBtn")}</button>
      <button type="button" class="btn btn--ghost btn--sm btn--danger-ghost" data-cancel-lead="${lead.id}">${t("cancelBtn")}</button>
      <button class="btn btn--primary btn--sm" data-convert="${lead.id}">${t("convertBtn")}</button>
    </div>
  `;
  card.querySelector("[data-copy-phone]").addEventListener("click", (e) => {
    navigator.clipboard.writeText(lead.phone);
    const btn = e.currentTarget;
    const original = btn.textContent;
    btn.textContent = t("copied");
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
  card.querySelector("[data-followup-lead]").addEventListener("click", () => markLeadFollowup(lead));
  card.querySelector("[data-cancel-lead]").addEventListener("click", () => cancelLead(lead));
  card.querySelector("[data-convert]").addEventListener("click", () => openLeadModal(lead));
  return card;
}

function renderCancelledLeadsList() {
  let list = allCancelledLeads;
  if (searchTerm) {
    list = list.filter(l =>
      (l.customer_name || "").toLowerCase().includes(searchTerm) ||
      (l.phone || "").includes(searchTerm)
    );
  }

  const wrap = document.getElementById("ordersList");
  const emptyMsg = document.getElementById("emptyMsg");
  wrap.innerHTML = "";

  if (list.length === 0) {
    emptyMsg.textContent = t("noCancelledLeads");
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  list.forEach(lead => wrap.appendChild(renderCancelledLeadCard(lead)));
}

function renderCancelledLeadCard(lead) {
  const card = document.createElement("div");
  card.className = "order-card-row";
  card.innerHTML = `
    <div class="order-card-row__main">
      <div class="order-card-row__top">
        <span class="status-badge status-badge--cancelled">${t("cancelledLeadBadge")}</span>
        <span class="order-card-row__time">${formatDate(lead.created_at)}</span>
      </div>
      <h3 class="order-card-row__name">${escapeHtml(lead.customer_name)}</h3>
      <p class="order-card-row__meta">${escapeHtml(lead.phone)}${lead.district ? " · " + escapeHtml(lead.district) : ""}</p>
      <p class="order-card-row__address">${escapeHtml(lead.address || "")}</p>
      ${lead.cancel_reason ? `<p class="order-card-row__address" style="color:var(--danger);"><b>${t("cancelReasonLabel")}:</b> ${escapeHtml(lead.cancel_reason)}</p>` : ""}
    </div>
    <div class="order-card-row__actions">
      <button type="button" class="btn btn--ghost btn--sm" data-copy-phone="${escapeAttr(lead.phone)}">${t("copyNumber")}</button>
      ${currentUserRole === "admin" ? `<button type="button" class="btn btn--ghost btn--sm" data-edit-reason="${lead.id}">${t("editBtn")}</button>` : ""}
      <button type="button" class="btn btn--ghost btn--sm btn--restore-ghost" data-restore-lead="${lead.id}">${t("restoreBtn")}</button>
    </div>
  `;
  card.querySelector("[data-copy-phone]").addEventListener("click", (e) => {
    navigator.clipboard.writeText(lead.phone);
    const btn = e.currentTarget;
    const original = btn.textContent;
    btn.textContent = t("copied");
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
  const editReasonBtn = card.querySelector("[data-edit-reason]");
  if (editReasonBtn) {
    editReasonBtn.addEventListener("click", () => editLeadCancelReason(lead));
  }
  card.querySelector("[data-restore-lead]").addEventListener("click", () => restoreLead(lead));
  return card;
}

function renderFollowupLeadsList() {
  let list = allFollowupLeads;
  if (searchTerm) {
    list = list.filter(l =>
      (l.customer_name || "").toLowerCase().includes(searchTerm) ||
      (l.phone || "").includes(searchTerm)
    );
  }

  const wrap = document.getElementById("ordersList");
  const emptyMsg = document.getElementById("emptyMsg");
  wrap.innerHTML = "";

  if (list.length === 0) {
    emptyMsg.textContent = t("noFollowupLeads");
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  list.forEach(lead => wrap.appendChild(renderFollowupLeadCard(lead)));
}

function renderFollowupLeadCard(lead) {
  const card = document.createElement("div");
  card.className = "order-card-row";
  card.innerHTML = `
    <div class="order-card-row__main">
      <div class="order-card-row__top">
        <span class="status-badge status-badge--followup">${t("leadFollowupTab")}</span>
        <span class="order-card-row__time">${formatDate(lead.created_at)}</span>
      </div>
      <h3 class="order-card-row__name">${escapeHtml(lead.customer_name)}</h3>
      <p class="order-card-row__meta">${escapeHtml(lead.phone)}${lead.district ? " · " + escapeHtml(lead.district) : ""}</p>
      <p class="order-card-row__address">${escapeHtml(lead.address || "")}</p>
    </div>
    <div class="order-card-row__actions">
      <button type="button" class="btn btn--ghost btn--sm" data-copy-phone="${escapeAttr(lead.phone)}">${t("copyNumber")}</button>
      <button type="button" class="btn btn--ghost btn--sm" data-back-pending="${lead.id}">${t("backToPendingBtn")}</button>
      <button type="button" class="btn btn--ghost btn--sm btn--danger-ghost" data-cancel-lead="${lead.id}">${t("cancelBtn")}</button>
      <button class="btn btn--primary btn--sm" data-convert="${lead.id}">${t("convertBtn")}</button>
    </div>
  `;
  card.querySelector("[data-copy-phone]").addEventListener("click", (e) => {
    navigator.clipboard.writeText(lead.phone);
    const btn = e.currentTarget;
    const original = btn.textContent;
    btn.textContent = t("copied");
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
  card.querySelector("[data-back-pending]").addEventListener("click", () => moveLeadToPending(lead));
  card.querySelector("[data-cancel-lead]").addEventListener("click", () => cancelLead(lead));
  card.querySelector("[data-convert]").addEventListener("click", () => openLeadModal(lead));
  return card;
}

async function cancelLead(lead) {
  const reason = await askReason({
    title: t("cancelReasonModalTitle"),
    subtitle: `${lead.customer_name} — ${t("cancelLeadConfirm")}`,
    placeholder: t("cancelReasonPlaceholder"),
    confirmLabel: t("confirmCancelBtn"),
  });
  if (reason === null) return;

  const { error } = await client
    .from("leads")
    .update({ status: "cancelled", cancel_reason: reason })
    .eq("id", lead.id);

  if (error) {
    console.error(error);
    alert(t("cancelFailed") + " (" + error.message + ")");
    return;
  }

  if (activeFilter === "lead_followup") await loadFollowupLeads();
  else await loadLeads();
}

async function markLeadFollowup(lead) {
  if (!confirm(`${lead.customer_name} — ${t("markFollowupConfirm")}`)) return;

  const { error } = await client
    .from("leads")
    .update({ status: "followup" })
    .eq("id", lead.id);

  if (error) {
    console.error(error);
    alert(t("updateFailed") + " (" + error.message + ")");
    return;
  }

  await loadLeads();
}

async function moveLeadToPending(lead) {
  const { error } = await client
    .from("leads")
    .update({ status: "pending" })
    .eq("id", lead.id);

  if (error) {
    console.error(error);
    alert(t("updateFailed") + " (" + error.message + ")");
    return;
  }

  await loadFollowupLeads();
}

async function restoreLead(lead) {
  if (!confirm(`${lead.customer_name} — ${t("restoreLeadConfirm")}`)) return;

  const { error } = await client
    .from("leads")
    .update({ status: "pending", cancel_reason: null })
    .eq("id", lead.id);

  if (error) {
    console.error(error);
    alert(t("restoreFailed") + " (" + error.message + ")");
    return;
  }

  await loadCancelledLeads();
}

async function editLeadCancelReason(lead) {
  const updated = await askReason({
    title: t("editCancelReasonTitle"),
    subtitle: lead.customer_name,
    initialValue: lead.cancel_reason || "",
    confirmLabel: t("saveBtn"),
  });
  if (updated === null) return;

  const { error } = await client
    .from("leads")
    .update({ cancel_reason: updated })
    .eq("id", lead.id);

  if (error) {
    console.error(error);
    alert(t("updateFailed") + " (" + error.message + ")");
    return;
  }

  await loadCancelledLeads();
}

function openLeadModal(lead) {
  currentModalLead = lead;
  const modal = document.getElementById("leadModal");
  const body = document.getElementById("leadModalBody");
  const qty = lead.quantity || 1;
  const productTotal = CONFIG.UNIT_PRICE * qty;
  const grandTotal = productTotal + CONFIG.DELIVERY_CHARGE;

  body.innerHTML = `
    <h2 class="modal__title">${t("convertLeadTitle")}</h2>
    <div class="modal__grid">
      <div><span class="modal__label">${t("name")}</span><input type="text" id="leadName" class="modal__edit-input" value="${escapeAttr(lead.customer_name)}"></div>
      <div><span class="modal__label">${t("phone")}</span><p class="phone-copy"><span>${escapeHtml(lead.phone)}</span></p></div>
      <div><span class="modal__label">${t("district")}</span><input type="text" id="leadDistrict" class="modal__edit-input" value="${escapeAttr(lead.district || "")}"></div>
      <div><span class="modal__label">${t("quantity")}</span><input type="number" id="leadQuantity" class="modal__edit-input" min="1" value="${qty}"></div>
      <div><span class="modal__label">${t("age")}</span><input type="number" id="leadAge" class="modal__edit-input" min="1" value="${lead.age || ""}"></div>
      <div class="modal__grid-full"><span class="modal__label">${t("address")}</span><textarea id="leadAddress" class="modal__edit-input" rows="2">${escapeHtml(lead.address || "")}</textarea></div>
    </div>

    <div class="modal__payment">
      <h4>${t("paymentVerification")}</h4>
      <p>${t("productTotal")}: ৳<span id="leadProductTotal">${productTotal}</span> + ${t("delivery")}: ৳${CONFIG.DELIVERY_CHARGE} = <b>৳<span id="leadGrandTotal">${grandTotal}</span></b></p>
    </div>

    <div class="modal__notes">
      <label for="leadPaymentMethod">${t("paymentMethodLabel")}</label>
      <select id="leadPaymentMethod">
        <option value="bkash">bKash</option>
        <option value="nagad">Nagad</option>
        <option value="cod">COD (ক্যাশ অন ডেলিভারি)</option>
      </select>
    </div>
    <div id="leadAdvanceFields">
      <div class="modal__notes">
        <label for="leadSenderNumber">${t("senderNumber")} <span class="optional-tag">${t("optionalTag")}</span></label>
        <input type="text" id="leadSenderNumber" placeholder="01XXXXXXXXX">
      </div>
      <div class="modal__notes">
        <label for="leadTrxId">Transaction ID <span class="optional-tag">${t("optionalTag")}</span></label>
        <input type="text" id="leadTrxId" placeholder="TrxID">
      </div>
    </div>
    <div class="modal__notes">
      <label for="leadHandledBy">${t("handledByLabel")}</label>
      <input type="text" id="leadHandledBy" placeholder="${t("handledByPlaceholder")}">
    </div>

    <button class="btn btn--primary btn--block" id="convertLeadBtn">${t("convertBtn")}</button>
    <p id="leadModalStatusMsg" class="form-status"></p>
  `;

  document.getElementById("leadQuantity").addEventListener("input", (e) => {
    const q = parseInt(e.target.value || "1", 10);
    const pt = CONFIG.UNIT_PRICE * q;
    document.getElementById("leadProductTotal").textContent = pt;
    document.getElementById("leadGrandTotal").textContent = pt + CONFIG.DELIVERY_CHARGE;
  });

  document.getElementById("leadPaymentMethod").addEventListener("change", (e) => {
    document.getElementById("leadAdvanceFields").style.display = e.target.value === "cod" ? "none" : "";
  });

  document.getElementById("convertLeadBtn").addEventListener("click", convertLead);

  modal.hidden = false;
}

function closeLeadModal() {
  document.getElementById("leadModal").hidden = true;
  currentModalLead = null;
}

async function convertLead() {
  const lead = currentModalLead;
  const msgEl = document.getElementById("leadModalStatusMsg");

  const name = document.getElementById("leadName").value.trim();
  const district = document.getElementById("leadDistrict").value.trim();
  const address = document.getElementById("leadAddress").value.trim();
  const quantity = parseInt(document.getElementById("leadQuantity").value || "1", 10);
  const paymentMethod = document.getElementById("leadPaymentMethod").value;
  const senderNumber = document.getElementById("leadSenderNumber").value.trim();
  const trxId = document.getElementById("leadTrxId").value.trim();
  const handledBy = document.getElementById("leadHandledBy").value.trim();
  const ageInput = document.getElementById("leadAge").value;
  const age = ageInput ? parseInt(ageInput, 10) : null;

  if (!name || !district || !address || !handledBy) {
    msgEl.textContent = t("fillAllFields");
    msgEl.className = "form-status error";
    return;
  }

  const unitPrice = CONFIG.UNIT_PRICE;
  const deliveryCharge = CONFIG.DELIVERY_CHARGE;
  const productTotal = unitPrice * quantity;
  const grandTotal = productTotal + deliveryCharge;

  msgEl.textContent = t("updating");
  msgEl.className = "form-status";

  const { data: inserted, error } = await client
    .from("orders")
    .insert({
      customer_name: name,
      phone: lead.phone,
      address,
      district,
      quantity,
      unit_price: unitPrice,
      product_total: productTotal,
      delivery_charge: deliveryCharge,
      grand_total: grandTotal,
      payment_method: paymentMethod,
      sender_number: senderNumber || null,
      trx_id: trxId || null,
      age,
      handled_by: handledBy,
      status: "pending_confirmation",
      confirmed_by: currentUser.email,
      last_updated_by: currentUser.email,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    msgEl.textContent = t("updateFailed");
    msgEl.className = "form-status error";
    return;
  }

  await client
    .from("leads")
    .update({ status: "converted", converted_order_id: inserted.id })
    .eq("id", lead.id);

  msgEl.textContent = t("updateSuccess");
  msgEl.className = "form-status success";
  if (activeFilter === "lead_followup") await loadFollowupLeads();
  else await loadLeads();
  await loadOrders();
  setTimeout(closeLeadModal, 700);
}

function updateStats() {
  const counts = { pending_confirmation: 0, confirmed: 0, delivered: 0, cancelled: 0 };
  allOrders.forEach(o => { if (counts[o.status] !== undefined) counts[o.status]++; });
  document.getElementById("statPending").textContent = counts.pending_confirmation;
  document.getElementById("statConfirmed").textContent = counts.confirmed;
  document.getElementById("statDelivered").textContent = counts.delivered;
  document.getElementById("statCancelled").textContent = counts.cancelled;
}

function render() {
  let list = allOrders;
  if (activeFilter !== "all") list = list.filter(o => o.status === activeFilter);
  if (searchTerm) {
    list = list.filter(o =>
      (o.customer_name || "").toLowerCase().includes(searchTerm) ||
      (o.phone || "").includes(searchTerm)
    );
  }

  const wrap = document.getElementById("ordersList");
  const emptyMsg = document.getElementById("emptyMsg");
  wrap.innerHTML = "";

  if (list.length === 0) {
    emptyMsg.textContent = t("noOrders");
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  list.forEach(order => wrap.appendChild(renderCard(order)));
}

function renderCard(order) {
  const card = document.createElement("div");
  card.className = "order-card-row";
  const paymentLabels = { bkash: "bKash", nagad: "Nagad", cod: "COD" };
  const paymentDisplay = order.payment_method ? (paymentLabels[order.payment_method] || order.payment_method) : "";
  const advanceDisplay = order.advance_type === "full" ? "Full Advance" : order.advance_type === "delivery_only" ? "Delivery Advance" : "";
  const notesPreview = order.notes ? (order.notes.length > 40 ? order.notes.slice(0, 40) + "…" : order.notes) : "";
  card.innerHTML = `
    <div class="order-card-row__main">
      <div class="order-card-row__top">
        <span class="status-badge status-badge--${order.status}">${STATUS_LABELS[order.status] || order.status}</span>
        <span class="order-card-row__time">${formatDate(order.created_at)}</span>
      </div>
      <h3 class="order-card-row__name">${escapeHtml(order.customer_name)}</h3>
      <p class="order-card-row__meta">${escapeHtml(order.phone)} · ${escapeHtml(order.district)} · ${order.quantity} ${t("pcs")} · ৳${order.grand_total}</p>
      <p class="order-card-row__address">${escapeHtml(order.address)}</p>
      <div class="order-card-row__details">
        ${paymentDisplay ? `<span class="order-card-row__detail-chip">💳 <b>${escapeHtml(paymentDisplay)}</b></span>` : ""}
        ${advanceDisplay ? `<span class="order-card-row__detail-chip">💰 <b>${advanceDisplay}</b></span>` : ""}
        ${order.age ? `<span class="order-card-row__detail-chip">🎂 <b>${order.age}</b></span>` : ""}
        ${order.handled_by ? `<span class="order-card-row__detail-chip">👤 <b>${escapeHtml(order.handled_by)}</b></span>` : ""}
        ${notesPreview ? `<span class="order-card-row__detail-chip">📝 ${escapeHtml(notesPreview)}</span>` : ""}
      </div>
      ${order.status === "cancelled" && order.cancel_reason ? `<p class="order-card-row__address" style="color:var(--danger);"><b>${t("cancelReasonLabel")}:</b> ${escapeHtml(order.cancel_reason)}</p>` : ""}
    </div>
    <div class="order-card-row__actions">
      <button type="button" class="btn btn--ghost btn--sm" data-copy-phone="${escapeAttr(order.phone)}">${t("copyNumber")}</button>
      ${
        order.status === "cancelled"
          ? `<button type="button" class="btn btn--ghost btn--sm btn--restore-ghost" data-restore-order="${order.id}">${t("restoreBtn")}</button>`
          : `<button type="button" class="btn btn--ghost btn--sm btn--danger-ghost" data-cancel-order="${order.id}">${t("cancelBtn")}</button>`
      }
      <button class="btn btn--primary btn--sm" data-open="${order.id}">${t("detailsBtn")}</button>
    </div>
  `;
  card.querySelector("[data-copy-phone]").addEventListener("click", (e) => {
    navigator.clipboard.writeText(order.phone);
    const btn = e.currentTarget;
    const original = btn.textContent;
    btn.textContent = t("copied");
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
  const cancelOrderBtn = card.querySelector("[data-cancel-order]");
  if (cancelOrderBtn) cancelOrderBtn.addEventListener("click", () => quickCancelOrder(order));
  const restoreOrderBtn = card.querySelector("[data-restore-order]");
  if (restoreOrderBtn) restoreOrderBtn.addEventListener("click", () => restoreOrder(order));
  card.querySelector("[data-open]").addEventListener("click", () => openModal(order));
  return card;
}

async function quickCancelOrder(order) {
  const reason = await askReason({
    title: t("cancelReasonModalTitle"),
    subtitle: `${order.customer_name} — ${t("cancelOrderConfirm")}`,
    placeholder: t("cancelReasonPlaceholder"),
    confirmLabel: t("confirmCancelBtn"),
  });
  if (reason === null) return;

  const { error } = await client
    .from("orders")
    .update({
      status: "cancelled",
      previous_status: order.status,
      cancel_reason: reason,
      last_updated_by: currentUser.email,
    })
    .eq("id", order.id);

  if (error) {
    console.error(error);
    alert(t("cancelFailed") + " (" + error.message + ")");
    return;
  }

  await loadOrders();
}

async function restoreOrder(order) {
  if (!confirm(`${order.customer_name} — ${t("restoreOrderConfirm")}`)) return;

  const restoredStatus = order.previous_status || "pending_confirmation";

  const { error } = await client
    .from("orders")
    .update({
      status: restoredStatus,
      previous_status: null,
      cancel_reason: null,
      last_updated_by: currentUser.email,
    })
    .eq("id", order.id);

  if (error) {
    console.error(error);
    alert(t("restoreFailed") + " (" + error.message + ")");
    return;
  }

  await loadOrders();
}

async function editCancelReason(order) {
  const updated = await askReason({
    title: t("editCancelReasonTitle"),
    subtitle: order.customer_name,
    initialValue: order.cancel_reason || "",
    confirmLabel: t("saveBtn"),
  });
  if (updated === null) return;

  const { error } = await client
    .from("orders")
    .update({ cancel_reason: updated, last_updated_by: currentUser.email })
    .eq("id", order.id);

  if (error) {
    console.error(error);
    alert(t("updateFailed") + " (" + error.message + ")");
    return;
  }

  await loadOrders();
  closeModal();
}

function openModal(order) {
  currentModalOrder = order;
  const modal = document.getElementById("orderModal");
  const body = document.getElementById("modalBody");

  body.innerHTML = `
    <h2 class="modal__title">${t("order")} #${order.id}</h2>
    <span class="status-badge status-badge--${order.status}">${STATUS_LABELS[order.status]}</span>
    <p class="muted" style="text-align:left;padding:6px 0;font-size:12.5px;">
      ${order.confirmed_by ? `✅ ${t("confirmedBy")}: <b>${escapeHtml(order.confirmed_by)}</b>` : `⏳ ${t("notConfirmedYet")}`}
      ${order.last_updated_by ? ` &nbsp;|&nbsp; 🔄 ${t("lastUpdated")}: <b>${escapeHtml(order.last_updated_by)}</b>` : ""}
    </p>

    ${order.cancel_reason ? `
      <div class="modal__payment">
        <h4>❌ ${t("cancelReasonLabel")}</h4>
        <p>${escapeHtml(order.cancel_reason)}</p>
        ${currentUserRole === "admin" ? `<button class="btn btn--ghost btn--sm" id="editCancelReasonBtn" type="button">${t("editBtn")}</button>` : ""}
      </div>
    ` : ""}
    ${order.confirm_note ? `
      <div class="modal__payment">
        <h4>✅ ${t("confirmNoteLabel")}</h4>
        <p>${escapeHtml(order.confirm_note)}</p>
      </div>
    ` : ""}

    <div class="modal__grid">
      <div><span class="modal__label">${t("name")}</span><input type="text" id="editName" class="modal__edit-input" value="${escapeAttr(order.customer_name)}"></div>
      <div><span class="modal__label">${t("phone")}</span><p class="phone-copy"><span>${escapeHtml(order.phone)}</span><button type="button" class="copy-btn" id="copyPhoneBtn">${t("copy")}</button></p></div>
      <div><span class="modal__label">${t("district")}</span><input type="text" id="editDistrict" class="modal__edit-input" value="${escapeAttr(order.district)}"></div>
      <div><span class="modal__label">${t("quantity")}</span><input type="number" id="editQuantity" class="modal__edit-input" min="1" value="${order.quantity}"></div>
      <div><span class="modal__label">${t("age")}</span><input type="number" id="editAge" class="modal__edit-input" min="1" value="${order.age || ""}"></div>
      <div class="modal__grid-full"><span class="modal__label">${t("address")}</span><textarea id="editAddress" class="modal__edit-input" rows="2">${escapeHtml(order.address)}</textarea></div>
    </div>

    <div class="modal__payment">
      <h4>${t("paymentVerification")}${order.payment_method ? ` (${order.payment_method})` : ""}</h4>
      <p>${t("senderNumber")}: <b>${order.sender_number ? escapeHtml(order.sender_number) : t("notProvided")}</b></p>
      <p>TrxID: <b>${order.trx_id ? escapeHtml(order.trx_id) : t("notProvided")}</b></p>
      <p class="muted">${t("paymentNote")}</p>
      <p>${t("productTotal")}: ৳<span id="calcProductTotal">${order.product_total}</span> + ${t("delivery")}: ৳${order.delivery_charge} = <b>৳<span id="calcGrandTotal">${order.grand_total}</span></b></p>
    </div>

    <div class="modal__notes">
      <label for="advanceTypeSelect">Advance Type</label>
      <select id="advanceTypeSelect">
        <option value="none">কোনো Advance নেয়া হয়নি (Full COD)</option>
        <option value="delivery_only">শুধু Delivery Charge Advance নেয়া হয়েছে</option>
        <option value="full">Full Payment Advance নেয়া হয়েছে</option>
      </select>
    </div>

    <div class="modal__notes">
      <label for="handledByInput">${t("handledByLabel")}</label>
      <input type="text" id="handledByInput" class="modal__edit-input" placeholder="${t("handledByPlaceholder")}" value="${escapeAttr(order.handled_by || "")}">
    </div>

    <div class="modal__notes">
      <label for="notesInput">${t("salesNotes")}</label>
      <textarea id="notesInput">${escapeHtml(order.notes || "")}</textarea>
    </div>

    <div class="modal__notes">
      <label for="statusSelect">${t("status")}</label>
      <select id="statusSelect">
        <option value="pending_confirmation">Pending</option>
        <option value="followup">Followup</option>
        <option value="confirmed">Confirmed</option>
        <option value="packed">Packed</option>
        <option value="ready_to_ship">Ready To Ship</option>
        <option value="shipped">Shipped</option>
        <option value="hold_by_courier">Hold By Courier</option>
        <option value="delivered">Delivered</option>
        <option value="payment_received">Payment Received</option>
        <option value="returned">Returned</option>
        <option value="cancelled">Canceled</option>
        <option value="unresolved">Unresolved</option>
      </select>
    </div>

    <button class="btn btn--primary btn--block" id="updateStatusBtn">${t("updateStatusBtn")}</button>
    <p id="modalStatusMsg" class="form-status"></p>

    <div class="modal__payment" style="margin-top:14px;">
      <h4>🚚 Courier Shipment</h4>
      ${order.consignment_id ? `
        <p>✅ Shipment তৈরি হয়ে গেছে — Tracking Code: <b>${escapeHtml(order.tracking_code || "")}</b></p>
        <p class="muted">Consignment ID: ${escapeHtml(order.consignment_id)}</p>
      ` : order.status === "packed" && currentUserRole === "admin" ? `
        <button class="btn btn--primary btn--block" id="createShipmentBtn" type="button">Create Shipment (Steadfast)</button>
        <p id="shipmentStatusMsg" class="form-status"></p>
      ` : order.status === "packed" ? `
        <p class="muted">Packaging team shipment তৈরি করে দেবে।</p>
      ` : `
        <p class="muted">Order "Packed" status-এ গেলে shipment তৈরি হবে।</p>
      `}
    </div>
  `;

  document.getElementById("copyPhoneBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(order.phone);
    const btn = document.getElementById("copyPhoneBtn");
    btn.textContent = t("copied");
    setTimeout(() => { btn.textContent = t("copy"); }, 1500);
  });


  document.getElementById("statusSelect").value = order.status;
  document.getElementById("advanceTypeSelect").value = order.advance_type || "none";

  const createShipmentBtn = document.getElementById("createShipmentBtn");
  if (createShipmentBtn) {
    createShipmentBtn.addEventListener("click", () => createShipment(order));
  }

  const editCancelReasonBtn = document.getElementById("editCancelReasonBtn");
  if (editCancelReasonBtn) {
    editCancelReasonBtn.addEventListener("click", () => editCancelReason(order));
  }

  document.getElementById("editQuantity").addEventListener("input", (e) => {
    const qty = parseInt(e.target.value || "1", 10);
    const productTotal = qty * order.unit_price;
    const grandTotal = productTotal + order.delivery_charge;
    document.getElementById("calcProductTotal").textContent = productTotal;
    document.getElementById("calcGrandTotal").textContent = grandTotal;
  });

  document.getElementById("updateStatusBtn").addEventListener("click", () => {
    const newStatus = document.getElementById("statusSelect").value;

    let confirmNote = null;
    if (newStatus === "confirmed" && !order.confirm_note) {
      confirmNote = prompt(t("confirmNotePrompt")) || "";
    }

    const editedFields = {
      customer_name: document.getElementById("editName").value.trim(),
      district: document.getElementById("editDistrict").value.trim(),
      address: document.getElementById("editAddress").value.trim(),
      quantity: parseInt(document.getElementById("editQuantity").value || "1", 10),
      age: document.getElementById("editAge").value ? parseInt(document.getElementById("editAge").value, 10) : null,
      handled_by: document.getElementById("handledByInput").value.trim(),
    };
    const advanceType = document.getElementById("advanceTypeSelect").value;
    updateStatus(order.id, newStatus, editedFields, order.unit_price, order.delivery_charge, advanceType, confirmNote);
  });

  modal.hidden = false;
}

function closeModal() {
  document.getElementById("orderModal").hidden = true;
  currentModalOrder = null;
}

async function updateStatus(orderId, newStatus, editedFields, unitPrice, deliveryCharge, advanceType, confirmNote) {
  const notes = document.getElementById("notesInput").value;
  const msgEl = document.getElementById("modalStatusMsg");
  msgEl.textContent = t("updating");
  msgEl.className = "form-status";

  const { data: existing } = await client
    .from("orders")
    .select("confirmed_by")
    .eq("id", orderId)
    .single();

  const productTotal = unitPrice * editedFields.quantity;
  const grandTotal = productTotal + deliveryCharge;

  const updatePayload = {
    status: newStatus,
    notes,
    last_updated_by: currentUser.email,
    customer_name: editedFields.customer_name,
    district: editedFields.district,
    address: editedFields.address,
    quantity: editedFields.quantity,
    age: editedFields.age,
    handled_by: editedFields.handled_by || null,
    product_total: productTotal,
    grand_total: grandTotal,
    advance_type: advanceType,
  };
  if (!existing?.confirmed_by) updatePayload.confirmed_by = currentUser.email;
  if (confirmNote && confirmNote.trim()) updatePayload.confirm_note = confirmNote.trim();

  const { error } = await client
    .from("orders")
    .update(updatePayload)
    .eq("id", orderId);

  if (error) {
    console.error(error);
    msgEl.textContent = t("updateFailed");
    msgEl.className = "form-status error";
    return;
  }

  msgEl.textContent = t("updateSuccess");
  msgEl.className = "form-status success";
  await loadOrders();
  setTimeout(closeModal, 700);
}

async function createShipment(order) {
  const msgEl = document.getElementById("shipmentStatusMsg");
  const btn = document.getElementById("createShipmentBtn");

  const name = document.getElementById("editName").value.trim();
  const district = document.getElementById("editDistrict").value.trim();
  const address = document.getElementById("editAddress").value.trim();
  const quantity = document.getElementById("editQuantity").value;
  const advanceType = document.getElementById("advanceTypeSelect").value;

  const productTotal = Number(document.getElementById("calcProductTotal").textContent);
  const grandTotal = Number(document.getElementById("calcGrandTotal").textContent);

  let codAmount;
  if (advanceType === "full") codAmount = 0;
  else if (advanceType === "delivery_only") codAmount = productTotal;
  else codAmount = grandTotal;

  btn.disabled = true;
  btn.textContent = "Creating...";
  msgEl.textContent = "Steadfast-এ shipment তৈরি হচ্ছে...";
  msgEl.className = "form-status";

  try {
    const res = await fetch("/api/steadfast-create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoice: String(order.id),
        recipient_name: name,
        recipient_phone: order.phone,
        recipient_address: `${address}, ${district}`,
        cod_amount: codAmount,
        note: `Qty: ${quantity}`,
      }),
    });
    const data = await res.json();

    if (data.status !== 200 || !data.consignment) {
      throw new Error(data.message || "Steadfast error");
    }

    const { consignment_id, tracking_code, status } = data.consignment;

    const { error } = await client
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

    if (error) throw error;

    msgEl.textContent = "✅ Shipment তৈরি হয়েছে! Tracking: " + tracking_code;
    msgEl.className = "form-status success";
    await loadOrders();
    setTimeout(closeModal, 1000);
  } catch (err) {
    console.error("Create shipment failed:", err);
    msgEl.textContent = "❌ ব্যর্থ হয়েছে: " + (err.message || "Unknown error");
    msgEl.className = "form-status error";
    btn.disabled = false;
    btn.textContent = "Create Shipment (Steadfast)";
  }
}

function onLangChange() {
  if (activeFilter === "leads") renderLeadsList();
  else if (activeFilter === "lead_followup") renderFollowupLeadsList();
  else if (activeFilter === "cancelled_leads") renderCancelledLeadsList();
  else render();
  if (currentModalOrder) openModal(currentModalOrder);
  if (currentModalLead) openLeadModal(currentModalLead);
}

// ---------- helpers ----------
function askReason({ title, subtitle = "", placeholder = "", initialValue = "", confirmLabel, dismissLabel, required = true }) {
  return new Promise((resolve) => {
    const modal = document.getElementById("reasonModal");
    const titleEl = document.getElementById("reasonModalTitle");
    const subtitleEl = document.getElementById("reasonModalSubtitle");
    const input = document.getElementById("reasonModalInput");
    const errorEl = document.getElementById("reasonModalError");
    const confirmBtn = document.getElementById("reasonModalConfirmBtn");
    const cancelBtn = document.getElementById("reasonModalCancelBtn");
    const backdrop = document.getElementById("reasonModalBackdrop");
    const closeBtn = document.getElementById("reasonModalClose");

    titleEl.textContent = title;
    subtitleEl.textContent = subtitle;
    subtitleEl.hidden = !subtitle;
    input.value = initialValue;
    input.placeholder = placeholder;
    confirmBtn.textContent = confirmLabel || t("confirmCancelBtn");
    cancelBtn.textContent = dismissLabel || t("modalDismissBtn");
    errorEl.hidden = true;

    modal.hidden = false;
    setTimeout(() => input.focus(), 50);

    function finish(result) {
      modal.hidden = true;
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onDismiss);
      backdrop.removeEventListener("click", onDismiss);
      closeBtn.removeEventListener("click", onDismiss);
      document.removeEventListener("keydown", onKeydown);
      resolve(result);
    }

    function onConfirm() {
      const val = input.value.trim();
      if (required && !val) {
        errorEl.textContent = t("cancelReasonRequired");
        errorEl.hidden = false;
        input.focus();
        return;
      }
      finish(val);
    }

    function onDismiss() {
      finish(null);
    }

    function onKeydown(e) {
      if (e.key === "Escape") onDismiss();
    }

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onDismiss);
    backdrop.addEventListener("click", onDismiss);
    closeBtn.addEventListener("click", onDismiss);
    document.addEventListener("keydown", onKeydown);
  });
}

function formatDate(iso) {
  const d = new Date(iso);
  const locale = getLang() === "en" ? "en-US" : "bn-BD";
  return d.toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}
function escapeAttr(str) { return escapeHtml(str); }