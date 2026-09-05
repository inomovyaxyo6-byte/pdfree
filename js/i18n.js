/* Interface strings. Every user-visible word lives here, so the markup carries
   no copy of its own. window.t(key) -> string */
(function () {
  const STRINGS = {
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
  };

  window.t = function (key) {
    return STRINGS[key] || key;
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
