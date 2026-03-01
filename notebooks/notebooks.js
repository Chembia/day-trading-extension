// Notebooks Page JavaScript

document.addEventListener('DOMContentLoaded', async () => {
    // Apply theme
    await ThemeManager.init();
    const currentTheme = await ThemeManager.getCurrent();
    ThemeManager.setupToggle(currentTheme);

    // View state
    let currentView = 'grid'; // 'grid' | 'gallery' | 'detail'
    let currentNotebookId = null;
    let currentImageId = null;

    // DOM elements
    const notebookGrid = document.getElementById('notebookGrid');
    const imageGallery = document.getElementById('imageGallery');
    const imageDetail = document.getElementById('imageDetail');
    const emptyState = document.getElementById('emptyState');
    const createNotebookBtn = document.getElementById('createNotebookBtn');
    const createFirstNotebookBtn = document.getElementById('createFirstNotebookBtn');
    const backBtn = document.getElementById('backBtn');
    const backToNotebooks = document.getElementById('backToNotebooks');
    const backToGallery = document.getElementById('backToGallery');
    const galleryTitle = document.getElementById('galleryTitle');
    const imageGrid = document.getElementById('imageGrid');
    const noImages = document.getElementById('noImages');
    const renameNotebookBtn = document.getElementById('renameNotebookBtn');
    const manageCollabBtn = document.getElementById('manageCollabBtn');
    const deleteNotebookBtn = document.getElementById('deleteNotebookBtn');
    const deleteImageBtn = document.getElementById('deleteImageBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');

    // Detail view elements
    const detailImage = document.getElementById('detailImage');
    const detailSymbol = document.getElementById('detailSymbol');
    const detailDate = document.getElementById('detailDate');
    const detailSymbolText = document.getElementById('detailSymbolText');
    const detailInterval = document.getElementById('detailInterval');
    const detailRange = document.getElementById('detailRange');
    const detailPatterns = document.getElementById('detailPatterns');
    const detailNotes = document.getElementById('detailNotes');
    const saveNotesBtn = document.getElementById('saveNotesBtn');

    // Name modal
    const notebookNameModal = document.getElementById('notebook-name-modal');
    const notebookModalTitle = document.getElementById('notebook-modal-title');
    const notebookNameInput = document.getElementById('notebook-name-input');
    const cancelNotebookName = document.getElementById('cancel-notebook-name');
    const confirmNotebookName = document.getElementById('confirm-notebook-name');

    // Collaborators modal
    const collabModal = document.getElementById('collaborators-modal');
    const collaboratorList = document.getElementById('collaborator-list');
    const collabEmail = document.getElementById('collab-email');
    const collabRole = document.getElementById('collab-role');
    const addCollabBtn = document.getElementById('add-collab-btn');
    const closeCollabModal = document.getElementById('close-collab-modal');

    let nameModalMode = 'create'; // 'create' | 'rename'

    // ---- Show/Hide Views ----
    function showView(view) {
        notebookGrid.classList.toggle('hidden', view !== 'grid');
        imageGallery.classList.toggle('hidden', view !== 'gallery');
        imageDetail.classList.toggle('hidden', view !== 'detail');
        emptyState.classList.add('hidden');
        currentView = view;
    }

    // ---- Render Notebook Grid ----
    async function renderNotebooks() {
        const notebooks = await NotebookManager.getAll();
        showView('grid');
        notebookGrid.innerHTML = '';

        if (notebooks.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        notebooks.forEach(nb => {
            const card = document.createElement('div');
            card.className = 'notebook-card';
            card.innerHTML = `
                <div class="notebook-card-icon">📓</div>
                <h3 class="notebook-card-name">${escapeHtml(nb.name)}</h3>
                <div class="notebook-card-meta">
                    <span>${nb.images.length} image${nb.images.length !== 1 ? 's' : ''}</span>
                    <span>Updated ${formatDate(nb.updatedAt)}</span>
                </div>
                <div class="notebook-card-actions">
                    <button class="rename-btn" title="Rename">✏️</button>
                    <button class="delete-btn danger" title="Delete">🗑️</button>
                </div>
            `;

            card.addEventListener('click', (e) => {
                if (e.target.closest('.notebook-card-actions')) return;
                openNotebook(nb.id);
            });

            card.querySelector('.rename-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openRenameModal(nb.id, nb.name);
            });

            card.querySelector('.delete-btn').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Delete notebook "${nb.name}"? This cannot be undone.`)) {
                    await NotebookManager.delete(nb.id);
                    renderNotebooks();
                }
            });

            notebookGrid.appendChild(card);
        });
    }

    // ---- Open Notebook (Gallery View) ----
    async function openNotebook(notebookId) {
        currentNotebookId = notebookId;
        const notebooks = await NotebookManager.getAll();
        const nb = notebooks.find(n => n.id === notebookId);
        if (!nb) return;
        galleryTitle.textContent = nb.name;
        showView('gallery');
        renderImageGrid(nb);
    }

    function renderImageGrid(nb) {
        imageGrid.innerHTML = '';
        if (nb.images.length === 0) {
            noImages.classList.remove('hidden');
            return;
        }
        noImages.classList.add('hidden');
        nb.images.slice().reverse().forEach(img => {
            const card = document.createElement('div');
            card.className = 'image-card';
            card.innerHTML = `
                <img class="image-card-thumbnail" src="${img.dataUrl}" alt="${escapeHtml(img.symbol)}">
                <div class="image-card-info">
                    <p class="image-card-symbol">${escapeHtml(img.symbol) || 'Unknown'}</p>
                    <p class="image-card-date">${formatDate(img.savedAt)}</p>
                    <p class="image-card-notes">${escapeHtml(img.notes) || 'No notes'}</p>
                </div>
            `;
            card.addEventListener('click', () => openImageDetail(img.id));
            imageGrid.appendChild(card);
        });
    }

    // ---- Open Image Detail ----
    async function openImageDetail(imageId) {
        currentImageId = imageId;
        const notebooks = await NotebookManager.getAll();
        const nb = notebooks.find(n => n.id === currentNotebookId);
        if (!nb) return;
        const img = nb.images.find(i => i.id === imageId);
        if (!img) return;

        detailImage.src = img.dataUrl;
        detailSymbol.textContent = img.symbol || 'Unknown';
        detailDate.textContent = formatDate(img.savedAt);
        detailSymbolText.textContent = img.symbol || '-';
        detailInterval.textContent = img.interval || '-';
        detailRange.textContent = img.startDate && img.endDate
            ? `${img.startDate.slice(0, 10)} to ${img.endDate.slice(0, 10)}`
            : '-';
        detailNotes.value = img.notes || '';

        detailPatterns.innerHTML = '';
        (img.patterns || []).forEach(p => {
            const tag = document.createElement('span');
            tag.className = 'pattern-tag';
            tag.textContent = p;
            detailPatterns.appendChild(tag);
        });
        if ((img.patterns || []).length === 0) {
            detailPatterns.textContent = 'None';
        }

        showView('detail');
    }

    // ---- Create / Rename Modal ----
    function openCreateModal() {
        nameModalMode = 'create';
        notebookModalTitle.textContent = 'New Notebook';
        notebookNameInput.value = '';
        notebookNameModal.classList.add('show');
        setTimeout(() => notebookNameInput.focus(), 100);
    }

    function openRenameModal(notebookId, currentName) {
        nameModalMode = 'rename';
        currentNotebookId = notebookId;
        notebookModalTitle.textContent = 'Rename Notebook';
        notebookNameInput.value = currentName;
        notebookNameModal.classList.add('show');
        setTimeout(() => notebookNameInput.select(), 100);
    }

    if (createNotebookBtn) createNotebookBtn.addEventListener('click', openCreateModal);
    if (createFirstNotebookBtn) createFirstNotebookBtn.addEventListener('click', openCreateModal);

    if (cancelNotebookName) {
        cancelNotebookName.addEventListener('click', () => {
            notebookNameModal.classList.remove('show');
        });
    }

    notebookNameModal.addEventListener('click', (e) => {
        if (e.target === notebookNameModal) notebookNameModal.classList.remove('show');
    });

    if (confirmNotebookName) {
        confirmNotebookName.addEventListener('click', async () => {
            const name = notebookNameInput.value.trim();
            if (nameModalMode === 'create') {
                await NotebookManager.create(name || undefined);
                notebookNameModal.classList.remove('show');
                renderNotebooks();
            } else {
                if (!name) return;
                await NotebookManager.rename(currentNotebookId, name);
                notebookNameModal.classList.remove('show');
                // Refresh current view
                if (currentView === 'grid') {
                    renderNotebooks();
                } else {
                    galleryTitle.textContent = name;
                }
            }
        });
    }

    notebookNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmNotebookName.click();
    });

    // ---- Navigation ----
    if (backBtn) backBtn.addEventListener('click', () => window.close());
    if (backToNotebooks) backToNotebooks.addEventListener('click', renderNotebooks);
    if (backToGallery) {
        backToGallery.addEventListener('click', () => openNotebook(currentNotebookId));
    }

    // Gallery actions
    if (renameNotebookBtn) {
        renameNotebookBtn.addEventListener('click', async () => {
            const notebooks = await NotebookManager.getAll();
            const nb = notebooks.find(n => n.id === currentNotebookId);
            if (nb) openRenameModal(nb.id, nb.name);
        });
    }

    if (deleteNotebookBtn) {
        deleteNotebookBtn.addEventListener('click', async () => {
            const notebooks = await NotebookManager.getAll();
            const nb = notebooks.find(n => n.id === currentNotebookId);
            if (!nb) return;
            if (confirm(`Delete notebook "${nb.name}"? This cannot be undone.`)) {
                await NotebookManager.delete(currentNotebookId);
                renderNotebooks();
            }
        });
    }

    if (deleteImageBtn) {
        deleteImageBtn.addEventListener('click', async () => {
            if (confirm('Delete this image? This cannot be undone.')) {
                await NotebookManager.deleteImage(currentNotebookId, currentImageId);
                openNotebook(currentNotebookId);
            }
        });
    }

    if (saveNotesBtn) {
        saveNotesBtn.addEventListener('click', async () => {
            await NotebookManager.updateImageNotes(currentNotebookId, currentImageId, detailNotes.value);
            showToast('Notes saved!');
        });
    }

    // ---- Collaborators Modal ----
    async function openCollabModal() {
        await renderCollaborators();
        collabModal.classList.add('show');
    }

    async function renderCollaborators() {
        const notebooks = await NotebookManager.getAll();
        const nb = notebooks.find(n => n.id === currentNotebookId);
        if (!nb) return;
        collaboratorList.innerHTML = '';
        if ((nb.collaborators || []).length === 0) {
            collaboratorList.innerHTML = '<p style="color:var(--text-secondary);font-size:13px;">No collaborators added yet.</p>';
            return;
        }
        nb.collaborators.forEach(c => {
            const item = document.createElement('div');
            item.className = 'collaborator-item';
            item.innerHTML = `
                <span class="collaborator-email">${escapeHtml(c.email)}</span>
                <span class="role-badge">${escapeHtml(c.role)}</span>
                <button class="remove-btn" data-email="${escapeHtml(c.email)}">Remove</button>
            `;
            item.querySelector('.remove-btn').addEventListener('click', async () => {
                await NotebookManager.removeCollaborator(currentNotebookId, c.email);
                await renderCollaborators();
            });
            collaboratorList.appendChild(item);
        });
    }

    if (manageCollabBtn) manageCollabBtn.addEventListener('click', openCollabModal);

    if (addCollabBtn) {
        addCollabBtn.addEventListener('click', async () => {
            const email = collabEmail.value.trim();
            const role = collabRole.value;
            if (!email) return;
            await NotebookManager.addCollaborator(currentNotebookId, email, role);
            collabEmail.value = '';
            await renderCollaborators();
        });
    }

    if (closeCollabModal) {
        closeCollabModal.addEventListener('click', () => collabModal.classList.remove('show'));
    }
    collabModal.addEventListener('click', (e) => {
        if (e.target === collabModal) collabModal.classList.remove('show');
    });

    // ---- Settings ----
    if (settingsBtn) settingsBtn.addEventListener('click', () => settingsModal.classList.add('show'));
    if (closeSettings) closeSettings.addEventListener('click', () => settingsModal.classList.remove('show'));
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) settingsModal.classList.remove('show');
    });

    // ---- Helpers ----
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric'
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showToast(message) {
        const div = document.createElement('div');
        div.className = 'success-toast';
        div.textContent = message;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }

    // ---- Initial Render ----
    await renderNotebooks();
});
