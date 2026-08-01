// Working comments widget.
// Comments are shared for every visitor (stored server-side via
// /api/comments, backed by Vercel KV). The server enforces a limit of
// 3 comments per IP address — see api/comments.js.
document.addEventListener('DOMContentLoaded', function () {
    const AVATAR_MAP = {
        a1: 'img/vaatartatar.jpg',
        a2: 'img/asuka.jpg',
        a3: 'img/mikasa.png'
    };
    const DEFAULT_AVATAR = 'a1';

    const openBtn = document.getElementById('openComments');
    const closeBtn = document.getElementById('comments-close');
    const popup = document.getElementById('comments-popup');
    const list = document.getElementById('comments-list');
    const emptyMsg = document.getElementById('comments-empty');
    const form = document.getElementById('comments-form');
    const nameInput = document.getElementById('comment-name');
    const textInput = document.getElementById('comment-text');
    const statusEl = document.getElementById('comments-status');
    const countBadge = document.getElementById('commentsCount');
    const avatarPicker = document.getElementById('commentAvatarPicker');
    const avatarOptions = document.querySelectorAll('.commentAvatarOption');

    if (!popup || !form || !list) return;

    let selectedAvatar = DEFAULT_AVATAR;

    function setStatus(message, type) {
        if (!statusEl) return;
        statusEl.textContent = message || '';
        statusEl.className = 'comments-status' + (type ? ' ' + type : '');
    }

    function formatDate(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleString(undefined, {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function renderComments(comments) {
        if (countBadge) countBadge.textContent = comments.length;

        list.querySelectorAll('.comment-item').forEach(function (el) { el.remove(); });

        if (!comments.length) {
            if (emptyMsg) emptyMsg.style.display = 'block';
            return;
        }
        if (emptyMsg) emptyMsg.style.display = 'none';

        // Newest first
        comments.slice().reverse().forEach(function (comment) {
            const item = document.createElement('div');
            item.className = 'comment-item';

            const head = document.createElement('div');
            head.className = 'comment-item-head';

            const who = document.createElement('div');
            who.className = 'comment-item-who';

            const avatar = document.createElement('img');
            avatar.className = 'comment-item-avatar';
            avatar.src = AVATAR_MAP[comment.avatar] || AVATAR_MAP[DEFAULT_AVATAR];
            avatar.alt = '';

            const name = document.createElement('span');
            name.className = 'comment-item-name';
            name.textContent = comment.name; // textContent avoids any HTML injection

            who.appendChild(avatar);
            who.appendChild(name);

            const date = document.createElement('span');
            date.className = 'comment-item-date';
            date.textContent = formatDate(comment.date);

            head.appendChild(who);
            head.appendChild(date);

            const text = document.createElement('div');
            text.className = 'comment-item-text';
            text.textContent = comment.text; // textContent avoids any HTML injection

            item.appendChild(head);
            item.appendChild(text);
            list.appendChild(item);
        });
    }

    function loadComments() {
        setStatus('Загрузка...', 'info');
        fetch('/api/comments')
            .then(function (res) {
                if (!res.ok) throw new Error('comments API not available');
                return res.json();
            })
            .then(function (data) {
                setStatus('');
                renderComments(Array.isArray(data.comments) ? data.comments : []);
            })
            .catch(function () {
                setStatus('Не удалось загрузить комментарии.', 'error');
                renderComments([]);
            });
    }

    function openPopup() {
        popup.classList.add('active');
        loadComments();
    }

    function closePopup() {
        popup.classList.remove('active');
    }

    if (openBtn) {
        openBtn.addEventListener('click', openPopup);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closePopup);
    }

    popup.addEventListener('click', function (e) {
        if (e.target === popup) closePopup();
    });

    if (avatarPicker) {
        avatarOptions.forEach(function (opt) {
            opt.addEventListener('click', function () {
                selectedAvatar = opt.getAttribute('data-avatar');
                avatarOptions.forEach(function (o) {
                    o.classList.toggle('selected', o === opt);
                });
            });
        });
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const name = (nameInput.value || '').trim().slice(0, 30);
        const text = (textInput.value || '').trim().slice(0, 300);

        if (!name || !text) return;

        const submitBtn = form.querySelector('.comments-submit');
        if (submitBtn) submitBtn.disabled = true;
        setStatus('Отправка...', 'info');

        fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, text: text, avatar: selectedAvatar })
        })
            .then(function (res) {
                return res.json().then(function (data) {
                    return { ok: res.ok, status: res.status, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok) {
                    if (result.status === 429) {
                        setStatus('Ты уже оставил максимум 3 комментария с этого IP.', 'error');
                    } else {
                        setStatus('Не удалось отправить комментарий.', 'error');
                    }
                    return;
                }
                textInput.value = '';
                setStatus('');
                loadComments();
            })
            .catch(function () {
                setStatus('Не удалось отправить комментарий. Проверь соединение.', 'error');
            })
            .finally(function () {
                if (submitBtn) submitBtn.disabled = false;
            });
    });
});
