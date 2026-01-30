// -----------------
// Load comments
// -----------------
async function loadComments(recipeId) {
  const commentsList = document.getElementById("commentsList");
  commentsList.innerHTML = "<p>Loading comments...</p>";

  try {
    const res = await fetch(`/api/comments/${recipeId}`);
    const data = await res.json();

    if (!data.comments || data.comments.length === 0) {
      commentsList.innerHTML = "<p>No comments yet.</p>";
      return;
    }

    // Fetch user info for each comment
    const commentsWithUser = await Promise.all(
      data.comments.map(async c => {
        let userName = c.user_id; // fallback
        try {
          const resUser = await fetch(`/api/users/public/${c.user_id}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          });
          if (resUser.ok) {
            const { user } = await resUser.json();
            userName = user?.name || c.user_id;
          }
        } catch (err) {
          console.error("Failed to fetch user for comment:", err);
        }
        return { ...c, userName };
      })
    );

    // Render comments
    commentsList.innerHTML = commentsWithUser
      .map(c => `
        <div class="comment-card">
          <p><strong>@${c.userName}</strong> </p>
          <p style="font-size: smaller; font-style: italic; color: #515d69">${new Date(c.created_date).toLocaleString()} -</p>
          <p>"${c.comment}"</p>
        </div>
      `)
      .join("");

  } catch (err) {
    console.error(err);
    commentsList.innerHTML = "<p>Failed to load comments.</p>";
  }
}

// -----------------
// Load recipe details
// -----------------
async function loadRecipeDetails() {
  const recipeId = sessionStorage.getItem("viewRecipeId");
  const token = localStorage.getItem("token");

  if (!recipeId || !token) {
    console.error("Missing recipe ID or token");
    return;
  }

  // Load comments immediately
  loadComments(recipeId);

  // Fetch recipe details
  try {
    const res = await fetch(`/api/recipes/${recipeId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("Failed to fetch recipe");

    const { recipe } = await res.json();
    if (!recipe) return;

    // Fill DOM elements (supports inputs, spans, p, div)
    const setValue = (id, value, isCheckbox = false) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (isCheckbox) {
        el.checked = value;
      } else if (["SPAN", "DIV", "P"].includes(el.tagName)) {
        el.textContent = value;
      } else {
        el.value = value;
      }
    };

    // Left side
    setValue("title", recipe.title || "");
    setValue("category", recipe.category || "");
    setValue("likeCount", recipe.is_like || 0);
    setValue("dislikeCount", recipe.is_dislike || 0);
    setValue("wishText", recipe.desc || "");
    setValue("favourite", recipe.favourite || false, true);

    const previewImg = document.getElementById("previewImg");
    if (previewImg) previewImg.src = recipe.imageUrl || "images/placeholder.png";

    // Right side: meta
    setValue("prepTime", recipe.prep_time ? recipe.prep_time + "m" : "-");
    setValue("cookTime", recipe.cook_time ? recipe.cook_time + "m" : "-");
    setValue("servesCount", recipe.serv || "-");

    // Right side: author
    if (recipe.userId) {
      const resUser = await fetch(`/api/users/public/${recipe.userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resUser.ok) {
        const { user } = await resUser.json();
        setValue("authorName", user?.name || "N/A");
        setValue("authorRole", "By"); // can append role if available
        const avatar = document.getElementById("authorAvatar");
        if (avatar) avatar.src = user?.avatar || "images/chef.png";
      }
    }

  } catch (err) {
    console.error(err);
  }

  // Likes / Dislikes buttons
  const likeBtn = document.getElementById("likeBtn");
  const dislikeBtn = document.getElementById("dislikeBtn");
  const likeCountEl = document.getElementById("likeCount");
  const dislikeCountEl = document.getElementById("dislikeCount");

  likeBtn?.addEventListener("click", () => {
    likeCountEl.textContent = parseInt(likeCountEl.textContent || 0) + 1;
  });

  dislikeBtn?.addEventListener("click", () => {
    dislikeCountEl.textContent = parseInt(dislikeCountEl.textContent || 0) + 1;
  });

  // Comment form submit
  const commentForm = document.getElementById("commentForm");
  const commentInput = document.getElementById("commentInput");

  commentForm.addEventListener("submit", async e => {
    e.preventDefault();
    const text = commentInput.value.trim();
    if (!text) return;

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ recipe_id: recipeId, comment: text })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add comment");

      commentInput.value = "";
      loadComments(recipeId);
    } catch (err) {
      alert(err.message);
    }
  });
}

// Expose globally
window.loadRecipeDetails = loadRecipeDetails;
window.loadComments = loadComments;
