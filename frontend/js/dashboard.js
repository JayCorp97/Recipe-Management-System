const mainContent = document.getElementById("mainContent");

// Load page function
async function loadPage(page, btnId) {
  try {
    const res = await fetch(`pages/${page}`);
    const html = await res.text();
    mainContent.innerHTML = html;

    // Active button styling
    document.querySelectorAll(".sidebar button").forEach(b =>
      b.classList.remove("active")
    );
    document.getElementById(btnId).classList.add("active");

  } catch (err) {
    mainContent.innerHTML = "<p>Error loading page</p>";
  }
}

// Button listeners
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

// Load default page
loadPage("recipes.html", "RecipesBtn");
