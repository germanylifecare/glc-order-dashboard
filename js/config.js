const CONFIG = {
  SUPABASE_URL: "https://mdbhsfquzxoxtrdpgjlk.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_QgBu3JjvZ9caIRCjyuKc7g_cMjV8OM_",
  UNIT_PRICE: 1280, // 1-pack price — tiered totals use BUNDLES/bundlePrice() below, not this × qty
  DELIVERY_CHARGE: 70,
  MRP_PRICE: 1680,
  BUNDLES: [
    { qty: 1, price: 1280 },
    { qty: 2, price: 2400 },
    { qty: 3, price: 3480 },
  ],
  PRODUCT_NAME: "Dr. Reckeweg R41 with Supporting File",
  COMPANY_NAME: "Germany Life Care Pharmacy",
  COMPANY_ADDRESS: "Khulna sadar",
  COMPANY_PHONE: "+8801611726076",
};

// Tiered bundle price lookup — mirrors the landing page's pricing (1→1280, 2→2400, 3→3480).
function bundlePrice(qty) {
  const match = CONFIG.BUNDLES.find((b) => b.qty === qty);
  return match ? match.price : CONFIG.UNIT_PRICE * qty;
}

// "Remember me" — checked (default) = session survives browser close (localStorage).
// Unchecked = session-only, cleared when browser closes (sessionStorage).
function glcAuthStorage() {
  return localStorage.getItem("glc_remember_me") === "false" ? window.sessionStorage : window.localStorage;
}