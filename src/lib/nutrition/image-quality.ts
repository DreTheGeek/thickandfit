// K2: Image quality gate — cheap client-side check that runs on the already-downscaled scan image
// before we spend a vision-model round-trip on a photo that is too dark or too blurry to identify
// food from. The goal is not a hard block; it is to give the member ONE chance to retake before we
// return them a confidently wrong answer.
//
// Method (kept fast on phones — samples the center 256x256 region, stride 2, ~30k pixels processed):
//   * brightness: mean luminance across the sample (0-255 grayscale).
//   * sharpness: variance of a 4-neighbor Laplacian on the same sample — motion-blurred images
//     collapse the Laplacian toward zero, so a low variance is a strong blur signal.
// Thresholds are conservative: only clearly bad shots trigger the warning, so the false-positive
// rate stays low and the flow is not interrupted for normal handheld photos.

export type ImageQuality = {
  brightness: number; // 0-255 mean luminance
  sharpness: number; // Laplacian variance on the sampled region
  tooDark: boolean;
  tooBright: boolean;
  tooBlurry: boolean;
  lowQuality: boolean; // any of the above
};

// Empirical thresholds. Loose on purpose — cratered brightness AND obvious motion blur trigger,
// nothing marginal. Tune from real telemetry once K6 wires an accuracy time series.
const DARK_THRESHOLD = 40; // mean luminance below this is very underexposed
const BRIGHT_THRESHOLD = 240; // above this the plate is blown out (glare / flash)
const BLUR_THRESHOLD = 60; // Laplacian variance below this is heavy motion or focus blur

const SAMPLE_SIDE = 256;

/**
 * Measure quality of a data URL image (JPEG/PNG). Returns null if the image cannot be measured
 * (browser too old, canvas 2D context missing, or non-image data URL). A null return means the
 * caller should NOT block — it is a graceful degradation, not a fail-closed rule.
 */
export async function measureImageQuality(dataUrl: string): Promise<ImageQuality | null> {
  if (typeof window === 'undefined') return null;
  try {
    const img = await loadImage(dataUrl);
    // Sample the center square: it is where the food usually is, and avoids letterboxing / hand.
    const side = Math.min(SAMPLE_SIDE, img.width, img.height);
    const sx = Math.max(0, Math.floor((img.width - side) / 2));
    const sy = Math.max(0, Math.floor((img.height - side) / 2));
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, side, side);
    const { data } = ctx.getImageData(0, 0, side, side);

    // First pass: grayscale into a flat array + mean luminance. Rec. 709 coefficients.
    const gray = new Float32Array(side * side);
    let sum = 0;
    for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
      const g = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      gray[j] = g;
      sum += g;
    }
    const brightness = sum / gray.length;

    // Second pass: 4-neighbor Laplacian with stride 2 (skip odd rows/cols — cuts work 4x).
    // Variance of |L| is the sharpness proxy; blurred images have tiny Laplacian everywhere.
    let lapSum = 0;
    let lapSqSum = 0;
    let lapCount = 0;
    for (let y = 2; y < side - 2; y += 2) {
      for (let x = 2; x < side - 2; x += 2) {
        const idx = y * side + x;
        const l =
          4 * gray[idx] -
          gray[idx - 1] -
          gray[idx + 1] -
          gray[idx - side] -
          gray[idx + side];
        lapSum += l;
        lapSqSum += l * l;
        lapCount += 1;
      }
    }
    const lapMean = lapCount > 0 ? lapSum / lapCount : 0;
    const sharpness = lapCount > 0 ? lapSqSum / lapCount - lapMean * lapMean : 0;

    const tooDark = brightness < DARK_THRESHOLD;
    const tooBright = brightness > BRIGHT_THRESHOLD;
    const tooBlurry = sharpness < BLUR_THRESHOLD;
    return {
      brightness,
      sharpness,
      tooDark,
      tooBright,
      tooBlurry,
      lowQuality: tooDark || tooBright || tooBlurry,
    };
  } catch {
    return null;
  }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = dataUrl;
  });
}
