(function () {
    'use strict';

    var mapBox = document.getElementById('map');

    function showError(text) {
        mapBox.innerHTML = '<p class="map__error">' + text + '</p>';
    }

    if (typeof ymaps3 === 'undefined') {
        showError('Не удалось загрузить Яндекс Карты...');
        return;
    }

    var GRODNO = [23.8295, 53.6778]; // долгота, широта

    var GROUPS = [
        { id: 1, sport: 'volleyball', name: 'Волейбол', time: '18:00', place: 'Парк Жилибера',
          have: 3, total: 6, status: 'open', chat: '16:00', lat: 53.6692, lng: 23.8236 },
        { id: 2, sport: 'badminton', name: 'Бадминтон', time: '19:30', place: 'Спорткомплекс в центре',
          have: 1, total: 2, status: 'soon', chat: '17:30', lat: 53.6781, lng: 23.8295 },
        { id: 3, sport: 'basketball', name: 'Баскетбол', time: '20:00', place: 'Площадка у ЦСК «Неман»',
          have: 4, total: 10, status: 'open', chat: '18:00', lat: 53.6742, lng: 23.8418 }
    ];

    var STATUS = {
        open: { text: 'Набирается', chip: 'chip--soft', pin: 'ypin--primary' },
        soon: { text: 'Нужен 1 игрок', chip: 'chip--amber', pin: 'ypin--accent' }
    };

    function lngLat(g) { return [g.lng, g.lat]; } // Берёт группу и возвращает пару координат в нужном Яндексу порядке

    function popupHtml(g) {
        var st = STATUS[g.status];
        return '<div class="gp">' +
            '<span class="chip ' + st.chip + '">' + st.text + '</span>' +
            '<h3 class="gp__title">' + g.name + ' · ' + g.time + '</h3>' +
            '<p class="gp__text">' + g.place + '</p>' +
            '<p class="gp__text">' + g.have + ' из ' + g.total + ' · чат с ' + g.chat + '</p>' +
            '<a class="btn btn--primary gp__btn" href="#">Присоединиться</a>' +
            '</div>';
    }

    async function initMap() {
        // 1. Ждём, пока Яндекс загрузит все свои компоненты
        await ymaps3.ready;

        var YMap = ymaps3.YMap;
        var YMapDefaultSchemeLayer = ymaps3.YMapDefaultSchemeLayer;     // сама карта (схема)
        var YMapDefaultFeaturesLayer = ymaps3.YMapDefaultFeaturesLayer; // слой для меток
        var YMapMarker = ymaps3.YMapMarker;
        var YMapControls = ymaps3.YMapControls;

        // 2. Создаём карту в нашем контейнере #map
        var map = new YMap(
            mapBox,
            { location: { center: GRODNO, zoom: 13 } },
            [new YMapDefaultSchemeLayer({}), new YMapDefaultFeaturesLayer({})]
        );

        // Курсор «сжатая рука»
        mapBox.addEventListener('pointerdown', function (e) {
            if (e.button !== 0) return;
            if (e.target.closest('.ymarker, button, a, [role="button"]')) return;
            mapBox.classList.add('is-dragging');
        });
        ['pointerup', 'pointercancel', 'blur'].forEach(function (name) {
            window.addEventListener(name, function () {
                mapBox.classList.remove('is-dragging');
            });
        });

        // 3. Кнопки масштаба «+ / −» лежат в отдельном пакете Яндекса
        try {
            ymaps3.import.registerCdn('https://cdn.jsdelivr.net/npm/{package}',
                ['@yandex/ymaps3-default-ui-theme@0.0']);
            var ui = await ymaps3.import('@yandex/ymaps3-default-ui-theme');
            map.addChild(new YMapControls({ position: 'right' }).addChild(new ui.YMapZoomControl({})));
        } catch (e) {
            console.warn('Кнопки масштаба не загрузились:', e);
        }

        /* ---------- Метки ----------
           Метка в API 3.0 — это обычный HTML-элемент. Карточку-окно в v3 нужно делать самим:
           кладём её внутрь того же элемента и показываем/прячем атрибутом hidden. */
        var items = {};      // id группы -> { group, marker, popup, onMap }
        var openedId = null;
        var resultLinks = document.querySelectorAll('.result');

        function setActive(id) {
            resultLinks.forEach(function (link) {
                link.classList.toggle('result--active', Number(link.dataset.group) === id);
            });
        }

        function closePopup() {
            if (openedId === null) return;
            var item = items[openedId];
            item.popup.hidden = true;
            item.marker.update({ zIndex: 1 });
            openedId = null;
        }

        // Карточка не должна выходить за края карты: сдвигаем её внутрь, а если сверху нет места, открываем под меткой
        function keepInside(popup) {
            popup.style.transform = '';
            popup.style.setProperty('--shift', '0px');
            popup.classList.remove('ypopup--below');

            var box = mapBox.getBoundingClientRect();
            var rect = popup.getBoundingClientRect();
            var gap = 8;

            if (rect.top < box.top + gap) {
                popup.classList.add('ypopup--below');
            }
            var dx = 0;
            if (rect.left < box.left + gap) dx = box.left + gap - rect.left;
            else if (rect.right > box.right - gap) dx = box.right - gap - rect.right;
            if (dx) {
                popup.style.transform = 'translateX(calc(-50% + ' + dx + 'px))';
                popup.style.setProperty('--shift', dx + 'px'); // «хвостик» остаётся у метки
            }
        }

        function openPopup(id) {
            if (openedId === id) return;
            closePopup();
            var item = items[id];
            item.popup.hidden = false;
            keepInside(item.popup);
            item.marker.update({ zIndex: 2000 }); // открытая карточка поверх остальных меток
            openedId = id;
            setActive(id);
        }

        GROUPS.forEach(function (g) {
            var root = document.createElement('div');
            root.className = 'ymarker';

            var pin = document.createElement('button');
            pin.type = 'button';
            pin.className = 'ypin ' + STATUS[g.status].pin;
            pin.setAttribute('aria-label', g.name + ', ' + g.time + ', ' + g.place);

            var popup = document.createElement('div');
            popup.className = 'ypopup';
            popup.hidden = true;
            popup.innerHTML = popupHtml(g) +
                '<button class="ypopup__close" type="button" aria-label="Закрыть">&times;</button>';

            root.appendChild(pin);
            root.appendChild(popup);

            pin.addEventListener('click', function () {
                if (openedId === g.id) closePopup(); else openPopup(g.id);
            });
            popup.querySelector('.ypopup__close').addEventListener('click', closePopup);

            var marker = new YMapMarker({ coordinates: lngLat(g), zIndex: 1 }, root);
            map.addChild(marker);
            items[g.id] = { group: g, marker: marker, popup: popup, onMap: true };
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') closePopup();
        });

        mapBox.addEventListener('click', function (event) {
            if (!event.target.closest('.ymarker')) closePopup();
        });

        /* ---------- Показать все видимые метки ---------- */
        function fitVisible() {
            var visible = GROUPS.filter(function (g) { return items[g.id].onMap; });
            if (!visible.length) return;

            if (visible.length === 1) {
                map.setLocation({ center: lngLat(visible[0]), zoom: 15, duration: 400 });
                return;
            }
            var lngs = visible.map(function (g) { return g.lng; });
            var lats = visible.map(function (g) { return g.lat; });
            var minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
            var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats);
            var padLng = Math.max((maxLng - minLng) * 0.3, 0.004);
            var padLat = Math.max((maxLat - minLat) * 0.3, 0.003);
            // bounds: [[левый-нижний угол], [правый-верхний угол]], каждый — [долгота, широта]
            map.setLocation({
                bounds: [[minLng - padLng, minLat - padLat], [maxLng + padLng, maxLat + padLat]],
                duration: 400
            });
        }
        fitVisible();

        /* ---------- Клик по группе в списке слева ---------- */
        resultLinks.forEach(function (link) {
            link.addEventListener('click', function (event) {
                event.preventDefault();
                var id = Number(link.dataset.group);
                map.setLocation({ center: lngLat(items[id].group), zoom: 15, duration: 600 });
                openPopup(id);
                // На телефоне карта над списком: возвращаем её в поле зрения
                mapBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });

        /* ---------- Фильтр по активности ---------- */
        var countEl = document.querySelector('.sidebar__count');
        var listItems = document.querySelectorAll('.results__item');

        function plural(n) {
            var n10 = n % 10, n100 = n % 100;
            if (n10 === 1 && n100 !== 11) return 'группа';
            if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return 'группы';
            return 'групп';
        }

        function applySportFilter(sport) {
            closePopup();
            var shown = 0;
            GROUPS.forEach(function (g) {
                var item = items[g.id];
                var visible = sport === 'all' || g.sport === sport;
                if (visible && !item.onMap) { map.addChild(item.marker); item.onMap = true; }
                if (!visible && item.onMap) { map.removeChild(item.marker); item.onMap = false; }
                if (visible) shown++;
            });
            listItems.forEach(function (li) {
                li.hidden = !(sport === 'all' || li.dataset.sport === sport);
            });
            countEl.textContent = shown ? 'Найдено ' + shown + ' ' + plural(shown) : 'Групп не найдено';
            fitVisible();
        }

        document.querySelectorAll('input[name="sport"]').forEach(function (input) {
            input.addEventListener('change', function () { applySportFilter(input.value); });
        });
    }

    initMap().catch(function (error) {
        console.error(error);
        showError('Карта не запустилась. Откройте консоль (F12): там будет причина, чаще всего это ключ.');
    });
})();