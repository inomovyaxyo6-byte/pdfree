# -*- coding: utf-8 -*-
"""Собирает тестовые PDF, на которых проверяется редактор.

    python test/make-fixtures.py

many-pages.pdf — 60 страниц, на них проверяется ленивая отрисовка.
form.pdf       — анкета с настоящими полями AcroForm: текстовые (включая
                 многострочное), выпадающий список и флажок.

Файлы собираются вручную, без зависимостей: так их легко читать глазами
и менять, когда понадобится новый случай.
"""
import io
import os

OUT_DIR = os.path.dirname(os.path.abspath(__file__))


def build(objects, root=1):
    """Склеивает пронумерованные объекты в файл PDF с таблицей xref."""
    out = bytearray(b'%PDF-1.4\n')
    offsets = []
    for i, body in enumerate(objects, 1):
        offsets.append(len(out))
        out += b'%d 0 obj\n' % i + body + b'\nendobj\n'
    xref = len(out)
    out += b'xref\n0 %d\n' % (len(objects) + 1)
    out += b'0000000000 65535 f \n'
    for off in offsets:
        out += b'%010d 00000 n \n' % off
    out += (b'trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n'
            % (len(objects) + 1, root, xref))
    return bytes(out)


def many_pages(count=60):
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [' +
        b' '.join(b'%d 0 R' % (4 + i) for i in range(count)) +
        b'] /Count %d >>' % count,
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    streams = []
    for i in range(count):
        text = ('BT /F1 36 Tf 70 700 Td (Page %d of %d) Tj ET\n'
                '0.85 0.27 0.24 RG 3 w 70 680 m 420 680 l S\n' % (i + 1, count))
        streams.append(text.encode())
    for i in range(count):
        objects.append(
            b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources '
            b'<< /Font << /F1 3 0 R >> >> /Contents %d 0 R >>' % (4 + count + i))
    for s in streams:
        objects.append(b'<< /Length %d >>\nstream\n' % len(s) + s + b'endstream')
    return build(objects)


def form():
    """Анкета: four fields of three different kinds on one page."""
    # 1 catalog, 2 pages, 3 font, 4 page, 5 content, 6..9 widgets
    content = (
        b'BT /F1 20 Tf 60 770 Td (Employment application) Tj ET\n'
        b'BT /F1 11 Tf 60 718 Td (Full name) Tj ET\n'
        b'BT /F1 11 Tf 60 650 Td (Position applied for) Tj ET\n'
        b'BT /F1 11 Tf 60 582 Td (Why you?) Tj ET\n'
        b'BT /F1 11 Tf 60 440 Td (Shift) Tj ET\n'
        b'BT /F1 11 Tf 84 362 Td (I agree to the terms) Tj ET\n'
        b'0.6 0.6 0.65 RG 1 w\n'
        b'60 690 300 22 re S\n'
        b'60 622 300 22 re S\n'
        b'60 480 420 90 re S\n'
        b'60 412 160 22 re S\n'
        b'60 360 16 16 re S\n'
    )
    widget = (b'<< /Type /Annot /Subtype /Widget /F 4 /P 4 0 R '
              b'/DA (/Helv 11 Tf 0 g) /Rect [%s] /FT /%s /T (%s) %s >>')
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [6 0 R 7 0 R 8 0 R 9 0 R] '
        b'/DA (/Helv 11 Tf 0 g) /NeedAppearances true '
        b'/DR << /Font << /Helv 3 0 R >> >> >> >>',
        b'<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Name /Helv >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources '
        b'<< /Font << /F1 3 0 R /Helv 3 0 R >> >> /Contents 5 0 R '
        b'/Annots [6 0 R 7 0 R 8 0 R 9 0 R] >>',
        b'<< /Length %d >>\nstream\n' % len(content) + content + b'endstream',
        widget % (b'60 690 360 712', b'Tx', b'fullName', b'/V ()'),
        widget % (b'60 622 360 644', b'Tx', b'position', b'/V (Driver)'),
        widget % (b'60 480 480 570', b'Tx', b'why', b'/V () /Ff 4096'),
        widget % (b'60 412 220 434', b'Ch', b'shift',
                  b'/V (Day) /Opt [(Day) (Night) (Any)] /Ff 131072'),
    ]
    # флажок отдельным объектом: ему нужен /AS и состояния внешнего вида
    objects[0] = objects[0].replace(b'[6 0 R 7 0 R 8 0 R 9 0 R]',
                                    b'[6 0 R 7 0 R 8 0 R 9 0 R 10 0 R]')
    objects[3] = objects[3].replace(b'/Annots [6 0 R 7 0 R 8 0 R 9 0 R]',
                                    b'/Annots [6 0 R 7 0 R 8 0 R 9 0 R 10 0 R]')
    objects.append(
        b'<< /Type /Annot /Subtype /Widget /F 4 /P 4 0 R /Rect [60 360 76 376] '
        b'/FT /Btn /T (agree) /V /Off /AS /Off >>')
    return build(objects)


def main():
    for name, data in (('many-pages.pdf', many_pages()), ('form.pdf', form())):
        path = os.path.join(OUT_DIR, name)
        with open(path, 'wb') as f:
            f.write(data)
        print('%-16s %d байт' % (name, len(data)))


if __name__ == '__main__':
    main()
