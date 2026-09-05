// =========================================================================
// GLC Dashboard — order list + status management
// =========================================================================

const client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const STATUS_LABELS = {
  pending_confirmation: "Pending",
  followup: "Followup",
  confirmed: "Confirmed",
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
let allOrders = [];
let allLeads = [];
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

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await client.auth.signOut();
    window.location.href = "index.html";
  });

  document.getElementById("refreshBtn").addEventListener("click", () => {
    if (activeFilter === "leads") loadLeads();
    else loadOrders();
  });
  document.getElementById("searchBox").addEventListener("input", (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    if (activeFilter === "leads") renderLeadsList();
    else render();
  });

  document.querySelectorAll(".filter-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      activeFilter = btn.dataset.status;
      if (activeFilter === "leads") {
        loadLeads();
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
  card.querySelector("[data-convert]").addEventListener("click", () => openLeadModal(lead));
  return card;
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
      </select>
    </div>
    <div class="modal__notes">
      <label for="leadSenderNumber">${t("senderNumber")}</label>
      <input type="text" id="leadSenderNumber" placeholder="01XXXXXXXXX">
    </div>
    <div class="modal__notes">
      <label for="leadTrxId">Transaction ID</label>
      <input type="text" id="leadTrxId" placeholder="TrxID">
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

  if (!name || !district || !address || !senderNumber || !trxId) {
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
      sender_number: senderNumber,
      trx_id: trxId,
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
  await loadLeads();
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
  card.innerHTML = `
    <div class="order-card-row__main">
      <div class="order-card-row__top">
        <span class="status-badge status-badge--${order.status}">${STATUS_LABELS[order.status] || order.status}</span>
        <span class="order-card-row__time">${formatDate(order.created_at)}</span>
      </div>
      <h3 class="order-card-row__name">${escapeHtml(order.customer_name)}</h3>
      <p class="order-card-row__meta">${escapeHtml(order.phone)} · ${escapeHtml(order.district)} · ${order.quantity} ${t("pcs")} · ৳${order.grand_total}</p>
      <p class="order-card-row__address">${escapeHtml(order.address)}</p>
    </div>
    <div class="order-card-row__actions">
      <button type="button" class="btn btn--ghost btn--sm" data-copy-phone="${escapeAttr(order.phone)}">${t("copyNumber")}</button>
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
  card.querySelector("[data-open]").addEventListener("click", () => openModal(order));
  return card;
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

    <div class="modal__grid">
      <div><span class="modal__label">${t("name")}</span><input type="text" id="editName" class="modal__edit-input" value="${escapeAttr(order.customer_name)}"></div>
      <div><span class="modal__label">${t("phone")}</span><p class="phone-copy"><span>${escapeHtml(order.phone)}</span><button type="button" class="copy-btn" id="copyPhoneBtn">${t("copy")}</button></p></div>
      <div><span class="modal__label">${t("district")}</span><input type="text" id="editDistrict" class="modal__edit-input" value="${escapeAttr(order.district)}"></div>
      <div><span class="modal__label">${t("quantity")}</span><input type="number" id="editQuantity" class="modal__edit-input" min="1" value="${order.quantity}"></div>
      <div class="modal__grid-full"><span class="modal__label">${t("address")}</span><textarea id="editAddress" class="modal__edit-input" rows="2">${escapeHtml(order.address)}</textarea></div>
    </div>

    <div class="modal__payment">
      <h4>${t("paymentVerification")} (${order.payment_method})</h4>
      <p>${t("senderNumber")}: <b>${escapeHtml(order.sender_number)}</b></p>
      <p>TrxID: <b>${escapeHtml(order.trx_id)}</b></p>
      <p class="muted">${t("paymentNote")}</p>
      <p>${t("productTotal")}: ৳<span id="calcProductTotal">${order.product_total}</span> + ${t("delivery")}: ৳${order.delivery_charge} = <b>৳<span id="calcGrandTotal">${order.grand_total}</span></b></p>
    </div>

    <div class="modal__notes">
      <label for="courierSelect">${t("courier")}</label>
      <select id="courierSelect">
        <option value="">${t("courierPlaceholder")}</option>
        <option value="Pathao">Pathao</option>
        <option value="Steadfast">Steadfast</option>
        <option value="RedX">RedX</option>
        <option value="Sundarban Courier">Sundarban Courier</option>
        <option value="eCourier">eCourier</option>
        <option value="Other">Other</option>
      </select>
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
  `;

  document.getElementById("copyPhoneBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(order.phone);
    const btn = document.getElementById("copyPhoneBtn");
    btn.textContent = t("copied");
    setTimeout(() => { btn.textContent = t("copy"); }, 1500);
  });

  document.getElementById("courierSelect").value = order.courier || "";
  document.getElementById("statusSelect").value = order.status;

  document.getElementById("editQuantity").addEventListener("input", (e) => {
    const qty = parseInt(e.target.value || "1", 10);
    const productTotal = qty * order.unit_price;
    const grandTotal = productTotal + order.delivery_charge;
    document.getElementById("calcProductTotal").textContent = productTotal;
    document.getElementById("calcGrandTotal").textContent = grandTotal;
  });

  document.getElementById("updateStatusBtn").addEventListener("click", () => {
    const newStatus = document.getElementById("statusSelect").value;
    const courier = document.getElementById("courierSelect").value;
    const editedFields = {
      customer_name: document.getElementById("editName").value.trim(),
      district: document.getElementById("editDistrict").value.trim(),
      address: document.getElementById("editAddress").value.trim(),
      quantity: parseInt(document.getElementById("editQuantity").value || "1", 10),
    };
    updateStatus(order.id, newStatus, courier, editedFields, order.unit_price, order.delivery_charge);
  });

  modal.hidden = false;
}

function closeModal() {
  document.getElementById("orderModal").hidden = true;
  currentModalOrder = null;
}

async function updateStatus(orderId, newStatus, courier, editedFields, unitPrice, deliveryCharge) {
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
    courier,
    last_updated_by: currentUser.email,
    customer_name: editedFields.customer_name,
    district: editedFields.district,
    address: editedFields.address,
    quantity: editedFields.quantity,
    product_total: productTotal,
    grand_total: grandTotal,
  };
  if (!existing?.confirmed_by) updatePayload.confirmed_by = currentUser.email;

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

function onLangChange() {
  if (activeFilter === "leads") renderLeadsList();
  else render();
  if (currentModalOrder) openModal(currentModalOrder);
  if (currentModalLead) openLeadModal(currentModalLead);
}

// ---------- helpers ----------
function formatDate(iso) {
  const d = new Date(iso);
  const locale = getLang() === "en" ? "en-US" : "bn-BD";
  return d.toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}
function escapeAttr(str) { return escapeHtml(str); }