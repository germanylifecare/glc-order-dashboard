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
let activeFilter = "all";
let searchTerm = "";

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

  document.getElementById("refreshBtn").addEventListener("click", loadOrders);
  document.getElementById("searchBox").addEventListener("input", (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    render();
  });

  document.querySelectorAll(".filter-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      activeFilter = btn.dataset.status;
      render();
    });
  });

  document.getElementById("modalBackdrop").addEventListener("click", closeModal);
  document.getElementById("modalClose").addEventListener("click", closeModal);

  await loadOrders();
}

async function loadOrders() {
  document.getElementById("loadingMsg").hidden = false;
  const { data, error } = await client
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  document.getElementById("loadingMsg").hidden = true;

  if (error) {
    console.error(error);
    alert("অর্ডার লোড করা যায়নি। আবার চেষ্টা করুন।");
    return;
  }

  allOrders = data || [];
  updateStats();
  render();
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
      <p class="order-card-row__meta">${escapeHtml(order.phone)} · ${escapeHtml(order.district)} · ${order.quantity} পিস · ৳${order.grand_total}</p>
      <p class="order-card-row__address">${escapeHtml(order.address)}</p>
    </div>
    <div class="order-card-row__actions">
      <button type="button" class="btn btn--ghost btn--sm" data-copy-phone="${escapeAttr(order.phone)}">📋 নাম্বার কপি</button>
      <button class="btn btn--primary btn--sm" data-open="${order.id}">বিস্তারিত</button>
    </div>
  `;
  card.querySelector("[data-copy-phone]").addEventListener("click", (e) => {
    navigator.clipboard.writeText(order.phone);
    const btn = e.currentTarget;
    const original = btn.textContent;
    btn.textContent = "✅ কপি হয়েছে";
    setTimeout(() => { btn.textContent = original; }, 1500);
  });
  card.querySelector("[data-open]").addEventListener("click", () => openModal(order));
  return card;
}

function openModal(order) {
  const modal = document.getElementById("orderModal");
  const body = document.getElementById("modalBody");

  body.innerHTML = `
    <h2 class="modal__title">অর্ডার #${order.id}</h2>
    <span class="status-badge status-badge--${order.status}">${STATUS_LABELS[order.status]}</span>

    <div class="modal__grid">
      <div><span class="modal__label">নাম</span><p>${escapeHtml(order.customer_name)}</p></div>
      <div><span class="modal__label">ফোন</span><p class="phone-copy"><span>${escapeHtml(order.phone)}</span><button type="button" class="copy-btn" id="copyPhoneBtn">📋 কপি</button></p></div>
      <div><span class="modal__label">জেলা</span><p>${escapeHtml(order.district)}</p></div>
      <div><span class="modal__label">কোয়ান্টিটি</span><p>${order.quantity} পিস</p></div>
      <div class="modal__grid-full"><span class="modal__label">ঠিকানা</span><p>${escapeHtml(order.address)}</p></div>
    </div>

    <div class="modal__payment">
      <h4>পেমেন্ট ভেরিফিকেশন (${order.payment_method})</h4>
      <p>পাঠানো নাম্বার: <b>${escapeHtml(order.sender_number)}</b></p>
      <p>TrxID: <b>${escapeHtml(order.trx_id)}</b></p>
      <p class="muted">⚠️ dashboard-এ শুধু কাস্টমারের দেওয়া তথ্য দেখানো হচ্ছে — bKash/Nagad অ্যাপ/SMS-এ গিয়ে TrxID মিলিয়ে নিশ্চিত করুন এটা আসল পেমেন্ট কিনা, তারপর Confirm করুন।</p>
      <p>প্রোডাক্ট মূল্য: ৳${order.product_total} + ডেলিভারি: ৳${order.delivery_charge} = <b>৳${order.grand_total}</b></p>
    </div>

    <div class="modal__notes">
      <label for="courierSelect">কুরিয়ার</label>
      <select id="courierSelect">
        <option value="">-- বাছাই করুন --</option>
        <option value="Pathao">Pathao</option>
        <option value="Steadfast">Steadfast</option>
        <option value="RedX">RedX</option>
        <option value="Sundarban Courier">Sundarban Courier</option>
        <option value="eCourier">eCourier</option>
        <option value="Other">Other</option>
      </select>
    </div>

    <div class="modal__notes">
      <label for="notesInput">সেলস নোট</label>
      <textarea id="notesInput">${escapeHtml(order.notes || "")}</textarea>
    </div>

    <div class="modal__notes">
      <label for="statusSelect">স্ট্যাটাস</label>
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

    <button class="btn btn--primary btn--block" id="updateStatusBtn">স্ট্যাটাস আপডেট করুন</button>
    <p id="modalStatusMsg" class="form-status"></p>
  `;

  document.getElementById("copyPhoneBtn").addEventListener("click", () => {
    navigator.clipboard.writeText(order.phone);
    const btn = document.getElementById("copyPhoneBtn");
    btn.textContent = "✅ কপি হয়েছে";
    setTimeout(() => { btn.textContent = "📋 কপি"; }, 1500);
  });

  document.getElementById("courierSelect").value = order.courier || "";
  document.getElementById("statusSelect").value = order.status;

  document.getElementById("updateStatusBtn").addEventListener("click", () => {
    const newStatus = document.getElementById("statusSelect").value;
    const courier = document.getElementById("courierSelect").value;
    updateStatus(order.id, newStatus, courier);
  });

  modal.hidden = false;
}

function closeModal() {
  document.getElementById("orderModal").hidden = true;
}

async function updateStatus(orderId, newStatus, courier) {
  const notes = document.getElementById("notesInput").value;
  const msgEl = document.getElementById("modalStatusMsg");
  msgEl.textContent = "আপডেট হচ্ছে…";
  msgEl.className = "form-status";

  const { error } = await client
    .from("orders")
    .update({ status: newStatus, notes, courier, confirmed_by: currentUser.email })
    .eq("id", orderId);

  if (error) {
    console.error(error);
    msgEl.textContent = "আপডেট ব্যর্থ হয়েছে।";
    msgEl.className = "form-status error";
    return;
  }

  msgEl.textContent = "✅ স্ট্যাটাস আপডেট হয়েছে।";
  msgEl.className = "form-status success";
  await loadOrders();
  setTimeout(closeModal, 700);
}

// ---------- helpers ----------
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("bn-BD", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}
function escapeAttr(str) { return escapeHtml(str); }