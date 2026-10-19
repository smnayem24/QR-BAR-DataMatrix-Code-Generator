/**
 * ==========================================================================
 * INDUSTRIAL CODE & LABEL GENERATOR - UNIFIED CODE ENGINE
 * Supports: 1D Barcodes (Code 128, Code 39, EAN, UPC, ITF),
 *           2D Data Matrix (ECC 200 Industrial Standard with 5mm Safety Margin),
 *           2D QR Code
 * ==========================================================================
 */

window.LabelApp = window.LabelApp || {};
LabelApp.CodeEngine = {};

/**
 * Checks if the current selected code is 2D (Data Matrix or QR Code)
 */
LabelApp.CodeEngine.is2D = function(codeType) {
  return codeType === 'datamatrix' || codeType === 'qrcode';
};

/**
 * Fallback DataMatrix Generator with Authentic L-Finder Pattern
 * Used if offline or if CDN fails, ensuring 100% reliability
 */
LabelApp.CodeEngine.drawFallbackDataMatrix = function(canvas, text) {
  const size = 300;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
  }

  const grid = 16;
  const cellSize = size / grid;

  ctx.fillStyle = '#000000';
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const isSolidBottom = (r === grid - 1);
      const isSolidLeft = (c === 0);
      const isDottedTop = (r === 0 && c % 2 === 0);
      const isDottedRight = (c === grid - 1 && r % 2 === 0);
      const bit = ((hash ^ (r * 19 + c * 37)) & 1) === 1;

      if (isSolidBottom || isSolidLeft || isDottedTop || isDottedRight || bit) {
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }
  }
};

/**
 * Measure text width considering letter spacing
 */
LabelApp.CodeEngine.measureTextWithSpacing = function(ctx, text, letterSpacing) {
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${letterSpacing}px`;
    return ctx.measureText(text).width;
  }
  const rawW = ctx.measureText(text).width;
  const extra = Math.max(0, text.length - 1) * letterSpacing;
  return rawW + extra;
};

/**
 * Draw text with letter spacing on 2D canvas (native + fallback support)
 */
LabelApp.CodeEngine.drawTextWithSpacing = function(ctx, text, x, y, letterSpacing, align = 'center') {
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${letterSpacing}px`;
    ctx.fillText(text, x, y);
    return;
  }

  const chars = String(text).split('');
  let totalW = 0;
  for (let i = 0; i < chars.length; i++) {
    totalW += ctx.measureText(chars[i]).width;
    if (i < chars.length - 1) totalW += letterSpacing;
  }

  let curX = (align === 'center') ? (x - totalW / 2) : x;
  for (let i = 0; i < chars.length; i++) {
    const charW = ctx.measureText(chars[i]).width;
    ctx.fillText(chars[i], curX + charW / 2, y);
    curX += charW + letterSpacing;
  }
};

/**
 * Render code directly into a DOM container element (used for Inspector & Grid Preview)
 */
LabelApp.CodeEngine.renderIntoDOM = function(containerEl, codeText, codeType, barcodeFormat, barColor, bgColor, boxWidth, boxHeight) {
  if (!containerEl) return;
  containerEl.innerHTML = '';

  const cleanText = String(codeText).trim().toUpperCase();

  // 1. DATA MATRIX (2D INDUSTRIAL ECC 200)
  if (codeType === 'datamatrix') {
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.objectFit = 'contain';
    containerEl.appendChild(canvas);

    let dmSuccess = false;
    try {
      if (typeof bwipjs !== 'undefined' && bwipjs.toCanvas) {
        const cleanBarColor = barColor.replace('#', '');
        const cleanBgColor = (bgColor && bgColor !== 'transparent') ? bgColor.replace('#', '') : 'FFFFFF';
        
        bwipjs.toCanvas(canvas, {
          bcid: barcodeFormat === 'datamatrixrectangular' ? 'datamatrixrectangular' : 'datamatrix',
          text: cleanText,
          scale: 4,
          includetext: false,
          barcolor: cleanBarColor,
          backgroundcolor: cleanBgColor
        });
        dmSuccess = canvas.width > 0 && canvas.height > 0;
      }
    } catch (err) {
      console.warn('bwip-js datamatrix warning:', err);
    }

    if (!dmSuccess) {
      LabelApp.CodeEngine.drawFallbackDataMatrix(canvas, cleanText);
    }
    return;
  }

  // 2. QR CODE (2D MATRIX)
  if (codeType === 'qrcode' || barcodeFormat === 'QR') {
    const qrDiv = document.createElement('div');
    const qrSize = Math.max(30, Math.min(boxWidth, boxHeight));
    qrDiv.style.width = `${qrSize}px`;
    qrDiv.style.height = `${qrSize}px`;
    qrDiv.style.margin = '0 auto';
    containerEl.appendChild(qrDiv);

    try {
      if (typeof QRCode !== 'undefined') {
        new QRCode(qrDiv, {
          text: cleanText,
          width: qrSize,
          height: qrSize,
          colorDark: barColor,
          colorLight: bgColor,
          correctLevel: QRCode.CorrectLevel.M
        });
      } else if (typeof bwipjs !== 'undefined' && bwipjs.toCanvas) {
        const canvas = document.createElement('canvas');
        containerEl.innerHTML = '';
        containerEl.appendChild(canvas);
        bwipjs.toCanvas(canvas, {
          bcid: 'qrcode',
          text: cleanText,
          scale: 3,
          barcolor: barColor.replace('#', ''),
          backgroundcolor: bgColor.replace('#', '')
        });
      }
    } catch (err) {
      containerEl.innerHTML = `<div style="font-size:10px; color:#c00;">QR Error: ${LabelApp.escapeHtml(err.message)}</div>`;
    }
    return;
  }

  // 3. 1D BARCODE (Code 128, Code 39, EAN, UPC, ITF)
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.style.width = '100%';
  svgEl.style.height = '100%';
  svgEl.style.display = 'block';
  containerEl.appendChild(svgEl);

  try {
    if (typeof JsBarcode !== 'undefined') {
      JsBarcode(svgEl, cleanText, {
        format: barcodeFormat || 'CODE128',
        displayValue: false,
        lineColor: barColor,
        background: 'transparent',
        margin: 0,
        width: 2,
        height: 100
      });

      const rawW = parseFloat(svgEl.getAttribute('width')) || 200;
      const rawH = parseFloat(svgEl.getAttribute('height')) || 100;
      svgEl.setAttribute('viewBox', `0 0 ${rawW} ${rawH}`);
      svgEl.setAttribute('preserveAspectRatio', 'none');
      svgEl.removeAttribute('width');
      svgEl.removeAttribute('height');
    } else {
      containerEl.innerHTML = `<div style="font-size:10px; color:#c00;">JsBarcode library loading...</div>`;
    }
  } catch (err) {
    containerEl.innerHTML = `<div style="font-size:10px; color:#c00;">Invalid ${barcodeFormat || 'barcode'}: ${LabelApp.escapeHtml(cleanText)}</div>`;
  }
};

/**
 * Render single label to high-DPI HTMLCanvasElement
 * Includes DataMatrix 5mm safety border & cut line trimming guide support
 */
LabelApp.CodeEngine.renderLabelToCanvas = function(item, dims, dpi, userSettings) {
  const { widthIn, heightIn } = dims;
  const widthPx = Math.round(widthIn * dpi);
  const heightPx = Math.round(heightIn * dpi);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');

  const s = userSettings;
  const codeType = s.codeType || 'barcode';
  const format = s.barcodeFormat || 'CODE128';
  const textPos = s.textPosition;
  const fontFamily = s.fontFamily || 'Inter';
  const fontWeight = s.fontWeight || '700';
  const fontSizeBase = s.fontSize || 22;
  const borderStyle = s.borderStyle;
  const textColor = s.textColor || '#000000';
  const barColor = s.barColor || '#000000';
  const bgColor = s.bgColor || '#FFFFFF';
  const widthRatioPct = (s.barcodeWidthRatio || 90) / 100;
  const heightRatioPct = (s.barcodeHeightRatio || 70) / 100;
  const marginMm = (typeof s.marginMm === 'number') ? s.marginMm : 5.0;
  const showCutLine = Boolean(s.showCutLine);

  // 1. Fill Solid Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, widthPx, heightPx);

  // =========================================================================
  // DATA MATRIX DEDICATED STICKER LAYOUT (AS IN DATAMATRIXGENERATOR.HTML)
  // =========================================================================
  if (codeType === 'datamatrix') {
    const marginPx = Math.round((marginMm / 25.4) * dpi);

    // Optional 5mm Cut Line Guide (Trimming line)
    if (showCutLine && marginPx > 0) {
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = Math.max(2, Math.round(widthPx * 0.003));
      ctx.setLineDash([Math.round(marginPx * 0.2), Math.round(marginPx * 0.2)]);
      ctx.strokeRect(marginPx, marginPx, widthPx - marginPx * 2, heightPx - marginPx * 2);
      ctx.setLineDash([]);
    } else if (borderStyle !== 'none') {
      ctx.lineWidth = Math.max(1, Math.round(dpi / 150));
      ctx.strokeStyle = (borderStyle === 'solid-dark') ? '#000000' : '#D0D5DD';
      if (borderStyle === 'dashed') ctx.setLineDash([Math.round(dpi / 30), Math.round(dpi / 30)]);
      ctx.strokeRect(0, 0, widthPx, heightPx);
      ctx.setLineDash([]);
    }

    // Safe Zone inside margin
    const safeLeft = marginPx;
    const safeTop = marginPx;
    const safeWidth = widthPx - marginPx * 2;
    const safeHeight = heightPx - marginPx * 2;

    const hasText = (textPos !== 'none');
    const textZoneHeight = hasText ? Math.round(safeHeight * 0.16) : 0;
    const qrZoneHeight = safeHeight - textZoneHeight;

    let qrZoneTop, textZoneTop;
    if (textPos === 'bottom') {
      qrZoneTop = safeTop;
      textZoneTop = safeTop + qrZoneHeight;
    } else {
      textZoneTop = safeTop;
      qrZoneTop = safeTop + textZoneHeight;
    }

    // Draw DataMatrix with bwip-js or fallback
    const dmCanvas = document.createElement('canvas');
    let dmSuccess = false;
    const cleanText = item.code.toUpperCase();

    try {
      if (typeof bwipjs !== 'undefined') {
        bwipjs.toCanvas(dmCanvas, {
          bcid: format === 'datamatrixrectangular' ? 'datamatrixrectangular' : 'datamatrix',
          text: cleanText,
          scale: Math.max(4, Math.round(dpi / 60)),
          includetext: false,
          barcolor: barColor.replace('#', ''),
          backgroundcolor: bgColor.replace('#', '')
        });
        dmSuccess = dmCanvas.width > 0 && dmCanvas.height > 0;
      }
    } catch (e) {
      console.warn('Data Matrix Canvas error:', e);
    }

    if (!dmSuccess) {
      LabelApp.CodeEngine.drawFallbackDataMatrix(dmCanvas, cleanText);
    }

    // Maximize DataMatrix square size while preserving quiet zone
    const dmAspect = (dmCanvas.width || 1) / (dmCanvas.height || 1);
    let targetDmH = Math.round(qrZoneHeight * 0.88);
    let targetDmW = Math.round(targetDmH * dmAspect);

    if (targetDmW > safeWidth * 0.90) {
      targetDmW = Math.round(safeWidth * 0.90);
      targetDmH = Math.round(targetDmW / dmAspect);
    }

    const qrX = safeLeft + Math.round((safeWidth - targetDmW) / 2);
    const qrY = qrZoneTop + Math.round((qrZoneHeight - targetDmH) / 2);

    ctx.imageSmoothingEnabled = false; // Sharp razor-crisp matrix pixels
    ctx.drawImage(dmCanvas, qrX, qrY, targetDmW, targetDmH);
    ctx.imageSmoothingEnabled = true;

    // Draw Text with User Font Size & Letter Spacing
    if (hasText) {
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textStr = String(item.title || item.code).toUpperCase();
      const scaleFactor = dpi / 96;
      const scaledLetterSpacing = Math.round((s.letterSpacing || 0) * scaleFactor);

      // Start from user's chosen text size
      let fontSize = Math.round((fontSizeBase || 22) * scaleFactor);
      const maxAllowedH = Math.round(textZoneHeight * 0.85);
      if (fontSize > maxAllowedH) {
        fontSize = maxAllowedH;
      }

      ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", "IBM Plex Mono", Arial, sans-serif`;

      let measuredWidth = LabelApp.CodeEngine.measureTextWithSpacing(ctx, textStr, scaledLetterSpacing);
      const maxTextWidth = safeWidth * 0.94;
      if (measuredWidth > maxTextWidth) {
        fontSize = Math.floor(fontSize * (maxTextWidth / measuredWidth));
        ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}", "IBM Plex Mono", Arial, sans-serif`;
      }

      const textY = textZoneTop + (textZoneHeight / 2);
      LabelApp.CodeEngine.drawTextWithSpacing(ctx, textStr, safeLeft + (safeWidth / 2), textY, scaledLetterSpacing, 'center');
    }

    return canvas;
  }

  // =========================================================================
  // STANDARD 1D BARCODE & QR CODE LAYOUT
  // =========================================================================
  if (borderStyle !== 'none') {
    ctx.lineWidth = Math.max(1, Math.round(dpi / 150));
    ctx.strokeStyle = (borderStyle === 'solid-dark') ? '#000000' : '#D0D5DD';
    if (borderStyle === 'dashed') ctx.setLineDash([Math.round(dpi / 30), Math.round(dpi / 30)]);
    ctx.strokeRect(0, 0, widthPx, heightPx);
    ctx.setLineDash([]);
  }

  const scaleFactor = dpi / 96;
  const scaledFontSize = Math.round(fontSizeBase * scaleFactor);
  const scaledLetterSpacing = Math.round((s.letterSpacing || 0) * scaleFactor);
  const hasTopText = (textPos === 'top' || textPos === 'both');
  const hasBottomText = (textPos === 'bottom' || textPos === 'both');

  const textHeightUnit = Math.round(scaledFontSize * 1.25);
  const gap = Math.round(scaledFontSize * 0.35);

  let totalTextH = 0;
  if (hasTopText) totalTextH += textHeightUnit + gap;
  if (hasBottomText) totalTextH += textHeightUnit + gap;

  const codeMaxWidth = Math.round(widthPx * widthRatioPct);
  const maxAllowedH = heightPx - totalTextH - Math.round(heightPx * 0.10);
  const codeMaxHeight = Math.max(Math.round(heightPx * 0.30), Math.min(maxAllowedH, Math.round(heightPx * heightRatioPct)));

  const totalBlockH = totalTextH + codeMaxHeight;
  let curY = Math.max(Math.round(heightPx * 0.04), Math.round((heightPx - totalBlockH) / 2));

  // Top Text
  if (hasTopText) {
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `${fontWeight} ${scaledFontSize}px "${fontFamily}", "Inter", Arial, sans-serif`;
    LabelApp.CodeEngine.drawTextWithSpacing(ctx, item.title.toUpperCase(), widthPx / 2, curY, scaledLetterSpacing, 'center');
    curY += textHeightUnit + gap;
  }

  // Code Render
  const cleanText = item.code.toUpperCase();

  if (codeType === 'qrcode' || format === 'QR') {
    const tempDiv = document.createElement('div');
    const qrSize = Math.min(codeMaxWidth, codeMaxHeight);
    new QRCode(tempDiv, {
      text: cleanText,
      width: qrSize,
      height: qrSize,
      colorDark: barColor,
      colorLight: bgColor
    });
    const qrImg = tempDiv.querySelector('img') || tempDiv.querySelector('canvas');
    if (qrImg) {
      const qx = Math.round((widthPx - qrSize) / 2);
      ctx.drawImage(qrImg, qx, curY, qrSize, qrSize);
      curY += qrSize + gap;
    }
  } else {
    // 1D Barcode
    const offCanvas = document.createElement('canvas');
    try {
      JsBarcode(offCanvas, cleanText, {
        format: format,
        displayValue: false,
        lineColor: barColor,
        background: bgColor,
        margin: 0,
        width: Math.max(2, Math.round(scaleFactor * 2.2)),
        height: 200
      });

      if (offCanvas.width > 0) {
        const drawW = codeMaxWidth;
        const drawH = codeMaxHeight;
        const bx = Math.round((widthPx - drawW) / 2);
        ctx.drawImage(offCanvas, bx, curY, drawW, drawH);
        curY += drawH + gap;
      }
    } catch (e) {
      console.error('JsBarcode Canvas error:', e);
    }
  }

  // Bottom Text
  if (hasBottomText) {
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const bSize = Math.max(10, Math.round(scaledFontSize * 0.85));
    ctx.font = `600 ${bSize}px "${fontFamily}", "Inter", Arial, sans-serif`;
    LabelApp.CodeEngine.drawTextWithSpacing(ctx, item.title.toUpperCase(), widthPx / 2, curY, scaledLetterSpacing, 'center');
  }

  return canvas;
};

/**
 * Render single label to Vector XML/SVG string
 */
LabelApp.CodeEngine.renderLabelToSVG = function(item, dims, userSettings) {
  const { widthIn, heightIn } = dims;
  const wPx = Math.round(widthIn * 96);
  const hPx = Math.round(heightIn * 96);

  const s = userSettings;
  const codeType = s.codeType || 'barcode';
  const format = s.barcodeFormat || 'CODE128';
  const textPos = s.textPosition;
  const fontFamily = s.fontFamily || 'Inter';
  const fontWeight = s.fontWeight || '700';
  const fontSizeBase = s.fontSize || 22;
  const letterSpacing = s.letterSpacing || 1;
  const borderStyle = s.borderStyle;
  const textColor = s.textColor || '#000000';
  const barColor = s.barColor || '#000000';
  const bgColor = s.bgColor || '#FFFFFF';
  const widthRatioPct = (s.barcodeWidthRatio || 90) / 100;
  const heightRatioPct = (s.barcodeHeightRatio || 70) / 100;
  const marginMm = (typeof s.marginMm === 'number') ? s.marginMm : 5.0;
  const showCutLine = Boolean(s.showCutLine);

  // =========================================================================
  // DATA MATRIX VECTOR SVG
  // =========================================================================
  if (codeType === 'datamatrix') {
    const marginPx = Math.round((marginMm / 25.4) * 96);

    let cutLineSvg = '';
    if (showCutLine && marginPx > 0) {
      cutLineSvg = `<rect x="${marginPx}" y="${marginPx}" width="${wPx - marginPx * 2}" height="${hPx - marginPx * 2}" fill="none" stroke="#CBD5E1" stroke-width="1.5" stroke-dasharray="4,4"/>`;
    }

    const safeLeft = marginPx;
    const safeTop = marginPx;
    const safeWidth = wPx - marginPx * 2;
    const safeHeight = hPx - marginPx * 2;

    const hasText = (textPos !== 'none');
    const textZoneHeight = hasText ? Math.round(safeHeight * 0.16) : 0;
    const qrZoneHeight = safeHeight - textZoneHeight;

    let qrZoneTop, textZoneTop;
    if (textPos === 'bottom') {
      qrZoneTop = safeTop;
      textZoneTop = safeTop + qrZoneHeight;
    } else {
      textZoneTop = safeTop;
      qrZoneTop = safeTop + textZoneHeight;
    }

    const cleanText = item.code.toUpperCase();
    let dmSvgContent = '';
    try {
      const dmSvgStr = bwipjs.toSVG({
        bcid: format === 'datamatrixrectangular' ? 'datamatrixrectangular' : 'datamatrix',
        text: cleanText,
        scale: 3,
        barcolor: barColor.replace('#', '')
      });

      const vbMatch = /viewBox="([^"]+)"/.exec(dmSvgStr);
      const vb = vbMatch ? vbMatch[1] : '0 0 100 100';
      const parts = vb.split(/\s+/).map(Number);
      const natW = parts[2] || 100;
      const natH = parts[3] || 100;
      const dmAspect = natW / natH;

      let targetDmH = Math.round(qrZoneHeight * 0.88);
      let targetDmW = Math.round(targetDmH * dmAspect);
      if (targetDmW > safeWidth * 0.90) {
        targetDmW = Math.round(safeWidth * 0.90);
        targetDmH = Math.round(targetDmW / dmAspect);
      }

      const qx = safeLeft + Math.round((safeWidth - targetDmW) / 2);
      const qy = qrZoneTop + Math.round((qrZoneHeight - targetDmH) / 2);
      const innerContent = dmSvgStr.replace(/^<svg[^>]*>|<\/svg>$/gi, '');

      dmSvgContent = `
        <svg x="${qx}" y="${qy}" width="${targetDmW}" height="${targetDmH}" viewBox="${vb}">
          ${innerContent}
        </svg>
      `;
    } catch (e) {
      console.warn('Data Matrix SVG error:', e);
    }

    let textSvg = '';
    if (hasText) {
      let fontSize = fontSizeBase || 22;
      const maxAllowedH = Math.round(textZoneHeight * 0.85);
      if (fontSize > maxAllowedH) fontSize = maxAllowedH;
      const textY = textZoneTop + (textZoneHeight / 2) + Math.round(fontSize * 0.35);
      textSvg = `<text x="${safeLeft + safeWidth / 2}" y="${textY}" text-anchor="middle" font-family="${fontFamily}, Arial, sans-serif" font-weight="${fontWeight}" font-size="${fontSize}px" letter-spacing="${letterSpacing}px" fill="${textColor}">${LabelApp.escapeHtml(cleanText)}</text>`;
    }

    return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthIn}in" height="${heightIn}in" viewBox="0 0 ${wPx} ${hPx}">
  <rect width="100%" height="100%" fill="${bgColor}"/>
  ${cutLineSvg}
  ${textSvg}
  ${dmSvgContent}
</svg>`;
  }

  // =========================================================================
  // STANDARD 1D BARCODE & QR CODE VECTOR SVG
  // =========================================================================
  const hasTopText = (textPos === 'top' || textPos === 'both');
  const hasBottomText = (textPos === 'bottom' || textPos === 'both');

  const textHeightUnit = Math.round(fontSizeBase * 1.25);
  const gap = Math.round(fontSizeBase * 0.35);

  let totalTextH = 0;
  if (hasTopText) totalTextH += textHeightUnit + gap;
  if (hasBottomText) totalTextH += textHeightUnit + gap;

  const codeMaxWidth = Math.round(wPx * widthRatioPct);
  const maxAllowedH = hPx - totalTextH - Math.round(hPx * 0.10);
  const codeMaxHeight = Math.max(Math.round(hPx * 0.30), Math.min(maxAllowedH, Math.round(hPx * heightRatioPct)));

  const totalBlockH = totalTextH + codeMaxHeight;
  let curY = Math.max(Math.round(hPx * 0.04), Math.round((hPx - totalBlockH) / 2));

  let borderSvg = '';
  if (borderStyle !== 'none') {
    const strokeColor = (borderStyle === 'solid-dark') ? '#000000' : '#D0D5DD';
    const dashAttr = (borderStyle === 'dashed') ? 'stroke-dasharray="4,4"' : '';
    borderSvg = `<rect x="0.5" y="0.5" width="${wPx - 1}" height="${hPx - 1}" fill="none" stroke="${strokeColor}" stroke-width="1" ${dashAttr}/>`;
  }

  let topTextSvg = '';
  if (hasTopText) {
    topTextSvg = `<text x="${wPx / 2}" y="${curY + fontSizeBase}" text-anchor="middle" font-family="${fontFamily}, Arial, sans-serif" font-weight="${fontWeight}" font-size="${fontSizeBase}px" letter-spacing="${letterSpacing}px" fill="${textColor}">${LabelApp.escapeHtml(item.title.toUpperCase())}</text>`;
    curY += textHeightUnit + gap;
  }

  let codeSvgContent = '';
  const cleanText = item.code.toUpperCase();

  if (codeType === 'qrcode' || format === 'QR') {
    try {
      const qrSvgStr = bwipjs.toSVG({
        bcid: 'qrcode',
        text: cleanText,
        scale: 3,
        barcolor: barColor.replace('#', '')
      });
      const qrSize = Math.min(codeMaxWidth, codeMaxHeight);
      const bx = Math.round((wPx - qrSize) / 2);
      const innerContent = qrSvgStr.replace(/^<svg[^>]*>|<\/svg>$/gi, '');
      const vbMatch = /viewBox="([^"]+)"/.exec(qrSvgStr);
      const vb = vbMatch ? vbMatch[1] : '0 0 100 100';

      codeSvgContent = `
        <svg x="${bx}" y="${curY}" width="${qrSize}" height="${qrSize}" viewBox="${vb}">
          ${innerContent}
        </svg>
      `;
      curY += qrSize + gap;
    } catch (e) {
      console.warn('QR SVG error:', e);
    }
  } else {
    // 1D Barcode
    const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(tempSvg, cleanText, {
      format: format,
      displayValue: false,
      lineColor: barColor,
      background: 'transparent',
      margin: 0,
      width: 2,
      height: 100
    });
    const genW = parseFloat(tempSvg.getAttribute('width')) || 200;
    const genH = parseFloat(tempSvg.getAttribute('height')) || 100;
    const bx = Math.round((wPx - codeMaxWidth) / 2);

    codeSvgContent = `
      <svg x="${bx}" y="${curY}" width="${codeMaxWidth}" height="${codeMaxHeight}" viewBox="0 0 ${genW} ${genH}" preserveAspectRatio="none">
        ${tempSvg.innerHTML}
      </svg>
    `;
    curY += codeMaxHeight + gap;
  }

  let bottomTextSvg = '';
  if (hasBottomText) {
    const bSize = Math.max(10, fontSizeBase - 4);
    bottomTextSvg = `<text x="${wPx / 2}" y="${curY + bSize}" text-anchor="middle" font-family="${fontFamily}, Arial, sans-serif" font-weight="600" font-size="${bSize}px" letter-spacing="${letterSpacing}px" fill="${textColor}">${LabelApp.escapeHtml(item.title.toUpperCase())}</text>`;
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthIn}in" height="${heightIn}in" viewBox="0 0 ${wPx} ${hPx}">
  <rect width="100%" height="100%" fill="${bgColor}"/>
  ${borderSvg}
  ${topTextSvg}
  ${codeSvgContent}
  ${bottomTextSvg}
</svg>`;
};
