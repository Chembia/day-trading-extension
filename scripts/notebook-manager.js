// Notebook Manager - CRUD operations for notebooks and saved images

const NotebookManager = {
    // Generate unique ID
    _genId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    },

    // Load all notebooks from storage
    async getAll() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['notebooks'], (result) => {
                resolve(result.notebooks || []);
            });
        });
    },

    // Save all notebooks to storage
    async _saveAll(notebooks) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ notebooks }, resolve);
        });
    },

    // Create a new notebook
    async create(name) {
        const notebooks = await this.getAll();
        const defaultName = name || `Notebook ${notebooks.length + 1}`;
        const notebook = {
            id: this._genId('nb'),
            name: defaultName,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            collaborators: [],
            images: []
        };
        notebooks.push(notebook);
        await this._saveAll(notebooks);
        return notebook;
    },

    // Rename a notebook
    async rename(notebookId, newName) {
        const notebooks = await this.getAll();
        const nb = notebooks.find(n => n.id === notebookId);
        if (!nb) throw new Error('Notebook not found');
        nb.name = newName;
        nb.updatedAt = new Date().toISOString();
        await this._saveAll(notebooks);
        return nb;
    },

    // Delete a notebook
    async delete(notebookId) {
        const notebooks = await this.getAll();
        const updated = notebooks.filter(n => n.id !== notebookId);
        await this._saveAll(updated);
    },

    // Save an image to a notebook
    async saveImage(notebookId, imageData) {
        const notebooks = await this.getAll();
        const nb = notebooks.find(n => n.id === notebookId);
        if (!nb) throw new Error('Notebook not found');
        const image = {
            id: this._genId('img'),
            dataUrl: imageData.dataUrl,
            symbol: imageData.symbol || '',
            interval: imageData.interval || '',
            startDate: imageData.startDate || '',
            endDate: imageData.endDate || '',
            patterns: imageData.patterns || [],
            notes: imageData.notes || '',
            savedAt: new Date().toISOString()
        };
        nb.images.push(image);
        nb.updatedAt = new Date().toISOString();
        await this._saveAll(notebooks);
        return image;
    },

    // Delete an image from a notebook
    async deleteImage(notebookId, imageId) {
        const notebooks = await this.getAll();
        const nb = notebooks.find(n => n.id === notebookId);
        if (!nb) throw new Error('Notebook not found');
        nb.images = nb.images.filter(img => img.id !== imageId);
        nb.updatedAt = new Date().toISOString();
        await this._saveAll(notebooks);
    },

    // Update notes for an image
    async updateImageNotes(notebookId, imageId, notes) {
        const notebooks = await this.getAll();
        const nb = notebooks.find(n => n.id === notebookId);
        if (!nb) throw new Error('Notebook not found');
        const img = nb.images.find(i => i.id === imageId);
        if (!img) throw new Error('Image not found');
        img.notes = notes;
        nb.updatedAt = new Date().toISOString();
        await this._saveAll(notebooks);
        return img;
    },

    // Add collaborator to a notebook
    async addCollaborator(notebookId, email, role) {
        const notebooks = await this.getAll();
        const nb = notebooks.find(n => n.id === notebookId);
        if (!nb) throw new Error('Notebook not found');
        if (!nb.collaborators.find(c => c.email === email)) {
            nb.collaborators.push({
                email,
                role: role || 'viewer',
                addedAt: new Date().toISOString()
            });
            nb.updatedAt = new Date().toISOString();
            await this._saveAll(notebooks);
        }
        return nb;
    },

    // Remove collaborator from a notebook
    async removeCollaborator(notebookId, email) {
        const notebooks = await this.getAll();
        const nb = notebooks.find(n => n.id === notebookId);
        if (!nb) throw new Error('Notebook not found');
        nb.collaborators = nb.collaborators.filter(c => c.email !== email);
        nb.updatedAt = new Date().toISOString();
        await this._saveAll(notebooks);
        return nb;
    }
};

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.NotebookManager = NotebookManager;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NotebookManager };
}
