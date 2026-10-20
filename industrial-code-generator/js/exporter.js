/**
 * ==========================================================================
 * INDUSTRIAL CODE & LABEL GENERATOR - EXPORTER & PRINT ENGINE
 * Features: High-DPI Master Roll PDF, 1-Up Zebra Roll PDF, Batch ZIP, SVG & CSV
 * Supports: Range Selection & Memory Optimized Batch Processing
 * ==========================================================================
 */

window.LabelApp = window.LabelApp || {};

/**
 * Download a single label as PNG or SVG
 */
LabelApp.downloadSingle = async function(code, idx, type) {
  const allItems = LabelApp.state.generatedItems;
  const item = allItems[idx] || { code: code.toUpperCase(), title: code.toUpperCase() };
  const dims = LabelApp.state.currentDimensions;
  const s = LabelApp.getUserSettings();
  const dpi = parseInt(document.getElementById('exportDpi').value) || 300;

  if (type === 'svg') {
    try {
      const svgStr = LabelApp.CodeEngine.renderLabelToSVG(item, dims, s);
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      LabelApp.downloadBlob(blob, `${LabelApp.sanitizeName(code.toUpperCase())}.svg`);
    } catch (e) {
      alert(`Could not export SVG: ${e.message}`);
    }
  } else {
    const canvas = LabelApp.CodeEngine.renderLabelToCanvas(item, dims, dpi, s);
    canvas.toBlob((blob) => {
      LabelApp.downloadBlob(blob, `${LabelApp.sanitizeName(code.toUpperCase())}.png`);
    }, 'image/png');
  }
};

/**
 * Download the currently inspected label
 */
LabelApp.downloadCurrentSingle = function(type) {
  const items = LabelApp.state.generatedItems;
  if (!items.length) return;
  const safeIdx = Math.min(LabelApp.state.currentSelectedIndex, items.length - 1);
  const item = items[safeIdx];
  LabelApp.downloadSingle(item.code, safeIdx, type);
};

/**
 * Print the current label directly via browser print dialog
 */
LabelApp.printSingleLabel = function() {
  const items = LabelApp.state.generatedItems;
  if (!items.length) return;
  const safeIdx = Math.min(LabelApp.state.currentSelectedIndex, items.length - 1);
  const item = items[safeIdx];
  const dims = LabelApp.state.currentDimensions;
  const s = LabelApp.getUserSettings();

  const printWindow = window.open('', '_blank');
  const canvas = LabelApp.CodeEngine.renderLabelToCanvas(item, dims, 300, s);
  const imgUrl = canvas.toDataURL('image/png');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Print Label - ${item.code}</title>
      <style>
        @page { size: ${dims.widthIn}in ${dims.heightIn}in; margin: 0; }
        body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; }
        img { width: 100%; height: 100%; object-fit: contain; }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      <img src="${imgUrl}">
    </body>
    </html>
  `);
  printWindow.document.close();
};

/**
 * Download labels in chunked ZIP files with range support
 */
LabelApp.downloadAllZIP = async function(formatType) {
  if (LabelApp.state.isGeneratingZip) return;
  const allItems = LabelApp.state.generatedItems;
  if (!allItems.length) {
    alert('No codes to export. Generate data first.');
    return;
  }

  // Range support
  const totalAll = allItems.length;
  const startInput = document.getElementById('rangeStartInput');
  const endInput = document.getElementById('rangeEndInput');
  let startIdx = startInput ? Math.max(0, (parseInt(startInput.value) || 1) - 1) : 0;
  let endIdx = endInput ? Math.min(totalAll - 1, (parseInt(endInput.value) || totalAll) - 1) : totalAll - 1;
  if (startIdx > endIdx) startIdx = 0;

  const items = allItems.slice(startIdx, endIdx + 1);

  const dims = LabelApp.state.currentDimensions;
  const s = LabelApp.getUserSettings();
  const dpi = parseInt(document.getElementById('exportDpi').value) || 300;
  const batchSize = parseInt(document.getElementById('zipBatchSize').value) || 500;
  const totalBatches = Math.ceil(items.length / batchSize);

  const progressWrap = document.getElementById('progressWrap');
  const progressBar = document.getElementById('progressBar');
  const progressNote = document.getElementById('progressNote');

  LabelApp.state.isGeneratingZip = true;
  if (progressWrap) progressWrap.style.display = 'block';

  let processed = 0;

  for (let b = 0; b < totalBatches; b++) {
    const batchItems = items.slice(b * batchSize, (b + 1) * batchSize);
    const zip = new JSZip();
    const folder = zip.folder(`labels_${formatType}`);

    for (let i = 0; i < batchItems.length; i++) {
      const item = batchItems[i];
      const safeName = LabelApp.sanitizeName(item.code.toUpperCase() || `label_${startIdx + b * batchSize + i + 1}`);

      if (formatType === 'svg') {
        try {
          const svgStr = LabelApp.CodeEngine.renderLabelToSVG(item, dims, s);
          folder.file(`${safeName}.svg`, svgStr);
        } catch (e) {
          folder.file(`${safeName}.txt`, `Error: ${e.message}`);
        }
      } else {
        const canvas = LabelApp.CodeEngine.renderLabelToCanvas(item, dims, dpi, s);
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        folder.file(`${safeName}.png`, blob);
      }

      processed++;
      const pct = Math.round((processed / items.length) * 100);
      if (progressBar) progressBar.style.width = pct + '%';
      if (progressNote) progressNote.textContent = `Batch ${b + 1}/${totalBatches} — Rendering ${processed}/${items.length} (${pct}%)`;

      if (i % 20 === 0) await LabelApp.yieldFrame();
    }

    if (progressNote) progressNote.textContent = `Compressing batch ${b + 1} of ${totalBatches}...`;
    await LabelApp.yieldFrame();

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    LabelApp.downloadBlob(zipBlob, `labels_${dims.widthRaw}x${dims.heightRaw}_part${b + 1}_of_${totalBatches}_(rows_${startIdx + b * batchSize + 1}-${startIdx + Math.min((b + 1) * batchSize, items.length)}).zip`);
    await LabelApp.yieldFrame();
  }

  if (progressNote) progressNote.textContent = `Completed! ${processed} labels successfully exported across ${totalBatches} ZIP file(s).`;
  LabelApp.state.isGeneratingZip = false;
};

/**
 * Master PDF Exporter: Multi-Column Roll Gang Sheet or 1-Up Zebra Roll
 */
LabelApp.exportPDF = async function() {
  const allItems = LabelApp.state.generatedItems;
  if (!allItems.length) {
    alert('No labels to export. Generate data first.');
    return;
  }

  const totalAll = allItems.length;
  const startInput = document.getElementById('rangeStartInput');
  const endInput = document.getElementById('rangeEndInput');
  let startIdx = startInput ? Math.max(0, (parseInt(startInput.value) || 1) - 1) : 0;
  let endIdx = endInput ? Math.min(totalAll - 1, (parseInt(endInput.value) || totalAll) - 1) : totalAll - 1;
  if (startIdx > endIdx) startIdx = 0;

  const items = allItems.slice(startIdx, endIdx + 1);

  const { jsPDF } = window.jspdf;
  const pdfMode = document.getElementById('pdfMode').value;
  const dpi = parseInt(document.getElementById('exportDpi').value) || 300;
  const total = items.length;
  const dims = LabelApp.state.currentDimensions;
  const s = LabelApp.getUserSettings();

  const progressWrap = document.getElementById('progressWrap');
  const progressBar = document.getElementById('progressBar');
  const progressNote = document.getElementById('progressNote');
  if (progressWrap) progressWrap.style.display = 'block';

  // -------------------------------------------------------------
  // MODE 1: MASTER GANG SHEET / ROLL PDF (MULTI-COLUMN FOR PRESS)
  // -------------------------------------------------------------
  if (pdfMode === 'master-roll') {
    const cols = Math.max(1, parseInt(document.getElementById('pdfColumns').value) || 6);
    const gapIn = parseFloat(document.getElementById('labelGap').value) || 0;
    const pageFormat = document.getElementById('rollPageFormat').value;

    const labelW = dims.widthIn;
    const labelH = dims.heightIn;

    const totalRows = Math.ceil(total / cols);

    let rowsPerPage = totalRows;
    if (pageFormat === 'paginated-5') rowsPerPage = 5;
    else if (pageFormat === 'paginated-10') rowsPerPage = 10;
    else if (pageFormat === 'paginated-20') rowsPerPage = 20;

    const totalPages = Math.ceil(totalRows / rowsPerPage);
    const sheetWidthIn = Number((cols * labelW + (cols - 1) * gapIn).toFixed(4));

    let pdf = null;
    let renderedCount = 0;

    for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
      const startRow = pageIdx * rowsPerPage;
      const rowsInThisPage = Math.min(rowsPerPage, totalRows - startRow);
      const pageHeightIn = Number((rowsInThisPage * labelH + (rowsInThisPage - 1) * gapIn).toFixed(4));
      const orientation = sheetWidthIn >= pageHeightIn ? 'l' : 'p';

      if (pageIdx === 0) {
        pdf = new jsPDF({
          orientation: orientation,
          unit: 'in',
          format: [sheetWidthIn, pageHeightIn]
        });
      } else {
        pdf.addPage([sheetWidthIn, pageHeightIn], orientation);
      }

      for (let r = 0; r < rowsInThisPage; r++) {
        const globalRow = startRow + r;
        for (let c = 0; c < cols; c++) {
          const itemIdx = globalRow * cols + c;
          if (itemIdx >= total) break;

          const item = items[itemIdx];
          const canvas = LabelApp.CodeEngine.renderLabelToCanvas(item, dims, dpi, s);
          const imgData = canvas.toDataURL('image/png');

          const posX = c * (labelW + gapIn);
          const posY = r * (labelH + gapIn);

          pdf.addImage(imgData, 'PNG', posX, posY, labelW, labelH, undefined, 'FAST');

          renderedCount++;
          const pct = Math.round((renderedCount / total) * 100);
          if (progressBar) progressBar.style.width = pct + '%';
          if (progressNote) progressNote.textContent = `Master Roll: Placing label ${renderedCount}/${total} (Col ${c + 1}/${cols}, Row ${globalRow + 1}/${totalRows})...`;

        }
      }

      // Draw Continuous Cut Lines between Rows & Columns on the Master Sheet
      if (s.drawSheetCutLines && s.borderStyle !== 'none') {
        const isDashed = (s.borderStyle === 'dashed');
        const isDark = (s.borderStyle === 'solid-dark');

        if (pdf.saveGraphicsState) pdf.saveGraphicsState();
        if (isDark) {
          pdf.setDrawColor(40, 50, 70);
        } else {
          pdf.setDrawColor(203, 213, 225); // #CBD5E1 crisp clean cut line
        }
        pdf.setLineWidth(0.008); // 0.008 in razor-thin precision line

        if (isDashed && pdf.setLineDashPattern) {
          pdf.setLineDashPattern([0.05, 0.05], 0);
        }

        // Draw vertical cut lines between columns
        for (let c = 1; c < cols; c++) {
          const cutX = c * labelW + (c - 0.5) * gapIn;
          pdf.line(cutX, 0, cutX, pageHeightIn);
        }

        // Draw horizontal cut lines between rows
        for (let r = 1; r < rowsInThisPage; r++) {
          const cutY = r * labelH + (r - 0.5) * gapIn;
          pdf.line(0, cutY, sheetWidthIn, cutY);
        }

        // Outer sheet perimeter cut border
        pdf.rect(0, 0, sheetWidthIn, pageHeightIn, 'S');

        if (pdf.restoreGraphicsState) pdf.restoreGraphicsState();
      }
    }

    if (progressNote) progressNote.textContent = 'Saving Master Roll PDF...';
    await LabelApp.yieldFrame();
    const mediaName = document.getElementById('rollMediaPreset').value;
    pdf.save(`master_sheet_${mediaName}_${cols}cols_${dims.widthRaw}x${dims.heightRaw}_${total}_labels.pdf`);
    if (progressNote) progressNote.textContent = `Completed! Master Roll PDF (${cols} columns, ${sheetWidthIn}" width) successfully exported.`;
  }
  // -------------------------------------------------------------
  // MODE 2: 1-UP SINGLE LABEL ROLL PDF (1 PER PAGE FOR ZEBRA)
  // -------------------------------------------------------------
  else {
    const orientation = dims.widthIn >= dims.heightIn ? 'l' : 'p';
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'in',
      format: [dims.widthIn, dims.heightIn]
    });

    for (let i = 0; i < total; i++) {
      if (i > 0) pdf.addPage([dims.widthIn, dims.heightIn], orientation);

      const item = items[i];
      const canvas = LabelApp.CodeEngine.renderLabelToCanvas(item, dims, dpi, s);
      const imgData = canvas.toDataURL('image/png');

      pdf.addImage(imgData, 'PNG', 0, 0, dims.widthIn, dims.heightIn, undefined, 'FAST');

      const pct = Math.round(((i + 1) / total) * 100);
      if (progressBar) progressBar.style.width = pct + '%';
      if (progressNote) progressNote.textContent = `1-Up Roll PDF: Building label ${i + 1} of ${total}...`;

      if (i % 10 === 0) await LabelApp.yieldFrame();
    }

    if (progressNote) progressNote.textContent = 'Saving 1-Up PDF document...';
    await LabelApp.yieldFrame();
    pdf.save(`single_labels_1up_${dims.widthRaw}x${dims.heightRaw}_${total}_labels.pdf`);
    if (progressNote) progressNote.textContent = `Completed! ${total} individual pages exported in PDF.`;
  }
};

/**
 * Export label metadata and dimensions as CSV
 */
LabelApp.downloadCSVData = function() {
  const items = LabelApp.state.generatedItems;
  if (!items.length) return;
  const dims = LabelApp.state.currentDimensions;
  const lines = ['Barcode,Title,Subtitle,Width,Height,Unit'];
  items.forEach(item => {
    lines.push(`"${item.code.toUpperCase()}","${item.title.toUpperCase()}","${item.subtitle}","${dims.widthRaw}","${dims.heightRaw}","${dims.unit}"`);
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  LabelApp.downloadBlob(blob, 'labels_data.csv');
};

/**
 * PDF mode toggle
 */
LabelApp.togglePdfMode = function() {
  const mode = document.getElementById('pdfMode').value;
  const settings = document.getElementById('masterRollSettings');
  if (settings) {
    settings.style.display = (mode === 'master-roll') ? 'block' : 'none';
  }
};

/**
 * Handle Roll Media presets
 */
LabelApp.handleRollMediaChange = function() {
  const preset = document.getElementById('rollMediaPreset').value;
  const colInput = document.getElementById('pdfColumns');
  const labelWidth = LabelApp.state.currentDimensions.widthIn || 6;

  if (preset === '3ft') {
    colInput.value = Math.max(1, Math.floor(36 / labelWidth)) || 6;
  } else if (preset === '4ft') {
    colInput.value = Math.max(1, Math.floor(48 / labelWidth)) || 8;
  } else if (preset === '2ft') {
    colInput.value = Math.max(1, Math.floor(24 / labelWidth)) || 4;
  } else if (preset === 'sheet-a4') {
    colInput.value = Math.max(1, Math.floor(8.27 / labelWidth)) || 1;
  } else if (preset === 'sheet-a3') {
    colInput.value = Math.max(1, Math.floor(11.69 / labelWidth)) || 2;
  }
  LabelApp.syncPdfColumns();
};

/**
 * Sync PDF Columns with Preview Grid Columns
 */
LabelApp.syncPdfColumns = function() {
  const cols = parseInt(document.getElementById('pdfColumns').value) || 6;
  const gridColsInput = document.getElementById('gridCols');
  if (gridColsInput && parseInt(gridColsInput.value) !== cols) {
    gridColsInput.value = cols;
  }
  LabelApp.renderPreview();
};
