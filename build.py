#!/usr/bin/env python3
"""Собирает весь сайт в один самодостаточный HTML-файл: dist/pdfree.html

В файл попадает всё — стили, скрипты, библиотеки, шрифты и worker pdf.js,
поэтому результат работает откуда угодно: с любого хостинга, с флешки и даже
двойным кликом с диска, без сервера и без интернета.

    python build.py
"""
import base64
import io
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(ROOT, 'dist')
OUT_FILE = os.path.join(OUT_DIR, 'pdfree.html')
# Вариант для площадок, которые сами оборачивают содержимое в <html><body>.
OUT_FRAGMENT = os.path.join(OUT_DIR, 'pdfree.fragment.html')

VENDOR = ['vendor/pdf.min.js', 'vendor/pdf-lib.min.js',
          'vendor/fontkit.umd.min.js', 'vendor/jszip.min.js']
# Те же версии на CDN — для площадок, которые не принимают библиотеки внутри
# страницы: их минифицированный код содержит служебные символы.
VENDOR_CDN = [
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    'https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
]
APP = ['js/i18n.js', 'js/core.js', 'js/editor.js', 'js/tools.js', 'js/app.js']
FONTS = {'sans': 'assets/fonts/Roboto-Regular.ttf',
         'bold': 'assets/fonts/Roboto-Bold.ttf',
         'hand': 'assets/fonts/Caveat-Regular.ttf'}


def read_text(rel):
    with io.open(os.path.join(ROOT, rel), encoding='utf-8') as f:
        return f.read()


def read_b64(rel):
    with open(os.path.join(ROOT, rel), 'rb') as f:
        return base64.b64encode(f.read()).decode('ascii')


def guard(code):
    """A literal </script> inside inlined code would close the tag early."""
    return code.replace('</script>', '<\\/script>')


def main():
    html = read_text('index.html')
    css = read_text('css/style.css')

    # Fonts: the stylesheet points at ../assets/fonts/*.ttf — swap in data URIs.
    for rel in FONTS.values():
        name = os.path.basename(rel)
        css = css.replace('url("../assets/fonts/%s")' % name,
                          'url("data:font/ttf;base64,%s")' % read_b64(rel))

    parts = []

    # pdf.js runs its parser in a worker; with no vendor/ folder next to us it
    # has to come from a blob built out of the inlined source.
    parts.append(
        'window.__PDFREE_WORKER = (function () {\n'
        '  var b64 = "%s";\n'
        '  var bin = atob(b64), bytes = new Uint8Array(bin.length);\n'
        '  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);\n'
        '  return URL.createObjectURL(new Blob([bytes], { type: "text/javascript" }));\n'
        '})();' % read_b64('vendor/pdf.worker.min.js'))

    # Fonts used for text and signatures inside the produced PDF.
    parts.append('window.__PDFREE_FONTS = {%s};' % ', '.join(
        '%s: "%s"' % (key, read_b64(rel)) for key, rel in FONTS.items()))

    cdn = '--cdn' in sys.argv
    for rel in (APP if cdn else VENDOR + APP):
        parts.append(guard(read_text(rel)))

    scripts = '\n'.join('<script>\n%s\n</script>' % p for p in parts)
    if cdn:
        # Внешние скрипты идут первыми: браузер выполняет их раньше встроенных,
        # поэтому глобальные pdfjsLib/PDFLib уже определены.
        scripts = ('\n'.join('<script src="%s"></script>' % u for u in VENDOR_CDN)
                   + '\n' + scripts)

    html = html.replace('<link rel="stylesheet" href="css/style.css">',
                        '<style>\n%s\n</style>' % css)
    html = html.replace('<link rel="icon" href="assets/favicon.svg">',
                        '<link rel="icon" href="data:image/svg+xml;base64,%s">'
                        % read_b64('assets/favicon.svg'))

    # Drop the individual <script src=...> tags and put everything in their place.
    html = re.sub(r'\n *<script src="[^"]+"></script>', '', html)
    html = html.replace('</body>', scripts + '\n</body>')

    if not os.path.isdir(OUT_DIR):
        os.mkdir(OUT_DIR)

    # --cdn собирает только вариант для площадки: полноценный автономный файл
    # должен остаться со всеми библиотеками внутри.
    if not cdn:
        with io.open(OUT_FILE, 'w', encoding='utf-8') as f:
            f.write(html)
        print('dist/pdfree.html — %.1f MB' % (os.path.getsize(OUT_FILE) / 1024 / 1024))

    if '--fragment' in sys.argv:
        frag = re.sub(r'<!DOCTYPE[^>]*>|</?html[^>]*>|</?head>|</?body>', '', html)
        frag = re.sub(r'<meta charset[^>]*>', '', frag)
        with io.open(OUT_FRAGMENT, 'w', encoding='utf-8') as f:
            f.write(frag.strip())
        print('dist/pdfree.fragment.html — %.1f MB'
              % (os.path.getsize(OUT_FRAGMENT) / 1024 / 1024))


if __name__ == '__main__':
    main()
