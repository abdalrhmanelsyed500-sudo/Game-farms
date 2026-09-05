/**
 * Headless canvas stub for the boot smoke test.
 *
 * Installed from a vitest setup file so it runs BEFORE Phaser is imported
 * (Phaser probes canvas features at module-evaluation time). Provides a
 * no-op Canvas2D context + rAF so the Canvas renderer can boot under jsdom.
 * Pixels are meaningless; wiring execution is what we verify.
 */

type AnyRecord = Record<string, unknown>;

export function installSmokeCanvasStub(): void {
  const scalarDefaults = new Map<string, unknown>([
    ['globalAlpha', 1],
    ['globalCompositeOperation', 'source-over'],
    ['lineWidth', 1],
    ['fillStyle', '#000000'],
    ['strokeStyle', '#000000'],
    ['font', '10px sans-serif'],
    ['textAlign', 'left'],
    ['textBaseline', 'alphabetic'],
  ]);

  function makeContext(canvas: HTMLCanvasElement): unknown {
    const store: AnyRecord = { canvas };
    return new Proxy(store, {
      get(target: AnyRecord, prop: string | symbol): unknown {
        if (typeof prop !== 'string') {
          return undefined;
        }
        if (prop in target) {
          return target[prop];
        }
        if (prop === 'measureText') {
          return () => ({ width: 12 });
        }
        if (prop === 'getImageData') {
          return (_x: number, _y: number, w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(Math.max(4, w * h * 4)),
          });
        }
        if (prop === 'createImageData') {
          return (w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(Math.max(4, w * h * 4)),
          });
        }
        if (prop === 'getLineDash') {
          return () => [];
        }
        if (scalarDefaults.has(prop)) {
          return scalarDefaults.get(prop);
        }
        return () => undefined;
      },
      set(target: AnyRecord, prop: string | symbol, value: unknown): boolean {
        if (typeof prop === 'string') {
          target[prop] = value;
        }
        return true;
      },
    });
  }

  // Phaser's feature detection checks for the constructor's existence.
  if (!window.CanvasRenderingContext2D) {
    (window as unknown as AnyRecord)['CanvasRenderingContext2D'] = class CanvasRenderingContext2D {};
  }

  const proto = window.HTMLCanvasElement.prototype as unknown as {
    getContext: (type: string) => unknown;
  };
  proto.getContext = function (this: HTMLCanvasElement, type: string): unknown {
    if (type !== '2d') {
      return null; // no WebGL in the smoke env => Phaser uses Canvas
    }
    const self = this as HTMLCanvasElement & { __smokeCtx?: unknown };
    if (!self.__smokeCtx) {
      self.__smokeCtx = makeContext(self);
    }
    return self.__smokeCtx;
  };

  window.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
    return window.setTimeout(() => callback(Date.now()), 16) as unknown as number;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number): void => {
    window.clearTimeout(id);
  }) as typeof window.cancelAnimationFrame;

  // jsdom never loads images, which would stall Phaser's TextureManager
  // (it waits for 3 base64 default textures). Fake it: any src "loads".
  class SmokeImage {
    public onload: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    public readonly width = 2;
    public readonly height = 2;
    private source = '';

    public set src(value: string) {
      this.source = value;
      window.setTimeout(() => {
        this.onload?.();
      }, 0);
    }

    public get src(): string {
      return this.source;
    }
  }
  (window as unknown as AnyRecord)['Image'] = SmokeImage;
  (globalThis as unknown as AnyRecord)['Image'] = SmokeImage;
}
