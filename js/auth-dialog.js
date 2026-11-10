const authDialog = document.getElementById('authDialog');

document.addEventListener('click', function (event) {
    if (event.target.closest('#userBtn, [data-open-auth]')) {
        authDialog.showModal();
    }
});

authDialog.addEventListener('click', function (event) {
    const clickedBackdrop = event.target === authDialog;
    const clickedCross = event.target.closest('[data-close]');
    if (clickedBackdrop || clickedCross) {
        authDialog.close();
    }
});