(function () {
    var btn = document.getElementById('chrome-toggle-btn');
    if (!btn) return;

    var hidden = false;

    function apply() {
        document.body.classList.toggle('chrome-hidden', hidden);
        btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
        btn.setAttribute('aria-label', hidden ? 'Show menu bars' : 'Hide menu bars for fullscreen');
    }

    apply();

    btn.addEventListener('click', function () {
        hidden = !hidden;
        apply();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && hidden) {
            hidden = false;
            apply();
        }
    });
})();
