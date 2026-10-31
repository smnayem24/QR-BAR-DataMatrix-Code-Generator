/**
 * ==========================================================================
 * INDUSTRIAL CODE & LABEL GENERATOR - PREVIEW & LIVE INSPECTOR
 * Features: True 1:1 Aspect Ratio Live Inspector & Batch Sheet Grid View
 * Supports: DataMatrix 5mm Safety Margin, Trimming Cut Line & 300 DPI Rendering
 * ==========================================================================
 */

window.LabelApp = window.LabelApp || {};

/**
 * Gather all user visual options into a single settings object
 */
LabelApp.getUserSettings = function() {
  const codeType = LabelApp.state.codeType || 'barcode';
  const formatSelect = document.getElementById('barcodeFormat');
  let barcodeFormat = formatSelect ? formatSelect.value : 'CODE128';

  if (codeType === 'datamatrix') {
    const dmShape = document.getElementById('datamatrixShape');
    barcodeFormat = (dmShape && dmShape.value === 'rectangular') ? 'datamatrixrectangular' : 'datamatrix';
  } else if (codeType === 'qrcode') {
    barcodeFormat = 'QR';
  }

  let marginMm = 5.0;
  let showCutLine = true;

  if (codeType === 'datamatrix') {
    const marginMmInput = document.getElementById('marginMm');
    const showCutLineCheck = document.getElementById('showCutLineCheck');
    marginMm = marginMmInput ? (parseFloat(marginMmInput.value) || 5.0) : 5.0;
    showCutLine = showCutLineCheck ? showCutLineCheck.checked : true;
  } else if (codeType === 'qrcode') {
    const qrMarginMmInput = document.getElementById('qrMarginMm');
    const qrShowCutLineCheck = document.getElementById('qrShowCutLineCheck');
    marginMm = qrMarginMmInput ? (parseFloat(qrMarginMmInput.value) || 5.0) : 5.0;
    showCutLine = qrShowCutLineCheck ? qrShowCutLineCheck.checked : true;
  } else {
    showCutLine = false;
  }

  const qrEccSelect = document.getElementById('qrEcc');
  const qrEcc = qrEccSelect ? qrEccSelect.value : 'M';

  const rawLs = document.getElementById('letterSpacing') ? parseFloat(document.getElementById('letterSpacing').value) : 1;
  const letterSpacing = isNaN(rawLs) ? 0 : rawLs;

  return {
    codeType: codeType,
    barcodeFormat: barcodeFormat,
    qrEcc: qrEcc,
    textPosition: document.getElementById('textPosition').value,
    fontFamily: document.getElementById('fontFamily').value,
    fontWeight: document.getElementById('fontWeight').value,
    fontSize: parseInt(document.getElementById('fontSize').value) || 36,
    letterSpacing: letterSpacing,
    slashedZero: document.getElementById('enableSlashedZero').checked,
    borderStyle: document.getElementById('borderStyle').value,
    labelPadding: parseInt(document.getElementById('labelPadding').value) || 12,
    textColor: document.getElementById('textColor').value,
    barColor: document.getElementById('barColor').value,
    bgColor: document.getElementById('bgColor').value,
    barcodeWidthRatio: parseInt(document.getElementById('barcodeWidthRatio').value) || 90,
    barcodeHeightRatio: parseInt(document.getElementById('barcodeHeightRatio').value) || 70,
    gridCols: parseInt(document.getElementById('gridCols').value) || 6,
    marginMm: marginMm,
    showCutLine: showCutLine,
    drawSheetCutLines: document.getElementById('drawSheetCutLines') ? document.getElementById('drawSheetCutLines').checked : true
  };
};

/**
 * Single Label Inspector navigation
 */
LabelApp.prevSingleLabel = function() {
  const items = LabelApp.state.generatedItems;
  if (!items.length) return;
  LabelApp.state.currentSelectedIndex = (LabelApp.state.currentSelectedIndex - 1 + items.length) % items.length;
  LabelApp.renderPreview();
};

LabelApp.nextSingleLabel = function() {
  const items = LabelApp.state.generatedItems;
  if (!items.length) return;
  LabelApp.state.currentSelectedIndex = (LabelApp.state.currentSelectedIndex + 1) % items.length;
  LabelApp.renderPreview();
};

LabelApp.selectLabelIndex = function(idx) {
  LabelApp.state.currentSelectedIndex = idx;
  LabelApp.renderPreview();
};

/**
 * Batch Grid Page Navigation
 */
LabelApp.prevGridPage = function() {
  if (LabelApp.state.gridCurrentPage > 0) {
    LabelApp.state.gridCurrentPage--;
    LabelApp.renderPreview();
  }
};

LabelApp.nextGridPage = function() {
  const cols = parseInt(document.getElementById('gridCols').value) || 6;
  const itemsPerPage = Math.max(1, cols * 4);
  const totalGridPages = Math.ceil(LabelApp.state.generatedItems.length / itemsPerPage);
  if (LabelApp.state.gridCurrentPage < totalGridPages - 1) {
    LabelApp.state.gridCurrentPage++;
    LabelApp.renderPreview();
  }
};

/**
 * Master Preview Render: Synchronizes Inspector and Batch Grid
 * 100% WYSIWYG Precision Rendering using High-DPI Canvas for All Symbologies!
 */
LabelApp.renderPreview = function() {
  const s = LabelApp.getUserSettings();
  const items = LabelApp.state.generatedItems;
  const dims = LabelApp.state.currentDimensions;

  let borderClass = 'bordered';
  if (s.borderStyle === 'solid-dark') borderClass = 'bordered-dark';
  else if (s.borderStyle === 'dashed') borderClass = 'bordered-dashed';
  else if (s.borderStyle === 'none') borderClass = '';

  const singleFrame = document.getElementById('singleLabelFrame');
  const gridContainer = document.getElementById('barcodeGrid');

  if (!items.length) {
    if (singleFrame) singleFrame.innerHTML = '<div style="padding:40px; color:#888;">No code data available.</div>';
    if (gridContainer) gridContainer.innerHTML = '<div style="padding:40px; color:#888;">No codes generated yet.</div>';
    return;
  }

  // =====================================================================
  // 1. RENDER SINGLE LABEL INSPECTOR (1:1 PHYSICAL PROPORTIONS)
  // =====================================================================
  const safeIdx = Math.min(LabelApp.state.currentSelectedIndex, items.length - 1);
  const singleItem = items[safeIdx];

  const widthIn = dims.widthIn;
  const heightIn = dims.heightIn;
  const widthMm = (widthIn * 25.4).toFixed(1);
  const heightMm = (heightIn * 25.4).toFixed(1);

  const singleDimTag = document.getElementById('singleDimTag');
  if (singleDimTag) {
    if (s.codeType === 'datamatrix' || s.codeType === 'qrcode') {
      singleDimTag.textContent = `${dims.widthRaw} × ${dims.heightRaw} ${dims.unit} (${widthMm} × ${heightMm} mm) • ${s.marginMm}mm Cut Zone`;
    } else {
      singleDimTag.textContent = `${dims.widthRaw} × ${dims.heightRaw} ${dims.unit} (${widthMm} × ${heightMm} mm) • 1D Barcode (${s.barcodeFormat || 'CODE128'})`;
    }
  }

  const dimensionMarkerTop = document.getElementById('dimensionMarkerTop');
  if (dimensionMarkerTop) {
    dimensionMarkerTop.textContent = `← ${dims.widthRaw} ${dims.unit} (${widthMm} mm) →`;
  }

  const singleNavText = document.getElementById('singleNavText');
  if (singleNavText) {
    singleNavText.textContent = `Label ${safeIdx + 1} of ${items.length}: ${singleItem.code}`;
  }

  // Scale frame to maximum 500px width and max 280px height preserving exact aspect ratio
  const maxInspectorW = 500;
  const maxInspectorH = 280;
  let inspectorW = maxInspectorW;
  let inspectorH = inspectorW * (heightIn / widthIn);
  if (inspectorH > maxInspectorH) {
    inspectorH = maxInspectorH;
    inspectorW = inspectorH * (widthIn / heightIn);
  }

  singleFrame.style.width = `${Math.round(inspectorW)}px`;
  singleFrame.style.height = `${Math.round(inspectorH)}px`;
  singleFrame.className = 'single-label-frame';
  singleFrame.style.padding = '0px';
  singleFrame.style.border = 'none';
  singleFrame.style.backgroundColor = 'transparent';

  // High-DPI 300 DPI Canvas for true 100% WYSIWYG matching PDF export!
  const renderCanvas = LabelApp.CodeEngine.renderLabelToCanvas(singleItem, dims, 300, s);
  renderCanvas.style.width = '100%';
  renderCanvas.style.height = '100%';
  renderCanvas.style.display = 'block';
  renderCanvas.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
  renderCanvas.style.borderRadius = '2px';
  singleFrame.innerHTML = '';
  singleFrame.appendChild(renderCanvas);

  // =====================================================================
  // 2. RENDER BATCH GRID (OPTIMIZED: 4 ROWS PER PAGE)
  // =====================================================================
  const cols = s.gridCols;
  gridContainer.style.backgroundColor = s.bgColor;
  gridContainer.style.gridTemplateColumns = `repeat(${cols}, minmax(135px, 1fr))`;
  gridContainer.style.width = (cols >= 6) ? `${cols * 145}px` : '100%';

  let cutLineClass = '';
  if (s.drawSheetCutLines && s.borderStyle !== 'none') {
    if (s.borderStyle === 'solid-dark') cutLineClass = 'has-cut-lines-dark';
    else if (s.borderStyle === 'dashed') cutLineClass = 'has-cut-lines-dashed';
    else cutLineClass = 'has-cut-lines';
  }
  gridContainer.className = `barcode-sheet-grid ${cutLineClass}`;

  const maxPreviewRows = 4;
  const itemsPerPage = Math.max(1, cols * maxPreviewRows);
  const totalGridPages = Math.max(1, Math.ceil(items.length / itemsPerPage));

  if (LabelApp.state.gridCurrentPage >= totalGridPages) {
    LabelApp.state.gridCurrentPage = totalGridPages - 1;
  }
  if (LabelApp.state.gridCurrentPage < 0) LabelApp.state.gridCurrentPage = 0;

  const startIndex = LabelApp.state.gridCurrentPage * itemsPerPage;
  const displayItems = items.slice(startIndex, startIndex + itemsPerPage);

  const startLabelNum = items.length > 0 ? startIndex + 1 : 0;
  const endLabelNum = startIndex + displayItems.length;

  const previewMetaEl = document.getElementById('previewMeta');
  if (previewMetaEl) {
    previewMetaEl.textContent = `Displaying ${startLabelNum}–${endLabelNum} of ${items.length} labels (${Math.ceil(displayItems.length / cols)} Rows) • All ${items.length} labels included in Master PDF / ZIP`;
  }

  const gridPageTextEl = document.getElementById('gridPageText');
  if (gridPageTextEl) {
    gridPageTextEl.textContent = `Page ${LabelApp.state.gridCurrentPage + 1} of ${totalGridPages}`;
  }

  const gridItemHeight = Math.max(90, Math.round(150 * (heightIn / widthIn)));

  // Unified Batch View: Renders miniature stickers matching continuous cut lines & layout
  gridContainer.innerHTML = displayItems.map((item, relIdx) => {
    const globalIdx = startIndex + relIdx;
    const isSelected = globalIdx === safeIdx ? 'selected-item' : '';
    return `
      <div class="barcode-item ${borderClass} ${isSelected}" id="bc-item-${globalIdx}" onclick="LabelApp.selectLabelIndex(${globalIdx})" style="padding: 0px; background-color: ${s.bgColor}; min-height: ${gridItemHeight}px;">
        <div class="item-actions">
          <button class="mini-icon-btn" title="Download PNG" onclick="event.stopPropagation(); LabelApp.downloadSingle('${item.code}', ${globalIdx}, 'png')">PNG</button>
          <button class="mini-icon-btn" title="Download SVG" onclick="event.stopPropagation(); LabelApp.downloadSingle('${item.code}', ${globalIdx}, 'svg')">SVG</button>
        </div>
        <div id="grid-canvas-wrap-${globalIdx}" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;"></div>
      </div>
    `;
  }).join('');

  displayItems.forEach((item, relIdx) => {
    const globalIdx = startIndex + relIdx;
    const wrapEl = document.getElementById(`grid-canvas-wrap-${globalIdx}`);
    if (wrapEl) {
      const miniCanvas = LabelApp.CodeEngine.renderLabelToCanvas(item, dims, 120, s);
      miniCanvas.style.width = '100%';
      miniCanvas.style.height = '100%';
      miniCanvas.style.display = 'block';
      wrapEl.appendChild(miniCanvas);
    }
  });
};
