// Activity Feed Component
class ActivityFeed {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`Activity feed container with id "${containerId}" not found`);
      return;
    }

    this.pollInterval = options.pollInterval || 5000; // 5 seconds default (fallback)
    this.maxItems = options.maxItems || 20;
    this.displayDurationMs = options.displayDurationMs ?? 20000; // 20 seconds, then remove
    this.pollTimer = null;
    this.lastUpdateTime = null;
    this.socket = null;
    this.useSocket = false;
    this.activities = []; // Store current activities for filtering
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
    
    // If using socket, filter stored activities; otherwise fetch from API
    let activities;
    if (this.useSocket && this.activities.length > 0) {
      const now = Date.now();
      activities = this.activities.filter((a) => {
        const age = now - new Date(a.createdAt).getTime();
        return age >= 0 && age < this.displayDurationMs;
      });
    } else {
      const fetched = await this.fetchActivities();
      const now = Date.now();
      activities = fetched.filter((a) => {
        const age = now - new Date(a.createdAt).getTime();
        return age >= 0 && age < this.displayDurationMs;
      });
      // Store activities for socket mode
      this.activities = activities;
    }

    if (activities.length === 0) {
      this.container.innerHTML = `
        <div class="activity-empty">
          <p>No recent activity</p>
          <p style="font-size: 0.75rem; color: #999; margin-top: 0.5rem;">Create a recipe to see activity here!</p>
        </div>
      `;
      return;
    }

    // Sort by createdAt descending (newest first)
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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

  // Add new activity from socket event
  addActivity(activity) {
    // Validate activity
    if (!activity.userName || !activity.recipeTitle || !activity.action) {
      console.warn("Invalid activity data from socket:", activity);
      return;
    }

    // Check if activity already exists (prevent duplicates)
    const exists = this.activities.some(a => a._id === activity._id);
    if (exists) {
      return;
    }

    // Add to beginning of array
    this.activities.unshift(activity);
    
    // Keep only maxItems
    if (this.activities.length > this.maxItems) {
      this.activities = this.activities.slice(0, this.maxItems);
    }

    // Re-render
    this.render();
  }

  // Force refresh method
  async refresh() {
    await this.render();
  }

  // Initialize Socket.IO connection
  initSocket() {
    if (typeof io === 'undefined') {
      console.warn("Socket.IO not available, falling back to polling");
      return false;
    }

    try {
      // Connect to Socket.IO server
      this.socket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      this.socket.on('connect', () => {
        console.log('✅ Connected to Socket.IO server');
        this.useSocket = true;
        // Join activity feed room
        this.socket.emit('join', 'activity-feed');
        // Initial fetch to populate activities
        this.fetchActivities().then(fetched => {
          this.activities = fetched;
          this.render();
        });
      });

      this.socket.on('new-activity', (activity) => {
        console.log('📡 Received new activity via Socket.IO:', activity);
        this.addActivity(activity);
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Disconnected from Socket.IO server, falling back to polling');
        this.useSocket = false;
        this.startPolling();
      });

      this.socket.on('connect_error', (error) => {
        console.warn('⚠️ Socket.IO connection error, falling back to polling:', error);
        this.useSocket = false;
        this.startPolling();
      });

      return true;
    } catch (error) {
      console.error('Error initializing Socket.IO:', error);
      return false;
    }
  }

  startPolling() {
    // Stop socket if it's running
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Stop existing polling if any
    this.stopPolling();

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

  // Cleanup method
  destroy() {
    this.stopPolling();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
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
      pollInterval: 5000, // Poll every 5 seconds (fallback)
      maxItems: 20,
      displayDurationMs: 20000 // Show each message for 20 seconds, then remove
    });
    
    // Try to initialize Socket.IO, fallback to polling if it fails
    const socketInitialized = window.activityFeed.initSocket();
    if (!socketInitialized) {
      console.log("Using polling mode for activity feed");
      window.activityFeed.startPolling();
    }
    
    // Refresh immediately when page becomes visible (e.g., after redirect)
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && window.activityFeed) {
        if (!window.activityFeed.useSocket) {
          window.activityFeed.refresh();
        }
      }
    });
    
    // Also refresh when page loads (only in polling mode)
    window.addEventListener("load", () => {
      if (window.activityFeed && !window.activityFeed.useSocket) {
        setTimeout(() => window.activityFeed.refresh(), 500);
      }
    });

    // Cleanup on page unload
    window.addEventListener("beforeunload", () => {
      if (window.activityFeed) {
        window.activityFeed.destroy();
      }
    });
  } else {
    console.warn("Activity feed container not found");
  }
}
