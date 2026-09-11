let client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { storage: glcAuthStorage() },
});

document.addEventListener("DOMContentLoaded", async () => {
  const rememberCheckbox = document.getElementById("rememberMe");
  if (rememberCheckbox) {
    rememberCheckbox.checked = localStorage.getItem("glc_remember_me") !== "false";
  }

  const toggleBtn = document.getElementById("togglePasswordBtn");
  const passwordInput = document.getElementById("password");
  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";
      toggleBtn.textContent = isHidden ? "🙈" : "👁️";
      toggleBtn.setAttribute("aria-label", isHidden ? "Hide password" : "Show password");
    });
  }

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
  const remember = document.getElementById("rememberMe")?.checked ?? true;
  const btn = document.getElementById("loginBtn");
  const status = document.getElementById("loginStatus");

  localStorage.setItem("glc_remember_me", remember ? "true" : "false");
  client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { storage: glcAuthStorage() },
  });

  btn.disabled = true;
  btn.textContent = t("loggingIn");
  status.textContent = "";
  status.className = "form-status";

  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    status.textContent = t("loginError");
    status.className = "form-status error";
    btn.disabled = false;
    btn.textContent = t("loginBtn");
    return;
  }

  await redirectByRole(data.user);
}