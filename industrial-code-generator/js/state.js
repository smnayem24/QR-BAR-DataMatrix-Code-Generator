/**
 * ==========================================================================
 * INDUSTRIAL CODE & LABEL GENERATOR - APPLICATION STATE & PRESETS
 * ==========================================================================
 */

window.LabelApp = window.LabelApp || {};

// Main Application State
LabelApp.state = {
  activeTab: 'seq',
  codeType: 'barcode', // 'barcode' | 'datamatrix' | 'qrcode'
  generatedItems: [],
  currentSelectedIndex: 0,
  gridCurrentPage: 0,
  currentDimensions: {
    widthIn: 6.0,
    heightIn: 3.0,
    unit: 'in',
    widthRaw: 6.0,
    heightRaw: 3.0,
    isSheet: false
  },
  isGeneratingZip: false,
  marginMm: 5.0,
  showCutLine: true,
  csvParsedRows: []
};

// Size Presets standard in logistics, warehousing & manufacturing
LabelApp.SIZE_PRESETS = {
  '6x3-l': { w: 6, h: 3, unit: 'in', cols: 4, orient: 'landscape', isSheet: false, label: '6" × 3" Landscape (Warehouse Standard)' },
  '3x3.5-p': { w: 3, h: 3.5, unit: 'in', cols: 4, orient: 'portrait', isSheet: false, label: '★ 3" × 3.5" (DataMatrix Pallet Sticker - 5mm Margin)' },
  '3x3-sq': { w: 3, h: 3, unit: 'in', cols: 4, orient: 'landscape', isSheet: false, label: '3" × 3" Square (DataMatrix / QR Sticker)' },
  '6x4-l': { w: 6, h: 4, unit: 'in', cols: 3, orient: 'landscape', isSheet: false, label: '6" × 4" Shipping (Landscape)' },
  '4x3-l': { w: 4, h: 3, unit: 'in', cols: 4, orient: 'landscape', isSheet: false, label: '4" × 3" Rack/Bin' },
  '4x2-l': { w: 4, h: 2, unit: 'in', cols: 4, orient: 'landscape', isSheet: false, label: '4" × 2" Shelf Label' },
  '3x2-l': { w: 3, h: 2, unit: 'in', cols: 5, orient: 'landscape', isSheet: false, label: '3" × 2" Sticker' },
  '2x1-l': { w: 2, h: 1, unit: 'in', cols: 6, orient: 'landscape', isSheet: false, label: '2" × 1" Shelf Lip' },
  '4x6-p': { w: 4, h: 6, unit: 'in', cols: 4, orient: 'portrait', isSheet: false, label: '4" × 6" Shipping' },
  '3x4-p': { w: 3, h: 4, unit: 'in', cols: 5, orient: 'portrait', isSheet: false, label: '3" × 4" Bin' },
  '2x3-p': { w: 2, h: 3, unit: 'in', cols: 6, orient: 'portrait', isSheet: false, label: '2" × 3" Tag' },
  '3x6-p': { w: 3, h: 6, unit: 'in', cols: 6, orient: 'portrait', isSheet: false, label: '3" × 6" Portrait Strip' },
  '1.5x0.5-l': { w: 1.5, h: 0.5, unit: 'in', cols: 8, orient: 'landscape', isSheet: false, label: '1.5" × 0.5" Mini' },
  'sheet-a4-photo': { w: 1.35, h: 1.7, unit: 'in', cols: 6, orient: 'portrait', isSheet: true, label: 'A4 Grid (Photo)' },
  'sheet-a4-24': { w: 70, h: 37, unit: 'mm', cols: 3, orient: 'landscape', isSheet: true, label: 'A4 24-up' },
  'sheet-a4-30': { w: 70, h: 29.7, unit: 'mm', cols: 3, orient: 'landscape', isSheet: true, label: 'A4 30-up' },
  'sheet-a4-65': { w: 38.1, h: 21.2, unit: 'mm', cols: 5, orient: 'landscape', isSheet: true, label: 'A4 65-up' },
  'sheet-letter-30': { w: 2.625, h: 1.0, unit: 'in', cols: 3, orient: 'landscape', isSheet: true, label: 'Letter 30-up' }
};

/**
 * Calculate inch-based dimensions regardless of user input units
 */
LabelApp.calculateDimensions = function(rawW, rawH, unit, isSheet) {
  let widthIn = rawW;
  let heightIn = rawH;

  if (unit === 'mm') {
    widthIn = rawW / 25.4;
    heightIn = rawH / 25.4;
  } else if (unit === 'cm') {
    widthIn = rawW / 2.54;
    heightIn = rawH / 2.54;
  } else if (unit === 'px') {
    widthIn = rawW / 96.0;
    heightIn = rawH / 96.0;
  }

  LabelApp.state.currentDimensions = {
    widthIn,
    heightIn,
    unit,
    widthRaw: rawW,
    heightRaw: rawH,
    isSheet: Boolean(isSheet)
  };
};

/**
 * Handle custom dimension inputs
 */
LabelApp.updateDimensions = function() {
  const w = parseFloat(document.getElementById('dimWidth').value) || 6;
  const h = parseFloat(document.getElementById('dimHeight').value) || 3;
  const unit = document.getElementById('dimUnit').value;

  LabelApp.calculateDimensions(w, h, unit, false);
  if (LabelApp.handleRollMediaChange) {
    LabelApp.handleRollMediaChange();
  }
  LabelApp.updateStats();
  if (LabelApp.renderPreview) {
    LabelApp.renderPreview();
  }
};

/**
 * Handle Preset dropdown change
 */
LabelApp.handleSizePresetChange = function() {
  const presetKey = document.getElementById('sizePresetSelect').value;
  const customBox = document.getElementById('customDimsBox');

  if (presetKey === 'custom') {
    customBox.style.display = 'block';
    LabelApp.updateDimensions();
    return;
  }

  customBox.style.display = 'none';
  const p = LabelApp.SIZE_PRESETS[presetKey];
  if (!p) return;

  document.getElementById('dimWidth').value = p.w;
  document.getElementById('dimHeight').value = p.h;
  document.getElementById('dimUnit').value = p.unit;
  document.getElementById('gridCols').value = p.cols;
  document.getElementById('labelOrientation').value = p.orient;

  LabelApp.calculateDimensions(p.w, p.h, p.unit, p.isSheet);
  if (LabelApp.handleRollMediaChange) {
    LabelApp.handleRollMediaChange();
  }
  LabelApp.updateStats();
  if (LabelApp.renderPreview) {
    LabelApp.renderPreview();
  }
};

/**
 * Toggle landscape vs. portrait orientation
 */
LabelApp.toggleOrientation = function() {
  const orient = document.getElementById('labelOrientation').value;
  const w = parseFloat(document.getElementById('dimWidth').value) || 6;
  const h = parseFloat(document.getElementById('dimHeight').value) || 3;

  if ((orient === 'landscape' && w < h) || (orient === 'portrait' && w > h)) {
    document.getElementById('dimWidth').value = h;
    document.getElementById('dimHeight').value = w;
    LabelApp.updateDimensions();
  }
};

/**
 * Update top hero stats badges
 */
LabelApp.updateStats = function() {
  const count = LabelApp.state.generatedItems.length;
  const statCount = document.getElementById('statCount');
  if (statCount) statCount.textContent = count;

  const dims = LabelApp.state.currentDimensions;
  const statSize = document.getElementById('statSize');
  if (statSize) {
    statSize.textContent = `${dims.widthRaw} × ${dims.heightRaw} ${dims.unit}`;
  }

  const gridColsInput = document.getElementById('gridCols');
  const cols = gridColsInput ? (parseInt(gridColsInput.value) || 4) : 4;
  const rowsPerPage = 5;
  const itemsPerPage = cols * rowsPerPage;
  const estPages = Math.max(1, Math.ceil(count / itemsPerPage));
  const statPages = document.getElementById('statPages');
  if (statPages) statPages.textContent = estPages;
};

/**
 * Utilities
 */
LabelApp.escapeHtml = function(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

LabelApp.sanitizeName = function(str) {
  return String(str).replace(/[^A-Za-z0-9\-_.]/g, '_').toUpperCase();
};

LabelApp.yieldFrame = function() {
  return new Promise(res => setTimeout(res, 0));
};

LabelApp.downloadBlob = function(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
