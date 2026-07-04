(function () {
    var STORAGE_KEY = 'theme';
    var toggle = document.getElementById('theme-toggle');
    if (!toggle) return;

    var meta = document.querySelector('meta[name="theme-color"]');
    var current = localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';

    function apply(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            toggle.textContent = 'Dark theme';
            toggle.setAttribute('aria-label', 'Switch to dark theme');
            if (meta) meta.setAttribute('content', '#e9ebee');
        } else {
            document.documentElement.removeAttribute('data-theme');
            toggle.textContent = 'Light theme';
            toggle.setAttribute('aria-label', 'Switch to light theme');
            if (meta) meta.setAttribute('content', '#2c3035');
        }
    }

    apply(current);

    toggle.addEventListener('click', function () {
        current = current === 'light' ? 'dark' : 'light';
        localStorage.setItem(STORAGE_KEY, current);
        apply(current);
    });
})();
