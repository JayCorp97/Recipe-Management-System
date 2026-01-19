const mainContent = document.getElementById("mainContent");

// Load page function
async function loadPage(page, btnId) {
  try {
    const res = await fetch(`pages/${page}`);
    if (!res.ok) throw new Error(`Failed to load pages/${page}`);

    const html = await res.text();
    mainContent.innerHTML = html;
    if (page === "my-recipes.html") loadMyRecipes();

   
if (page === "my-recipes.html" && window.renderMyRecipes) {
  window.renderMyRecipes();
}

    // Active button styling (only if btnId provided)
    if (btnId) {
      document.querySelectorAll(".sidebar button").forEach(b =>
        b.classList.remove("active")
      );

      const activeBtn = document.getElementById(btnId);
      if (activeBtn) activeBtn.classList.add("active");
    }

  } catch (err) {
    console.error(err);
    mainContent.innerHTML = "<p>Error loading page</p>";
  }
}

// Sidebar button listeners
document.getElementById("RecipesBtn")
  .addEventListener("click", () => loadPage("recipes.html", "RecipesBtn"));

document.getElementById("myRecipesBtn")
  .addEventListener("click", () => loadPage("my-recipes.html", "myRecipesBtn"));

document.getElementById("favouritesBtn")
  .addEventListener("click", () => loadPage("favourites.html", "favouritesBtn"));

document.getElementById("mealPlannerBtn")
  .addEventListener("click", () => loadPage("meal-planner.html", "mealPlannerBtn"));

document.getElementById("settingsBtn")
  .addEventListener("click", () => loadPage("settings.html", "settingsBtn"));

// Handle clicks inside dynamically loaded pages (Edit button)
mainContent.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".edit-btn");
  if (!editBtn) return;

  const recipeId = editBtn.dataset.id;
  if (!recipeId) return;

  // Go to the view/edit page and pass the recipe id in the query string
  window.location.href = `/pages/view-edit-recipe.html?id=${encodeURIComponent(recipeId)}`;
});

// Load default page
loadPage("recipes.html", "RecipesBtn");

mainContent.addEventListener("click", async (e) => {
  const editBtn = e.target.closest(".edit-btn");
  if (editBtn) {
    const recipeId = editBtn.dataset.id;
    window.location.href = `/pages/view-edit-recipe.html?id=${encodeURIComponent(recipeId)}`;
    return;
  }
 if (window.initRecipeFilters) window.initRecipeFilters();
  const deleteBtn = e.target.closest(".delete-btn");
  if (deleteBtn) {
    const recipeId = deleteBtn.dataset.id;
    if (!recipeId) return;

    if (!confirm("Delete this recipe?")) return;

    try {
      await window.deleteRecipeById(recipeId);
      await window.renderMyRecipes(); // refresh list
    } catch (err) {
      alert(err.message || "Failed to delete recipe");
    }
  }
});

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
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || "Failed to fetch recipes");
    }

    // Your backend returns { recipes: [...] }
    const recipes = Array.isArray(data.recipes) ? data.recipes : [];

    if (recipes.length === 0) {
      grid.innerHTML = "<p>No recipes saved yet.</p>";
      return;
    }

    grid.innerHTML = recipes
      .map((r) => `
        <div class="recipe-card">
          <div class="image-placeholder">
            ${
              r.imageUrl
                ? `<img src="${escapeHtml(r.imageUrl)}" alt="${escapeHtml(r.title)}" />`
                : "[IMAGE]"
            }
          </div>
          <div class="content">
            <div class="title">${escapeHtml(r.title)}</div>
            <div class="rating">Rating: ${renderStars(r.rating || 0)}</div>
            <div class="actions">
              <button class="edit-btn" data-id="${r._id}">Edit</button>
              <button class="delete-btn" data-id="${r._id}">Delete</button>
            </div>
          </div>
        </div>
      `)
      .join("");

  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p>${escapeHtml(err.message)}</p>`;
  }
}


function renderStars(rating) {
  const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★★★★★".slice(0, r) + "☆☆☆☆☆".slice(0, 5 - r);
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
