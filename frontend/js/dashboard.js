// dashboard.js

/* ===========================
   Main content reference
=========================== */
const mainContent = document.getElementById("mainContent");

/* ===========================
   Utility functions
=========================== */
function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderStars(rating) {
  const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r);
}

/* ===========================
   Page loader
=========================== */
async function loadPage(page, btnId) {
  try {
    const res = await fetch(`pages/${page}`);
    if (!res.ok) throw new Error(`Failed to load pages/${page}`);

    const html = await res.text();

    // Inject HTML first
    mainContent.innerHTML = html;

    // Extract and execute script tags from the loaded HTML
    const scriptTags = mainContent.querySelectorAll("script");
    for (const script of scriptTags) {
      if (script.src) {
        // External script - load it
        await new Promise((resolve, reject) => {
          const newScript = document.createElement("script");
          newScript.src = script.src;
          newScript.onload = resolve;
          newScript.onerror = reject;
          document.head.appendChild(newScript);
        });
      } else {
        // Inline script - execute it
        const newScript = document.createElement("script");
        newScript.textContent = script.textContent;
        document.head.appendChild(newScript);
        document.head.removeChild(newScript);
      }
      // Remove the original script tag from mainContent
      script.remove();
    }

    // ⚡ Call page-specific initializers AFTER HTML is injected and scripts are loaded
    if (page === "my-recipes.html") {
      // Wait a bit for scripts to initialize
      await new Promise(resolve => setTimeout(resolve, 50));
      // Try both function names for compatibility
      if (window.renderMyRecipes) {
        await window.renderMyRecipes();
      } else if (window.loadMyRecipes) {
        await window.loadMyRecipes();
      }
    }

    if (page === "recipes.html") {
      if (window.loadAllRecipes) await window.loadAllRecipes();
      if (window.initRecipeFilters) window.initRecipeFilters();
    }

    if (page === "settings.html" && window.loadSettings) {
      window.loadSettings();
    }

    if (page === "recipedetails.html" && window.loadRecipeDetails) {
      await window.loadRecipeDetails();
    }

    // Set active sidebar button
    if (btnId) {
      document.querySelectorAll(".sidebar button").forEach(b => b.classList.remove("active"));
      const activeBtn = document.getElementById(btnId);
      if (activeBtn) activeBtn.classList.add("active");
    }

  } catch (err) {
    console.error(err);
    mainContent.innerHTML = "<p>Error loading page</p>";
  }
}

/* ===========================
   Sidebar buttons
=========================== */
const sidebarMap = {
  RecipesBtn: "recipes.html",
  myRecipesBtn: "my-recipes.html",
  favouritesBtn: "favourites.html",
  mealPlannerBtn: "meal-planner.html",
  settingsBtn: "settings.html"
};

for (const [btnId, page] of Object.entries(sidebarMap)) {
  document.getElementById(btnId)?.addEventListener("click", () => loadPage(page, btnId));
}

/* ===========================
   Dynamic buttons inside loaded pages
=========================== */
mainContent.addEventListener("click", async (e) => {

  // OPEN button -> Load recipe details
  const openBtn = e.target.closest(".open-btn");
  if (openBtn) {
    const recipeId = openBtn.dataset.id;
    if (!recipeId) return;

    // Store recipe ID in sessionStorage
    sessionStorage.setItem("viewRecipeId", recipeId);

    // Load recipe details page
    loadPage("recipedetails.html");
    return;
  }

  // EDIT button
  const editBtn = e.target.closest(".edit-btn");
  if (editBtn) {
    const recipeId = editBtn.dataset.id;
    if (!recipeId) return;
    // Go directly to add-recipe page in edit mode
    window.location.href = `/pages/add-recipe.html?id=${encodeURIComponent(recipeId)}`;
    return;
  }

  // DELETE button
  const deleteBtn = e.target.closest(".delete-btn");
  if (deleteBtn) {
    const recipeId = deleteBtn.dataset.id;
    if (!recipeId) return;
    if (!confirm("Delete this recipe?")) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please log in to delete recipes.");
      return;
    }

    try {
      const res = await fetch(`/api/recipes/${encodeURIComponent(recipeId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete recipe");
      }

      // Refresh the recipes list
      if (window.loadMyRecipes) {
        await window.loadMyRecipes();
      } else if (window.renderMyRecipes) {
        await window.renderMyRecipes();
      }
    } catch (err) {
      alert(err.message || "Failed to delete recipe");
    }
  }

});

/* ===========================
   Default page load
=========================== */
document.addEventListener("DOMContentLoaded", () => {
  // Check for URL parameter to determine which page to load
  const urlParams = new URLSearchParams(window.location.search);
  const view = urlParams.get("view");
  
  if (view === "my-recipes") {
    loadPage("my-recipes.html", "myRecipesBtn");
  } else {
    loadPage("recipes.html", "RecipesBtn");
  }
});

/* ===========================
   My Recipes Page
=========================== */
async function loadMyRecipes() {
  const grid = document.getElementById("recipesGrid");
  if (!grid) return;

  grid.innerHTML = "<p>Loading recipes...</p>";

  const token = localStorage.getItem("token");
  if (!token) {
    grid.innerHTML = "<p>Please log in to view your recipes.</p>";
    return;
  }

  try {
    const res = await fetch("/api/recipes/mine", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Failed to fetch recipes");

    const recipes = Array.isArray(data.recipes) ? data.recipes : [];
    if (recipes.length === 0) {
      grid.innerHTML = "<p>No recipes saved yet.</p>";
      return;
    }

    grid.innerHTML = recipes
      .map(r => `
        <div class="recipe-card" 
          data-likes="${r.likes || 0}" 
          data-dislikes="${r.dislikes || 0}" 
          data-category="${r.category}" 
          data-region="${r.region}" 
          data-date="${r.createdAt}">

          <div class="image-placeholder">
            ${r.imageUrl ? `<img src="${r.imageUrl}" alt="${escapeHtml(r.title)}" />` : "[IMAGE]"}
          </div>

          <div class="content">
            <div class="title-wrapper">
              <div class="title">${escapeHtml(r.title)}</div>
            </div>

            <div class="likes-wrapper">
              <i class="fa-regular fa-thumbs-up"></i>
              <i class="fa-regular fa-thumbs-down"></i>
            </div>

            <div class="actions">
              <button class="open-btn" data-id="${r._id}">Open</button>
              <button class="edit-btn" data-id="${r._id}">Edit</button>
              <button class="delete-btn" data-id="${r._id}">Delete</button>
            </div>
          </div>
        </div>
      `).join("");

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

/* ===========================
   All Recipes Page
=========================== */
async function loadAllRecipes() {
  const grid = document.getElementById("recipesGridA");
  if (!grid) return;

  grid.innerHTML = "<p>Loading recipes...</p>";

  const token = localStorage.getItem("token");
  if (!token) {
    grid.innerHTML = "<p>Please log in to view your recipes.</p>";
    return;
  }

  try {
    const res = await fetch("/api/recipes/", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Failed to fetch recipes");

    const recipes = Array.isArray(data.recipes) ? data.recipes : [];
    if (recipes.length === 0) {
      grid.innerHTML = "<p>No recipes saved yet.</p>";
      return;
    }

    grid.innerHTML = recipes
      .map(r => `
        <div class="recipe-card" 
          data-likes="${r.likes || 0}" 
          data-dislikes="${r.dislikes || 0}" 
          data-category="${r.category}" 
          data-region="${r.region}" 
          data-date="${r.createdAt}">

          <div class="image-placeholder">
            ${r.imageUrl ? `<img src="${r.imageUrl}" alt="${r.title}" />` : "[IMAGE]"}
          </div>

          <div class="content">
            <div class="title-wrapper">
              <div class="title">${r.title}</div>
            </div>

            <div class="likes-wrapper">
              <div class="like-display">
                <i class="fa-regular fa-thumbs-up"></i>
                <span>${r.is_like || 0}</span>
              </div>
              <div class="dislike-display">
                <i class="fa-regular fa-thumbs-down"></i>
                <span>${r.is_dislike || 0}</span>
              </div>
            </div>

            <div class="actions">
              <button class="open-btn" data-id="${r._id}">Open</button>
            </div>
          </div>
        </div>
      `).join("");

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}

/* ===========================
   Expose globally
=========================== */
window.loadMyRecipes = loadMyRecipes;
window.loadAllRecipes = loadAllRecipes;
window.escapeHtml = escapeHtml;
window.renderStars = renderStars;
