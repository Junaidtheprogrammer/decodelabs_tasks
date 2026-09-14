document.addEventListener('DOMContentLoaded', () => {
  const itemForm = document.getElementById('item-form');
  const titleInput = document.getElementById('title');
  const descriptionInput = document.getElementById('description');
  const itemsList = document.getElementById('items-list');
  const statusMessage = document.getElementById('status-message');
  const loadingSpinner = document.getElementById('loading-spinner');
  const refreshBtn = document.getElementById('refresh-btn');

  function showStatus(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = `status-banner ${isError ? 'error' : 'success'}`;
    statusMessage.classList.remove('hidden');
    setTimeout(() => statusMessage.classList.add('hidden'), 4000);
  }

  async function fetchItems() {
    loadingSpinner.classList.remove('hidden');
    try {
      const response = await fetch('/api/items');
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const result = await response.json();

      if (result.success) {
        renderItems(result.data);
      } else {
        showStatus(result.error || 'Failed to fetch items', true);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      showStatus('Network error: Unable to connect to server.', true);
    } finally {
      loadingSpinner.classList.add('hidden');
    }
  }

  function renderItems(items) {
    itemsList.innerHTML = '';

    if (items.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'empty-state';
      emptyLi.textContent = 'No items found. Create one above!';
      itemsList.appendChild(emptyLi);
      return;
    }

    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'item-card';

      const contentDiv = document.createElement('div');
      contentDiv.className = 'item-content';

      const h3 = document.createElement('h3');
      h3.textContent = item.title;

      const p = document.createElement('p');
      p.textContent = item.description || 'No description provided.';

      contentDiv.appendChild(h3);
      contentDiv.appendChild(p);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-danger';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', () => deleteItem(item.id));

      li.appendChild(contentDiv);
      li.appendChild(deleteBtn);
      itemsList.appendChild(li);
    });
  }

  itemForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!title) {
      showStatus('Please fill in the title.', true);
      return;
    }

    try {
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showStatus('Item created successfully!');
        itemForm.reset();
        await fetchItems();
      } else {
        showStatus(result.error || 'Server error occurred', true);
      }
    } catch (error) {
      console.error('Submit error:', error);
      showStatus('Network error while saving item.', true);
    }
  });

  async function deleteItem(id) {
    try {
      const response = await fetch(`/api/items/${id}`, { method: 'DELETE' });
      const result = await response.json();

      if (response.ok && result.success) {
        showStatus('Item deleted.');
        await fetchItems();
      } else {
        showStatus(result.error || 'Failed to delete item.', true);
      }
    } catch (error) {
      console.error('Delete error:', error);
      showStatus('Network error while deleting item.', true);
    }
  }

  refreshBtn.addEventListener('click', fetchItems);
  fetchItems();
});