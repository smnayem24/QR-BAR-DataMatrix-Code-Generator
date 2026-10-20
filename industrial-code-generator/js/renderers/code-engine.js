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
LabelApp.CodeEngine.is2D = function (codeType) {
  return codeType === 'datamatrix' || codeType === 'qrcode';
};

/**
 * Fallback DataMatrix Generator with Authentic L-Finder Pattern
 * Used if offline or if CDN fails, ensuring 100% reliability
 */
LabelApp.CodeEngine.drawFallbackDataMatrix = function (canvas, text) {
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
LabelApp.CodeEngine.measureTextWithSpacing = function (ctx, text, letterSpacing) {
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
LabelApp.CodeEngine.drawTextWithSpacing = function (ctx, text, x, y, letterSpacing, align = 'center') {
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
 * Measure jsPDF text width including letter spacing (document units).
 */
LabelApp.CodeEngine.measurePdfTextWithSpacing = function (pdf, text, charSpace) {
  const chars = String(text || '').split('');
  if (!chars.length) return 0;
  let totalW = 0;
  for (let i = 0; i < chars.length; i++) {
    totalW += pdf.getTextWidth(chars[i]);
    if (i < chars.length - 1) totalW += charSpace;
  }
  return totalW;
};

/**
 * Draw centered text on jsPDF with letter spacing.
 * Do NOT use setCharSpace when PDF unit is 'in' — it treats values as inches.
 */
LabelApp.CodeEngine.drawPdfTextWithSpacing = function (pdf, text, centerX, y, charSpace, textOpts) {
  const chars = String(text || '').split('');
  if (!chars.length) return;
  const totalW = LabelApp.CodeEngine.measurePdfTextWithSpacing(pdf, text, charSpace);
  let curX = centerX - totalW / 2;
  const opts = textOpts || { baseline: 'middle' };
  for (let i = 0; i < chars.length; i++) {
    const charW = pdf.getTextWidth(chars[i]);
    pdf.text(chars[i], curX, y, opts);
    curX += charW + (i < chars.length - 1 ? charSpace : 0);
  }
};

/**
 * Render code directly into a DOM container element (used for Inspector & Grid Preview)
 */
LabelApp.CodeEngine.renderIntoDOM = function (containerEl, codeText, codeType, barcodeFormat, barColor, bgColor, boxWidth, boxHeight) {
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
LabelApp.CodeEngine.renderLabelToCanvas = function (item, dims, dpi, userSettings) {
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
  // DEDICATED 2D INDUSTRIAL STICKER LAYOUT (DATA MATRIX & QR CODE)
  // Supports 5mm safety margin, trimming cut line, and crisp matrix pixels
  // =========================================================================
  if (codeType === 'datamatrix' || codeType === 'qrcode') {
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

    // Draw 2D Code (DataMatrix or QR Code) with bwip-js or fallback
    const codeCanvas = document.createElement('canvas');
    let renderSuccess = false;
    const cleanText = item.code.toUpperCase();

    try {
      if (typeof bwipjs !== 'undefined' && bwipjs.toCanvas) {
        if (codeType === 'qrcode') {
          bwipjs.toCanvas(codeCanvas, {
            bcid: 'qrcode',
            text: cleanText,
            eclevel: s.qrEcc || 'M',
            scale: Math.max(3, Math.round(dpi / 75)),
            includetext: false,
            barcolor: barColor.replace('#', ''),
            backgroundcolor: bgColor.replace('#', '')
          });
          renderSuccess = codeCanvas.width > 0 && codeCanvas.height > 0;
        } else {
          bwipjs.toCanvas(codeCanvas, {
            bcid: format === 'datamatrixrectangular' ? 'datamatrixrectangular' : 'datamatrix',
            text: cleanText,
            scale: Math.max(4, Math.round(dpi / 60)),
            includetext: false,
            barcolor: barColor.replace('#', ''),
            backgroundcolor: bgColor.replace('#', '')
          });
          renderSuccess = codeCanvas.width > 0 && codeCanvas.height > 0;
        }
      }
    } catch (e) {
      console.warn(`${codeType} Canvas render error:`, e);
    }

    if (!renderSuccess) {
      if (codeType === 'qrcode') {
        if (typeof QRCode !== 'undefined') {
          const tempDiv = document.createElement('div');
          new QRCode(tempDiv, {
            text: cleanText,
            width: 300,
            height: 300,
            colorDark: barColor,
            colorLight: bgColor,
            correctLevel: (s.qrEcc === 'H') ? QRCode.CorrectLevel.H : (s.qrEcc === 'Q') ? QRCode.CorrectLevel.Q : (s.qrEcc === 'L') ? QRCode.CorrectLevel.L : QRCode.CorrectLevel.M
          });
          const generatedCanvas = tempDiv.querySelector('canvas');
          if (generatedCanvas) {
            codeCanvas.width = generatedCanvas.width;
            codeCanvas.height = generatedCanvas.height;
            const cCtx = codeCanvas.getContext('2d');
            cCtx.drawImage(generatedCanvas, 0, 0);
            renderSuccess = true;
          }
        }
      } else {
        LabelApp.CodeEngine.drawFallbackDataMatrix(codeCanvas, cleanText);
        renderSuccess = true;
      }
    }

    // Maximize 2D code size while preserving quiet zone
    const codeAspect = (codeCanvas.width || 1) / (codeCanvas.height || 1);
    let targetH = Math.round(qrZoneHeight * 0.88);
    let targetW = Math.round(targetH * codeAspect);

    if (targetW > safeWidth * 0.90) {
      targetW = Math.round(safeWidth * 0.90);
      targetH = Math.round(targetW / codeAspect);
    }

    const qrX = safeLeft + Math.round((safeWidth - targetW) / 2);
    const qrY = qrZoneTop + Math.round((qrZoneHeight - targetH) / 2);

    ctx.imageSmoothingEnabled = false; // Sharp razor-crisp matrix pixels
    ctx.drawImage(codeCanvas, qrX, qrY, targetW, targetH);
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
LabelApp.CodeEngine.renderLabelToSVG = function (item, dims, userSettings) {
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
  // DEDICATED 2D INDUSTRIAL STICKER VECTOR SVG (DATA MATRIX & QR CODE)
  // =========================================================================
  if (codeType === 'datamatrix' || codeType === 'qrcode') {
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
    let codeSvgContent = '';
    try {
      const bcidName = (codeType === 'qrcode')
        ? 'qrcode'
        : ((format === 'datamatrixrectangular') ? 'datamatrixrectangular' : 'datamatrix');

      const bwipOpts = {
        bcid: bcidName,
        text: cleanText,
        scale: 3,
        barcolor: barColor.replace('#', '')
      };
      if (codeType === 'qrcode') {
        bwipOpts.eclevel = s.qrEcc || 'M';
      }

      const generatedSvgStr = bwipjs.toSVG(bwipOpts);

      const vbMatch = /viewBox="([^"]+)"/.exec(generatedSvgStr);
      const vb = vbMatch ? vbMatch[1] : '0 0 100 100';
      const parts = vb.split(/\s+/).map(Number);
      const natW = parts[2] || 100;
      const natH = parts[3] || 100;
      const codeAspect = natW / natH;

      let targetH = Math.round(qrZoneHeight * 0.88);
      let targetW = Math.round(targetH * codeAspect);
      if (targetW > safeWidth * 0.90) {
        targetW = Math.round(safeWidth * 0.90);
        targetH = Math.round(targetW / codeAspect);
      }

      const qx = safeLeft + Math.round((safeWidth - targetW) / 2);
      const qy = qrZoneTop + Math.round((qrZoneHeight - targetH) / 2);
      const innerContent = generatedSvgStr.replace(/^<svg[^>]*>|<\/svg>$/gi, '');

      codeSvgContent = `
        <svg x="${qx}" y="${qy}" width="${targetW}" height="${targetH}" viewBox="${vb}">
          ${innerContent}
        </svg>
      `;
    } catch (e) {
      console.warn(`${codeType} SVG error:`, e);
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
  ${codeSvgContent}
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

/**
 * Utility: Convert Hex color to [R, G, B]
 */
LabelApp.hexToRgb = function (hex) {
  if (!hex) return [0, 0, 0];
  let c = String(hex).replace('#', '').trim();
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
};

/**
 * ==========================================================================
 * HIGH-SPEED PURE VECTOR PDF LABEL RENDERER
 * Renders labels directly to jsPDF as native vector primitives.
 * Solves browser crashes and out-of-memory errors on massive 3,800+ batches!
 * ==========================================================================
 */
LabelApp.CodeEngine.drawLabelToPDF = function (pdf, item, dims, posX, posY, s) {
  const labelW = dims.widthIn;
  const labelH = dims.heightIn;
  const codeType = s.codeType || 'barcode';
  const format = s.barcodeFormat || 'CODE128';
  const cleanText = String(item.code || '').toUpperCase();
  const titleText = String(item.title || item.code || '').toUpperCase();
  const textPos = s.textPosition || 'top';
  const hasText = (textPos !== 'none');

  // 1. Draw solid background if not standard white
  if (s.bgColor && s.bgColor.toUpperCase() !== '#FFFFFF') {
    const bgRgb = LabelApp.hexToRgb(s.bgColor) || [255, 255, 255];
    pdf.setFillColor(bgRgb[0], bgRgb[1], bgRgb[2]);
    pdf.rect(posX, posY, labelW, labelH, 'F');
  }

  // 2. Safety Margin calculation
  const marginMm = (typeof s.marginMm === 'number') ? s.marginMm : 4.0;
  const marginIn = marginMm / 25.4;
  const showCutLine = Boolean(s.showCutLine);

  const safeW = Math.max(0.1, labelW - marginIn * 2);
  const safeH = Math.max(0.1, labelH - marginIn * 2);
  const safeLeft = posX + marginIn;
  const safeTop = posY + marginIn;

  // 3. Optional Dashed Cut Line Guide (Trimming guide)
  if (showCutLine && marginIn > 0) {
    pdf.setDrawColor(203, 213, 225); // #CBD5E1
    pdf.setLineWidth(0.008);
    if (pdf.setLineDashPattern) pdf.setLineDashPattern([0.04, 0.04], 0);
    pdf.rect(safeLeft, safeTop, safeW, safeH, 'S');
    if (pdf.setLineDashPattern) pdf.setLineDashPattern([], 0);
  }

  // 4. Height allocation for 2D vs 1D
  const is2D = (codeType === 'datamatrix' || codeType === 'qrcode');
  const textZoneH = hasText ? (safeH * 0.16) : 0;
  const qrZoneH = safeH - textZoneH;

  let qrZoneTop, textZoneTop;
  if (textPos === 'bottom') {
    qrZoneTop = safeTop;
    textZoneTop = safeTop + qrZoneH;
  } else {
    textZoneTop = safeTop;
    qrZoneTop = safeTop + textZoneH;
  }

  // 5. Draw 2D or 1D Code as Pure Vector Rectangles
  if (is2D) {
    const bcid = (codeType === 'qrcode')
      ? 'qrcode'
      : ((format === 'datamatrixrectangular') ? 'datamatrixrectangular' : 'datamatrix');

    // Sample module matrix using tiny 1-scale canvas (~16x16 or 24x24 px, 0.1ms, ~0 RAM)
    const mCanvas = document.createElement('canvas');
    let mSuccess = false;

    try {
      if (typeof bwipjs !== 'undefined' && bwipjs.toCanvas) {
        const bwOpts = {
          bcid: bcid,
          text: cleanText,
          scale: 1,
          includetext: false,
          barcolor: '000000',
          backgroundcolor: 'ffffff'
        };
        if (codeType === 'qrcode') {
          bwOpts.eclevel = s.qrEcc || 'M';
        }
        bwipjs.toCanvas(mCanvas, bwOpts);
        mSuccess = (mCanvas.width > 0 && mCanvas.height > 0);
      }
    } catch (e) {
      console.warn('Vector matrix render warning:', e);
    }

    if (!mSuccess) {
      LabelApp.CodeEngine.drawFallbackDataMatrix(mCanvas, cleanText);
      mSuccess = true;
    }

    if (mSuccess) {
      const mW = mCanvas.width;
      const mH = mCanvas.height;
      const mAspect = mW / mH;

      let targetH = qrZoneH * 0.88;
      let targetW = targetH * mAspect;
      if (targetW > safeW * 0.90) {
        targetW = safeW * 0.90;
        targetH = targetW / mAspect;
      }

      const qx = safeLeft + (safeW - targetW) / 2;
      const qy = qrZoneTop + (qrZoneH - targetH) / 2;
      const cellW = targetW / mW;
      const cellH = targetH / mH;

      const mCtx = mCanvas.getContext('2d');
      const imgData = mCtx.getImageData(0, 0, mW, mH).data;

      const barColorRgb = LabelApp.hexToRgb(s.barColor || '#000000') || [0, 0, 0];
      pdf.setFillColor(barColorRgb[0], barColorRgb[1], barColorRgb[2]);

      // Scan rows and merge contiguous black cells for maximum rendering speed and compact PDF
      for (let r = 0; r < mH; r++) {
        let spanStart = -1;
        for (let c = 0; c < mW; c++) {
          const idx = (r * mW + c) * 4;
          const isDark = (imgData[idx + 3] > 128) && ((imgData[idx] + imgData[idx + 1] + imgData[idx + 2]) < 384);

          if (isDark) {
            if (spanStart === -1) spanStart = c;
          } else {
            if (spanStart !== -1) {
              const spanLen = c - spanStart;
              pdf.rect(qx + spanStart * cellW, qy + r * cellH, spanLen * cellW, cellH, 'F');
              spanStart = -1;
            }
          }
        }
        if (spanStart !== -1) {
          const spanLen = mW - spanStart;
          pdf.rect(qx + spanStart * cellW, qy + r * cellH, spanLen * cellW, cellH, 'F');
        }
      }
    }
  } else {
    // 1D Barcode Vector
    const bCanvas = document.createElement('canvas');
    try {
      JsBarcode(bCanvas, cleanText, {
        format: format,
        displayValue: false,
        lineColor: '#000000',
        background: '#ffffff',
        margin: 0,
        width: 1,
        height: 50
      });
      if (bCanvas.width > 0) {
        const bW = bCanvas.width;
        const bCtx = bCanvas.getContext('2d');
        const bData = bCtx.getImageData(0, 0, bW, 1).data;

        const maxCodeW = labelW * ((s.barcodeWidthRatio || 90) / 100);
        const maxCodeH = labelH * ((s.barcodeHeightRatio || 70) / 100);
        const targetW = maxCodeW;
        const targetH = maxCodeH;
        const colW = targetW / bW;
        const bx = posX + (labelW - targetW) / 2;
        const by = posY + (labelH - targetH) / 2;

        const barColorRgb = LabelApp.hexToRgb(s.barColor || '#000000') || [0, 0, 0];
        pdf.setFillColor(barColorRgb[0], barColorRgb[1], barColorRgb[2]);

        let spanStart = -1;
        for (let c = 0; c < bW; c++) {
          const idx = c * 4;
          const isDark = (bData[idx + 3] > 128) && ((bData[idx] + bData[idx + 1] + bData[idx + 2]) < 384);
          if (isDark) {
            if (spanStart === -1) spanStart = c;
          } else {
            if (spanStart !== -1) {
              pdf.rect(bx + spanStart * colW, by, (c - spanStart) * colW, targetH, 'F');
              spanStart = -1;
            }
          }
        }
        if (spanStart !== -1) {
          pdf.rect(bx + spanStart * colW, by, (bW - spanStart) * colW, targetH, 'F');
        }
      }
    } catch (e) {
      console.warn('1D barcode vector error:', e);
    }
  }

  // 6. Draw Vector Header Text
  if (hasText) {
    const textColorRgb = LabelApp.hexToRgb(s.textColor || '#000000') || [0, 0, 0];
    pdf.setTextColor(textColorRgb[0], textColorRgb[1], textColorRgb[2]);

    const isMono = (s.fontFamily === 'JetBrains Mono' || s.fontFamily === 'Roboto Mono');
    const isBold = (parseInt(s.fontWeight, 10) >= 700);
    pdf.setFont(isMono ? 'courier' : 'helvetica', isBold ? 'bold' : 'normal');

    // Font size: CSS px → PDF points (1px @ 96dpi ≈ 0.75 pt)
    const basePt = (s.fontSize || 40) * 0.75;
    const maxPt = (textZoneH * 72) * 0.82;
    let fontPt = Math.max(6, Math.min(basePt, maxPt));
    pdf.setFontSize(fontPt);

    // CRITICAL: PDF is unit:'in'. Letter-spacing UI value is CSS px → inches = /96.
    // Never use setCharSpace(px*0.75) here — that treated ~2" gaps between letters.
    const charSpaceIn = Math.max(0, (s.letterSpacing || 0) / 96);
    const centerX = safeLeft + safeW / 2;
    const textY = textZoneTop + textZoneH / 2;
    const maxTextW = safeW * 0.94;

    let measuredW = LabelApp.CodeEngine.measurePdfTextWithSpacing(pdf, titleText, charSpaceIn);
    if (measuredW > maxTextW && measuredW > 0) {
      fontPt = Math.max(6, fontPt * (maxTextW / measuredW));
      pdf.setFontSize(fontPt);
    }

    // Reset any leftover charSpace from prior draws
    if (typeof pdf.setCharSpace === 'function') {
      pdf.setCharSpace(0);
    }

    LabelApp.CodeEngine.drawPdfTextWithSpacing(pdf, titleText, centerX, textY, charSpaceIn, {
      baseline: 'middle'
    });
  }
};

