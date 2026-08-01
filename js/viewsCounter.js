// Working page view counter, counted by visitor IP on the server side
// (see /api/views.js). Each unique IP is counted once, no matter how
// many times that visitor reloads the page.
//
// If the API is unavailable (e.g. Vercel KV isn't connected to this
// project yet), we fall back to a local, per-browser counter so the
// number on screen doesn't just stay stuck on "...".
document.addEventListener('DOMContentLoaded', function () {
    const viewsEl = document.getElementById('viewsCount');
    if (!viewsEl) return;

    const LOCAL_FALLBACK_KEY = 'profile_views_fallback';
    const SESSION_FLAG = 'profile_view_counted_session';

    function formatNumber(n) {
        return n.toLocaleString('en-US');
    }

    function useLocalFallback() {
        try {
            const alreadyCounted = sessionStorage.getItem(SESSION_FLAG);
            let count = parseInt(localStorage.getItem(LOCAL_FALLBACK_KEY), 10);
            if (isNaN(count)) count = 0;

            if (!alreadyCounted) {
                count += 1;
                localStorage.setItem(LOCAL_FALLBACK_KEY, String(count));
                sessionStorage.setItem(SESSION_FLAG, '1');
            }

            viewsEl.textContent = formatNumber(count);
        } catch (e) {
            viewsEl.textContent = '0';
        }
    }

    fetch('/api/views')
        .then(function (res) {
            if (!res.ok) throw new Error('views API not available');
            return res.json();
        })
        .then(function (data) {
            if (typeof data.views !== 'number') throw new Error('Unexpected views response');
            viewsEl.textContent = formatNumber(data.views);
        })
        .catch(function () {
            useLocalFallback();
        });
});
