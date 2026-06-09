'use strict';

function generateCSV(headers, rows) {
  const esc = v => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [headers, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
}

async function generatePDF(title, subtitle, headers, rows) {
  const PDFDocument = require('pdfkit');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header block
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#000').text('NeoTrade', 40, 40);
    doc.fontSize(13).font('Helvetica-Bold').text(title, 40, 64);
    doc.fontSize(8).font('Helvetica').fillColor('#64748b').text(subtitle, 40, 82);
    doc.fillColor('#000');

    // Table
    const pageW = doc.page.width - 80;
    const colW  = Math.floor(pageW / headers.length);
    let y = 100;

    // Header row
    doc.rect(40, y, pageW, 20).fill('#0f172a');
    doc.fillColor('#fff').fontSize(7.5).font('Helvetica-Bold');
    headers.forEach((h, i) => doc.text(h, 44 + i * colW, y + 6, { width: colW - 4, lineBreak: false }));

    // Data rows
    y += 20;
    doc.fillColor('#000').font('Helvetica').fontSize(7.5);
    for (const [ri, row] of rows.entries()) {
      if (y > doc.page.height - 60) { doc.addPage(); y = 40; }
      if (ri % 2 === 0) {
        doc.rect(40, y, pageW, 17).fill('#f8fafc');
        doc.rect(40, y, pageW, 17).stroke('#e2e8f0');
      }
      doc.fillColor('#000');
      row.forEach((cell, i) =>
        doc.text(String(cell ?? ''), 44 + i * colW, y + 5, { width: colW - 4, lineBreak: false })
      );
      y += 17;
    }

    doc.end();
  });
}

module.exports = { generateCSV, generatePDF };
