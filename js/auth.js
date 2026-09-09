const client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await client.auth.getSession();
  if (session) {
    await redirectByRole(session.user);
    return;
  }

  document.getElementById("loginForm").addEventListener("submit", onLogin);
});

async function redirectByRole(user) {
  const { data: profile, error } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!error && profile && profile.role === "packaging") {
    window.location.href = "packaging.html";
  } else {
    window.location.href = "dashboard.html";
  }
}

async function onLogin(e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const btn = document.getElementById("loginBtn");
  const status = document.getElementById("loginStatus");

  btn.disabled = true;
  btn.textContent = "লগইন হচ্ছে…";
  status.textContent = "";
  status.className = "form-status";

  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    status.textContent = "ইমেইল অথবা পাসওয়ার্ড ভুল।";
    status.className = "form-status error";
    btn.disabled = false;
    btn.textContent = "লগইন করুন";
    return;
  }

  await redirectByRole(data.user);
}