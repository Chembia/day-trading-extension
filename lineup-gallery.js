// Line-Up Gallery JavaScript

// Load and display all snapshots
async function loadGallery() {
    const result = await chrome.storage.local.get('lineupSnapshots');
    const snapshots = result.lineupSnapshots || [];

    const container = document.getElementById('gallery-container');
    container.innerHTML = '';

    if (snapshots.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'gallery-empty';
        empty.textContent = 'No snapshots in Line-Up yet. Add charts from the results page.';
        container.appendChild(empty);
        return;
    }

    snapshots.forEach(snapshot => {
        const card = createGalleryCard(snapshot);
        container.appendChild(card);
    });
}

function createGalleryCard(snapshot) {
    const card = document.createElement('div');
    card.className = 'gallery-snapshot glass-container';
    card.dataset.snapshotId = snapshot.id;

    const timestamp = new Date(snapshot.timestamp);

    card.innerHTML = `
        <img src="${snapshot.dataUrl}" alt="${snapshot.symbol} snapshot">
        <div class="gallery-snapshot-info">
            <div class="gallery-snapshot-symbol">${snapshot.symbol}</div>
            <div class="gallery-snapshot-details">
                <span>${snapshot.interval}</span>
                <span>${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}</span>
            </div>
        </div>
    `;

    card.addEventListener('click', () => openLightbox(snapshot));
    return card;
}

// Lightbox
function openLightbox(snapshot) {
    document.getElementById('lightbox').classList.remove('hidden');
    document.getElementById('lightbox-image').src = snapshot.dataUrl;
    document.getElementById('lightbox-symbol').textContent = snapshot.symbol;

    const timestamp = new Date(snapshot.timestamp);
    document.getElementById('lightbox-details').textContent =
        `${snapshot.interval} • ${timestamp.toLocaleDateString()} ${timestamp.toLocaleTimeString()}`;

    window.currentLightboxSnapshotId = snapshot.id;
}

function closeLightbox() {
    document.getElementById('lightbox').classList.add('hidden');
    window.currentLightboxSnapshotId = null;
}

// Download snapshot
function downloadSnapshot() {
    const img = document.getElementById('lightbox-image');
    const link = document.createElement('a');
    link.href = img.src;
    link.download = `RBT€-snapshot-${Date.now()}.png`;
    link.click();
}

// Delete snapshot
async function deleteSnapshotFromGallery() {
    if (!window.currentLightboxSnapshotId) return;
    if (!confirm('Delete this snapshot permanently?')) return;

    const result = await chrome.storage.local.get('lineupSnapshots');
    let snapshots = result.lineupSnapshots || [];
    snapshots = snapshots.filter(s => s.id !== window.currentLightboxSnapshotId);
    await chrome.storage.local.set({ lineupSnapshots: snapshots });

    closeLightbox();
    loadGallery();
}

// Theme toggle
function initTheme() {
    const toggle = document.getElementById('theme-toggle');

    chrome.storage.local.get('theme', (result) => {
        const theme = result.theme || 'light';
        document.documentElement.setAttribute('data-theme', theme);
        updateThemeToggle(theme);
    });

    toggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        chrome.storage.local.set({ theme: newTheme });
        updateThemeToggle(newTheme);
    });
}

function updateThemeToggle(theme) {
    const toggle = document.getElementById('theme-toggle');
    toggle.textContent = theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadGallery();
    initTheme();

    document.getElementById('close-lightbox').addEventListener('click', closeLightbox);
    document.getElementById('download-snapshot').addEventListener('click', downloadSnapshot);
    document.getElementById('delete-from-lightbox').addEventListener('click', deleteSnapshotFromGallery);
    document.getElementById('close-gallery').addEventListener('click', () => window.close());

    document.querySelector('.lightbox-overlay').addEventListener('click', closeLightbox);
});
