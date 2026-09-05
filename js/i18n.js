/* Simple dictionary-based i18n. window.t(key) -> string */
(function () {
  const DICT = {
    ru: {
      'nav.home': 'Главная', 'nav.editor': 'Редактор', 'nav.tools': 'Инструменты',

      'home.title': 'Редактируйте и подписывайте PDF — бесплатно',
      'home.lead': 'Без регистрации, без водяных знаков, без лимитов. Файлы обрабатываются прямо в вашем браузере и никогда не отправляются на сервер.',
      'home.drop': 'Перетащите PDF сюда',
      'home.dropSub': 'или нажмите, чтобы выбрать файл',
      'drop.joke1': 'Мы позаботимся о нём',
      'drop.joke2': 'Бросай тело сюда',
      'drop.joke3': 'Ещё один договор, который никто не прочитал',
      'home.b1': 'Файлы не покидают устройство',
      'home.b2': 'Без лимитов и подписок',
      'home.b3': 'Работает офлайн',
      'home.tools': 'Инструменты',
      'home.why1t': 'Почему это бесплатно?',
      'home.why1b': 'Здесь нет серверов, которые нужно оплачивать: PDF читается и пересобирается кодом прямо на вашей странице. Нам просто нечего вам выставлять в счёт.',
      'home.why2t': 'Насколько это безопасно?',
      'home.why2b': 'Документ не загружается в интернет. Откройте вкладку, отключите Wi-Fi — и всё продолжит работать. Это удобно для договоров, паспортов и справок.',
      'home.why3t': 'Юридическая сила подписи',
      'home.why3b': 'Здесь вы ставите изображение подписи — это простая электронная подпись. Для квалифицированной подписи с криптосертификатом нужен аккредитованный сервис.',

      'tool.select': 'Выбор', 'tool.text': 'Текст', 'tool.sign': 'Подпись', 'tool.image': 'Картинка',
      'tool.check': 'Галочка', 'tool.draw': 'Рисовать', 'tool.highlight': 'Маркер', 'tool.rect': 'Фигура',
      'tool.redact': 'Скрыть',
      'tool.drop': 'Перетащите файлы сюда', 'tool.run': 'Выполнить',

      'editor.open': 'Открыть', 'editor.save': 'Скачать PDF',
      'editor.empty': 'Откройте PDF, чтобы начать редактирование',

      'sign.title': 'Ваша подпись', 'sign.draw': 'Нарисовать', 'sign.type': 'Напечатать',
      'sign.upload': 'Загрузить', 'sign.thick': 'Толщина', 'sign.size': 'Размер', 'sign.clear': 'Очистить',
      'sign.uploadHint': 'Фото или скан подписи (PNG, JPG)',
      'sign.uploadSub': 'Белый фон будет удалён автоматически',
      'sign.remember': 'Запомнить на этом устройстве', 'sign.apply': 'Применить',
      'sign.empty': 'Сначала нарисуйте или введите подпись',

      'footer.tag': 'бесплатный PDF-редактор, работающий целиком в браузере',

      'p.color': 'Цвет', 'p.size': 'Размер', 'p.font': 'Шрифт', 'p.width': 'Толщина',
      'p.font.sans': 'Обычный', 'p.font.serif': 'С засечками', 'p.font.mono': 'Моноширинный', 'p.font.hand': 'Рукописный',
      'p.bold': 'Жирный', 'p.fill': 'Заливка', 'p.opacity': 'Прозрачность',
      'p.hint.select': 'Кликните по объекту, чтобы переместить или изменить размер. Двойной клик по тексту — редактировать.',
      'p.hint.text': 'Кликните по странице и печатайте. Готовый блок сразу можно двигать и менять размер.',
      'p.hint.sign': 'Кликните по странице, чтобы поставить подпись — её сразу можно двигать и масштабировать.',
      'p.hint.image': 'Кликните по странице, чтобы вставить изображение — оно сразу готово к перемещению.',
      'p.hint.check': 'Кликните, чтобы поставить галочку. Её сразу можно двигать и менять размер.',
      'p.hint.draw': 'Рисуйте мышью прямо по странице.',
      'p.hint.highlight': 'Проведите по тексту, чтобы выделить.',
      'p.hint.rect': 'Растяните прямоугольник. Последний остаётся выделенным — поправьте его, не меняя инструмент.',
      'p.hint.redact': 'Закрасьте место, которое нужно скрыть. При сохранении включите «растрировать», чтобы текст под чёрным нельзя было выделить.',

      'tools.sign.t': 'Подписать PDF', 'tools.sign.d': 'Нарисуйте, напечатайте или загрузите подпись и поставьте её в нужное место',
      'tools.edit.t': 'Редактировать PDF', 'tools.edit.d': 'Текст, картинки, галочки, рисование, маркер и фигуры поверх страницы',
      'tools.merge.t': 'Объединить PDF', 'tools.merge.d': 'Склейте несколько файлов в один документ',
      'tools.split.t': 'Разделить PDF', 'tools.split.d': 'Вырежьте диапазон страниц или разбейте документ по одной',
      'tools.rotate.t': 'Повернуть PDF', 'tools.rotate.d': 'Разверните все страницы на 90, 180 или 270 градусов',
      'tools.pdf2img.t': 'PDF → изображения', 'tools.pdf2img.d': 'Сохраните страницы как PNG или JPG (архивом)',
      'tools.img2pdf.t': 'Изображения → PDF', 'tools.img2pdf.d': 'Соберите JPG и PNG в один PDF-документ',
      'tools.compress.t': 'Сжать PDF', 'tools.compress.d': 'Уменьшите вес файла с выбранным качеством',
      'tools.watermark.t': 'Водяной знак', 'tools.watermark.d': 'Наложите текст поверх или под содержимым страниц',
      'tools.pagenum.t': 'Нумерация страниц', 'tools.pagenum.d': 'Проставьте номера страниц в нужном углу',
      'tools.text.t': 'Извлечь текст', 'tools.text.d': 'Выгрузите весь текст документа в .txt файл',

      'o.range': 'Страницы', 'o.rangeHint': 'например: 1-3, 5, 8-10 (пусто — все)',
      'o.mode': 'Режим', 'o.mode.range': 'Извлечь диапазон', 'o.mode.each': 'Каждая страница — отдельный файл',
      'o.angle': 'Угол', 'o.format': 'Формат', 'o.quality': 'Качество', 'o.dpi': 'Разрешение',
      'o.text': 'Текст', 'o.opacity': 'Прозрачность', 'o.rotation': 'Наклон', 'o.layer': 'Слой',
      'o.layer.over': 'Поверх содержимого', 'o.layer.under': 'Под содержимым',
      'o.position': 'Положение', 'o.pos.br': 'Снизу справа', 'o.pos.bc': 'Снизу по центру', 'o.pos.bl': 'Снизу слева',
      'o.pos.tr': 'Сверху справа', 'o.pos.tc': 'Сверху по центру', 'o.pos.tl': 'Сверху слева',
      'o.start': 'Начать с номера', 'o.fontsize': 'Размер шрифта', 'o.pagesize': 'Размер страницы',
      'o.fit': 'Вписывать', 'o.margin': 'Поля',
      'o.rasterize': 'Растрировать страницы (надёжно скрывает закрашенное, но текст перестанет копироваться)',

      'msg.dropPdf': 'Нужен PDF-файл',
      'msg.loaded': 'Файл открыт',
      'msg.saved': 'Готово — файл скачан',
      'msg.noFiles': 'Добавьте файлы',
      'msg.needTwo': 'Нужно минимум два файла',
      'msg.badRange': 'Не удалось разобрать диапазон страниц',
      'msg.encrypted': 'Файл защищён паролем — откройте его без защиты',
      'msg.error': 'Ошибка: ',
      'msg.working': 'Обрабатываю…',
      'msg.rendering': 'Отрисовываю страницы…',
      'msg.copied': 'Скопировано',
      'busy.save': 'Собираю PDF…',
      'res.download': 'Скачать',
      'thumb.rotL': 'Повернуть влево', 'thumb.rotR': 'Повернуть вправо',
      'thumb.del': 'Удалить страницу', 'thumb.dup': 'Дублировать',
      'confirm.lastPage': 'Нельзя удалить последнюю страницу'
    },

    en: {
      'nav.home': 'Home', 'nav.editor': 'Editor', 'nav.tools': 'Tools',

      'home.title': 'Edit and sign PDFs — free',
      'home.lead': 'No sign-up, no watermarks, no limits. Your files are processed right inside your browser and never reach a server.',
      'home.drop': 'Drop a PDF here',
      'home.dropSub': 'or click to choose a file',
      'drop.joke1': "We'll take care of it",
      'drop.joke2': 'Drop the body here',
      'drop.joke3': 'Another contract nobody read',
      'home.b1': 'Files never leave your device',
      'home.b2': 'No limits, no subscription',
      'home.b3': 'Works offline',
      'home.tools': 'Tools',
      'home.why1t': 'Why is it free?',
      'home.why1b': 'There are no servers to pay for: the PDF is parsed and rebuilt by code running on your own page. There is simply nothing to bill you for.',
      'home.why2t': 'Is it safe?',
      'home.why2b': 'Your document is never uploaded. Open the tab, turn off Wi-Fi, and everything still works — handy for contracts, IDs and certificates.',
      'home.why3t': 'About signature validity',
      'home.why3b': 'You place an image of your signature, which is a simple electronic signature. A qualified signature with a crypto certificate requires an accredited provider.',

      'tool.select': 'Select', 'tool.text': 'Text', 'tool.sign': 'Sign', 'tool.image': 'Image',
      'tool.check': 'Check', 'tool.draw': 'Draw', 'tool.highlight': 'Highlight', 'tool.rect': 'Shape',
      'tool.redact': 'Redact',
      'tool.drop': 'Drop files here', 'tool.run': 'Run',

      'editor.open': 'Open', 'editor.save': 'Download PDF',
      'editor.empty': 'Open a PDF to start editing',

      'sign.title': 'Your signature', 'sign.draw': 'Draw', 'sign.type': 'Type',
      'sign.upload': 'Upload', 'sign.thick': 'Thickness', 'sign.size': 'Size', 'sign.clear': 'Clear',
      'sign.uploadHint': 'Photo or scan of your signature (PNG, JPG)',
      'sign.uploadSub': 'The white background is removed automatically',
      'sign.remember': 'Remember on this device', 'sign.apply': 'Apply',
      'sign.empty': 'Draw or type a signature first',

      'footer.tag': 'a free PDF editor that runs entirely in your browser',

      'p.color': 'Color', 'p.size': 'Size', 'p.font': 'Font', 'p.width': 'Width',
      'p.font.sans': 'Sans', 'p.font.serif': 'Serif', 'p.font.mono': 'Mono', 'p.font.hand': 'Handwriting',
      'p.bold': 'Bold', 'p.fill': 'Fill', 'p.opacity': 'Opacity',
      'p.hint.select': 'Click an object to move or resize it. Double-click text to edit.',
      'p.hint.text': 'Click on the page and type. The finished box can be moved and resized right away.',
      'p.hint.sign': 'Click on the page to place your signature — it is ready to move and scale at once.',
      'p.hint.image': 'Click on the page to insert an image — it is ready to move at once.',
      'p.hint.check': 'Click to place a check mark. It can be moved and resized right away.',
      'p.hint.draw': 'Draw freehand directly on the page.',
      'p.hint.highlight': 'Drag across text to highlight it.',
      'p.hint.rect': 'Drag to draw a rectangle. The last one stays selected, so you can adjust it without switching tools.',
      'p.hint.redact': 'Cover what should be hidden. Enable "rasterize" on save so the text underneath cannot be selected.',

      'tools.sign.t': 'Sign PDF', 'tools.sign.d': 'Draw, type or upload a signature and drop it anywhere',
      'tools.edit.t': 'Edit PDF', 'tools.edit.d': 'Text, images, check marks, freehand, highlighter and shapes',
      'tools.merge.t': 'Merge PDF', 'tools.merge.d': 'Combine several files into one document',
      'tools.split.t': 'Split PDF', 'tools.split.d': 'Extract a page range or burst into single pages',
      'tools.rotate.t': 'Rotate PDF', 'tools.rotate.d': 'Turn every page by 90, 180 or 270 degrees',
      'tools.pdf2img.t': 'PDF to images', 'tools.pdf2img.d': 'Save pages as PNG or JPG (as a zip)',
      'tools.img2pdf.t': 'Images to PDF', 'tools.img2pdf.d': 'Bundle JPG and PNG files into one PDF',
      'tools.compress.t': 'Compress PDF', 'tools.compress.d': 'Shrink the file at the quality you choose',
      'tools.watermark.t': 'Watermark', 'tools.watermark.d': 'Stamp text over or under the page content',
      'tools.pagenum.t': 'Page numbers', 'tools.pagenum.d': 'Add page numbers in any corner',
      'tools.text.t': 'Extract text', 'tools.text.d': 'Export all text of the document to a .txt file',

      'o.range': 'Pages', 'o.rangeHint': 'e.g. 1-3, 5, 8-10 (empty = all)',
      'o.mode': 'Mode', 'o.mode.range': 'Extract range', 'o.mode.each': 'One file per page',
      'o.angle': 'Angle', 'o.format': 'Format', 'o.quality': 'Quality', 'o.dpi': 'Resolution',
      'o.text': 'Text', 'o.opacity': 'Opacity', 'o.rotation': 'Tilt', 'o.layer': 'Layer',
      'o.layer.over': 'Over content', 'o.layer.under': 'Under content',
      'o.position': 'Position', 'o.pos.br': 'Bottom right', 'o.pos.bc': 'Bottom center', 'o.pos.bl': 'Bottom left',
      'o.pos.tr': 'Top right', 'o.pos.tc': 'Top center', 'o.pos.tl': 'Top left',
      'o.start': 'Start at', 'o.fontsize': 'Font size', 'o.pagesize': 'Page size',
      'o.fit': 'Fit', 'o.margin': 'Margin',
      'o.rasterize': 'Rasterize pages (truly hides covered text, but text is no longer selectable)',

      'msg.dropPdf': 'A PDF file is required',
      'msg.loaded': 'File opened',
      'msg.saved': 'Done — file downloaded',
      'msg.noFiles': 'Add some files first',
      'msg.needTwo': 'At least two files are needed',
      'msg.badRange': 'Could not parse the page range',
      'msg.encrypted': 'The file is password protected — remove the protection first',
      'msg.error': 'Error: ',
      'msg.working': 'Working…',
      'msg.rendering': 'Rendering pages…',
      'msg.copied': 'Copied',
      'busy.save': 'Building the PDF…',
      'res.download': 'Download',
      'thumb.rotL': 'Rotate left', 'thumb.rotR': 'Rotate right',
      'thumb.del': 'Delete page', 'thumb.dup': 'Duplicate',
      'confirm.lastPage': 'The last page cannot be deleted'
    }
  };

  let lang = localStorage.getItem('pdfree.lang') || (navigator.language || 'ru').slice(0, 2);
  if (!DICT[lang]) lang = 'ru';

  window.t = function (key) {
    return (DICT[lang] && DICT[lang][key]) || DICT.ru[key] || key;
  };
  window.getLang = () => lang;
  window.setLang = function (next) {
    if (!DICT[next]) return;
    lang = next;
    localStorage.setItem('pdfree.lang', next);
    document.documentElement.lang = next;
    window.applyI18n();
    document.dispatchEvent(new CustomEvent('langchange'));
  };
  window.applyI18n = function (root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = window.t(el.getAttribute('data-i18n'));
    });
    (root || document).querySelectorAll('[data-i18n-ph]').forEach(el => {
      el.placeholder = window.t(el.getAttribute('data-i18n-ph'));
    });
  };
})();
