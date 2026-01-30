// =========================
// Helpers
// =========================
function getToken() {
  return localStorage.getItem("token");
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`
  };
}

function showError(err, fallback) {
  console.error(err);
  alert(err?.message || fallback);
}

function getEl(id) {
  return document.getElementById(id);
}

// =========================
// Load Settings (fetch data only)
// =========================
async function fetchSettings() {
  const token = getToken();
  if (!token) {
    alert("Please login first");
    return;
  }

  try {
    const res = await fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || "Failed to load settings");
    }

    // Profile fields
    const firstNameEl = getEl("firstName");
    const lastNameEl = getEl("lastName");
    const emailEl = getEl("email");

    if (firstNameEl) firstNameEl.value = data.f_name || "";
    if (lastNameEl) lastNameEl.value = data.l_name || "";
    if (emailEl) emailEl.value = data.email || "";

    // Preferences
    const darkModeEl = getEl("darkModeToggle");
    const emailNotifEl = getEl("emailNotifications");

    const darkMode = darkModeEl.checked = data.mode || false;
    const emailNotifications = !!data.preferences?.emailNotifications;

    if (darkModeEl) {
      darkModeEl.checked = darkMode;
      document.body.classList.toggle("dark-mode", darkMode);
    }

    if (emailNotifEl) emailNotifEl.checked = emailNotifications;

  } catch (err) {
    showError(err, "Unable to load settings");
  }
}

// =========================
// Update Profile
// =========================
async function updateProfile() {
  const firstNameEl = getEl("firstName");
  const lastNameEl = getEl("lastName");
  const emailEl = getEl("email");

  if (!firstNameEl || !lastNameEl || !emailEl) {
    return showError({ message: "Profile form is missing elements" });
  }

  const f_name = firstNameEl.value.trim();
  const l_name = lastNameEl.value.trim();
  const email = emailEl.value.trim();

  if (!f_name || !l_name || !email) {
    return showError({ message: "All profile fields are required" });
  }

  const payload = { f_name, l_name, email };

  try {
    const res = await fetch("/api/users/profile", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || `Failed with status ${res.status}`);
    }

    alert("Profile updated successfully");
  } catch (err) {
    showError(err, "Failed to update profile");
  }
}

// =========================
// Change Password
// =========================
async function changePassword() {
  const currentEl = getEl("currentPassword");
  const newEl = getEl("newPassword");
  const confirmEl = getEl("confirmPassword");

  if (!currentEl || !newEl || !confirmEl) {
    return alert("Password form is missing elements");
  }

  const currentPassword = currentEl.value;
  const newPassword = newEl.value;
  const confirmPassword = confirmEl.value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return alert("Please fill all password fields");
  }

  if (newPassword !== confirmPassword) {
    return alert("New passwords do not match");
  }

  try {
    const res = await fetch("/api/users/password", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    alert("Password changed successfully");

    currentEl.value = "";
    newEl.value = "";
    confirmEl.value = "";
  } catch (err) {
    showError(err, "Failed to change password");
  }
}

// =========================
// Save Preferences
// =========================
async function savePreferences() {
  const darkModeEl = getEl("darkModeToggle");
  const emailNotifEl = getEl("emailNotifications");

  if (!darkModeEl || !emailNotifEl) {
    return alert("Preferences form is missing elements");
  }

  try {
    const payload = {
      darkMode: darkModeEl.checked,
      emailNotifications: emailNotifEl.checked
    };

    const res = await fetch("/api/users/preferences", {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    alert("Preferences saved successfully");
  } catch (err) {
    showError(err, "Failed to save preferences");
  }
}

// =========================
// Setup Settings Page
// =========================
function setupSettingsPage() {
  // Call the real fetch function
  fetchSettings();

  getEl("updateProfileBtn")?.addEventListener("click", updateProfile);
  getEl("changePasswordBtn")?.addEventListener("click", changePassword);
  getEl("savePreferencesBtn")?.addEventListener("click", savePreferences);

  getEl("darkModeToggle")?.addEventListener("change", (e) => {
    document.body.classList.toggle("dark-mode", e.target.checked);
  });
}

// Expose globally for dashboard.js
window.loadSettings = setupSettingsPage;
