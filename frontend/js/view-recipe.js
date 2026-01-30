/**
 * Call this after loading `recipedetails.html` dynamically
 * @param {string} recipeId - the ID of the recipe to fetch
 */
async function loadRecipeDetails(recipeId) {
  const mainContent = document.getElementById("mainContent");
  if (!mainContent) return;

  try {
    // Load HTML layout
    const res = await fetch("/pages/recipedetails.html");
    if (!res.ok) throw new Error("Failed to load recipe details layout");
    const html = await res.text();
    mainContent.innerHTML = html;

    // Fetch recipe data from API
    const token = localStorage.getItem("token");
    if (!token) throw new Error("You must be logged in");

    const recipeRes = await fetch(`/api/recipes/${recipeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await recipeRes.json();
    if (!recipeRes.ok) throw new Error(data.message || "Failed to fetch recipe");

    const r = data.recipe;

    // Populate the fields AFTER HTML is loaded
    document.getElementById("title").value = r.title || "";
    document.getElementById("category").value = r.category || "";
    document.getElementById("wishText").value = r.desc || "";
    document.getElementById("favourite").checked = r.favourite || false;

    document.getElementById("starsText").textContent = renderStars(r.rating || 0);

    const previewImg = document.getElementById("previewImg");
    if (r.imageUrl) {
      previewImg.src = r.imageUrl;
      previewImg.style.display = "block";
      const placeholder = document.querySelector("#imagePreview .image-placeholder");
      if (placeholder) placeholder.style.display = "none";
    }

    // Back button handler
    const backBtn = document.getElementById("backBtn");
    if (backBtn) {
      backBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        // Load dashboard recipes HTML
        const res = await fetch("/pages/recipes.html");
        const html = await res.text();
        mainContent.innerHTML = html;

        // If you have a loadAllRecipes function
        if (typeof loadAllRecipes === "function") loadAllRecipes();
      });
    }

  } catch (err) {
    console.error(err);
    mainContent.innerHTML = `<p>Error loading recipe: ${err.message}</p>`;
  }
}

// Helper function to render stars
function renderStars(rating) {
  if (!rating || rating === 0) return "No rating";
  return Array.from({ length: 5 }, (_, i) => (i < rating ? "★" : "☆")).join("");
}
