/**
 * WebGPU Compute Shaders for Image Processing
 * 
 * Progressive enhancement for high-performance image processing:
 * - Grayscale conversion
 * - Contrast enhancement
 * - Adaptive thresholding
 * - Gaussian blur
 * 
 * Falls back to WASM/JS when WebGPU is not available.
 */

// Types
export interface WebGPUCapabilities {
  available: boolean;
  adapter: GPUAdapter | null;
  device: GPUDevice | null;
  maxWorkgroupSize: number;
  maxBufferSize: number;
}

// Shader code
const GRAYSCALE_SHADER = `
@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
@group(0) @binding(2) var<uniform> dimensions: vec2<u32>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;
    let width = dimensions.x;
    let height = dimensions.y;
    
    if (x >= width || y >= height) {
        return;
    }
    
    let idx = y * width + x;
    let pixel = input[idx];
    
    // Extract RGBA
    let r = f32((pixel >> 0u) & 0xFFu);
    let g = f32((pixel >> 8u) & 0xFFu);
    let b = f32((pixel >> 16u) & 0xFFu);
    let a = (pixel >> 24u) & 0xFFu;
    
    // Luminance formula: 0.299*R + 0.587*G + 0.114*B
    let gray = u32(0.299 * r + 0.587 * g + 0.114 * b);
    
    // Pack back to RGBA
    output[idx] = gray | (gray << 8u) | (gray << 16u) | (a << 24u);
}
`;

const CONTRAST_SHADER = `
@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
@group(0) @binding(2) var<uniform> params: vec4<f32>; // x=width, y=height, z=factor, w=unused

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;
    let width = u32(params.x);
    let height = u32(params.y);
    let factor = params.z;
    
    if (x >= width || y >= height) {
        return;
    }
    
    let idx = y * width + x;
    let pixel = input[idx];
    
    // Extract RGBA
    let r = f32((pixel >> 0u) & 0xFFu);
    let g = f32((pixel >> 8u) & 0xFFu);
    let b = f32((pixel >> 16u) & 0xFFu);
    let a = (pixel >> 24u) & 0xFFu;
    
    // Contrast adjustment: mid + (pixel - mid) * factor
    let mid = 128.0;
    let new_r = clamp(mid + (r - mid) * factor, 0.0, 255.0);
    let new_g = clamp(mid + (g - mid) * factor, 0.0, 255.0);
    let new_b = clamp(mid + (b - mid) * factor, 0.0, 255.0);
    
    // Pack back to RGBA
    output[idx] = u32(new_r) | (u32(new_g) << 8u) | (u32(new_b) << 16u) | (a << 24u);
}
`;

const THRESHOLD_SHADER = `
@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read> integral: array<u32>;
@group(0) @binding(2) var<storage, read_write> output: array<u32>;
@group(0) @binding(3) var<uniform> params: vec4<f32>; // x=width, y=height, z=blockSize, w=c

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;
    let width = u32(params.x);
    let height = u32(params.y);
    let blockSize = i32(params.z);
    let c = i32(params.w);
    
    if (x >= width || y >= height) {
        return;
    }
    
    let half = blockSize / 2;
    let x1 = max(0, i32(x) - half);
    let y1 = max(0, i32(y) - half);
    let x2 = min(i32(width) - 1, i32(x) + half);
    let y2 = min(i32(height) - 1, i32(y) + half);
    
    // Get sum from integral image
    let d = integral[u32(y2) * width + u32(x2)];
    var a = 0u;
    var b = 0u;
    var cc = 0u;
    
    if (x1 > 0 && y1 > 0) {
        a = integral[u32(y1 - 1) * width + u32(x1 - 1)];
    }
    if (y1 > 0) {
        b = integral[u32(y1 - 1) * width + u32(x2)];
    }
    if (x1 > 0) {
        cc = integral[u32(y2) * width + u32(x1 - 1)];
    }
    
    let sum = d + a - b - cc;
    let count = u32((x2 - x1 + 1) * (y2 - y1 + 1));
    let mean = i32(sum / count);
    let threshold = mean - c;
    
    let idx = y * width + x;
    let pixel = input[idx];
    let gray = i32((pixel >> 0u) & 0xFFu);
    let alpha = (pixel >> 24u) & 0xFFu;
    
    var value = 0u;
    if (gray > threshold) {
        value = 255u;
    }
    
    output[idx] = value | (value << 8u) | (value << 16u) | (alpha << 24u);
}
`;

const GAUSSIAN_BLUR_SHADER = `
@group(0) @binding(0) var<storage, read> input: array<u32>;
@group(0) @binding(1) var<storage, read_write> output: array<u32>;
@group(0) @binding(2) var<uniform> params: vec4<f32>; // x=width, y=height, z=sigma, w=unused

// 5x5 Gaussian kernel (precomputed for sigma=1.0)
const kernel = array<f32, 25>(
    0.003765, 0.015019, 0.023792, 0.015019, 0.003765,
    0.015019, 0.059912, 0.094907, 0.059912, 0.015019,
    0.023792, 0.094907, 0.150342, 0.094907, 0.023792,
    0.015019, 0.059912, 0.094907, 0.059912, 0.015019,
    0.003765, 0.015019, 0.023792, 0.015019, 0.003765
);

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;
    let width = u32(params.x);
    let height = u32(params.y);
    
    if (x >= width || y >= height) {
        return;
    }
    
    var sum_r = 0.0;
    var sum_g = 0.0;
    var sum_b = 0.0;
    var sum_weight = 0.0;
    
    for (var ky = 0; ky < 5; ky++) {
        for (var kx = 0; kx < 5; kx++) {
            let nx = i32(x) + kx - 2;
            let ny = i32(y) + ky - 2;
            
            if (nx >= 0 && nx < i32(width) && ny >= 0 && ny < i32(height)) {
                let nidx = u32(ny) * width + u32(nx);
                let pixel = input[nidx];
                let weight = kernel[ky * 5 + kx];
                
                sum_r += f32((pixel >> 0u) & 0xFFu) * weight;
                sum_g += f32((pixel >> 8u) & 0xFFu) * weight;
                sum_b += f32((pixel >> 16u) & 0xFFu) * weight;
                sum_weight += weight;
            }
        }
    }
    
    let idx = y * width + x;
    let alpha = (input[idx] >> 24u) & 0xFFu;
    
    let r = u32(clamp(sum_r / sum_weight, 0.0, 255.0));
    let g = u32(clamp(sum_g / sum_weight, 0.0, 255.0));
    let b = u32(clamp(sum_b / sum_weight, 0.0, 255.0));
    
    output[idx] = r | (g << 8u) | (b << 16u) | (alpha << 24u);
}
`;

// WebGPU Processor class
export class WebGPUProcessor {
  private device: GPUDevice | null = null;
  private adapter: GPUAdapter | null = null;
  private pipelines: Map<string, GPUComputePipeline> = new Map();
  private initialized = false;

  /**
   * Check if WebGPU is available
   */
  static async isAvailable(): Promise<boolean> {
    if (!navigator.gpu) {
      return false;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  /**
   * Initialize WebGPU
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    if (!navigator.gpu) {
      console.warn('[WebGPU] Not supported in this browser');
      return false;
    }

    try {
      this.adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (!this.adapter) {
        console.warn('[WebGPU] No adapter found');
        return false;
      }

      this.device = await this.adapter.requestDevice({
        requiredLimits: {
          maxStorageBufferBindingSize: 256 * 1024 * 1024, // 256MB
        },
      });

      // Create pipelines
      await this.createPipeline('grayscale', GRAYSCALE_SHADER);
      await this.createPipeline('contrast', CONTRAST_SHADER);
      await this.createPipeline('threshold', THRESHOLD_SHADER);
      await this.createPipeline('blur', GAUSSIAN_BLUR_SHADER);

      this.initialized = true;
      console.log('[WebGPU] Initialized successfully');
      return true;
    } catch (error) {
      console.error('[WebGPU] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Create a compute pipeline
   */
  private async createPipeline(name: string, shaderCode: string): Promise<void> {
    if (!this.device) return;

    const shaderModule = this.device.createShaderModule({
      code: shaderCode,
    });

    const pipeline = this.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'main',
      },
    });

    this.pipelines.set(name, pipeline);
  }

  /**
   * Convert image to grayscale using GPU
   */
  async toGrayscale(imageData: ImageData): Promise<ImageData> {
    if (!this.device || !this.initialized) {
      return this.fallbackGrayscale(imageData);
    }

    const pipeline = this.pipelines.get('grayscale');
    if (!pipeline) {
      return this.fallbackGrayscale(imageData);
    }

    try {
      const { width, height, data } = imageData;
      const pixelCount = width * height;

      // Convert RGBA bytes to u32 array
      const inputData = new Uint32Array(data.buffer);

      // Create buffers
      const inputBuffer = this.device.createBuffer({
        size: pixelCount * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      const outputBuffer = this.device.createBuffer({
        size: pixelCount * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });

      const dimensionsBuffer = this.device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const readBuffer = this.device.createBuffer({
        size: pixelCount * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      // Write data
      this.device.queue.writeBuffer(inputBuffer, 0, inputData);
      this.device.queue.writeBuffer(dimensionsBuffer, 0, new Uint32Array([width, height]));

      // Create bind group
      const bindGroup = this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inputBuffer } },
          { binding: 1, resource: { buffer: outputBuffer } },
          { binding: 2, resource: { buffer: dimensionsBuffer } },
        ],
      });

      // Dispatch
      const commandEncoder = this.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
      passEncoder.end();

      // Copy result
      commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, pixelCount * 4);
      this.device.queue.submit([commandEncoder.finish()]);

      // Read result
      await readBuffer.mapAsync(GPUMapMode.READ);
      const resultData = new Uint32Array(readBuffer.getMappedRange().slice(0));
      readBuffer.unmap();

      // Convert back to ImageData
      const resultBytes = new Uint8ClampedArray(resultData.buffer);
      return new ImageData(resultBytes, width, height);
    } catch (error) {
      console.error('[WebGPU] Grayscale failed, using fallback:', error);
      return this.fallbackGrayscale(imageData);
    }
  }

  /**
   * Enhance contrast using GPU
   */
  async enhanceContrast(imageData: ImageData, factor: number = 1.5): Promise<ImageData> {
    if (!this.device || !this.initialized) {
      return this.fallbackContrast(imageData, factor);
    }

    const pipeline = this.pipelines.get('contrast');
    if (!pipeline) {
      return this.fallbackContrast(imageData, factor);
    }

    try {
      const { width, height, data } = imageData;
      const pixelCount = width * height;

      const inputData = new Uint32Array(data.buffer);

      const inputBuffer = this.device.createBuffer({
        size: pixelCount * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      const outputBuffer = this.device.createBuffer({
        size: pixelCount * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });

      const paramsBuffer = this.device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const readBuffer = this.device.createBuffer({
        size: pixelCount * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      this.device.queue.writeBuffer(inputBuffer, 0, inputData);
      this.device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([width, height, factor, 0]));

      const bindGroup = this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inputBuffer } },
          { binding: 1, resource: { buffer: outputBuffer } },
          { binding: 2, resource: { buffer: paramsBuffer } },
        ],
      });

      const commandEncoder = this.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
      passEncoder.end();

      commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, pixelCount * 4);
      this.device.queue.submit([commandEncoder.finish()]);

      await readBuffer.mapAsync(GPUMapMode.READ);
      const resultData = new Uint32Array(readBuffer.getMappedRange().slice(0));
      readBuffer.unmap();

      const resultBytes = new Uint8ClampedArray(resultData.buffer);
      return new ImageData(resultBytes, width, height);
    } catch (error) {
      console.error('[WebGPU] Contrast failed, using fallback:', error);
      return this.fallbackContrast(imageData, factor);
    }
  }

  /**
   * Apply Gaussian blur using GPU
   */
  async gaussianBlur(imageData: ImageData, sigma: number = 1.0): Promise<ImageData> {
    if (!this.device || !this.initialized) {
      return this.fallbackBlur(imageData);
    }

    const pipeline = this.pipelines.get('blur');
    if (!pipeline) {
      return this.fallbackBlur(imageData);
    }

    try {
      const { width, height, data } = imageData;
      const pixelCount = width * height;

      const inputData = new Uint32Array(data.buffer);

      const inputBuffer = this.device.createBuffer({
        size: pixelCount * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      const outputBuffer = this.device.createBuffer({
        size: pixelCount * 4,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });

      const paramsBuffer = this.device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const readBuffer = this.device.createBuffer({
        size: pixelCount * 4,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      this.device.queue.writeBuffer(inputBuffer, 0, inputData);
      this.device.queue.writeBuffer(paramsBuffer, 0, new Float32Array([width, height, sigma, 0]));

      const bindGroup = this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inputBuffer } },
          { binding: 1, resource: { buffer: outputBuffer } },
          { binding: 2, resource: { buffer: paramsBuffer } },
        ],
      });

      const commandEncoder = this.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginComputePass();
      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
      passEncoder.end();

      commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, pixelCount * 4);
      this.device.queue.submit([commandEncoder.finish()]);

      await readBuffer.mapAsync(GPUMapMode.READ);
      const resultData = new Uint32Array(readBuffer.getMappedRange().slice(0));
      readBuffer.unmap();

      const resultBytes = new Uint8ClampedArray(resultData.buffer);
      return new ImageData(resultBytes, width, height);
    } catch (error) {
      console.error('[WebGPU] Blur failed, using fallback:', error);
      return this.fallbackBlur(imageData);
    }
  }

  /**
   * Get capabilities
   */
  getCapabilities(): WebGPUCapabilities {
    return {
      available: this.initialized,
      adapter: this.adapter,
      device: this.device,
      maxWorkgroupSize: 256,
      maxBufferSize: 256 * 1024 * 1024,
    };
  }

  /**
   * Destroy resources
   */
  destroy(): void {
    this.device?.destroy();
    this.device = null;
    this.adapter = null;
    this.pipelines.clear();
    this.initialized = false;
  }

  // Fallback implementations
  private fallbackGrayscale(imageData: ImageData): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    for (let i = 0; i < data.length; i += 4) {
      const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    return new ImageData(data, imageData.width, imageData.height);
  }

  private fallbackContrast(imageData: ImageData, factor: number): ImageData {
    const data = new Uint8ClampedArray(imageData.data);
    const mid = 128;
    for (let i = 0; i < data.length; i += 4) {
      for (let j = 0; j < 3; j++) {
        const adjusted = mid + (data[i + j] - mid) * factor;
        data[i + j] = Math.max(0, Math.min(255, Math.round(adjusted)));
      }
    }
    return new ImageData(data, imageData.width, imageData.height);
  }

  private fallbackBlur(imageData: ImageData): ImageData {
    // Simple box blur fallback
    const { width, height, data } = imageData;
    const result = new Uint8ClampedArray(data);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              sum += data[((y + dy) * width + (x + dx)) * 4 + c];
            }
          }
          result[(y * width + x) * 4 + c] = Math.round(sum / 9);
        }
      }
    }
    
    return new ImageData(result, width, height);
  }
}

// Singleton instance
let processorInstance: WebGPUProcessor | null = null;

export async function getWebGPUProcessor(): Promise<WebGPUProcessor | null> {
  if (!processorInstance) {
    processorInstance = new WebGPUProcessor();
    const success = await processorInstance.initialize();
    if (!success) {
      processorInstance = null;
    }
  }
  return processorInstance;
}

export async function isWebGPUAvailable(): Promise<boolean> {
  return WebGPUProcessor.isAvailable();
}
