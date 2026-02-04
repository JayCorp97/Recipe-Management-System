document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("addRecipeForm");
  if (!form) return;

  const fileInput = document.getElementById("recipeImage");
  const chooseBtn = document.getElementById("chooseFileBtn");
  const uploadArea = document.getElementById("uploadArea");
  const previewWrap = document.getElementById("imagePreviewWrap");
  const previewImg = document.getElementById("imagePreview");
  const removeImageBtn = document.getElementById("removeImageBtn");
  const addIngredientBtn = document.getElementById("addIngredientBtn");
  const ingredientsList = document.getElementById("ingredientsList");
  const cancelBtn = document.getElementById("cancelBtn");
  const submitBtn = document.getElementById("submitBtn");
  const errorMessage = document.getElementById("errorMessage");
  const successMessage = document.getElementById("successMessage");
  const ratingValue = document.getElementById("ratingValue");
  const starsText = document.getElementById("starsText");
  const ratingInputs = document.querySelectorAll('input[name="ratingInput"]');
  const titleInput = document.getElementById("title");
  const addStepBtn = document.getElementById("addStepBtn");
  const instructionsList = document.getElementById("instructionsList");
  const tagsInput = document.getElementById("tagsInput");
  const tagsList = document.getElementById("tagsList");
  const panelTitle = document.querySelector(".panel-title");
  const panelSubtitle = document.querySelector(".panel-subtitle");
  const btnText = submitBtn?.querySelector(".btn-text");
  const categoryEl = document.getElementById("category");
  let pendingCategory = null;

  // Check if we're in edit mode
  const urlParams = new URLSearchParams(window.location.search);
  const recipeId = urlParams.get("id");
  let isEditMode = false;
  let currentRecipe = null;

  // Show message helper
  function showMessage(element, message) {
    element.textContent = message;
    element.style.display = "flex";
    setTimeout(() => {
      element.style.display = "none";
    }, 5000);
  }

  // Hide message helper
  function hideMessages() {
    errorMessage.style.display = "none";
    successMessage.style.display = "none";
  }

  // Star Rating Handler
  if (ratingInputs.length > 0 && ratingValue && starsText) {
    const ratingLabels = {
      5: "Excellent",
      4: "Very Good",
      3: "Good",
      2: "Fair",
      1: "Poor",
      0: "No rating"
    };

    const updateRatingText = (value) => {
      ratingValue.value = value;
      if (starsText) {
        starsText.textContent = ratingLabels[value] || "No rating";
      }
    };

    ratingInputs.forEach((input) => {
      input.addEventListener("change", function () {
        const value = parseInt(this.value);
        updateRatingText(value);
      });

      // Also handle click for better UX
      input.addEventListener("click", function () {
        const value = parseInt(this.value);
        updateRatingText(value);
      });
    });

    // Initialize text
    updateRatingText(0);
  }


  // Duplicate Recipe Checker
  let duplicateCheckTimeout;
  let existingRecipes = [];
  let isCheckingDuplicate = false;

  // Load existing recipes for duplicate checking
  async function loadExistingRecipes() {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      // Check user's own recipes for duplicates
      const res = await fetch("/api/recipes/mine", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.recipes)) {
        existingRecipes = data.recipes;
      }
    } catch (err) {
      console.error("Error loading recipes for duplicate check:", err);
    }
  }

  // Check for duplicate recipe title
  async function checkDuplicate(title) {
    if (!title || title.trim().length < 3) {
      hideDuplicateWarning();
      return false;
    }

    const normalizedTitle = title.trim().toLowerCase();
    
    // Check in loaded recipes first (fast)
    const duplicate = existingRecipes.find(
      (recipe) => recipe.title.trim().toLowerCase() === normalizedTitle
    );

    if (duplicate) {
      showDuplicateWarning(duplicate.title);
      return true;
    }

    // Also check all recipes (in case user wants to check against all)
    try {
      const res = await fetch("/api/recipes");
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.recipes)) {
        const allDuplicate = data.recipes.find(
          (recipe) => recipe.title.trim().toLowerCase() === normalizedTitle
        );
        if (allDuplicate) {
          showDuplicateWarning(allDuplicate.title);
          return true;
        }
      }
    } catch (err) {
      console.error("Error checking all recipes:", err);
    }

    hideDuplicateWarning();
    return false;
  }

  // Show duplicate warning
  function showDuplicateWarning(existingTitle) {
    const titleField = document.getElementById("title");
    if (titleField) {
      titleField.classList.add("duplicate-warning");
      const existingWarning = document.getElementById("duplicateWarning");
      if (existingWarning) {
        existingWarning.remove();
      }
      
      const warning = document.createElement("div");
      warning.id = "duplicateWarning";
      warning.className = "duplicate-warning-message";
      warning.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>A recipe with the title "<strong>${escapeHtml(existingTitle)}</strong>" already exists. Consider using a different title.</span>
      `;
      
      titleField.parentElement.appendChild(warning);
    }
  }

  // Hide duplicate warning
  function hideDuplicateWarning() {
    const titleField = document.getElementById("title");
    if (titleField) {
      titleField.classList.remove("duplicate-warning");
      const warning = document.getElementById("duplicateWarning");
      if (warning) {
        warning.remove();
      }
    }
  }

  // Escape HTML helper
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize: Load existing recipes on page load
  loadExistingRecipes();

  // Load categories from admin-managed list
  async function loadCategories() {
    if (!categoryEl) return;
    try {
      const res = await fetch("/api/categories");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !Array.isArray(data.categories)) return;

      const options = data.categories
        .map((cat) => `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`)
        .join("");
      categoryEl.innerHTML = `<option value="">Select a category</option>${options}`;

      if (pendingCategory) {
        categoryEl.value = pendingCategory;
        if (categoryEl.value !== pendingCategory) {
          const option = document.createElement("option");
          option.value = pendingCategory;
          option.textContent = pendingCategory;
          categoryEl.appendChild(option);
          categoryEl.value = pendingCategory;
        }
      }
    } catch (err) {
      console.error("Error loading categories:", err);
    }
  }

  loadCategories();

  // Real-time duplicate checking on title input (debounced)
  if (titleInput) {
    titleInput.addEventListener("input", function () {
      clearTimeout(duplicateCheckTimeout);
      const title = this.value.trim();

      if (title.length >= 3) {
        duplicateCheckTimeout = setTimeout(() => {
          checkDuplicate(title);
        }, 500); // Wait 500ms after user stops typing
      } else {
        hideDuplicateWarning();
      }
    });

    // Also check on blur
    titleInput.addEventListener("blur", function () {
      clearTimeout(duplicateCheckTimeout);
      const title = this.value.trim();
      if (title.length >= 3) {
        checkDuplicate(title);
      }
    });
  }

  // File input handling
  if (chooseBtn && fileInput) {
    chooseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      fileInput.click();
    });
  }

  // Drag and drop functionality
  if (uploadArea && fileInput) {
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ["dragenter", "dragover"].forEach((eventName) => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.add("drag-over");
      }, false);
    });

    ["dragleave", "drop"].forEach((eventName) => {
      uploadArea.addEventListener(eventName, () => {
        uploadArea.classList.remove("drag-over");
      }, false);
    });

    uploadArea.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        fileInput.files = files;
        handleFileSelect();
      }
    });

    uploadArea.addEventListener("click", () => {
      fileInput.click();
    });
  }

  function handleFileSelect() {
    const file = fileInput?.files?.[0];
    if (!file) {
      previewWrap.style.display = "none";
      previewImg.src = "";
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      showMessage(errorMessage, "Please select a valid image file.");
      fileInput.value = "";
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showMessage(errorMessage, "Image size must be less than 10MB.");
      fileInput.value = "";
      return;
    }

    previewWrap.style.display = "block";
    previewImg.src = URL.createObjectURL(file);
  }

  if (fileInput && previewWrap && previewImg) {
    fileInput.addEventListener("change", handleFileSelect);
  }

  // Remove image
  if (removeImageBtn) {
    removeImageBtn.addEventListener("click", () => {
      fileInput.value = "";
      previewWrap.style.display = "none";
      previewImg.src = "";
      if (previewImg.src) {
        URL.revokeObjectURL(previewImg.src);
      }
    });
  }

  // Add ingredient
  if (addIngredientBtn && ingredientsList) {
    addIngredientBtn.addEventListener("click", () => {
      const row = document.createElement("div");
      row.className = "ingredient-row";
      const index = ingredientsList.children.length + 1;
      row.innerHTML = `
        <input name="ingredients[]" type="text" placeholder="Ingredient ${index}" />
        <button class="square-btn square-btn-danger" type="button" aria-label="Remove ingredient" title="Remove ingredient">
          <i class="fas fa-minus"></i>
        </button>
      `;
      ingredientsList.appendChild(row);

      // Add remove functionality to new button
      const removeBtn = row.querySelector("button");
      removeBtn.addEventListener("click", () => {
        row.style.animation = "slideOut 0.3s ease-out";
        setTimeout(() => {
          row.remove();
        }, 300);
      });

      // Focus on new input
      row.querySelector("input").focus();
    });
  }

  // Remove ingredient functionality for existing rows
  ingredientsList?.querySelectorAll(".ingredient-row button").forEach((btn) => {
    btn.addEventListener("click", function () {
      const row = this.closest(".ingredient-row");
      if (ingredientsList.children.length > 1) {
        row.style.animation = "slideOut 0.3s ease-out";
        setTimeout(() => {
          row.remove();
        }, 300);
      } else {
        showMessage(errorMessage, "At least one ingredient is required.");
      }
    });
  });

  // Add instruction step
  if (addStepBtn && instructionsList) {
    addStepBtn.addEventListener("click", () => {
      const stepNumber = instructionsList.children.length + 1;
      const row = document.createElement("div");
      row.className = "instruction-row";
      row.innerHTML = `
        <div class="step-number">${stepNumber}</div>
        <textarea name="instructions[]" placeholder="Describe step ${stepNumber}..." rows="2"></textarea>
        <button class="square-btn square-btn-danger" type="button" aria-label="Remove step" title="Remove step">
          <i class="fas fa-minus"></i>
        </button>
      `;
      instructionsList.appendChild(row);

      // Add remove functionality
      const removeBtn = row.querySelector("button");
      removeBtn.addEventListener("click", () => {
        row.style.animation = "slideOut 0.3s ease-out";
        setTimeout(() => {
          row.remove();
          // Update step numbers
          updateStepNumbers();
        }, 300);
      });

      // Focus on new textarea
      row.querySelector("textarea").focus();
    });
  }

  // Remove instruction step functionality for existing rows
  instructionsList?.querySelectorAll(".instruction-row button").forEach((btn) => {
    btn.addEventListener("click", function () {
      const row = this.closest(".instruction-row");
      if (instructionsList.children.length > 1) {
        row.style.animation = "slideOut 0.3s ease-out";
        setTimeout(() => {
          row.remove();
          updateStepNumbers();
        }, 300);
      } else {
        showMessage(errorMessage, "At least one instruction step is required.");
      }
    });
  });

  // Update step numbers
  function updateStepNumbers() {
    const steps = instructionsList?.querySelectorAll(".instruction-row");
    steps?.forEach((row, index) => {
      const stepNumber = row.querySelector(".step-number");
      if (stepNumber) {
        stepNumber.textContent = index + 1;
      }
    });
  }

  // Tags functionality
  let tags = [];

  if (tagsInput && tagsList) {
    tagsInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        const tag = this.value.trim();
        if (tag && tag.length > 0 && !tags.includes(tag.toLowerCase())) {
          addTag(tag);
          this.value = "";
        }
      }
    });

    tagsInput.addEventListener("blur", function () {
      const tag = this.value.trim();
      if (tag && tag.length > 0 && !tags.includes(tag.toLowerCase())) {
        addTag(tag);
        this.value = "";
      }
    });
  }

  function addTag(tag) {
    const normalizedTag = tag.toLowerCase();
    if (tags.includes(normalizedTag)) return;

    tags.push(normalizedTag);
    const tagItem = document.createElement("div");
    tagItem.className = "tag-item";
    tagItem.innerHTML = `
      <span>${escapeHtml(tag)}</span>
      <button type="button" class="tag-remove" aria-label="Remove tag">
        <i class="fas fa-times"></i>
      </button>
    `;

    const removeBtn = tagItem.querySelector(".tag-remove");
    removeBtn.addEventListener("click", () => {
      tags = tags.filter((t) => t !== normalizedTag);
      tagItem.remove();
    });

    tagsList.appendChild(tagItem);
  }

  // Cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to cancel? All unsaved changes will be lost.")) {
        window.location.href = "/dashboard.html?view=my-recipes";
      }
    });
  }

  // Load recipe data if in edit mode (after all initialization)
  if (recipeId) {
    isEditMode = true;
    const token = localStorage.getItem("token");
    if (!token) {
      showMessage(errorMessage, "Please log in to edit recipes.");
      setTimeout(() => {
        window.location.href = "/login.html";
      }, 2000);
      return;
    }

    try {
      const res = await fetch(`/api/recipes/${encodeURIComponent(recipeId)}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || "Failed to load recipe");
      }

      currentRecipe = data.recipe;
      if (!currentRecipe) {
        throw new Error("Recipe not found");
      }

      // Update page title
      if (panelTitle) {
        panelTitle.innerHTML = `<i class="fas fa-edit"></i> Edit Recipe`;
      }
      if (panelSubtitle) {
        panelSubtitle.textContent = "Update your recipe details";
      }
      if (btnText) {
        btnText.textContent = "Update Recipe";
      }

      // Populate form fields
      if (titleInput) titleInput.value = currentRecipe.title || "";
      const descEl = document.getElementById("desc");
      if (descEl) descEl.value = currentRecipe.desc || "";

      if (currentRecipe.category) {
        pendingCategory = currentRecipe.category;
        if (categoryEl) {
          categoryEl.value = currentRecipe.category;
          if (categoryEl.value !== currentRecipe.category) {
            const option = document.createElement("option");
            option.value = currentRecipe.category;
            option.textContent = currentRecipe.category;
            categoryEl.appendChild(option);
            categoryEl.value = currentRecipe.category;
          }
        }
      }

      // Rating
      if (ratingValue && currentRecipe.rating !== undefined) {
        const rating = Math.max(0, Math.min(5, Math.round(Number(currentRecipe.rating) || 0)));
        ratingValue.value = rating;
        const ratingInput = document.querySelector(`input[name="ratingInput"][value="${rating}"]`);
        if (ratingInput) ratingInput.checked = true;
        if (starsText) {
          const ratingLabels = {
            5: "Excellent", 4: "Very Good", 3: "Good", 2: "Fair", 1: "Poor", 0: "No rating"
          };
          starsText.textContent = ratingLabels[rating] || "No rating";
        }
      }

      // Times and servings
      const cookingTimeEl = document.getElementById("cookingTime");
      if (cookingTimeEl && currentRecipe.cookingTime) {
        cookingTimeEl.value = currentRecipe.cookingTime;
      }
      const prepTimeEl = document.getElementById("prepTime");
      if (prepTimeEl && currentRecipe.prepTime) {
        prepTimeEl.value = currentRecipe.prepTime;
      }
      const servingsEl = document.getElementById("servings");
      if (servingsEl && currentRecipe.servings) {
        servingsEl.value = currentRecipe.servings;
      }

      // Image
      if (currentRecipe.imageUrl && previewImg && previewWrap) {
        previewImg.src = currentRecipe.imageUrl;
        previewWrap.style.display = "block";
      }

      // Ingredients
      if (ingredientsList && Array.isArray(currentRecipe.ingredients)) {
        ingredientsList.innerHTML = "";
        currentRecipe.ingredients.forEach((ing) => {
          const row = document.createElement("div");
          row.className = "ingredient-row";
          row.innerHTML = `
            <input name="ingredients[]" type="text" value="${escapeHtml(ing)}" />
            <button class="square-btn square-btn-danger" type="button" aria-label="Remove ingredient" title="Remove ingredient">
              <i class="fas fa-minus"></i>
            </button>
          `;
          const removeBtn = row.querySelector("button");
          removeBtn.addEventListener("click", () => row.remove());
          ingredientsList.appendChild(row);
        });
      }

      // Instructions
      if (instructionsList && Array.isArray(currentRecipe.instructions)) {
        instructionsList.innerHTML = "";
        currentRecipe.instructions.forEach((instruction, index) => {
          const row = document.createElement("div");
          row.className = "instruction-row";
          row.innerHTML = `
            <div class="step-number">${index + 1}</div>
            <textarea name="instructions[]" placeholder="Describe step ${index + 1}..." rows="2">${escapeHtml(instruction)}</textarea>
            <button class="square-btn square-btn-danger" type="button" aria-label="Remove step" title="Remove step">
              <i class="fas fa-minus"></i>
            </button>
          `;
          const removeBtn = row.querySelector("button");
          removeBtn.addEventListener("click", () => {
            row.remove();
            // Renumber steps
            const steps = instructionsList.querySelectorAll(".instruction-row");
            steps.forEach((step, i) => {
              step.querySelector(".step-number").textContent = i + 1;
            });
          });
          instructionsList.appendChild(row);
        });
      }

      // Difficulty
      if (currentRecipe.difficulty) {
        const difficultyInput = document.querySelector(`input[name="difficulty"][value="${currentRecipe.difficulty}"]`);
        if (difficultyInput) difficultyInput.checked = true;
      }

      // Dietary
      if (Array.isArray(currentRecipe.dietary)) {
        currentRecipe.dietary.forEach((diet) => {
          const dietaryInput = document.querySelector(`input[name="dietary[]"][value="${diet}"]`);
          if (dietaryInput) dietaryInput.checked = true;
        });
      }

      // Tags
      if (Array.isArray(currentRecipe.tags)) {
        currentRecipe.tags.forEach((tag) => {
          addTag(tag);
        });
      }

      // Notes
      const notesEl = document.getElementById("notes");
      if (notesEl && currentRecipe.notes) {
        notesEl.value = currentRecipe.notes;
      }
    } catch (err) {
      console.error("Error loading recipe:", err);
      showMessage(errorMessage, err.message || "Failed to load recipe");
      setTimeout(() => {
        window.location.href = "/pages/my-recipes.html";
      }, 2000);
    }
  }

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessages();

    const token = localStorage.getItem("token");
    if (!token) {
      showMessage(errorMessage, "Please log in again.");
      setTimeout(() => {
        window.location.href = "/login.html";
      }, 2000);
      return;
    }

    const title = document.getElementById("title")?.value?.trim() || "";
    const description = document.getElementById("desc")?.value?.trim() || "";

    if (!title) {
      showMessage(errorMessage, "Recipe Title is required.");
      document.getElementById("title").focus();
      return;
    }

    // Final duplicate check before submission (skip if editing same recipe)
    if (!isEditMode || (isEditMode && title !== currentRecipe?.title)) {
      const hasDuplicate = await checkDuplicate(title);
      if (hasDuplicate) {
        const proceed = confirm(
          `A recipe with the title "${title}" already exists. Do you want to continue anyway?`
        );
        if (!proceed) {
          document.getElementById("title").focus();
          return;
        }
      }
    }

    if (!description) {
      showMessage(errorMessage, "Description is required.");
      document.getElementById("desc").focus();
      return;
    }

    // Collect ingredients
    const ingredientInputs = ingredientsList?.querySelectorAll('input[name="ingredients[]"]') || [];
    const ingredients = Array.from(ingredientInputs)
      .map((input) => input.value.trim())
      .filter((val) => val.length > 0);

    if (ingredients.length === 0) {
      showMessage(errorMessage, "Please add at least one ingredient.");
      return;
    }

    // Collect instructions
    const instructionInputs = instructionsList?.querySelectorAll('textarea[name="instructions[]"]') || [];
    const instructions = Array.from(instructionInputs)
      .map((input) => input.value.trim())
      .filter((val) => val.length > 0);

    if (instructions.length === 0) {
      showMessage(errorMessage, "Please add at least one cooking instruction step.");
      return;
    }

    // Build FormData (required for file upload)
    const fd = new FormData();
    fd.append("title", title);
    fd.append("description", description);
    ingredients.forEach((ingredient) => {
      fd.append("ingredients[]", ingredient);
    });

    // Instructions
    instructions.forEach((instruction) => {
      fd.append("instructions[]", instruction);
    });

    // Difficulty
    const difficultyEl = document.querySelector('input[name="difficulty"]:checked');
    if (difficultyEl) {
      fd.append("difficulty", difficultyEl.value);
    }

    // Dietary information
    const dietaryCheckboxes = document.querySelectorAll('input[name="dietary[]"]:checked');
    const dietaryInfo = Array.from(dietaryCheckboxes).map((cb) => cb.value);
    dietaryInfo.forEach((diet) => {
      fd.append("dietary[]", diet);
    });

    // Tags
    tags.forEach((tag) => {
      fd.append("tags[]", tag);
    });

    // Notes
    const notesEl = document.getElementById("notes");
    if (notesEl && notesEl.value.trim()) {
      fd.append("notes", notesEl.value.trim());
    }

    // Category
    const categoryEl = document.getElementById("category");
    if (categoryEl && categoryEl.value.trim()) {
      fd.append("category", categoryEl.value.trim());
    } else {
      fd.append("category", "Dinner"); // Default category
    }

    // Rating
    const rating = ratingValue ? parseInt(ratingValue.value) || 0 : 0;
    fd.append("rating", rating);

    // Additional fields (for future use or description enhancement)
    const cookingTime = document.getElementById("cookingTime")?.value;
    const prepTime = document.getElementById("prepTime")?.value;
    const servings = document.getElementById("servings")?.value;
    
    // These can be added to description or stored separately when backend supports them
    if (cookingTime || prepTime || servings) {
      let additionalInfo = [];
      if (prepTime) additionalInfo.push(`Prep: ${prepTime} min`);
      if (cookingTime) additionalInfo.push(`Cook: ${cookingTime} min`);
      if (servings) additionalInfo.push(`Serves: ${servings}`);
      
      // Append as separate fields (backend can ignore if not supported)
      if (cookingTime) fd.append("cookingTime", cookingTime);
      if (prepTime) fd.append("prepTime", prepTime);
      if (servings) fd.append("servings", servings);
    }

    // Image file (name must be "image" to match upload.single("image"))
    const file = fileInput?.files?.[0];
    if (file) fd.append("image", file);

    // Show loading state
    submitBtn.disabled = true;
    const btnText = submitBtn.querySelector(".btn-text");
    const btnLoading = submitBtn.querySelector(".btn-loading");
    if (btnText) btnText.style.display = "none";
    if (btnLoading) btnLoading.style.display = "inline-flex";

    try {
      const url = isEditMode 
        ? `/api/recipes/${encodeURIComponent(recipeId)}`
        : "/api/recipes";
      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: {
          Authorization: `Bearer ${token}`,
          // DO NOT set Content-Type when using FormData
        },
        body: fd,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Save failed:", res.status, data);
        
        // Handle duplicate error specifically
        if (res.status === 409 && data.duplicate) {
          showMessage(errorMessage, data.message || `A recipe with the title "${data.existingTitle}" already exists.`);
          document.getElementById("title").focus();
          showDuplicateWarning(data.existingTitle);
        } else {
          showMessage(errorMessage, data.message || `Failed to ${isEditMode ? "update" : "save"} recipe. Please try again.`);
        }
        
        submitBtn.disabled = false;
        if (btnText) btnText.style.display = "inline";
        if (btnLoading) btnLoading.style.display = "none";
        return;
      }

      showMessage(successMessage, `Recipe ${isEditMode ? "updated" : "saved"} successfully! Redirecting...`);
      setTimeout(() => {
        window.location.href = "/dashboard.html?view=my-recipes";
      }, 1500);
    } catch (err) {
      console.error(err);
      showMessage(errorMessage, `Network error ${isEditMode ? "updating" : "saving"} recipe. Please check your connection and try again.`);
      submitBtn.disabled = false;
      if (btnText) btnText.style.display = "inline";
      if (btnLoading) btnLoading.style.display = "none";
    }
  });

  // Add slideOut animation to CSS dynamically
  if (!document.getElementById("dynamic-styles")) {
    const style = document.createElement("style");
    style.id = "dynamic-styles";
    style.textContent = `
      @keyframes slideOut {
        from {
          opacity: 1;
          transform: translateX(0);
        }
        to {
          opacity: 0;
          transform: translateX(10px);
        }
      }
    `;
    document.head.appendChild(style);
  }
});
