/**
 * ==========================================================================
 * INDUSTRIAL PRINTING & ROLL GANG-SHEET CALCULATOR & BATCH PLANNER
 * Solves roll media mismatch, 200" PDF limits, and incomplete-row paper waste.
 * Provides bi-directional synchronization with LabelApp Studio.
 * ==========================================================================
 */

window.LabelApp = window.LabelApp || {};
LabelApp.Calculator = {};

// Default Planner State
LabelApp.Calculator.state = {
  totalOrder: 0,
  labelWidthIn: 3.0,
  labelHeightIn: 3.5,
  rollWidthIn: 48.0,
  rollPreset: '4ft',
  sideMarginIn: 0.0,
  gapIn: 0.0,
  maxHeightIn: 199.5, // Just under PDF 200" MediaBox limit for 100% safe single page per part
  maxHeightPreset: 'pdf-200',
  autoExporting: false
};

/**
 * Switch top-level Main View between 'studio' and 'calc'
 */
window.switchMainView = function(viewName) {
  const studioView = document.getElementById('studioMainView');
  const calcView = document.getElementById('calcMainView');
  const btnStudio = document.getElementById('btnViewStudio');
  const btnCalc = document.getElementById('btnViewCalc');

  if (viewName === 'calc') {
    if (studioView) studioView.style.display = 'none';
    if (calcView) calcView.style.display = 'grid';
    if (btnStudio) btnStudio.classList.remove('active');
    if (btnCalc) btnCalc.classList.add('active');

    // Sync from Studio state into Calculator
    if (LabelApp.Calculator && LabelApp.Calculator.syncFromStudio) {
      LabelApp.Calculator.syncFromStudio();
      LabelApp.Calculator.calculate();
    }
  } else {
    if (calcView) calcView.style.display = 'none';
    if (studioView) studioView.style.display = 'flex';
    if (btnCalc) btnCalc.classList.remove('active');
    if (btnStudio) btnStudio.classList.add('active');

    // Trigger preview render in case dimensions changed
    if (LabelApp.renderPreview) LabelApp.renderPreview();
    if (LabelApp.updateRollEstimate) LabelApp.updateRollEstimate();
  }
};

/**
 * Synchronize settings from Studio into Calculator
 */
LabelApp.Calculator.syncFromStudio = function() {
  const dims = LabelApp.state.currentDimensions || { widthIn: 3.0, heightIn: 3.5 };
  LabelApp.Calculator.state.labelWidthIn = dims.widthIn || 3.0;
  LabelApp.Calculator.state.labelHeightIn = dims.heightIn || 3.5;

  const totalAll = (LabelApp.state.generatedItems && LabelApp.state.generatedItems.length) || 0;
  const calcTotalInput = document.getElementById('calcTotalOrder');

  if (totalAll > 0) {
    LabelApp.Calculator.state.totalOrder = totalAll;
    if (calcTotalInput) calcTotalInput.value = totalAll;
  } else {
    // If no labels generated in studio, check if user manually typed a quantity
    const manualQty = parseInt(calcTotalInput && calcTotalInput.value ? calcTotalInput.value : 0, 10) || 0;
    LabelApp.Calculator.state.totalOrder = manualQty;
    if (calcTotalInput && manualQty === 0) calcTotalInput.value = '';
  }

  const rollPresetEl = document.getElementById('rollMediaPreset');
  if (rollPresetEl) {
    LabelApp.Calculator.state.rollPreset = rollPresetEl.value;
    if (rollPresetEl.value === '4ft') LabelApp.Calculator.state.rollWidthIn = 48.0;
    else if (rollPresetEl.value === '3ft') LabelApp.Calculator.state.rollWidthIn = 36.0;
    else if (rollPresetEl.value === '2ft') LabelApp.Calculator.state.rollWidthIn = 24.0;
    else if (rollPresetEl.value === 'sheet-a4') LabelApp.Calculator.state.rollWidthIn = 8.27;
    else if (rollPresetEl.value === 'sheet-a3') LabelApp.Calculator.state.rollWidthIn = 11.69;
  }

  const gapEl = document.getElementById('labelGap');
  if (gapEl) {
    LabelApp.Calculator.state.gapIn = parseFloat(gapEl.value) || 0;
  }

  const calcWInput = document.getElementById('calcLabelW');
  if (calcWInput) calcWInput.value = LabelApp.Calculator.state.labelWidthIn;

  const calcHInput = document.getElementById('calcLabelH');
  if (calcHInput) calcHInput.value = LabelApp.Calculator.state.labelHeightIn;

  const calcRollPreset = document.getElementById('calcRollPreset');
  if (calcRollPreset) calcRollPreset.value = LabelApp.Calculator.state.rollPreset;

  const calcRollWidthInput = document.getElementById('calcRollWidth');
  if (calcRollWidthInput) calcRollWidthInput.value = LabelApp.Calculator.state.rollWidthIn;

  const calcGapInput = document.getElementById('calcGap');
  if (calcGapInput) calcGapInput.value = LabelApp.Calculator.state.gapIn;
};

/**
 * Handle Roll Preset changes inside Calculator
 */
LabelApp.Calculator.onRollPresetChange = function() {
  const preset = document.getElementById('calcRollPreset').value;
  const widthInput = document.getElementById('calcRollWidth');
  const customBox = document.getElementById('calcCustomRollWrap');

  LabelApp.Calculator.state.rollPreset = preset;

  if (preset === '4ft') {
    LabelApp.Calculator.state.rollWidthIn = 48.0;
    if (customBox) customBox.style.display = 'none';
  } else if (preset === '3ft') {
    LabelApp.Calculator.state.rollWidthIn = 36.0;
    if (customBox) customBox.style.display = 'none';
  } else if (preset === '2ft') {
    LabelApp.Calculator.state.rollWidthIn = 24.0;
    if (customBox) customBox.style.display = 'none';
  } else if (preset === '1000mm') {
    LabelApp.Calculator.state.rollWidthIn = 39.37; // 1000 mm = 39.37"
    if (customBox) customBox.style.display = 'none';
  } else if (preset === 'custom') {
    if (customBox) customBox.style.display = 'block';
    LabelApp.Calculator.state.rollWidthIn = parseFloat(widthInput.value) || 48.0;
  }

  if (widthInput) widthInput.value = LabelApp.Calculator.state.rollWidthIn;

  // Sync to Studio Roll Preset
  const studioRollPreset = document.getElementById('rollMediaPreset');
  if (studioRollPreset && (preset === '4ft' || preset === '3ft' || preset === '2ft')) {
    studioRollPreset.value = preset;
  }

  LabelApp.Calculator.calculate();
};

/**
 * Handle Max Page / Run Height Preset changes
 */
LabelApp.Calculator.onHeightPresetChange = function() {
  const preset = document.getElementById('calcHeightPreset').value;
  const customBox = document.getElementById('calcCustomHeightWrap');
  const heightInput = document.getElementById('calcMaxHeight');

  LabelApp.Calculator.state.maxHeightPreset = preset;

  if (preset === 'pdf-200') {
    LabelApp.Calculator.state.maxHeightIn = 199.5; // PDF 200" safe
    if (customBox) customBox.style.display = 'none';
  } else if (preset === '15ft') {
    LabelApp.Calculator.state.maxHeightIn = 180.0;
    if (customBox) customBox.style.display = 'none';
  } else if (preset === '10ft') {
    LabelApp.Calculator.state.maxHeightIn = 120.0;
    if (customBox) customBox.style.display = 'none';
  } else if (preset === '5m') {
    LabelApp.Calculator.state.maxHeightIn = 196.85; // 5 meters
    if (customBox) customBox.style.display = 'none';
  } else if (preset === 'custom') {
    if (customBox) customBox.style.display = 'block';
    LabelApp.Calculator.state.maxHeightIn = parseFloat(heightInput.value) || 199.5;
  }

  if (heightInput) heightInput.value = LabelApp.Calculator.state.maxHeightIn;
  LabelApp.Calculator.calculate();
};

/**
 * Main Optimization Calculator Engine
 * Calculates optimal columns, zero-waste full rows, and complete schedule table.
 */
LabelApp.Calculator.calculate = function() {
  const totalInput = document.getElementById('calcTotalOrder');
  const wInput = document.getElementById('calcLabelW');
  const hInput = document.getElementById('calcLabelH');
  const rollWInput = document.getElementById('calcRollWidth');
  const sideMarginInput = document.getElementById('calcSideMargin');
  const gapInput = document.getElementById('calcGap');
  const maxHInput = document.getElementById('calcMaxHeight');

  const totalOrder = Math.max(0, parseInt(totalInput && totalInput.value ? totalInput.value : 0, 10) || 0);
  const labelW = Math.max(0.2, parseFloat(wInput ? wInput.value : 3.0) || 3.0);
  const labelH = Math.max(0.2, parseFloat(hInput ? hInput.value : 3.5) || 3.5);
  const rollW = Math.max(2.0, parseFloat(rollWInput ? rollWInput.value : 48.0) || 48.0);
  const sideMargin = Math.max(0, parseFloat(sideMarginInput ? sideMarginInput.value : 0) || 0);
  const gap = Math.max(0, parseFloat(gapInput ? gapInput.value : 0) || 0);
  const maxH = Math.max(12.0, parseFloat(maxHInput ? maxHInput.value : 199.5) || 199.5);

  LabelApp.Calculator.state.totalOrder = totalOrder;
  LabelApp.Calculator.state.labelWidthIn = labelW;
  LabelApp.Calculator.state.labelHeightIn = labelH;
  LabelApp.Calculator.state.rollWidthIn = rollW;
  LabelApp.Calculator.state.sideMarginIn = sideMargin;
  LabelApp.Calculator.state.gapIn = gap;
  LabelApp.Calculator.state.maxHeightIn = maxH;

  // 1. Column Calculation & Width Utilization
  const printableWidth = Math.max(labelW, rollW - sideMargin * 2);
  const cols = Math.max(1, Math.floor((printableWidth + gap) / (labelW + gap)));
  const gridWidthIn = cols * labelW + Math.max(0, cols - 1) * gap;
  const remainingSideIn = Math.max(0, (rollW - gridWidthIn) / 2);
  const widthUtilPct = Math.min(100, (gridWidthIn / rollW) * 100);

  // 2. Full-Row Snapping under Max Height (Zero Waste)
  const pitchY = labelH + gap;
  const maxRowsPerFile = Math.max(1, Math.floor((maxH + gap) / pitchY));
  const zeroWasteBatchSize = cols * maxRowsPerFile;
  const fileHeightIn = maxRowsPerFile * labelH + Math.max(0, maxRowsPerFile - 1) * gap;
  const fileLengthFt = (fileHeightIn / 12).toFixed(1);
  const fileLengthM = (fileHeightIn * 0.0254).toFixed(1);

  // 3. Total Production Metrics
  const totalRows = totalOrder > 0 ? Math.ceil(totalOrder / cols) : 0;
  const totalLengthIn = totalRows * labelH + Math.max(0, totalRows - 1) * gap;
  const totalLengthFt = (totalLengthIn / 12).toFixed(1);
  const totalLengthM = (totalLengthIn * 0.0254).toFixed(1);
  const totalParts = totalOrder > 0 ? Math.ceil(totalOrder / zeroWasteBatchSize) : 0;

  // 4. Update Stat Badges in UI
  const statCols = document.getElementById('calcStatCols');
  const statUtil = document.getElementById('calcStatUtil');
  const statBatch = document.getElementById('calcStatBatch');
  const statParts = document.getElementById('calcStatParts');
  const statLength = document.getElementById('calcStatLength');
  const btnExportAll = document.getElementById('btnExportAllCalc');

  if (statCols) statCols.textContent = `${cols} Cols`;
  if (statUtil) statUtil.textContent = `${widthUtilPct.toFixed(1)}%`;
  if (statBatch) statBatch.textContent = `${zeroWasteBatchSize.toLocaleString()} Labels`;
  if (statParts) statParts.textContent = `${totalParts} PDF Files`;
  if (statLength) statLength.textContent = totalOrder > 0 ? `${totalLengthFt} ft (${totalLengthM}m)` : `0 ft (0m)`;

  if (btnExportAll) {
    btnExportAll.disabled = (totalOrder === 0);
    btnExportAll.style.opacity = totalOrder === 0 ? '0.5' : '1';
    btnExportAll.style.cursor = totalOrder === 0 ? 'not-allowed' : 'pointer';
  }

  // 5. Update Visual Roll Cross-Section Bar
  const visRollBar = document.getElementById('calcVisRollBar');
  const visMeta = document.getElementById('calcVisMeta');
  if (visRollBar) {
    const leftPct = (remainingSideIn / rollW) * 100;
    const gridPct = (gridWidthIn / rollW) * 100;
    const rightPct = Math.max(0, 100 - leftPct - gridPct);

    visRollBar.innerHTML = `
      <div style="width:${leftPct}%; background:#E2E8F0; height:100%; display:flex; align-items:center; justify-content:center; font-size:10px; color:#64748B; font-weight:600;" title="Left Margin: ${remainingSideIn.toFixed(2)} in">
        ${leftPct > 3 ? remainingSideIn.toFixed(2) + '"' : ''}
      </div>
      <div style="width:${gridPct}%; background:linear-gradient(90deg, #1D63ED, #2563EB); height:100%; display:flex; align-items:center; justify-content:center; color:#FFFFFF; font-weight:700; font-size:11.5px; letter-spacing:0.5px;">
        ${cols} Columns Active (${gridWidthIn.toFixed(1)}" Grid &bull; ${widthUtilPct.toFixed(1)}% Utilization)
      </div>
      <div style="width:${rightPct}%; background:#E2E8F0; height:100%; display:flex; align-items:center; justify-content:center; font-size:10px; color:#64748B; font-weight:600;" title="Right Margin: ${remainingSideIn.toFixed(2)} in">
        ${rightPct > 3 ? remainingSideIn.toFixed(2) + '"' : ''}
      </div>
    `;
  }
  if (visMeta) {
    visMeta.textContent = `Physical Roll: ${rollW}" (${(rollW * 25.4).toFixed(0)}mm) &bull; Grid: ${gridWidthIn.toFixed(2)}" &bull; Side Margins: ${remainingSideIn.toFixed(2)}" each &bull; Height per Roll: ${fileLengthFt} ft (Max: ${(maxH/12).toFixed(1)} ft)`;
  }

  // 6. Build the Pre-calculated Batch Schedule Table
  const tableBody = document.getElementById('calcScheduleTbody');
  if (tableBody) {
    if (totalOrder === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:36px 16px; color:#64748B;">
            <div style="font-size:28px; margin-bottom:8px;">📦</div>
            <div style="font-weight:700; font-size:14px; color:#1E293B; margin-bottom:4px;">No Production Order Defined Yet</div>
            <div style="font-size:12px; color:#64748B; max-width:440px; margin:0 auto; line-height:1.5;">
              Generate codes in <strong>Label Studio & Generator</strong> or enter a <strong>Total Order Quantity</strong> on the left panel to calculate zero-waste batches.
            </div>
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    let currStart = 1;

    for (let p = 1; p <= totalParts; p++) {
      const currEnd = Math.min(totalOrder, p * zeroWasteBatchSize);
      const count = currEnd - currStart + 1;
      const partRows = Math.ceil(count / cols);
      const partH = partRows * labelH + Math.max(0, partRows - 1) * gap;
      const partFt = (partH / 12).toFixed(1);
      const partM = (partH * 0.0254).toFixed(1);
      const isLastPart = (p === totalParts);
      const isFull = (count === zeroWasteBatchSize);

      const statusTag = isFull 
        ? `<span class="badge" style="background:#DCFCE7; color:#15803D; font-weight:700;">100% Full Rows (0 Waste)</span>`
        : `<span class="badge" style="background:#FEF9C3; color:#A16207; font-weight:700;">Final Part (${count} labels)</span>`;

      rowsHtml += `
        <tr>
          <td style="font-weight:700; font-family:var(--mono); color:var(--brand-blue);">Part ${String(p).padStart(2, '0')}</td>
          <td style="font-family:var(--mono); font-weight:600;">Labels ${currStart.toLocaleString()} &rarr; ${currEnd.toLocaleString()}</td>
          <td><strong>${count.toLocaleString()}</strong></td>
          <td>${partRows} Rows (${cols} cols)</td>
          <td style="font-family:var(--mono); font-size:11.5px;">~${partFt} ft (${partM}m)</td>
          <td>${statusTag}</td>
          <td style="text-align:right; white-space:nowrap;">
            <button class="btn-ghost btn-small" onclick="LabelApp.Calculator.applyPartToStudio(${currStart}, ${currEnd}, ${cols})" style="padding:3px 8px; font-size:11px;">
              🚀 Load to Studio
            </button>
            <button class="btn-primary btn-small" onclick="LabelApp.Calculator.exportPartDirect(${currStart}, ${currEnd}, ${cols}, ${p}, ${totalParts}, this)" style="padding:3px 8px; font-size:11px; margin-left:4px;">
              ⚡ Export PDF
            </button>
          </td>
        </tr>
      `;

      currStart = currEnd + 1;
    }

    tableBody.innerHTML = rowsHtml;
  }
};

/**
 * Apply a specific batch range to Studio and switch to Studio view
 */
LabelApp.Calculator.applyPartToStudio = function(start, end, cols) {
  // Update Studio inputs
  const startInput = document.getElementById('rangeStartInput');
  const endInput = document.getElementById('rangeEndInput');
  const pdfColsInput = document.getElementById('pdfColumns');
  const gridColsInput = document.getElementById('gridCols');

  if (startInput) startInput.value = start;
  if (endInput) endInput.value = end;
  if (pdfColsInput) pdfColsInput.value = cols;
  if (gridColsInput) gridColsInput.value = cols;

  // Switch to Studio
  window.switchMainView('studio');

  // Trigger preview & estimate update
  if (LabelApp.updateRollEstimate) LabelApp.updateRollEstimate();
  if (LabelApp.renderPreview) LabelApp.renderPreview();
};

/**
 * Apply whole configuration (columns, size, media) to Studio
 */
LabelApp.Calculator.applyAllToStudio = function() {
  const { cols, labelW, labelH, rollPreset, rollWidthIn } = LabelApp.Calculator.state;

  // Sync dimensions
  const dimW = document.getElementById('dimWidth');
  const dimH = document.getElementById('dimHeight');
  if (dimW) dimW.value = labelW;
  if (dimH) dimH.value = labelH;

  const pdfColsInput = document.getElementById('pdfColumns');
  if (pdfColsInput) {
    const printableWidth = Math.max(labelW, rollWidthIn);
    pdfColsInput.value = Math.max(1, Math.floor(printableWidth / labelW));
  }

  if (LabelApp.updateDimensions) LabelApp.updateDimensions();
  window.switchMainView('studio');
};

/**
 * Direct export of a single batch part from the Calculator table
 * Downloads ONLY that specific part file without re-chunking or downloading other parts.
 */
LabelApp.Calculator.exportPartDirect = async function(start, end, cols, partNum, totalParts, btnElement) {
  let origText = '';
  if (btnElement) {
    origText = btnElement.innerHTML;
    btnElement.disabled = true;
    btnElement.innerHTML = '⏳ Exporting...';
  }

  try {
    // 1. Ensure data exists up to this range
    let allItems = LabelApp.state.generatedItems || [];
    if (allItems.length < end) {
      const prefixInput = document.getElementById('seqPrefix');
      const prefix = prefixInput ? prefixInput.value : 'P-';
      const pad = document.getElementById('seqPad') ? parseInt(document.getElementById('seqPad').value, 10) : 4;
      
      for (let i = allItems.length + 1; i <= end; i++) {
        const numStr = (pad > 0) ? String(i).padStart(pad, '0') : String(i);
        const code = `${prefix}${numStr}`.toUpperCase();
        allItems.push({ code: code, title: code, subtitle: '' });
      }
      LabelApp.state.generatedItems = allItems;
      LabelApp.updateStats();
    }

    // 2. Extract EXACTLY this part's items (start to end)
    const partItems = allItems.slice(start - 1, end);
    const partCount = partItems.length;
    if (!partCount) {
      alert(`No items found for Part ${partNum} (${start}–${end})`);
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.innerHTML = origText;
      }
      return;
    }

    // 3. Dimensions & layout (strictly sync with Calculator's active dimensions)
    const activeLabelW = LabelApp.Calculator.state.labelWidthIn || 3.0;
    const activeLabelH = LabelApp.Calculator.state.labelHeightIn || 3.5;
    const dims = {
      ...(LabelApp.state.currentDimensions || {}),
      widthIn: activeLabelW,
      heightIn: activeLabelH,
      widthRaw: String(activeLabelW),
      heightRaw: String(activeLabelH)
    };
    const s = LabelApp.getUserSettings();
    const gapIn = parseFloat(document.getElementById('calcGap') ? document.getElementById('calcGap').value : 0) || 0;

    const partRows = Math.ceil(partCount / cols);
    const sheetWidthIn = Number((cols * activeLabelW + Math.max(0, cols - 1) * gapIn).toFixed(4));
    const pageHeightIn = Number((partRows * activeLabelH + Math.max(0, partRows - 1) * gapIn).toFixed(4));
    const orientation = sheetWidthIn >= pageHeightIn ? 'l' : 'p';

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'in',
      format: [sheetWidthIn, pageHeightIn],
      compress: true
    });

    const progressWrap = document.getElementById('progressWrap');
    const progressBar = document.getElementById('progressBar');
    const progressNote = document.getElementById('progressNote');
    if (progressWrap) progressWrap.style.display = 'block';

    // 4. Render only this single part's items
    for (let r = 0; r < partRows; r++) {
      for (let c = 0; c < cols; c++) {
        const itemIdx = r * cols + c;
        if (itemIdx >= partCount) break;

        const item = partItems[itemIdx];
        const posX = c * (activeLabelW + gapIn);
        const posY = r * (activeLabelH + gapIn);

        LabelApp.CodeEngine.drawLabelToPDF(pdf, item, dims, posX, posY, s);

        if (progressBar) progressBar.style.width = Math.round(((itemIdx + 1) / partCount) * 100) + '%';
        if (progressNote) {
          progressNote.textContent = `Part ${partNum}/${totalParts}: Rendering label ${itemIdx + 1} of ${partCount} (${start + itemIdx})...`;
        }

        if (itemIdx % 50 === 0) await LabelApp.yieldFrame();
      }
    }

    // 5. Continuous Cut Divider Lines
    if (s.drawSheetCutLines && s.borderStyle !== 'none') {
      const isDashed = (s.borderStyle === 'dashed');
      const isDark = (s.borderStyle === 'solid-dark');

      if (pdf.saveGraphicsState) pdf.saveGraphicsState();
      pdf.setDrawColor(isDark ? 40 : 203, isDark ? 50 : 213, isDark ? 70 : 225);
      pdf.setLineWidth(0.008);

      if (isDashed && pdf.setLineDashPattern) {
        pdf.setLineDashPattern([0.05, 0.05], 0);
      }

      // Vertical cut lines
      for (let c = 1; c < cols; c++) {
        const cutX = c * (activeLabelW + gapIn) - gapIn / 2;
        pdf.line(cutX, 0, cutX, pageHeightIn);
      }

      // Horizontal cut lines
      for (let r = 1; r < partRows; r++) {
        const cutY = r * (activeLabelH + gapIn) - gapIn / 2;
        pdf.line(0, cutY, sheetWidthIn, cutY);
      }

      pdf.rect(0, 0, sheetWidthIn, pageHeightIn, 'S');
      if (pdf.restoreGraphicsState) pdf.restoreGraphicsState();
    }

    // 6. Save ONLY THIS SINGLE FILE
    const mediaPreset = document.getElementById('calcRollPreset') ? document.getElementById('calcRollPreset').value : 'roll';
    const fileName = `master_roll_${mediaPreset}_${cols}cols_${dims.widthRaw}x${dims.heightRaw}_Part${String(partNum).padStart(2, '0')}_of_${totalParts}_(labels_${start}-${end}).pdf`;
    
    if (progressNote) progressNote.textContent = `Saving Part ${partNum} (${start}–${end})...`;
    await LabelApp.yieldFrame();
    
    pdf.save(fileName);

    if (progressNote) {
      progressNote.textContent = `Downloaded Part ${partNum} of ${totalParts} (${partCount} labels, ${partRows} rows)!`;
    }

    if (btnElement) {
      btnElement.innerHTML = '✅ Downloaded!';
      setTimeout(() => {
        btnElement.disabled = false;
        btnElement.innerHTML = origText;
      }, 3000);
    }
  } catch (err) {
    console.error('Error exporting single part:', err);
    if (btnElement) {
      btnElement.disabled = false;
      btnElement.innerHTML = origText;
    }
    alert('Export error: ' + err.message);
  }
};

/**
 * Sequential Automated Exporter for All Parts in Order
 */
LabelApp.Calculator.exportAllPartsSequentially = async function() {
  if (LabelApp.Calculator.state.autoExporting) return;
  LabelApp.Calculator.state.autoExporting = true;

  const btn = document.getElementById('btnExportAllCalc');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Exporting All Parts Sequentially...';
  }

  const { totalOrder, rollWidthIn, labelWidthIn, labelHeightIn, maxHeightIn, gapIn } = LabelApp.Calculator.state;
  const cols = Math.max(1, Math.floor((rollWidthIn + gapIn) / (labelWidthIn + gapIn)));
  const maxRows = Math.max(1, Math.floor((maxHeightIn + gapIn) / (labelHeightIn + gapIn)));
  const batchSize = cols * maxRows;
  const totalParts = Math.ceil(totalOrder / batchSize);

  // Auto-fill full sequence if needed
  let allItems = LabelApp.state.generatedItems || [];
  if (allItems.length < totalOrder) {
    const prefixInput = document.getElementById('seqPrefix');
    const prefix = prefixInput ? prefixInput.value : 'P-';
    const pad = document.getElementById('seqPad') ? parseInt(document.getElementById('seqPad').value, 10) : 4;
    
    for (let i = allItems.length + 1; i <= totalOrder; i++) {
      const numStr = (pad > 0) ? String(i).padStart(pad, '0') : String(i);
      const code = `${prefix}${numStr}`.toUpperCase();
      allItems.push({ code: code, title: code, subtitle: '' });
    }
    LabelApp.state.generatedItems = allItems;
    LabelApp.updateStats();
  }

  for (let p = 1; p <= totalParts; p++) {
    const start = (p - 1) * batchSize + 1;
    const end = Math.min(totalOrder, p * batchSize);

    if (btn) {
      btn.textContent = `Exporting Part ${p} of ${totalParts} (${start}–${end})...`;
    }

    await LabelApp.Calculator.exportPartDirect(start, end, cols, p, totalParts);
    await new Promise(r => setTimeout(r, 800)); // Pause between downloads
  }

  if (btn) {
    btn.disabled = false;
    btn.textContent = '🏭 One-Click Export Entire Order in Zero-Waste Parts';
  }
  LabelApp.Calculator.state.autoExporting = false;
  alert(`Successfully exported all ${totalOrder.toLocaleString()} labels across ${totalParts} Zero-Waste Vector PDF parts!`);
};
