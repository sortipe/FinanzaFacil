export interface QualityMetric {
  ok: boolean;
  score: number;
  message: string;
}

export interface QualityReport {
  overallOk: boolean;
  blur: QualityMetric;
  brightness: QualityMetric;
  contrast: QualityMetric;
  resolution: QualityMetric;
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function computeGrayscale(data: Uint8ClampedArray, pixels: number): Float64Array {
  const gray = new Float64Array(pixels);
  for (let i = 0; i < pixels; i++) {
    const idx = i * 4;
    gray[i] = luminance(data[idx], data[idx + 1], data[idx + 2]);
  }
  return gray;
}

function checkBlur(gray: Float64Array, width: number, height: number): QualityMetric {
  const w = width;
  const h = height;
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const laplacian =
        -4 * gray[idx] +
        gray[idx - 1] + gray[idx + 1] +
        gray[idx - w] + gray[idx + w];
      sum += laplacian;
      sumSq += laplacian * laplacian;
      count++;
    }
  }

  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  const score = Math.round(variance);

  if (score > 150) {
    return { ok: true, score, message: 'Imagen nítida' };
  } else if (score > 80) {
    return { ok: true, score, message: 'Nitidez aceptable' };
  } else {
    return { ok: false, score, message: 'Foto borrosa — sostén el celular firme al tomar la foto' };
  }
}

function checkBrightness(gray: Float64Array): QualityMetric {
  let sum = 0;
  let min = 255;
  let max = 0;
  const len = gray.length;

  for (let i = 0; i < len; i++) {
    const v = gray[i];
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const avg = Math.round(sum / len);

  if (avg >= 60 && avg <= 200) {
    return { ok: true, score: avg, message: 'Brillo adecuado' };
  } else if (avg < 60) {
    return { ok: false, score: avg, message: 'Foto muy oscura — busca mejor iluminación' };
  } else {
    return { ok: false, score: avg, message: 'Foto muy clara — evita.flash o luz directa' };
  }
}

function checkContrast(gray: Float64Array): QualityMetric {
  let sum = 0;
  const len = gray.length;
  for (let i = 0; i < len; i++) sum += gray[i];
  const mean = sum / len;

  let sumSqDiff = 0;
  for (let i = 0; i < len; i++) {
    const diff = gray[i] - mean;
    sumSqDiff += diff * diff;
  }
  const stddev = Math.round(Math.sqrt(sumSqDiff / len));

  if (stddev > 40) {
    return { ok: true, score: stddev, message: 'Contraste adecuado' };
  } else if (stddev > 25) {
    return { ok: true, score: stddev, message: 'Contraste aceptable' };
  } else {
    return { ok: false, score: stddev, message: 'Contraste bajo — el texto puede no ser legible' };
  }
}

function checkResolution(width: number, height: number): QualityMetric {
  const minDim = Math.min(width, height);

  if (width >= 800 && height >= 600) {
    return { ok: true, score: minDim, message: 'Resolución adecuada' };
  } else if (width >= 500 && height >= 400) {
    return { ok: true, score: minDim, message: 'Resolución aceptable' };
  } else {
    return {
      ok: false,
      score: minDim,
      message: `Resolución muy baja (${width}×${height}) — usa la cámara trasera`,
    };
  }
}

export async function analyzeImageQuality(
  base64Image: string,
  mimeType: string
): Promise<QualityReport> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let { width, height } = img;

      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = width * height;
      const gray = computeGrayscale(imageData.data, pixels);

      const blur = checkBlur(gray, width, height);
      const brightness = checkBrightness(gray);
      const contrast = checkContrast(gray);
      const resolution = checkResolution(img.naturalWidth, img.naturalHeight);

      const overallOk = blur.ok && brightness.ok && contrast.ok && resolution.ok;

      resolve({ overallOk, blur, brightness, contrast, resolution });
    };

    img.onerror = () => {
      resolve({
        overallOk: false,
        blur: { ok: false, score: 0, message: 'No se pudo cargar la imagen' },
        brightness: { ok: false, score: 0, message: '' },
        contrast: { ok: false, score: 0, message: '' },
        resolution: { ok: false, score: 0, message: '' },
      });
    };

    img.src = `data:${mimeType};base64,${base64Image}`;
  });
}
