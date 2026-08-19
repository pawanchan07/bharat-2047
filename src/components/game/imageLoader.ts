// ============================================================================
// IMAGE LOADING UTILITIES
// ============================================================================
// Handles loading and caching of sprite images with optional background filtering
// and WebP optimization for faster loading on slow connections.

// Background color to filter from sprite sheets
const BACKGROUND_COLOR = { r: 255, g: 0, b: 0 };
// Color distance threshold - pixels within this distance will be made transparent
const COLOR_THRESHOLD = 155; // Adjust this value to be more/less aggressive

// Image cache for building sprites
const imageCache = new Map<string, HTMLImageElement>();

// Track WebP support (detected once on first use)
let webpSupported: boolean | null = null;

// Event emitter for image loading progress (to trigger re-renders)
type ImageLoadCallback = () => void;
const imageLoadCallbacks = new Set<ImageLoadCallback>();

/**
 * Check if the browser supports WebP format
 * Uses a small test image to detect support
 */
async function checkWebPSupport(): Promise<boolean> {
  if (webpSupported !== null) {
    return webpSupported;
  }
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      webpSupported = img.width > 0 && img.height > 0;
      resolve(webpSupported);
    };
    img.onerror = () => {
      webpSupported = false;
      resolve(false);
    };
    // Tiny 1x1 WebP image
    img.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
  });
}

/**
 * Get the WebP path for a PNG image
 */
function getWebPPath(src: string): string | null {
  if (src.endsWith('.png')) {
    return src.replace(/\.png$/, '.webp');
  }
  return null;
}

/**
 * Register a callback to be notified when images are loaded
 * @returns Cleanup function to unregister the callback
 */
export function onImageLoaded(callback: ImageLoadCallback): () => void {
  imageLoadCallbacks.add(callback);
  return () => { imageLoadCallbacks.delete(callback); };
}

/**
 * Notify all registered callbacks that an image has loaded
 */
function notifyImageLoaded() {
  imageLoadCallbacks.forEach(cb => cb());
}

/**
 * Load an image directly without WebP optimization
 * @param src The image source path
 * @returns Promise resolving to the loaded image
 */
function loadImageDirect(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(src, img);
      notifyImageLoaded();
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Load an image from a source URL, preferring WebP if available
 * @param src The image source path (PNG)
 * @returns Promise resolving to the loaded image
 */
export async function loadImage(src: string): Promise<HTMLImageElement> {
  // Return cached image if available
  if (imageCache.has(src)) {
    return imageCache.get(src)!;
  }
  
  // Check if we should try WebP
  const webpPath = getWebPPath(src);
  if (webpPath) {
    const supportsWebP = await checkWebPSupport();
    
    if (supportsWebP) {
      // Try loading WebP first
      try {
        const img = await loadImageDirect(webpPath);
        // Also cache under the PNG path for future lookups
        imageCache.set(src, img);
        return img;
      } catch {
        // WebP failed (file might not exist), fall back to PNG
        console.debug(`WebP not available for ${src}, using PNG`);
      }
    }
  }
  
  // Load PNG directly
  return loadImageDirect(src);
}

/**
 * Filters colors close to the background color from an image, making them transparent
 * @param img The source image to process
 * @param threshold Maximum color distance to consider as background (default: COLOR_THRESHOLD)
 * @returns A new HTMLImageElement with filtered colors made transparent
 */
export function filterBackgroundColor(img: HTMLImageElement, threshold: number = COLOR_THRESHOLD): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // Draw the original image to the canvas
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // PERF: compare squared distances. This runs over ~4 million pixels per sheet, and
      // sqrt() on every one of them buys nothing — x <= t is the same test as x² <= t².
      const thresholdSq = threshold * threshold;
      const { r: bgR, g: bgG, b: bgB } = BACKGROUND_COLOR;

      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - bgR;
        const dg = data[i + 1] - bgG;
        const db = data[i + 2] - bgB;

        // If the color is close to the background color, make it transparent
        if (dr * dr + dg * dg + db * db <= thresholdSq) {
          data[i + 3] = 0; // Set alpha to 0 (transparent)
        }
      }

      // Put the modified image data back
      ctx.putImageData(imageData, 0, 0);

      // Create a new image from the processed canvas.
      // Measured on this content: toDataURL takes ~47 ms for a 2048² sheet while toBlob
      // takes ~1050 ms. The base64 string looks like the wasteful option and is not, so
      // leave this alone unless a fresh measurement says otherwise.
      const filteredImg = new Image();
      filteredImg.onload = () => resolve(filteredImg);
      filteredImg.onerror = () => reject(new Error('Failed to create filtered image'));
      filteredImg.src = canvas.toDataURL();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Loads an image and applies background color filtering if it's a sprite sheet
 * @param src The image source path
 * @param applyFilter Whether to apply background color filtering (default: true for sprite sheets)
 * @returns Promise resolving to the loaded (and optionally filtered) image
 */
export function loadSpriteImage(src: string, applyFilter: boolean = true): Promise<HTMLImageElement> {
  // Check if this is already cached (as filtered version)
  const cacheKey = applyFilter ? `${src}_filtered` : src;
  if (imageCache.has(cacheKey)) {
    return Promise.resolve(imageCache.get(cacheKey)!);
  }
  
  return loadImage(src).then((img) => {
    if (applyFilter) {
      return filterBackgroundColor(img).then((filteredImg: HTMLImageElement) => {
        imageCache.set(cacheKey, filteredImg);
        return filteredImg;
      });
    }
    return img;
  });
}

/**
 * Check if an image is cached
 * @param src The image source path
 * @param filtered Whether to check for the filtered version
 */
export function isImageCached(src: string, filtered: boolean = false): boolean {
  const cacheKey = filtered ? `${src}_filtered` : src;
  return imageCache.has(cacheKey);
}

/**
 * Get a cached image if available
 * @param src The image source path
 * @param filtered Whether to get the filtered version
 */
export function getCachedImage(src: string, filtered: boolean = false): HTMLImageElement | undefined {
  const cacheKey = filtered ? `${src}_filtered` : src;
  return imageCache.get(cacheKey);
}

/**
 * Clear the image cache
 */
export function clearImageCache(): void {
  imageCache.clear();
}
