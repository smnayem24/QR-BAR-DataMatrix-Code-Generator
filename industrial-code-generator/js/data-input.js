/**
 * ==========================================================================
 * INDUSTRIAL CODE & LABEL GENERATOR - DATA INPUT & IMPORT HANDLERS
 * Supports: Auto Sequence Generation, Paste List, Excel (.xlsx, .xls) & CSV
 * ==========================================================================
 */

window.LabelApp = window.LabelApp || {};

/**
 * Switch tabs between Sequence, Paste List, and File Import
 */
LabelApp.switchTab = function(tab) {
  LabelApp.state.activeTab = tab;
  
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach((b, i) => {
    b.classList.toggle('active', 
      (tab === 'seq' && i === 0) || 
      (tab === 'list' && i === 1) || 
      (tab === 'csv' && i === 2)
    );
  });

  const tabSeq = document.getElementById('tab-seq');
  const tabList = document.getElementById('tab-list');
  const tabCsv = document.getElementById('tab-csv');

  if (tabSeq) tabSeq.style.display = tab === 'seq' ? 'block' : 'none';
  if (tabList) tabList.style.display = tab === 'list' ? 'block' : 'none';
  if (tabCsv) tabCsv.style.display = tab === 'csv' ? 'block' : 'none';
};

/**
 * Generate label items based on the active tab
 */
LabelApp.generateData = function() {
  const state = LabelApp.state;
  state.generatedItems = [];

  if (state.activeTab === 'seq') {
    const prefix = (document.getElementById('seqPrefix').value || '').trim().toUpperCase();
    const start = parseInt(document.getElementById('seqStart').value) || 1;
    const end = parseInt(document.getElementById('seqEnd').value) || 1;
    const step = parseInt(document.getElementById('seqStep').value) || 1;
    const pad = parseInt(document.getElementById('seqPad').value) || 0;
    const suffix = (document.getElementById('seqSuffix').value || '').trim().toUpperCase();

    const min = Math.min(start, end);
    const max = Math.max(start, end);

    for (let i = min; i <= max; i += step) {
      const numStr = pad > 0 ? String(i).padStart(pad, '0') : String(i);
      const code = `${prefix}${numStr}${suffix}`.toUpperCase();
      state.generatedItems.push({ code, title: code, subtitle: '' });
    }
  } else if (state.activeTab === 'list') {
    const text = (document.getElementById('manualListInput').value || '').trim().toUpperCase();
    if (!text) {
      alert('Please paste at least one code in the text box.');
      return;
    }
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    lines.forEach(line => {
      const parts = line.split(/[,\t]/).map(s => s.trim().toUpperCase());
      const code = parts[0] || '';
      const title = parts.length > 1 ? parts[1] : code;
      const subtitle = parts.length > 2 ? parts[2] : '';
      if (code) {
        state.generatedItems.push({ code, title, subtitle });
      }
    });
  } else if (state.activeTab === 'csv') {
    if (!state.csvParsedRows || !state.csvParsedRows.length) {
      alert('Please upload an Excel or CSV file first.');
      return;
    }
    const codeIdx = parseInt(document.getElementById('csvCodeCol').value) || 0;
    const titleIdx = parseInt(document.getElementById('csvTitleCol').value);

    state.csvParsedRows.forEach(row => {
      const code = row[codeIdx] ? String(row[codeIdx]).trim().toUpperCase() : '';
      if (code) {
        const title = (titleIdx >= 0 && row[titleIdx]) ? String(row[titleIdx]).trim().toUpperCase() : code;
        state.generatedItems.push({ code, title, subtitle: '' });
      }
    });
  }

  state.currentSelectedIndex = 0;
  state.gridCurrentPage = 0;
  LabelApp.updateStats();
  if (LabelApp.renderPreview) {
    LabelApp.renderPreview();
  }
};

/**
 * Handle Excel (.xlsx, .xls) and CSV File Upload & Parsing
 */
LabelApp.handleFileUpload = function(file) {
  if (!file) return;

  const fileName = file.name.toLowerCase();
  const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

  const reader = new FileReader();

  if (isExcel && typeof XLSX !== 'undefined') {
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!jsonData || jsonData.length === 0) {
          document.getElementById('csvStatus').textContent = 'The uploaded Excel file appears to be empty.';
          return;
        }

        const headers = jsonData[0];
        LabelApp.populateColumnSelects(headers);

        LabelApp.state.csvParsedRows = jsonData.slice(1).filter(r => r && r.length > 0);
        document.getElementById('csvStatus').textContent = `Loaded ${LabelApp.state.csvParsedRows.length} rows from "${file.name}"`;
        LabelApp.generateData();
      } catch (err) {
        console.error(err);
        alert('Error parsing Excel file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    // CSV Text Fallback
    reader.onload = function(evt) {
      const content = evt.target.result;
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 1) {
        document.getElementById('csvStatus').textContent = 'File is empty.';
        return;
      }

      const rows = lines.map(l => l.split(',').map(c => c.trim().replace(/^"|"$/g, '').toUpperCase()));
      const headers = rows[0];
      LabelApp.populateColumnSelects(headers);

      LabelApp.state.csvParsedRows = rows.slice(1);
      document.getElementById('csvStatus').textContent = `Loaded ${LabelApp.state.csvParsedRows.length} rows from "${file.name}"`;
      LabelApp.generateData();
    };
    reader.readAsText(file);
  }
};

/**
 * Helper to populate code & title column select dropdowns
 */
LabelApp.populateColumnSelects = function(headers) {
  const codeSelect = document.getElementById('csvCodeCol');
  const titleSelect = document.getElementById('csvTitleCol');
  if (!codeSelect || !titleSelect) return;

  codeSelect.innerHTML = '';
  titleSelect.innerHTML = '<option value="-1">Same as Code</option>';

  let defaultCol = 0;
  headers.forEach((h, i) => {
    const colName = String(h || `Column ${i + 1}`).trim();
    const opt1 = document.createElement('option');
    opt1.value = i;
    opt1.textContent = `${colName} (Col ${i + 1})`;
    codeSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = i;
    opt2.textContent = `${colName} (Col ${i + 1})`;
    titleSelect.appendChild(opt2);

    const lower = colName.toLowerCase();
    if (lower.includes('pallet') || lower.includes('code') || lower.includes('barcode') || lower.includes('id')) {
      defaultCol = i;
    }
  });

  codeSelect.value = defaultCol;
  const colRow = document.getElementById('columnSelectRow');
  if (colRow) colRow.style.display = 'flex';
};

/**
 * Drag & Drop Setup
 */
LabelApp.initDropZone = function() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('csvFileInput');
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      LabelApp.handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      LabelApp.handleFileUpload(e.target.files[0]);
    }
  });
};
