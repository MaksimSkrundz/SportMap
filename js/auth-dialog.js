// Окно «Войдите или зарегистрируйтесь»
// Открывается по иконке пользователя и по любой кнопке с атрибутом data-open-auth
const authDialog = document.getElementById('authDialog');
const openers = document.querySelectorAll('#userBtn, [data-open-auth]');

// 1. Открыть: showModal() затемняет страницу и переносит фокус в окно
openers.forEach(function (button) {
    button.addEventListener('click', function () {
        authDialog.showModal();
    });
});

// 2. Закрыть: по крестику или по клику на затемнённый фон
authDialog.addEventListener('click', function (event) {
    const clickedBackdrop = event.target === authDialog;
    const clickedCross = event.target.closest('[data-close]');
    if (clickedBackdrop || clickedCross) {
        authDialog.close();
    }
});

// Закрытие по клавише Esc браузер делает сам, ничего писать не нужно