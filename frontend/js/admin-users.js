(() => {
  const state = {
    page: 1,
    limit: 10,
    search: "",
    role: "all",
    status: "all",
    users: [],
    totalPages: 1,
    selectedUser: null,
    actionType: null,
    selectedIds: new Set()
  };

  const token = localStorage.getItem("token");
  const tableWrap = document.getElementById("usersTableWrap");
  const pagination = document.getElementById("usersPagination");
  const searchInput = document.getElementById("userSearchInput");
  const roleFilter = document.getElementById("userRoleFilter");
  const statusFilter = document.getElementById("userStatusFilter");
  const refreshBtn = document.getElementById("refreshUsersBtn");
  const bulkDeactivateBtn = document.getElementById("bulkDeactivateBtn");
  const bulkDeleteBtn = document.getElementById("bulkDeleteBtn");

  const statusModal = document.getElementById("userStatusModal");
  const statusTitle = document.getElementById("userStatusTitle");
  const statusMessage = document.getElementById("userStatusMessage");
  const statusHint = document.getElementById("userStatusHint");
  const confirmStatusBtn = document.getElementById("confirmUserStatusBtn");
  const cancelStatusBtn = document.getElementById("cancelUserStatusBtn");
  const closeStatusBtn = document.getElementById("closeUserStatusModal");

  const deleteModal = document.getElementById("userDeleteModal");
  const deleteMessage = document.getElementById("userDeleteMessage");
  const deleteHint = document.getElementById("userDeleteHint");
  const deleteMode = document.getElementById("deleteMode");
  const confirmDeleteBtn = document.getElementById("confirmUserDeleteBtn");
  const cancelDeleteBtn = document.getElementById("cancelUserDeleteBtn");
  const closeDeleteBtn = document.getElementById("closeUserDeleteModal");

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

  const getStatusBadge = (user) => {
    if (user.deletedAt) return badge("badge-muted", "Deleted");
    if (user.active === 1) return badge("badge-success", "Active");
    return badge("badge-warning", "Suspended");
  };

  const renderTable = () => {
    if (!tableWrap) return;
    if (!state.users.length) {
      tableWrap.innerHTML = "<p class=\"empty-state\">No users found.</p>";
      pagination.innerHTML = "";
      return;
    }

    const allSelected = state.users.length > 0 && state.users.every((u) => state.selectedIds.has(u._id));
    const rows = state.users.map((user) => {
      const isProtected = user.role === "admin";
      const actionDisabled = isProtected ? "disabled" : "";
      const protectedLabel = isProtected ? "Protected" : "";
      return `
      <tr>
        <td>
          <input type="checkbox" class="row-select" data-id="${user._id}" ${state.selectedIds.has(user._id) ? "checked" : ""} ${isProtected ? "disabled" : ""} />
        </td>
        <td>${escapeHtml(user.f_name)} ${escapeHtml(user.l_name)}</td>
        <td>${escapeHtml(user.email)}</td>
        <td>${badge("badge-muted", escapeHtml(user.role || "user"))}</td>
        <td>${getStatusBadge(user)}</td>
        <td>${formatDate(user.created_date)}</td>
        <td>
          <button class="btn btn-warning" data-action="toggle" data-id="${user._id}" ${actionDisabled}>
            ${protectedLabel || (user.active === 1 ? "Deactivate" : "Activate")}
          </button>
          <button class="btn btn-danger" data-action="delete" data-id="${user._id}" ${actionDisabled}>
            Delete
          </button>
        </td>
      </tr>
    `;
    }).join("");

    tableWrap.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th><input type="checkbox" id="selectAllUsers" ${allSelected ? "checked" : ""} /></th>
            <th>User</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
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
    if (!pagination) return;
    pagination.innerHTML = `
      <span class="pill">Page ${state.page} of ${state.totalPages}</span>
      <button class="btn btn-secondary" ${state.page === 1 ? "disabled" : ""} data-page="prev">Prev</button>
      <button class="btn btn-secondary" ${state.page === state.totalPages ? "disabled" : ""} data-page="next">Next</button>
    `;
  };

  const fetchUsers = async () => {
    if (!token) {
      tableWrap.innerHTML = "<p class=\"empty-state\">Missing auth token.</p>";
      return;
    }
    tableWrap.innerHTML = "<p class=\"empty-state\">Loading users...</p>";
    try {
      const params = new URLSearchParams({
        page: state.page,
        limit: state.limit,
        search: state.search,
        role: state.role,
        status: state.status
      });
      const res = await fetch(`/api/users/admin/all?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data.message || "Failed to load users");

      state.users = Array.isArray(data.users) ? data.users : [];
      state.totalPages = data.totalPages || 1;
      state.selectedIds = new Set(
        state.users.filter((u) => state.selectedIds.has(u._id)).map((u) => u._id)
      );
      renderTable();
    } catch (err) {
      console.error(err);
      tableWrap.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
    }
  };

  const openModal = (modal) => modal?.classList.add("show");
  const closeModal = (modal) => modal?.classList.remove("show");

  const handleTableAction = (event) => {
    const btn = event.target.closest("button[data-action]");
    const checkbox = event.target.closest("input.row-select");
    const selectAll = event.target.closest("#selectAllUsers");
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
        state.users.filter((u) => u.role !== "admin").forEach((u) => state.selectedIds.add(u._id));
      } else {
        state.users.forEach((u) => state.selectedIds.delete(u._id));
      }
      renderTable();
      return;
    }
    if (!btn) return;
    const userId = btn.dataset.id;
    const action = btn.dataset.action;
    const user = state.users.find((u) => u._id === userId);
    if (!user) return;

    state.selectedUser = user;
    if (action === "toggle") {
      const isActive = user.active === 1;
      state.actionType = isActive ? "deactivate" : "activate";
      statusTitle.textContent = `${isActive ? "Deactivate" : "Activate"} User`;
      statusMessage.textContent = `Are you sure you want to ${isActive ? "deactivate" : "activate"} ${user.f_name} ${user.l_name}?`;
      statusHint.textContent = isActive
        ? "Deactivated users cannot log in until reactivated."
        : "Activating restores user access.";
      confirmStatusBtn.textContent = isActive ? "Deactivate" : "Activate";
      openModal(statusModal);
    }
    if (action === "delete") {
      state.actionType = "delete";
      deleteMessage.textContent = `Delete ${user.f_name} ${user.l_name}?`;
      deleteHint.textContent = "Soft delete disables access but keeps data. Hard delete is permanent.";
      deleteMode.value = "soft";
      openModal(deleteModal);
    }
  };

  const updateStatus = async () => {
    if (!state.selectedUser) return;
    const makeActive = state.actionType === "activate";
    try {
      const res = await fetch(`/api/users/admin/${state.selectedUser._id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ active: makeActive })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data.message || "Failed to update status");
      closeModal(statusModal);
      await fetchUsers();
    } catch (err) {
      statusHint.textContent = err.message;
      statusHint.style.color = "#b91c1c";
    }
  };

  const deleteUser = async () => {
    if (!state.selectedUser) return;
    const hardDelete = deleteMode.value === "hard";
    try {
      const res = await fetch(`/api/users/admin/${state.selectedUser._id}?hard=${hardDelete}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data.message || "Failed to delete user");
      closeModal(deleteModal);
      await fetchUsers();
    } catch (err) {
      deleteHint.textContent = err.message;
      deleteHint.style.color = "#b91c1c";
    }
  };

  const bulkDeactivate = async () => {
    const ids = Array.from(state.selectedIds);
    if (!ids.length) {
      alert("Select at least one user.");
      return;
    }
    statusTitle.textContent = "Bulk Deactivate";
    statusMessage.textContent = `Deactivate ${ids.length} users?`;
    statusHint.textContent = "Admins and your own account are protected.";
    confirmStatusBtn.textContent = "Deactivate";
    state.actionType = "bulk-deactivate";
    openModal(statusModal);
  };

  const bulkDelete = async () => {
    const ids = Array.from(state.selectedIds);
    if (!ids.length) {
      alert("Select at least one user.");
      return;
    }
    deleteMessage.textContent = `Delete ${ids.length} users?`;
    deleteHint.textContent = "Soft delete keeps data. Hard delete is permanent.";
    deleteMode.value = "soft";
    state.actionType = "bulk-delete";
    openModal(deleteModal);
  };

  const submitBulkStatus = async () => {
    const ids = Array.from(state.selectedIds);
    try {
      const res = await fetch("/api/users/admin/bulk-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ids, active: false })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data.message || "Bulk update failed");
      closeModal(statusModal);
      state.selectedIds.clear();
      await fetchUsers();
    } catch (err) {
      statusHint.textContent = err.message;
      statusHint.style.color = "#b91c1c";
    }
  };

  const submitBulkDelete = async () => {
    const ids = Array.from(state.selectedIds);
    const hardDelete = deleteMode.value === "hard";
    try {
      const res = await fetch("/api/users/admin/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ids, hard: hardDelete })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data.message || "Bulk delete failed");
      closeModal(deleteModal);
      state.selectedIds.clear();
      await fetchUsers();
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
        fetchUsers();
      }, 300);
    });

    roleFilter?.addEventListener("change", (e) => {
      state.role = e.target.value;
      state.page = 1;
      fetchUsers();
    });

    statusFilter?.addEventListener("change", (e) => {
      state.status = e.target.value;
      state.page = 1;
      fetchUsers();
    });

    refreshBtn?.addEventListener("click", fetchUsers);
    bulkDeactivateBtn?.addEventListener("click", bulkDeactivate);
    bulkDeleteBtn?.addEventListener("click", bulkDelete);
  };

  const initPagination = () => {
    pagination?.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-page]");
      if (!btn) return;
      if (btn.dataset.page === "prev" && state.page > 1) {
        state.page -= 1;
        fetchUsers();
      }
      if (btn.dataset.page === "next" && state.page < state.totalPages) {
        state.page += 1;
        fetchUsers();
      }
    });
  };

  const initModals = () => {
    confirmStatusBtn?.addEventListener("click", () => {
      if (state.actionType === "bulk-deactivate") {
        submitBulkStatus();
      } else {
        updateStatus();
      }
    });
    cancelStatusBtn?.addEventListener("click", () => closeModal(statusModal));
    closeStatusBtn?.addEventListener("click", () => closeModal(statusModal));

    confirmDeleteBtn?.addEventListener("click", () => {
      if (state.actionType === "bulk-delete") {
        submitBulkDelete();
      } else {
        deleteUser();
      }
    });
    cancelDeleteBtn?.addEventListener("click", () => closeModal(deleteModal));
    closeDeleteBtn?.addEventListener("click", () => closeModal(deleteModal));
  };

  const initActions = () => {
    tableWrap?.addEventListener("click", handleTableAction);
  };

  window.initAdminUsers = () => {
    initFilters();
    initPagination();
    initModals();
    initActions();
    fetchUsers();
    if (window.adminUsersInterval) {
      clearInterval(window.adminUsersInterval);
    }
    window.adminUsersInterval = setInterval(fetchUsers, 30000);
  };
})();
