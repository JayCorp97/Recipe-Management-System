(() => {
  const state = {
    page: 1,
    limit: 10,
    search: "",
    status: "all",
    categories: [],
    totalPages: 1,
    editingCategory: null
  };

  const token = localStorage.getItem("token");
  const tableWrap = document.getElementById("categoriesTableWrap");
  const pagination = document.getElementById("categoriesPagination");
  const searchInput = document.getElementById("categorySearchInput");
  const statusFilter = document.getElementById("categoryStatusFilter");
  const refreshBtn = document.getElementById("refreshCategoriesBtn");
  const openCreateBtn = document.getElementById("openCreateCategoryBtn");

  const formModal = document.getElementById("categoryFormModal");
  const formTitle = document.getElementById("categoryModalTitle");
  const formHint = document.getElementById("categoryFormHint");
  const closeFormBtn = document.getElementById("closeCategoryFormModal");
  const cancelFormBtn = document.getElementById("cancelCategoryFormBtn");
  const saveFormBtn = document.getElementById("saveCategoryBtn");
  const categoryForm = document.getElementById("categoryForm");
  const categoryName = document.getElementById("categoryName");
  const categoryDescription = document.getElementById("categoryDescription");
  const categoryActive = document.getElementById("categoryActive");

  const deleteModal = document.getElementById("categoryDeleteModal");
  const deleteMessage = document.getElementById("categoryDeleteMessage");
  const deleteHint = document.getElementById("categoryDeleteHint");
  const closeDeleteBtn = document.getElementById("closeCategoryDeleteModal");
  const cancelDeleteBtn = document.getElementById("cancelCategoryDeleteBtn");
  const confirmDeleteBtn = document.getElementById("confirmCategoryDeleteBtn");

  const escapeHtml = (value) => String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const badge = (type, label) =>
    `<span class="badge ${type}">${label}</span>`;

  const renderTable = () => {
    if (!state.categories.length) {
      tableWrap.innerHTML = "<p class=\"empty-state\">No categories found.</p>";
      pagination.innerHTML = "";
      return;
    }

    const rows = state.categories.map((category) => `
      <tr>
        <td>${escapeHtml(category.name)}</td>
        <td>${escapeHtml(category.slug)}</td>
        <td>${escapeHtml(category.description || "—")}</td>
        <td>${category.isActive ? badge("badge-success", "Active") : badge("badge-warning", "Inactive")}</td>
        <td>
          <button class="btn btn-secondary" data-action="edit" data-id="${category._id}">Edit</button>
          <button class="btn btn-danger" data-action="delete" data-id="${category._id}">Delete</button>
        </td>
      </tr>
    `).join("");

    tableWrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Slug</th>
            <th>Description</th>
            <th>Status</th>
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

  const fetchCategories = async () => {
    if (!token) {
      tableWrap.innerHTML = "<p class=\"empty-state\">Missing auth token.</p>";
      return;
    }
    tableWrap.innerHTML = "<p class=\"empty-state\">Loading categories...</p>";
    try {
      const params = new URLSearchParams({
        page: state.page,
        limit: state.limit,
        search: state.search,
        status: state.status
      });
      const res = await fetch(`/api/categories/admin?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data.message || "Failed to load categories");

      state.categories = Array.isArray(data.categories) ? data.categories : [];
      state.totalPages = data.totalPages || 1;
      renderTable();
    } catch (err) {
      console.error(err);
      tableWrap.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
    }
  };

  const openModal = (modal) => modal?.classList.add("show");
  const closeModal = (modal) => modal?.classList.remove("show");

  const resetForm = () => {
    categoryForm?.reset();
    categoryActive.value = "true";
    formHint.textContent = "";
    formHint.style.color = "#6b7280";
  };

  const openCreateModal = () => {
    state.editingCategory = null;
    resetForm();
    formTitle.textContent = "Add Category";
    openModal(formModal);
  };

  const openEditModal = (category) => {
    state.editingCategory = category;
    resetForm();
    formTitle.textContent = "Edit Category";
    categoryName.value = category.name || "";
    categoryDescription.value = category.description || "";
    categoryActive.value = category.isActive ? "true" : "false";
    openModal(formModal);
  };

  const saveCategory = async () => {
    if (!categoryName.value.trim()) {
      formHint.textContent = "Name is required.";
      formHint.style.color = "#b91c1c";
      return;
    }
    try {
      const payload = {
        name: categoryName.value.trim(),
        description: categoryDescription.value.trim(),
        isActive: categoryActive.value === "true"
      };
      const isEdit = Boolean(state.editingCategory);
      const url = isEdit ? `/api/categories/${state.editingCategory._id}` : "/api/categories";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data.message || "Failed to save category");

      closeModal(formModal);
      await fetchCategories();
    } catch (err) {
      formHint.textContent = err.message;
      formHint.style.color = "#b91c1c";
    }
  };

  const openDeleteModal = (category) => {
    state.editingCategory = category;
    deleteMessage.textContent = `Delete "${category.name}"?`;
    deleteHint.textContent = "Deleting removes the category if no recipes are using it.";
    deleteHint.style.color = "#6b7280";
    openModal(deleteModal);
  };

  const deleteCategory = async () => {
    if (!state.editingCategory) return;
    try {
      const res = await fetch(`/api/categories/${state.editingCategory._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data.message || "Failed to delete category");
      closeModal(deleteModal);
      await fetchCategories();
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
        fetchCategories();
      }, 300);
    });

    statusFilter?.addEventListener("change", (e) => {
      state.status = e.target.value;
      state.page = 1;
      fetchCategories();
    });

    refreshBtn?.addEventListener("click", fetchCategories);
    openCreateBtn?.addEventListener("click", openCreateModal);
  };

  const initPagination = () => {
    pagination?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-page]");
      if (!btn) return;
      if (btn.dataset.page === "prev" && state.page > 1) {
        state.page -= 1;
        fetchCategories();
      }
      if (btn.dataset.page === "next" && state.page < state.totalPages) {
        state.page += 1;
        fetchCategories();
      }
    });
  };

  const initTableActions = () => {
    tableWrap?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const category = state.categories.find((c) => c._id === btn.dataset.id);
      if (!category) return;

      if (btn.dataset.action === "edit") openEditModal(category);
      if (btn.dataset.action === "delete") openDeleteModal(category);
    });
  };

  const initModals = () => {
    closeFormBtn?.addEventListener("click", () => closeModal(formModal));
    cancelFormBtn?.addEventListener("click", () => closeModal(formModal));
    saveFormBtn?.addEventListener("click", saveCategory);
    closeDeleteBtn?.addEventListener("click", () => closeModal(deleteModal));
    cancelDeleteBtn?.addEventListener("click", () => closeModal(deleteModal));
    confirmDeleteBtn?.addEventListener("click", deleteCategory);
  };

  window.initAdminCategories = () => {
    initFilters();
    initPagination();
    initTableActions();
    initModals();
    fetchCategories();
    if (window.adminCategoriesInterval) {
      clearInterval(window.adminCategoriesInterval);
    }
    window.adminCategoriesInterval = setInterval(fetchCategories, 30000);
  };
})();
