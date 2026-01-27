function initRecipeFilters() {
  const filterRating = document.getElementById('filterRating');
  const filterCategory = document.getElementById('filterCategory');
  const filterRegion = document.getElementById('filterRegion');
  const filterSort = document.getElementById('filterSort');
  const clearBtn = document.getElementById('clearFilters');
  const grid = document.getElementById('recipesGrid');

  if (!grid || !clearBtn) return; // safety check

  function applyFilters() {
    const cards = Array.from(grid.querySelectorAll('.recipe-card'));
    let filteredCards = [...cards];

    if (filterRating.value) {
      filteredCards = filteredCards.filter(card =>
        Number(card.dataset.rating) >= Number(filterRating.value)
      );
    }
    if (filterCategory.value) {
      filteredCards = filteredCards.filter(card =>
        card.dataset.category === filterCategory.value
      );
    }
    if (filterRegion.value) {
      filteredCards = filteredCards.filter(card =>
        card.dataset.region === filterRegion.value
      );
    }
    if (filterSort.value) {
      filteredCards.sort((a, b) =>
        filterSort.value === 'latest'
          ? new Date(b.dataset.date) - new Date(a.dataset.date)
          : new Date(a.dataset.date) - new Date(b.dataset.date)
      );
    }

    grid.innerHTML = '';
    filteredCards.forEach(card => grid.appendChild(card));
  }

  // Attach event listeners
  filterRating.addEventListener('change', applyFilters);
  filterCategory.addEventListener('change', applyFilters);
  filterRegion.addEventListener('change', applyFilters);
  filterSort.addEventListener('change', applyFilters);

  clearBtn.addEventListener('click', () => {
    filterRating.value = '';
    filterCategory.value = '';
    filterRegion.value = '';
    filterSort.value = '';
    applyFilters();
  });
}
