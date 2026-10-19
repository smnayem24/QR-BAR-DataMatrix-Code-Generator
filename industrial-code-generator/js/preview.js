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
    fontSize: parseInt(document.getElementById('fontSize').value) || 22,
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
    showCutLine: showCutLine
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
 */
LabelApp.renderPreview = function() {
  const s = LabelApp.getUserSettings();
  const items = LabelApp.state.generatedItems;
  const dims = LabelApp.state.currentDimensions;

  let borderClass = 'bordered';
  if (s.borderStyle === 'solid-dark') borderClass = 'bordered-dark';
  else if (s.borderStyle === 'dashed') borderClass = 'bordered-dashed';
  else if (s.borderStyle === 'none') borderClass = '';

  const slashedStyle = s.slashedZero ? 'font-variant-numeric: slashed-zero; font-feature-settings: "zero" 1;' : '';

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
      singleDimTag.textContent = `${dims.widthRaw} × ${dims.heightRaw} ${dims.unit} (${widthMm} × ${heightMm} mm)`;
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

  // For 2D Codes (DataMatrix & QR Code), render exact high-precision canvas sticker with cut line
  if (s.codeType === 'datamatrix' || s.codeType === 'qrcode') {
    singleFrame.className = 'single-label-frame';
    singleFrame.style.padding = '0px';
    singleFrame.style.border = 'none';
    singleFrame.style.backgroundColor = 'transparent';

    const renderCanvas = LabelApp.CodeEngine.renderLabelToCanvas(singleItem, dims, 300, s);
    renderCanvas.style.width = '100%';
    renderCanvas.style.height = '100%';
    renderCanvas.style.display = 'block';
    renderCanvas.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
    renderCanvas.style.borderRadius = '2px';
    singleFrame.innerHTML = '';
    singleFrame.appendChild(renderCanvas);
  } else {
    // 1D Barcode & QR Code standard inspector layout
    singleFrame.className = `single-label-frame ${borderClass}`;
    singleFrame.style.padding = `${s.labelPadding}px`;
    singleFrame.style.backgroundColor = s.bgColor;

    const hasTopText = (s.textPosition === 'top' || s.textPosition === 'both');
    const hasBottomText = (s.textPosition === 'bottom' || s.textPosition === 'both');
    const textSpaceEstimate = (hasTopText ? 30 : 0) + (hasBottomText ? 30 : 0);
    const availableContentH = Math.max(40, inspectorH - textSpaceEstimate - (s.labelPadding * 2));
    const singleCodeHeight = Math.round(availableContentH * (s.barcodeHeightRatio / 100));

    const is2DCode = LabelApp.CodeEngine.is2D(s.codeType);
    const codeBoxWidth = is2DCode ? `${singleCodeHeight}px` : `${s.barcodeWidthRatio}%`;

    singleFrame.innerHTML = `
      ${hasTopText ? `
        <div class="barcode-text-top" style="font-family:'${s.fontFamily}', 'Inter', sans-serif; font-weight:${s.fontWeight}; font-size:${s.fontSize}px; letter-spacing:${s.letterSpacing}px; color:${s.textColor}; ${slashedStyle}">
          ${LabelApp.escapeHtml(singleItem.title.toUpperCase())}
        </div>
      ` : ''}

      <div class="barcode-svg-wrap" id="single-code-container" style="height: ${singleCodeHeight}px; width: ${codeBoxWidth}; margin: 0 auto; display: flex; align-items: center; justify-content: center;"></div>

      ${hasBottomText ? `
        <div class="barcode-text-bottom" style="font-family:'${s.fontFamily}', 'Inter', sans-serif; font-size:${Math.max(10, s.fontSize - 4)}px; letter-spacing:${s.letterSpacing}px; color:${s.textColor}; ${slashedStyle}">
          ${LabelApp.escapeHtml(singleItem.title.toUpperCase())}
        </div>
      ` : ''}
    `;

    const singleCodeContainer = document.getElementById('single-code-container');
    LabelApp.CodeEngine.renderIntoDOM(
      singleCodeContainer,
      singleItem.code,
      s.codeType,
      s.barcodeFormat,
      s.barColor,
      s.bgColor,
      inspectorW * (s.barcodeWidthRatio / 100),
      singleCodeHeight
    );
  }

  // =====================================================================
  // 2. RENDER BATCH GRID (OPTIMIZED: 4 ROWS PER PAGE)
  // =====================================================================
  const cols = s.gridCols;
  gridContainer.style.backgroundColor = s.bgColor;
  gridContainer.style.gridTemplateColumns = `repeat(${cols}, minmax(135px, 1fr))`;
  gridContainer.style.width = (cols >= 6) ? `${cols * 145}px` : '100%';

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

  if (s.codeType === 'datamatrix' || s.codeType === 'qrcode') {
    // For 2D batch view, render miniature stickers matching the 5mm trimming & layout
    gridContainer.innerHTML = displayItems.map((item, relIdx) => {
      const globalIdx = startIndex + relIdx;
      const isSelected = globalIdx === safeIdx ? 'selected-item' : '';
      return `
        <div class="barcode-item ${isSelected}" id="bc-item-${globalIdx}" onclick="LabelApp.selectLabelIndex(${globalIdx})" style="padding: 4px; background-color: ${s.bgColor}; min-height: ${gridItemHeight}px;">
          <div class="item-actions">
            <button class="mini-icon-btn" title="Download PNG" onclick="event.stopPropagation(); LabelApp.downloadSingle('${item.code}', ${globalIdx}, 'png')">PNG</button>
            <button class="mini-icon-btn" title="Download SVG" onclick="event.stopPropagation(); LabelApp.downloadSingle('${item.code}', ${globalIdx}, 'svg')">SVG</button>
          </div>
          <div id="grid-dm-canvas-wrap-${globalIdx}" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;"></div>
        </div>
      `;
    }).join('');

    displayItems.forEach((item, relIdx) => {
      const globalIdx = startIndex + relIdx;
      const wrapEl = document.getElementById(`grid-dm-canvas-wrap-${globalIdx}`);
      if (wrapEl) {
        const miniCanvas = LabelApp.CodeEngine.renderLabelToCanvas(item, dims, 120, s);
        miniCanvas.style.maxWidth = '100%';
        miniCanvas.style.maxHeight = `${gridItemHeight}px`;
        miniCanvas.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
        wrapEl.appendChild(miniCanvas);
      }
    });
  } else {
    // 1D Barcode & QR Code standard grid layout
    const hasTopText = (s.textPosition === 'top' || s.textPosition === 'both');
    const hasBottomText = (s.textPosition === 'bottom' || s.textPosition === 'both');
    const textSpaceEstimate = (hasTopText ? 30 : 0) + (hasBottomText ? 30 : 0);
    const gridBcHeight = Math.max(30, Math.round((gridItemHeight - textSpaceEstimate) * (s.barcodeHeightRatio / 100) * 0.8));
    const is2DCode = LabelApp.CodeEngine.is2D(s.codeType);
    const gridCodeBoxWidth = is2DCode ? `${gridBcHeight}px` : `${s.barcodeWidthRatio}%`;

    gridContainer.innerHTML = displayItems.map((item, relIdx) => {
      const globalIdx = startIndex + relIdx;
      const isSelected = globalIdx === safeIdx ? 'selected-item' : '';
      return `
        <div class="barcode-item ${borderClass} ${isSelected}" id="bc-item-${globalIdx}" onclick="LabelApp.selectLabelIndex(${globalIdx})" style="padding: ${Math.round(s.labelPadding * 0.6)}px; background-color: ${s.bgColor}; min-height: ${gridItemHeight}px;">
          <div class="item-actions">
            <button class="mini-icon-btn" title="Download PNG" onclick="event.stopPropagation(); LabelApp.downloadSingle('${item.code}', ${globalIdx}, 'png')">PNG</button>
            <button class="mini-icon-btn" title="Download SVG" onclick="event.stopPropagation(); LabelApp.downloadSingle('${item.code}', ${globalIdx}, 'svg')">SVG</button>
          </div>

          ${hasTopText ? `
            <div class="barcode-text-top" style="font-family:'${s.fontFamily}', 'Inter', sans-serif; font-weight:${s.fontWeight}; font-size:${Math.max(11, s.fontSize - 6)}px; letter-spacing:${s.letterSpacing}px; color:${s.textColor}; ${slashedStyle}">
              ${LabelApp.escapeHtml(item.title.toUpperCase())}
            </div>
          ` : ''}

          <div class="barcode-svg-wrap" style="height: ${gridBcHeight}px; width: ${gridCodeBoxWidth}; margin: 0 auto; display: flex; align-items: center; justify-content: center;">
            <div id="grid-code-target-${globalIdx}" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;"></div>
          </div>

          ${hasBottomText ? `
            <div class="barcode-text-bottom" style="font-family:'${s.fontFamily}', 'Inter', sans-serif; font-size:${Math.max(9, s.fontSize - 10)}px; letter-spacing:${s.letterSpacing}px; color:${s.textColor}; ${slashedStyle}">
              ${LabelApp.escapeHtml(item.title.toUpperCase())}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    displayItems.forEach((item, relIdx) => {
      const globalIdx = startIndex + relIdx;
      const targetEl = document.getElementById(`grid-code-target-${globalIdx}`);
      if (targetEl) {
        LabelApp.CodeEngine.renderIntoDOM(
          targetEl,
          item.code,
          s.codeType,
          s.barcodeFormat,
          s.barColor,
          s.bgColor,
          140 * (s.barcodeWidthRatio / 100),
          gridBcHeight
        );
      }
    });
  }
};
