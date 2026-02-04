const adminContent = document.getElementById("adminContent");

async function loadAdminPage(page, btnId) {
  try {
    const res = await fetch(`pages/${page}`);
    if (!res.ok) throw new Error(`Failed to load pages/${page}`);

    const html = await res.text();
    adminContent.innerHTML = html;

    const scriptTags = adminContent.querySelectorAll("script");
    for (const script of scriptTags) {
      if (script.src) {
        await new Promise((resolve, reject) => {
          const newScript = document.createElement("script");
          newScript.src = script.src;
          newScript.onload = resolve;
          newScript.onerror = reject;
          document.head.appendChild(newScript);
        });
      } else {
        const newScript = document.createElement("script");
        newScript.textContent = script.textContent;
        document.head.appendChild(newScript);
        document.head.removeChild(newScript);
      }
      script.remove();
    }

    if (page === "admin-users.html" && window.initAdminUsers) {
      window.initAdminUsers();
    }
    if (page === "admin-categories.html" && window.initAdminCategories) {
      window.initAdminCategories();
    }
    if (page === "admin-recipes.html" && window.initAdminRecipes) {
      window.initAdminRecipes();
    }
    if (page === "admin-analytics.html" && window.initAdminAnalytics) {
      window.initAdminAnalytics();
    }

    if (btnId) {
      document.querySelectorAll(".admin-sidebar button").forEach((b) => b.classList.remove("active"));
      const activeBtn = document.getElementById(btnId);
      if (activeBtn) activeBtn.classList.add("active");
    }
  } catch (err) {
    console.error(err);
    adminContent.innerHTML = "<p class=\"empty-state\">Error loading page.</p>";
  }
}

const adminSidebarMap = {
  adminUsersBtn: "admin-users.html",
  adminCategoriesBtn: "admin-categories.html",
  adminRecipesBtn: "admin-recipes.html",
  adminAnalyticsBtn: "admin-analytics.html"
};

for (const [btnId, page] of Object.entries(adminSidebarMap)) {
  document.getElementById(btnId)?.addEventListener("click", () => loadAdminPage(page, btnId));
}

document.addEventListener("DOMContentLoaded", () => {
  loadAdminPage("admin-users.html", "adminUsersBtn");
});
