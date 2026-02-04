(() => {
  const state = {
    page: 1,
    limit: 10,
    search: "",
    category: "",
    status: "active",
    recipes: [],
    totalPages: 1,
    selectedRecipe: null,
    selectedIds: new Set(),
    actionType: null
  };

  const token = localStorage.getItem("token");
  const tableWrap = document.getElementById("recipesTableWrap");
  const pagination = document.getElementById("recipesPagination");
  const searchInput = document.getElementById("recipeSearchInput");
  const categoryInput = document.getElementById("recipeCategoryInput");
  const statusFilter = document.getElementById("recipeStatusFilter");
  const refreshBtn = document.getElementById("refreshRecipesBtn");
  const bulkDeleteBtn = document.getElementById("bulkRecipeDeleteBtn");

  const deleteModal = document.getElementById("recipeDeleteModal");
  const deleteMessage = document.getElementById("recipeDeleteMessage");
  const deleteHint = document.getElementById("recipeDeleteHint");
  const deleteMode = document.getElementById("recipeDeleteMode");
  const closeDeleteBtn = document.getElementById("closeRecipeDeleteModal");
  const cancelDeleteBtn = document.getElementById("cancelRecipeDeleteBtn");
  const confirmDeleteBtn = document.getElementById("confirmRecipeDeleteBtn");

  const escapeHtml = (value) => String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const formatDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
  };

  const badge = (type, label) =>
    `<span class="badge ${type}">${label}</span>`;

  const getStatusBadge = (recipe) => {
    if (recipe.deletedAt) return badge("badge-warning", "Deleted");
    return badge("badge-success", "Active");
  };

  const renderTable = () => {
    if (!state.recipes.length) {
      tableWrap.innerHTML = "<p class=\"empty-state\">No recipes found.</p>";
      pagination.innerHTML = "";
      return;
    }

    const allSelected = state.recipes.length > 0 && state.recipes.every((r) => state.selectedIds.has(r._id));
    const rows = state.recipes.map((recipe) => `
      <tr>
        <td><input type="checkbox" class="row-select" data-id="${recipe._id}" ${state.selectedIds.has(recipe._id) ? "checked" : ""} /></td>
        <td>${escapeHtml(recipe.title)}</td>
        <td>${escapeHtml(recipe.category || "Uncategorised")}</td>
        <td>${escapeHtml(recipe.userId || "—")}</td>
        <td>${getStatusBadge(recipe)}</td>
        <td>${formatDate(recipe.createdAt)}</td>
        <td>
          <button class="btn btn-danger" data-action="delete" data-id="${recipe._id}">
            Delete
          </button>
        </td>
      </tr>
    `).join("");

    tableWrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th><input type="checkbox" id="selectAllRecipes" ${allSelected ? "checked" : ""} /></th>
            <th>Title</th>
            <th>Category</th>
            <th>User</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;

    renderPagination();
  };

  const renderPagination = () => {
    pagination.innerHTML = `
      <span class="pill">Page ${state.page} of ${state.totalPages}</span>
      <button class="btn btn-secondary" ${state.page === 1 ? "disabled" : ""} data-page="prev">Prev</button>
      <button class="btn btn-secondary" ${state.page === state.totalPages ? "disabled" : ""} data-page="next">Next</button>
    `;
  };

  const fetchRecipes = async () => {
    if (!token) {
      tableWrap.innerHTML = "<p class=\"empty-state\">Missing auth token.</p>";
      return;
    }
    tableWrap.innerHTML = "<p class=\"empty-state\">Loading recipes...</p>";
    try {
      const params = new URLSearchParams({
        page: state.page,
        limit: state.limit,
        search: state.search,
        category: state.category,
        status: state.status
      });
      const res = await fetch(`/api/recipes/admin/all?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data.message || "Failed to load recipes");

      state.recipes = Array.isArray(data.recipes) ? data.recipes : [];
      state.totalPages = data.totalPages || 1;
      state.selectedIds = new Set(
        state.recipes.filter((r) => state.selectedIds.has(r._id)).map((r) => r._id)
      );
      renderTable();
    } catch (err) {
      console.error(err);
      tableWrap.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
    }
  };

  const openModal = (modal) => modal?.classList.add("show");
  const closeModal = (modal) => modal?.classList.remove("show");

  const openDeleteModal = (recipe) => {
    state.selectedRecipe = recipe;
    state.actionType = "single";
    deleteMessage.textContent = `Delete "${recipe.title}"?`;
    deleteHint.textContent = "This permanently removes the recipe.";
    deleteHint.style.color = "#6b7280";
    deleteMode.value = "soft";
    openModal(deleteModal);
  };

  const deleteRecipe = async () => {
    if (!state.selectedRecipe) return;
    try {
      const res = await fetch(`/api/recipes/admin/${state.selectedRecipe._id}?mode=${deleteMode.value}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data.message || "Failed to delete recipe");
      closeModal(deleteModal);
      await fetchRecipes();
    } catch (err) {
      deleteHint.textContent = err.message;
      deleteHint.style.color = "#b91c1c";
    }
  };

  const bulkDelete = () => {
    const ids = Array.from(state.selectedIds);
    if (!ids.length) {
      alert("Select at least one recipe.");
      return;
    }
    state.actionType = "bulk";
    deleteMessage.textContent = `Delete ${ids.length} recipes?`;
    deleteHint.textContent = "Soft delete keeps recipes recoverable.";
    deleteHint.style.color = "#6b7280";
    deleteMode.value = "soft";
    openModal(deleteModal);
  };

  const submitBulkDelete = async () => {
    const ids = Array.from(state.selectedIds);
    try {
      const res = await fetch("/api/recipes/admin/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ids, mode: deleteMode.value })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data.message || "Bulk delete failed");
      closeModal(deleteModal);
      state.selectedIds.clear();
      await fetchRecipes();
    } catch (err) {
      deleteHint.textContent = err.message;
      deleteHint.style.color = "#b91c1c";
    }
  };

  const initFilters = () => {
    let searchTimer;
    searchInput?.addEventListener("input", (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = e.target.value.trim();
        state.page = 1;
        fetchRecipes();
      }, 300);
    });

    let categoryTimer;
    categoryInput?.addEventListener("input", (e) => {
      clearTimeout(categoryTimer);
      categoryTimer = setTimeout(() => {
        state.category = e.target.value.trim();
        state.page = 1;
        fetchRecipes();
      }, 300);
    });

    statusFilter?.addEventListener("change", (e) => {
      state.status = e.target.value;
      state.page = 1;
      fetchRecipes();
    });

    refreshBtn?.addEventListener("click", fetchRecipes);
    bulkDeleteBtn?.addEventListener("click", bulkDelete);
  };

  const initPagination = () => {
    pagination?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-page]");
      if (!btn) return;
      if (btn.dataset.page === "prev" && state.page > 1) {
        state.page -= 1;
        fetchRecipes();
      }
      if (btn.dataset.page === "next" && state.page < state.totalPages) {
        state.page += 1;
        fetchRecipes();
      }
    });
  };

  const initTableActions = () => {
    tableWrap?.addEventListener("click", (e) => {
      const checkbox = e.target.closest("input.row-select");
      const selectAll = e.target.closest("#selectAllRecipes");
      if (checkbox) {
        const id = checkbox.dataset.id;
        if (checkbox.checked) {
          state.selectedIds.add(id);
        } else {
          state.selectedIds.delete(id);
        }
        return;
      }
      if (selectAll) {
        if (selectAll.checked) {
          state.recipes.forEach((r) => state.selectedIds.add(r._id));
        } else {
          state.recipes.forEach((r) => state.selectedIds.delete(r._id));
        }
        renderTable();
        return;
      }
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const recipe = state.recipes.find((r) => r._id === btn.dataset.id);
      if (!recipe) return;
      if (btn.dataset.action === "delete") openDeleteModal(recipe);
    });
  };

  const initModals = () => {
    confirmDeleteBtn?.addEventListener("click", () => {
      if (state.actionType === "bulk") {
        submitBulkDelete();
      } else {
        deleteRecipe();
      }
    });
    cancelDeleteBtn?.addEventListener("click", () => closeModal(deleteModal));
    closeDeleteBtn?.addEventListener("click", () => closeModal(deleteModal));
  };

  window.initAdminRecipes = () => {
    initFilters();
    initPagination();
    initTableActions();
    initModals();
    fetchRecipes();
    if (window.adminRecipesInterval) {
      clearInterval(window.adminRecipesInterval);
    }
    window.adminRecipesInterval = setInterval(fetchRecipes, 30000);
  };
})();
