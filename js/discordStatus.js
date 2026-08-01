function atualizarPerfilDiscord(userId) {
    // Если ID пользователя не указан, используем ID totsamiyhori по умолчанию
    const targetUserId = userId || '524918668388335616';
    
    // Обновленный URL для конечной точки конкретного пользователя
    fetch(`https://discorduserstatus-2-0.onrender.com/status/${targetUserId}`)
    .then(response => response.json())
    .then(data => {
        // Обновить фото профиля (если доступно)
        const avatarImg = document.querySelector('.avatarImage');
        if (avatarImg && data.avatarUrl) {
            avatarImg.src = data.avatarUrl;
            console.log(`Аватар пользователя ${targetUserId} обновлен:`, data.avatarUrl);
        }
        
        // Обновить статус
        const statusImg = document.querySelector('.discordStatus');
        if (statusImg) {
            // Использовать правильный путь к изображению в зависимости от статуса
            switch(data.status) {
                case 'online': statusImg.src = '/img/online.png'; break;
                case 'idle': statusImg.src = '/img/idle.png'; break;
                case 'dnd': statusImg.src = '/img/dnd.png'; break;
                default: statusImg.src = '/img/offline.png';
            }
            console.log(`Статус пользователя ${targetUserId} обновлен на:`, data.status);
        } else {
            console.error('Элемент .discordStatus не найден в DOM');
        }
        
        // Если хотите отображать имя пользователя
        const usernameElement = document.querySelector('.username');
        if (usernameElement && data.username) {
            usernameElement.textContent = data.username;
        }
    })
    .catch(error => {
        console.error('Ошибка при получении статуса:', error);
        // Добавить более заметную обработку ошибок для отладки
        const statusElement = document.querySelector('.status-debugging');
        if (statusElement) {
            statusElement.textContent = 'Ошибка подключения: ' + error.message;
            statusElement.style.color = 'red';
        }
    });
}

// Определить, какого пользователя отслеживать в зависимости от страницы
function determinarUsuarioPagina() {
    // Вы можете использовать разные методы для определения, какого пользователя отображать
    // Например, на основе URL или какого-то элемента на странице
    
    // Пример: проверяем, находимся ли мы на странице вашего профиля
    const currentPath = window.location.pathname;
    if (currentPath.includes('meuperfil') || currentPath.includes('perfil2')) {
        // Ваш ID пользователя
        return '524918668388335616';
    }
    
    // По умолчанию возвращаем ID totsamiyhori
    return '524918668388335616';
}

// Вызвать функцию сразу при загрузке с правильным ID
const userId = determinarUsuarioPagina();
atualizarPerfilDiscord(userId);

// Вызывать функцию периодически для поддержания актуальности
setInterval(() => atualizarPerfilDiscord(userId), 5000); // 5 секунд