// Theme Manager - Light/Dark mode support

const ThemeManager = {
    // Apply theme to document
    apply(theme) {
        document.documentElement.setAttribute('data-theme', theme || 'light');
    },

    // Get current theme
    async getCurrent() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['theme'], (result) => {
                resolve(result.theme || 'light');
            });
        });
    },

    // Save and apply theme
    async set(theme) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ theme }, () => {
                this.apply(theme);
                resolve();
            });
        });
    },

    // Initialize theme on page load
    async init() {
        const theme = await this.getCurrent();
        this.apply(theme);
        return theme;
    },

    // Setup settings modal theme toggle buttons
    setupToggle(activeTheme) {
        const buttons = document.querySelectorAll('.theme-option');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === activeTheme);
            btn.addEventListener('click', async () => {
                const newTheme = btn.dataset.theme;
                await this.set(newTheme);
                buttons.forEach(b => b.classList.toggle('active', b.dataset.theme === newTheme));
            });
        });
    }
};

// Make available globally for browser usage
if (typeof window !== 'undefined') {
    window.ThemeManager = ThemeManager;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ThemeManager };
}
