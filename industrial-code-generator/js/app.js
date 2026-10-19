/**
 * ==========================================================================
 * INDUSTRIAL CODE & LABEL GENERATOR - MAIN APPLICATION ENTRY POINT
 * Initializes modules, binds events, and manages code type switching
 * ==========================================================================
 */

window.LabelApp = window.LabelApp || {};

/**
 * Set and switch between Barcode, Data Matrix, and QR Code modes
 */
LabelApp.setCodeType = function(type) {
  LabelApp.state.codeType = type;

  // 1. Update UI cards
  document.querySelectorAll('.code-type-card').forEach(card => {
    card.classList.toggle('active', card.getAttribute('data-type') === type);
  });

  // 2. Show/Hide contextual settings
  const barcodeSymbologyWrap = document.getElementById('barcodeSymbologyWrap');
  const datamatrixOptionsWrap = document.getElementById('datamatrixOptionsWrap');
  const qrcodeOptionsWrap = document.getElementById('qrcodeOptionsWrap');

  if (barcodeSymbologyWrap) {
    barcodeSymbologyWrap.style.display = (type === 'barcode') ? 'block' : 'none';
  }
  if (datamatrixOptionsWrap) {
    datamatrixOptionsWrap.style.display = (type === 'datamatrix') ? 'block' : 'none';
  }
  if (qrcodeOptionsWrap) {
    qrcodeOptionsWrap.style.display = (type === 'qrcode') ? 'block' : 'none';
  }

  // 3. For 2D codes (DataMatrix & QR), switch to 3" x 3.5" Pallet/Sticker preset if currently on default 6x3
  const sizePresetSelect = document.getElementById('sizePresetSelect');
  if (type === 'datamatrix' || type === 'qrcode') {
    if (sizePresetSelect && sizePresetSelect.value === '6x3-l') {
      sizePresetSelect.value = '3x3.5-p';
      LabelApp.handleSizePresetChange();
    }
  } else if (type === 'barcode') {
    if (sizePresetSelect && sizePresetSelect.value === '3x3.5-p') {
      sizePresetSelect.value = '6x3-l';
      LabelApp.handleSizePresetChange();
    }
  }

  // 4. Adjust default aspect ratios appropriately for 2D vs 1D
  const widthRatioInput = document.getElementById('barcodeWidthRatio');
  const heightRatioInput = document.getElementById('barcodeHeightRatio');
  const widthValEl = document.getElementById('bcWidthVal');
  const heightValEl = document.getElementById('bcHeightVal');

  if (type === 'datamatrix' || type === 'qrcode') {
    if (widthRatioInput && heightRatioInput) {
      widthRatioInput.value = 60;
      heightRatioInput.value = 60;
      if (widthValEl) widthValEl.textContent = '60%';
      if (heightValEl) heightValEl.textContent = '60%';
    }
  } else {
    if (widthRatioInput && heightRatioInput) {
      widthRatioInput.value = 90;
      heightRatioInput.value = 70;
      if (widthValEl) widthValEl.textContent = '90%';
      if (heightValEl) heightValEl.textContent = '70%';
    }
  }

  LabelApp.renderPreview();
};

/**
 * Range Preset Shortcut (1-100, 1-500, All, etc.)
 */
LabelApp.setRangePreset = function(start, end) {
  const total = LabelApp.state.generatedItems.length;
  if (!total) {
    alert('Please generate sequence data or upload a file first.');
    return;
  }
  const startInput = document.getElementById('rangeStartInput');
  const endInput = document.getElementById('rangeEndInput');
  if (startInput) startInput.value = start;
  if (endInput) endInput.value = (end === 'all') ? total : Math.min(total, end);
};

/**
 * Initialize Application
 */
window.addEventListener('DOMContentLoaded', () => {
  // 1. Initial size preset configuration
  LabelApp.handleSizePresetChange();

  // 2. Generate initial demo sequence (P-27 to P-52)
  LabelApp.generateData();

  // 3. Initialize Drag & Drop for Excel/CSV
  if (LabelApp.initDropZone) {
    LabelApp.initDropZone();
  }

  // 4. Default code type
  LabelApp.setCodeType('barcode');
});

// ==========================================================================
// BACKWARD COMPATIBILITY / GLOBAL SCOPE BRIDGES FOR HTML ATTRIBUTES
// ==========================================================================
window.switchTab = LabelApp.switchTab;
window.generateData = LabelApp.generateData;
window.handleCSVUpload = function(e) {
  if (e.target.files && e.target.files[0]) {
    LabelApp.handleFileUpload(e.target.files[0]);
  }
};
window.handleFileUpload = LabelApp.handleFileUpload;
window.handleSizePresetChange = LabelApp.handleSizePresetChange;
window.updateDimensions = LabelApp.updateDimensions;
window.toggleOrientation = LabelApp.toggleOrientation;
window.renderPreview = LabelApp.renderPreview;
window.handleFontChange = function() { LabelApp.renderPreview(); };
window.prevSingleLabel = LabelApp.prevSingleLabel;
window.nextSingleLabel = LabelApp.nextSingleLabel;
window.selectLabelIndex = LabelApp.selectLabelIndex;
window.prevGridPage = LabelApp.prevGridPage;
window.nextGridPage = LabelApp.nextGridPage;
window.downloadCurrentSingle = LabelApp.downloadCurrentSingle;
window.downloadSingle = LabelApp.downloadSingle;
window.printSingleLabel = LabelApp.printSingleLabel;
window.downloadAllZIP = LabelApp.downloadAllZIP;
window.exportPDF = LabelApp.exportPDF;
window.downloadCSVData = LabelApp.downloadCSVData;
window.togglePdfMode = LabelApp.togglePdfMode;
window.handleRollMediaChange = LabelApp.handleRollMediaChange;
window.syncPdfColumns = LabelApp.syncPdfColumns;
window.setCodeType = LabelApp.setCodeType;
window.setRangePreset = LabelApp.setRangePreset;
