// Activity Feed Component
class ActivityFeed {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Activity feed container with id "${containerId}" not found`);
      return;
    }

    this.pollInterval = options.pollInterval || 5000; // 5 seconds default
    this.maxItems = options.maxItems || 20;
    this.displayDurationMs = options.displayDurationMs ?? 20000; // 20 seconds, then remove
    this.pollTimer = null;
    this.lastUpdateTime = null;
  }

  async fetchActivities() {
    try {
      const res = await fetch(`/api/activities?limit=${this.maxItems}`);
      if (!res.ok) {
        console.error("Failed to fetch activities:", res.status, res.statusText);
        throw new Error("Failed to fetch activities");
      }
      
      const data = await res.json();
      const activities = Array.isArray(data.activities) ? data.activities : [];
      console.log(`Fetched ${activities.length} activities`);
      return activities;
    } catch (err) {
      console.error("Error fetching activities:", err);
      return [];
    }
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return "just now";
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  renderActivity(activity) {
    const actionIcon = activity.action === "created" ? "✨" : activity.action === "updated" ? "✏️" : "🗑️";
    const actionText = activity.action === "created" ? "created" : activity.action === "updated" ? "edited" : "deleted";
    
    return `
      <div class="activity-item" data-activity-id="${activity._id}">
        <div class="activity-icon">${actionIcon}</div>
        <div class="activity-content">
          <div class="activity-text">
            <span class="activity-user">${this.escapeHtml(activity.userName)}</span>
            <span class="activity-action">${actionText}</span>
            <span class="activity-recipe">'${this.escapeHtml(activity.recipeTitle)}'</span>
          </div>
          <div class="activity-time">${this.formatTime(activity.createdAt)}</div>
        </div>
      </div>
    `;
  }

  escapeHtml(str) {
    return String(str || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async render() {
    if (!this.container) {
      console.warn("Activity feed container not found");
      return;
    }
    
    const fetched = await this.fetchActivities();
    const now = Date.now();
    const activities = fetched.filter((a) => {
      const age = now - new Date(a.createdAt).getTime();
      return age >= 0 && age < this.displayDurationMs;
    });

    if (activities.length === 0) {
      this.container.innerHTML = `
        <div class="activity-empty">
          <p>No recent activity</p>
          <p style="font-size: 0.75rem; color: #999; margin-top: 0.5rem;">Create a recipe to see activity here!</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = activities
      .map(activity => {
        // Validate activity has required fields
        if (!activity.userName || !activity.recipeTitle || !activity.action) {
          console.warn("Invalid activity data:", activity);
          return "";
        }
        return this.renderActivity(activity);
      })
      .filter(html => html.length > 0)
      .join("");

    // Add animation for new items
    const items = this.container.querySelectorAll(".activity-item");
    items.forEach((item, index) => {
      item.style.opacity = "0";
      item.style.transform = "translateY(-10px)";
      setTimeout(() => {
        item.style.transition = "all 0.3s ease";
        item.style.opacity = "1";
        item.style.transform = "translateY(0)";
      }, index * 50);
    });
  }

  // Force refresh method
  async refresh() {
    await this.render();
  }

  startPolling() {
    // Initial render
    this.render();
    
    // Set up polling
    this.pollTimer = setInterval(() => {
      this.render();
    }, this.pollInterval);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

// Initialize activity feed when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initActivityFeed);
} else {
  initActivityFeed();
}

function initActivityFeed() {
  const feedContainer = document.getElementById("activityFeed");
  if (feedContainer) {
    window.activityFeed = new ActivityFeed("activityFeed", {
      pollInterval: 5000, // Poll every 5 seconds
      maxItems: 20,
      displayDurationMs: 20000 // Show each message for 20 seconds, then remove
    });
    window.activityFeed.startPolling();
    
    // Refresh immediately when page becomes visible (e.g., after redirect)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && window.activityFeed) {
        window.activityFeed.refresh();
      }
    });
    
    // Also refresh when page loads
    window.addEventListener("load", () => {
      if (window.activityFeed) {
        setTimeout(() => window.activityFeed.refresh(), 500);
      }
    });
  } else {
    console.warn("Activity feed container not found");
  }
}
