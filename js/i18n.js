// =========================================================================
// GLC Dashboard — language toggle (Bangla / English)
// =========================================================================

const I18N = {
  bn: {
    logout: "লগআউট",
    refresh: "🔄 রিফ্রেশ",
    searchPlaceholder: "নাম / ফোন নাম্বার দিয়ে খুঁজুন…",
    loading: "লোড হচ্ছে…",
    noOrders: "কোনো অর্ডার নেই।",
    loadError: "অর্ডার লোড করা যায়নি। আবার চেষ্টা করুন।",
    order: "অর্ডার",
    name: "নাম",
    phone: "ফোন",
    district: "জেলা",
    quantity: "কোয়ান্টিটি",
    address: "ঠিকানা",
    pcs: "পিস",
    paymentVerification: "পেমেন্ট ভেরিফিকেশন",
    senderNumber: "পাঠানো নাম্বার",
    paymentNote: "⚠️ dashboard-এ শুধু কাস্টমারের দেওয়া তথ্য দেখানো হচ্ছে — bKash/Nagad অ্যাপ/SMS-এ গিয়ে TrxID মিলিয়ে নিশ্চিত করুন এটা আসল পেমেন্ট কিনা, তারপর Confirm করুন।",
    productTotal: "প্রোডাক্ট মূল্য",
    delivery: "ডেলিভারি",
    courier: "কুরিয়ার",
    courierPlaceholder: "-- বাছাই করুন --",
    salesNotes: "সেলস নোট",
    status: "স্ট্যাটাস",
    updateStatusBtn: "স্ট্যাটাস আপডেট করুন",
    confirmedBy: "কনফার্ম করেছেন",
    notConfirmedYet: "এখনো কেউ কনফার্ম করেননি",
    lastUpdated: "সর্বশেষ আপডেট",
    copy: "📋 কপি",
    copied: "✅ কপি হয়েছে",
    copyNumber: "📋 নাম্বার কপি",
    updating: "আপডেট হচ্ছে…",
    updateFailed: "আপডেট ব্যর্থ হয়েছে।",
    updateSuccess: "✅ স্ট্যাটাস আপডেট হয়েছে।",
    loginTitle: "সেলস টিম লগইন",
    loginSub: "আপনার অ্যাকাউন্ট ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন",
    email: "ইমেইল",
    password: "পাসওয়ার্ড",
    loginBtn: "লগইন করুন",
    detailsBtn: "বিস্তারিত",
    abandonedLeadsTab: "Abandoned Leads",
    leadBadge: "Abandoned Lead",
    noLeads: "কোনো Abandoned Lead নেই।",
    convertBtn: "অর্ডারে কনভার্ট করুন",
    convertLeadTitle: "Lead থেকে অর্ডার কনভার্ট",
    paymentMethodLabel: "পেমেন্ট মাধ্যম",
    fillAllFields: "সব ঘর পূরণ করুন।",
    notProvided: "এখনো দেওয়া হয়নি — কল করে জিজ্ঞেস করুন",
  },
  en: {
    logout: "Logout",
    refresh: "🔄 Refresh",
    searchPlaceholder: "Search by name / phone…",
    loading: "Loading…",
    noOrders: "No orders found.",
    loadError: "Could not load orders. Please try again.",
    order: "Order",
    name: "Name",
    phone: "Phone",
    district: "District",
    quantity: "Quantity",
    address: "Address",
    pcs: "pcs",
    paymentVerification: "Payment Verification",
    senderNumber: "Sender Number",
    paymentNote: "⚠️ This dashboard only shows what the customer entered — check the TrxID against your bKash/Nagad app/SMS before you Confirm.",
    productTotal: "Product Total",
    delivery: "Delivery",
    courier: "Courier",
    courierPlaceholder: "-- Select --",
    salesNotes: "Sales Notes",
    status: "Status",
    updateStatusBtn: "Update Status",
    confirmedBy: "Confirmed by",
    notConfirmedYet: "Not confirmed yet",
    lastUpdated: "Last updated",
    copy: "📋 Copy",
    copied: "✅ Copied",
    copyNumber: "📋 Copy Number",
    updating: "Updating…",
    updateFailed: "Update failed.",
    updateSuccess: "✅ Status updated.",
    loginTitle: "Sales Team Login",
    loginSub: "Log in with your account email and password",
    email: "Email",
    password: "Password",
    loginBtn: "Log In",
    detailsBtn: "Details",
    abandonedLeadsTab: "Abandoned Leads",
    leadBadge: "Abandoned Lead",
    noLeads: "No abandoned leads found.",
    convertBtn: "Convert to Order",
    convertLeadTitle: "Convert Lead to Order",
    paymentMethodLabel: "Payment Method",
    fillAllFields: "Please fill all fields.",
    notProvided: "Not provided yet — ask on the call",
  },
};

function getLang() { return localStorage.getItem("glc_lang") || "bn"; }
function setLang(lang) { localStorage.setItem("glc_lang", lang); }
function t(key) {
  const lang = getLang();
  return (I18N[lang] && I18N[lang][key]) || I18N.bn[key] || key;
}

function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  const toggleBtn = document.getElementById("langToggleBtn");
  if (toggleBtn) toggleBtn.textContent = getLang() === "bn" ? "EN" : "বাং";
}

function toggleLang() {
  setLang(getLang() === "bn" ? "en" : "bn");
  applyStaticTranslations();
  if (typeof onLangChange === "function") onLangChange();
}

document.addEventListener("DOMContentLoaded", () => {
  applyStaticTranslations();
  const toggleBtn = document.getElementById("langToggleBtn");
  if (toggleBtn) toggleBtn.addEventListener("click", toggleLang);
});