(function() {
  // Use a private variable to avoid redeclaration issues
  let plannerRecipes = [];

  /* ===========================
     Load recipes for planner
  ============================ */
  async function loadPlannerRecipes() {
    try {
      const res = await fetch("/api/recipes");
      const data = await res.json();

      if (!res.ok) {
        console.error("Failed to load recipes");
        return;
      }

      plannerRecipes = data.recipes || [];
      populateMealSelectors();
    } catch (err) {
      console.error("Error loading planner recipes", err);
    }
  }

  /* ===========================
     Populate dropdowns
  ============================ */
  function populateMealSelectors() {
    const selects = document.querySelectorAll(".meal-select");

    selects.forEach(select => {
      select.innerHTML = `<option value="">Select recipe</option>`;

      plannerRecipes.forEach(recipe => {
        const opt = document.createElement("option");
        opt.value = recipe._id;
        opt.textContent = recipe.title;
        select.appendChild(opt);
      });
    });
  }

  /* ===========================
     Save meal plan
  ============================ */
  async function saveMealPlan() {
    const meals = {};

    document.querySelectorAll(".meal-select").forEach(select => {
      const day = select.dataset.day;
      const type = select.dataset.type;

      if (!meals[day]) meals[day] = {};
      meals[day][type] = select.value || null;
    });

    try {
      const res = await fetch("/api/users/meals", {
        method: "PUT", // make sure your backend expects PUT
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}` // add JWT if needed
        },
        body: JSON.stringify({ meals })
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to save meal plan");
        return;
      }

      alert("Meal plan saved successfully");
    } catch (err) {
      console.error(err);
      alert("Error saving meal plan");
    }
  }

  /* ===========================
     Init meal planner
  ============================ */
  function initMealPlanner() {
    const saveBtn = document.getElementById("saveMealPlan");
    if (!saveBtn) return;

    saveBtn.removeEventListener("click", saveMealPlan); // prevent double binding
    saveBtn.addEventListener("click", saveMealPlan);

    loadPlannerRecipes();
  }

  // Expose globally
  window.initMealPlanner = initMealPlanner;
})();
