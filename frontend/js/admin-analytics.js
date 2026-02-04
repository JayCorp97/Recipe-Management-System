(() => {
  const token = localStorage.getItem("token");
  const refreshBtn = document.getElementById("refreshAnalyticsBtn");
  const rangeSelect = document.getElementById("analyticsRange");

  const totalUsers = document.getElementById("totalUsers");
  const totalRecipes = document.getElementById("totalRecipes");
  const avgRating = document.getElementById("avgRating");
  const totalCategories = document.getElementById("totalCategories");
  const userGrowth = document.getElementById("userGrowth");
  const recipeGrowth = document.getElementById("recipeGrowth");

  const categoryUsageWrap = document.getElementById("categoryUsageWrap");
  const tagInsightsWrap = document.getElementById("tagInsightsWrap");
  const userTrendCanvas = document.getElementById("userTrendChart");
  const recipeTrendCanvas = document.getElementById("recipeTrendChart");
  const ratingBucketCanvas = document.getElementById("ratingBucketChart");
  const roleBreakdownCanvas = document.getElementById("roleBreakdownChart");

  const charts = {};

  const escapeHtml = (value) => String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const renderTable = (container, headers, rows) => {
    if (!rows.length) {
      container.innerHTML = "<p class=\"empty-state\">No data yet.</p>";
      return;
    }
    const headRow = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const bodyRows = rows.map((row) => `
      <tr>
        ${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}
      </tr>
    `).join("");

    container.innerHTML = `
      <table class="table">
        <thead>
          <tr>${headRow}</tr>
        </thead>
        <tbody>
          ${bodyRows}
        </tbody>
      </table>
    `;
  };

  const ensureChart = (key, config) => {
    if (!window.Chart) {
      return null;
    }
    if (charts[key]) {
      charts[key].data = config.data;
      charts[key].options = { ...charts[key].options, ...config.options };
      charts[key].update();
      return charts[key];
    }
    charts[key] = new window.Chart(config.ctx, {
      type: config.type,
      data: config.data,
      options: config.options
    });
    return charts[key];
  };

  const renderLineChart = (key, canvas, labels, data, color) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ensureChart(key, {
      ctx,
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: key,
            data,
            borderColor: color,
            backgroundColor: `${color}33`,
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true }
        }
      }
    });
  };

  const renderBarChart = (key, canvas, labels, data, color) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ensureChart(key, {
      ctx,
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: key,
            data,
            backgroundColor: color,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true }
        }
      }
    });
  };

  const fetchOverview = async () => {
    const res = await fetch("/api/admin/analytics/overview", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || data.message || "Failed to load overview");

    totalUsers.textContent = data.users?.total ?? 0;
    totalRecipes.textContent = data.recipes?.total ?? 0;
    totalCategories.textContent = data.categories ?? 0;
    avgRating.textContent = data.insights?.avgRating ?? 0;
    userGrowth.textContent = `Growth ${data.insights?.userGrowthPct ?? 0}%`;
    recipeGrowth.textContent = `Growth ${data.insights?.recipeGrowthPct ?? 0}%`;
  };

  const fetchCategoryUsage = async () => {
    const res = await fetch("/api/admin/analytics/category-usage", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || data.message || "Failed to load categories");
    const rows = (data.usage || []).slice(0, 10).map((item) => [
      item.category || "Uncategorised",
      String(item.total || 0),
      item.isActive ? "Active" : "Inactive"
    ]);
    renderTable(categoryUsageWrap, ["Category", "Recipes", "Status"], rows);
  };

  const fetchTagInsights = async () => {
    const res = await fetch("/api/admin/analytics/tag-insights", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || data.message || "Failed to load tags");
    const rows = (data.tags || []).slice(0, 10).map((item) => [
      item.tag || "—",
      String(item.total || 0),
      String(Number(item.avgRating || 0).toFixed(2))
    ]);
    renderTable(tagInsightsWrap, ["Tag", "Recipes", "Avg Rating"], rows);
  };

  const fetchTrends = async () => {
    const days = rangeSelect?.value || "30";
    const userRes = await fetch(`/api/admin/analytics/user-trends?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const userData = await userRes.json().catch(() => ({}));
    if (userRes.ok && Array.isArray(userData.trends)) {
      const labels = userData.trends.map((t) => t.date);
      const counts = userData.trends.map((t) => t.total);
      renderLineChart("userTrends", userTrendCanvas, labels, counts, "#2563eb");
    }

    const recipeRes = await fetch(`/api/admin/analytics/recipe-trends?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const recipeData = await recipeRes.json().catch(() => ({}));
    if (recipeRes.ok && Array.isArray(recipeData.trends)) {
      const labels = recipeData.trends.map((t) => t.date);
      const counts = recipeData.trends.map((t) => t.total);
      renderLineChart("recipeTrends", recipeTrendCanvas, labels, counts, "#10b981");
    }
  };

  const fetchRatingBuckets = async () => {
    const res = await fetch("/api/admin/analytics/recipe-rating-buckets", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || data.message || "Failed to load rating buckets");
    const bucketMap = {};
    (data.buckets || []).forEach((bucket) => {
      bucketMap[bucket._id] = bucket.total;
    });
    const labels = ["0-1", "1-2", "2-3", "3-4", "4-5", "5+"];
    const values = [0, 1, 2, 3, 4, 5].map((value) => bucketMap[value] || 0);
    renderBarChart("ratingBuckets", ratingBucketCanvas, labels, values, "#f59e0b");
  };

  const fetchRoleBreakdown = async () => {
    const res = await fetch("/api/admin/analytics/user-role-breakdown", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || data.message || "Failed to load role breakdown");
    const labels = (data.roles || []).map((r) => r.role || "unknown");
    const values = (data.roles || []).map((r) => r.total || 0);
    renderBarChart("roleBreakdown", roleBreakdownCanvas, labels, values, "#6366f1");
  };

  const refreshAnalytics = async () => {
    if (!token) return;
    try {
      if (!window.Chart) {
        if (userTrendCanvas?.parentElement) {
          userTrendCanvas.parentElement.innerHTML = "<p class=\"empty-state\">Charts unavailable</p>";
        }
      }
      await Promise.all([
        fetchOverview(),
        fetchCategoryUsage(),
        fetchTagInsights(),
        fetchTrends(),
        fetchRatingBuckets(),
        fetchRoleBreakdown()
      ]);
    } catch (err) {
      console.error(err);
      categoryUsageWrap.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
      tagInsightsWrap.innerHTML = `<p class="empty-state">${escapeHtml(err.message)}</p>`;
    }
  };

  window.initAdminAnalytics = () => {
    refreshBtn?.addEventListener("click", refreshAnalytics);
    rangeSelect?.addEventListener("change", refreshAnalytics);
    refreshAnalytics();
    if (window.adminAnalyticsInterval) {
      clearInterval(window.adminAnalyticsInterval);
    }
    window.adminAnalyticsInterval = setInterval(refreshAnalytics, 60000);
  };
})();
