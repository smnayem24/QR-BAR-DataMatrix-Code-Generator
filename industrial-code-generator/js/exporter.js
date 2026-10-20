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
 * PDF ISO 32000 MediaBox max ≈ 14,400 pt = 200 inches.
 * Taller pages get clipped by viewers (looks "incomplete" at the bottom).
 */
LabelApp.PDF_MAX_PAGE_IN = 200;

/**
 * Max labels that fit on one PDF page without exceeding MediaBox height.
 */
LabelApp.getMaxLabelsPerPdfPage = function(cols, labelH, gapIn) {
  const maxH = LabelApp.PDF_MAX_PAGE_IN;
  const pitch = (labelH || 1) + (gapIn || 0);
  const maxRows = Math.max(1, Math.floor((maxH + (gapIn || 0)) / pitch));
  return maxRows * Math.max(1, cols || 1);
};

/**
 * Master PDF Exporter: Multi-Column Roll Gang Sheet or 1-Up Zebra Roll
 * Uses 100% Pure Vector rendering to eliminate browser crashes and RAM overflow!
 * Includes Smart Roll Chunking (e.g. 1,000 / 2,000 labels per file) for press safety.
 * Also auto-splits when page height would exceed the PDF 200" MediaBox limit.
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
  const total = items.length;

  const { jsPDF } = window.jspdf;
  const pdfMode = document.getElementById('pdfMode').value;
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
    const cols = Math.max(1, parseInt(document.getElementById('pdfColumns').value) || 16);
    const gapIn = parseFloat(document.getElementById('labelGap').value) || 0;
    const labelW = dims.widthIn;
    const labelH = dims.heightIn;

    const rollChunkSelect = document.getElementById('rollChunkSize');
    const chunkSizeVal = rollChunkSelect ? rollChunkSelect.value : '1000';
    const userChunkLimit = (chunkSizeVal === 'all') ? total : (parseInt(chunkSizeVal, 10) || 1000);

    // Cap by PDF MediaBox height so the bottom of the roll is never clipped
    const heightSafeLimit = LabelApp.getMaxLabelsPerPdfPage(cols, labelH, gapIn);
    const chunkLimit = Math.min(userChunkLimit, heightSafeLimit);

    if (userChunkLimit > heightSafeLimit && progressNote) {
      const maxRows = Math.floor(heightSafeLimit / cols);
      const maxH = (maxRows * labelH + Math.max(0, maxRows - 1) * gapIn).toFixed(1);
      progressNote.textContent = `PDF page max is ${LabelApp.PDF_MAX_PAGE_IN}" tall — auto-splitting into parts of ≤${heightSafeLimit} labels (~${maxH}" / part)...`;
      await LabelApp.yieldFrame();
    }

    const numChunks = Math.ceil(total / chunkLimit);
    let totalProcessed = 0;

    for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
      const chunkStart = chunkIdx * chunkLimit;
      const chunkEnd = Math.min(total, (chunkIdx + 1) * chunkLimit);
      const chunkItems = items.slice(chunkStart, chunkEnd);
      const chunkTotal = chunkItems.length;

      const chunkRows = Math.ceil(chunkTotal / cols);
      const sheetWidthIn = Number((cols * labelW + (cols - 1) * gapIn).toFixed(4));
      const pageHeightIn = Number((chunkRows * labelH + (chunkRows - 1) * gapIn).toFixed(4));
      const orientation = sheetWidthIn >= pageHeightIn ? 'l' : 'p';

      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'in',
        format: [sheetWidthIn, pageHeightIn],
        compress: true
      });

      for (let r = 0; r < chunkRows; r++) {
        for (let c = 0; c < cols; c++) {
          const itemIdx = r * cols + c;
          if (itemIdx >= chunkTotal) break;

          const item = chunkItems[itemIdx];
          const posX = c * (labelW + gapIn);
          const posY = r * (labelH + gapIn);

          // PURE VECTOR DRAWING — Instant, zero memory leakage!
          LabelApp.CodeEngine.drawLabelToPDF(pdf, item, dims, posX, posY, s);

          totalProcessed++;
          const pct = Math.round((totalProcessed / total) * 100);
          if (progressBar) progressBar.style.width = pct + '%';
          if (progressNote) {
            progressNote.textContent = `Part ${chunkIdx + 1}/${numChunks}: Rendering label ${itemIdx + 1}/${chunkTotal} (Overall ${totalProcessed}/${total} — ${pct}%)...`;
          }

          if (itemIdx % 50 === 0) await LabelApp.yieldFrame();
        }
      }

      // Continuous Cut Divider Lines between Rows & Columns on the Master Sheet
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
          const cutX = c * (labelW + gapIn) - gapIn / 2;
          pdf.line(cutX, 0, cutX, pageHeightIn);
        }

        // Draw horizontal cut lines between rows
        for (let r = 1; r < chunkRows; r++) {
          const cutY = r * (labelH + gapIn) - gapIn / 2;
          pdf.line(0, cutY, sheetWidthIn, cutY);
        }

        // Outer sheet perimeter cut border
        pdf.rect(0, 0, sheetWidthIn, pageHeightIn, 'S');

        if (pdf.restoreGraphicsState) pdf.restoreGraphicsState();
      }

      if (progressNote) progressNote.textContent = `Saving Part ${chunkIdx + 1} of ${numChunks}...`;
      await LabelApp.yieldFrame();

      const mediaName = document.getElementById('rollMediaPreset') ? document.getElementById('rollMediaPreset').value : 'roll';
      const partTag = (numChunks > 1) ? `_part${chunkIdx + 1}_of_${numChunks}_(labels_${startIdx + chunkStart + 1}-${startIdx + chunkEnd})` : '';
      pdf.save(`master_sheet_${mediaName}_${cols}cols_${dims.widthRaw}x${dims.heightRaw}${partTag}.pdf`);

      if (numChunks > 1 && chunkIdx < numChunks - 1) {
        await new Promise(r => setTimeout(r, 600)); // Pause so browser doesn't block multi-file downloads
      }
    }

    if (progressNote) {
      progressNote.textContent = `Completed! ${total} labels exported across ${numChunks} Vector Master Roll PDF file(s) with zero lag.`;
    }
  }
  // -------------------------------------------------------------
  // MODE 2: 1-UP SINGLE LABEL ROLL PDF (1 PER PAGE FOR ZEBRA)
  // -------------------------------------------------------------
  else {
    const orientation = dims.widthIn >= dims.heightIn ? 'l' : 'p';
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'in',
      format: [dims.widthIn, dims.heightIn],
      compress: true
    });

    for (let i = 0; i < total; i++) {
      if (i > 0) pdf.addPage([dims.widthIn, dims.heightIn], orientation);

      const item = items[i];
      // PURE VECTOR DRAWING — Zero lag!
      LabelApp.CodeEngine.drawLabelToPDF(pdf, item, dims, 0, 0, s);

      const pct = Math.round(((i + 1) / total) * 100);
      if (progressBar) progressBar.style.width = pct + '%';
      if (progressNote) progressNote.textContent = `1-Up Vector PDF: Building label ${i + 1} of ${total} (${pct}%)...`;

      if (i % 50 === 0) await LabelApp.yieldFrame();
    }

    if (progressNote) progressNote.textContent = 'Saving 1-Up Vector PDF document...';
    await LabelApp.yieldFrame();
    pdf.save(`single_labels_vector_1up_${dims.widthRaw}x${dims.heightRaw}_${total}_labels.pdf`);
    if (progressNote) progressNote.textContent = `Completed! ${total} individual vector pages exported in PDF.`;
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
  LabelApp.updateRollEstimate();
};

/**
 * Calculate and display real-time Roll Length & File Chunking Estimate
 */
LabelApp.updateRollEstimate = function() {
  const noteEl = document.getElementById('rollEstimateNote');
  if (!noteEl) return;

  const allItems = LabelApp.state.generatedItems || [];
  const totalAll = allItems.length || 0;
  const startInput = document.getElementById('rangeStartInput');
  const endInput = document.getElementById('rangeEndInput');
  let startIdx = startInput ? Math.max(0, (parseInt(startInput.value) || 1) - 1) : 0;
  let endIdx = endInput ? Math.min(totalAll - 1, (parseInt(endInput.value) || totalAll) - 1) : (totalAll > 0 ? totalAll - 1 : 0);
  if (startIdx > endIdx) startIdx = 0;

  const count = (totalAll > 0) ? (endIdx - startIdx + 1) : 0;
  const cols = parseInt(document.getElementById('pdfColumns').value) || 16;
  const gapIn = parseFloat(document.getElementById('labelGap') ? document.getElementById('labelGap').value : 0) || 0;
  const dims = LabelApp.state.currentDimensions || { heightIn: 3.5, widthIn: 3.0 };
  const labelH = dims.heightIn || 3.5;

  const chunkSelect = document.getElementById('rollChunkSize');
  const chunkVal = chunkSelect ? chunkSelect.value : '1000';
  const userChunk = (chunkVal === 'all') ? count : (parseInt(chunkVal, 10) || 1000);
  const heightSafeLimit = LabelApp.getMaxLabelsPerPdfPage(cols, labelH, gapIn);
  const chunkLimit = Math.min(userChunk || 1, heightSafeLimit);

  const numFiles = Math.max(1, Math.ceil(count / chunkLimit));
  const labelsPerRoll = Math.min(count, chunkLimit);
  const rowsPerRoll = Math.ceil(labelsPerRoll / cols);
  const lengthIn = rowsPerRoll * labelH + Math.max(0, rowsPerRoll - 1) * gapIn;
  const lengthFt = (lengthIn / 12).toFixed(1);
  const lengthM = (lengthIn * 0.0254).toFixed(1);
  const hitPdfCap = userChunk > heightSafeLimit;

  if (count === 0) {
    noteEl.textContent = 'No labels loaded';
  } else if (numFiles === 1) {
    noteEl.textContent = `~${lengthFt} ft (${lengthM} m) • 1 PDF (${count.toLocaleString()} labels @ ${cols} cols)`;
  } else if (hitPdfCap) {
    noteEl.textContent = `~${lengthFt} ft (${lengthM} m)/part • ${numFiles} PDFs (PDF max ${LabelApp.PDF_MAX_PAGE_IN}" → ≤${heightSafeLimit} labels/file)`;
  } else {
    noteEl.textContent = `~${lengthFt} ft (${lengthM} m) per roll • ${numFiles} PDF Files (${count.toLocaleString()} labels total)`;
  }
};

/**
 * Handle Roll Media presets
 */
LabelApp.handleRollMediaChange = function() {
  const preset = document.getElementById('rollMediaPreset').value;
  const colInput = document.getElementById('pdfColumns');
  const labelWidth = LabelApp.state.currentDimensions.widthIn || 3.0;

  if (preset === '4ft') {
    colInput.value = Math.max(1, Math.floor(48 / labelWidth)) || 16;
  } else if (preset === '3ft') {
    colInput.value = Math.max(1, Math.floor(36 / labelWidth)) || 12;
  } else if (preset === '2ft') {
    colInput.value = Math.max(1, Math.floor(24 / labelWidth)) || 8;
  } else if (preset === 'sheet-a4') {
    colInput.value = Math.max(1, Math.floor(8.27 / labelWidth)) || 2;
  } else if (preset === 'sheet-a3') {
    colInput.value = Math.max(1, Math.floor(11.69 / labelWidth)) || 3;
  }
  LabelApp.syncPdfColumns();
  LabelApp.updateRollEstimate();
};

/**
 * Sync PDF Columns with Preview Grid Columns
 */
LabelApp.syncPdfColumns = function() {
  const cols = parseInt(document.getElementById('pdfColumns').value) || 16;
  const gridColsInput = document.getElementById('gridCols');
  if (gridColsInput && parseInt(gridColsInput.value) !== cols) {
    gridColsInput.value = cols;
  }
  LabelApp.renderPreview();
  LabelApp.updateRollEstimate();
};
