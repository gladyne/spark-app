import type LType from "leaflet";

export interface HeatLayerOptions {
  radius?: number;
  blur?: number;
  max?: number;
  maxZoom?: number;
  minOpacity?: number;
  gradient?: Record<number, string>;
  pane?: string;
}

class SimpleHeat {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private maxVal = 1;
  private dataPoints: [number, number, number][] = [];
  private circle: HTMLCanvasElement | null = null;
  private r = 0;
  private grad: Uint8ClampedArray | null = null;

  readonly defaultRadius = 25;
  readonly defaultGradient: Record<number, string> = {
    0.4: "blue",
    0.6: "cyan",
    0.7: "lime",
    0.8: "yellow",
    1: "red",
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;
    this.width = canvas.width;
    this.height = canvas.height;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
  }

  data(points: [number, number, number][]): this {
    this.dataPoints = points;
    return this;
  }

  max(value: number): this {
    this.maxVal = value;
    return this;
  }

  radius(r: number, blur = 15): this {
    const circle = document.createElement("canvas");
    const ctx = circle.getContext("2d");
    if (!ctx) return this;
    const totalR = r + blur;
    this.r = totalR;
    circle.width = totalR * 2;
    circle.height = totalR * 2;

    ctx.shadowOffsetX = 200;
    ctx.shadowOffsetY = 200;
    ctx.shadowBlur = blur;
    ctx.shadowColor = "black";
    ctx.beginPath();
    ctx.arc(totalR - 200, totalR - 200, r, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    this.circle = circle;
    return this;
  }

  gradient(grad: Record<number, string>): this {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return this;
    canvas.width = 1;
    canvas.height = 256;
    const linear = ctx.createLinearGradient(0, 0, 0, 256);
    for (const [stop, color] of Object.entries(grad)) {
      linear.addColorStop(Number(stop), color);
    }
    ctx.fillStyle = linear;
    ctx.fillRect(0, 0, 1, 256);
    this.grad = ctx.getImageData(0, 0, 1, 256).data;
    return this;
  }

  draw(minOpacity = 0.05): this {
    if (!this.circle) this.radius(this.defaultRadius);
    if (!this.grad) this.gradient(this.defaultGradient);
    if (!this.circle || !this.grad) return this;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    for (const pt of this.dataPoints) {
      ctx.globalAlpha = Math.max(pt[2] / this.maxVal, minOpacity);
      ctx.drawImage(this.circle, pt[0] - this.r, pt[1] - this.r);
    }

    if (this.width > 0 && this.height > 0) {
      const colored = ctx.getImageData(0, 0, this.width, this.height);
      this.colorize(colored.data, this.grad);
      ctx.putImageData(colored, 0, 0);
    }
    return this;
  }

  getRadius(): number {
    return this.r;
  }

  private colorize(pixels: Uint8ClampedArray, gradient: Uint8ClampedArray): void {
    for (let i = 3; i < pixels.length; i += 4) {
      const j = pixels[i] * 4;
      if (j > 0) {
        pixels[i - 3] = gradient[j];
        pixels[i - 2] = gradient[j + 1];
        pixels[i - 1] = gradient[j + 2];
      }
    }
  }
}

export type WeightedLatLng = [number, number, number];

export interface CanvasHeatLayerInstance {
  layer: LType.Layer;
  setOptions: (opts: HeatLayerOptions) => void;
  setLatLngs: (latlngs: WeightedLatLng[]) => void;
}

export function createCanvasHeatLayer(
  L: typeof LType,
  initialLatLngs: WeightedLatLng[],
  initialOptions: HeatLayerOptions = {}
): CanvasHeatLayerInstance {
  let latlngs = initialLatLngs;
  const options: HeatLayerOptions = { ...initialOptions };

  let mapRef: LType.Map | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let heat: SimpleHeat | null = null;
  let frameId: number | null = null;

  const updateHeatOptions = () => {
    if (!heat) return;
    heat.radius(options.radius ?? heat.defaultRadius, options.blur);
    if (options.gradient) heat.gradient(options.gradient);
    if (options.max !== undefined) heat.max(options.max);
  };

  const redraw = () => {
    frameId = null;
    if (!mapRef || !heat || !canvas) return;
    const size = mapRef.getSize();
    if (size.x <= 0 || size.y <= 0) return;

    const r = heat.getRadius();
    const bounds = L.bounds(L.point([-r, -r]), size.add([r, r]));
    const max = options.max ?? 1;
    const maxZoom = options.maxZoom ?? mapRef.getMaxZoom();
    const v = 1 / Math.pow(2, Math.max(0, Math.min(maxZoom - mapRef.getZoom(), 12)));
    const cellSize = r / 2;
    const grid: Array<Array<[number, number, number] | undefined>> = [];
    const panePos = (mapRef as unknown as { _getMapPanePos: () => LType.Point })._getMapPanePos();
    const offsetX = panePos.x % cellSize;
    const offsetY = panePos.y % cellSize;

    for (const ll of latlngs) {
      const p = mapRef.latLngToContainerPoint([ll[0], ll[1]]);
      if (!bounds.contains(p)) continue;
      const x = Math.floor((p.x - offsetX) / cellSize) + 2;
      const y = Math.floor((p.y - offsetY) / cellSize) + 2;
      const k = ll[2] * v;
      if (!grid[y]) grid[y] = [];
      const cell = grid[y][x];
      if (!cell) {
        grid[y][x] = [p.x, p.y, k];
      } else {
        cell[0] = (cell[0] * cell[2] + p.x * k) / (cell[2] + k);
        cell[1] = (cell[1] * cell[2] + p.y * k) / (cell[2] + k);
        cell[2] += k;
      }
    }

    const data: [number, number, number][] = [];
    for (const row of grid) {
      if (!row) continue;
      for (const cell of row) {
        if (cell) {
          data.push([Math.round(cell[0]), Math.round(cell[1]), Math.min(cell[2], max)]);
        }
      }
    }

    heat.data(data).draw(options.minOpacity);
  };

  const scheduleRedraw = () => {
    if (!heat || frameId !== null || !mapRef) return;
    frameId = L.Util.requestAnimFrame(redraw);
  };

  const reset = () => {
    if (!mapRef || !canvas || !heat) return;
    const topLeft = mapRef.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, topLeft);
    const size = mapRef.getSize();
    if (canvas.width !== size.x || canvas.height !== size.y) {
      heat.resize(size.x, size.y);
    }
    redraw();
  };

  const animateZoom = (e: LType.ZoomAnimEvent) => {
    if (!mapRef || !canvas) return;
    const scale = mapRef.getZoomScale(e.zoom, mapRef.getZoom());
    const offset = (
      mapRef as unknown as {
        _getCenterOffset: (c: LType.LatLng) => LType.Point;
        _getMapPanePos: () => LType.Point;
      }
    )
      ._getCenterOffset(e.center)
      .multiplyBy(-scale)
      .subtract(
        (mapRef as unknown as { _getMapPanePos: () => LType.Point })._getMapPanePos()
      );
    L.DomUtil.setTransform(canvas, offset, scale);
  };

  const CustomHeatLayer = L.Layer.extend({
    onAdd(map: LType.Map) {
      mapRef = map;
      if (!canvas) {
        canvas = L.DomUtil.create(
          "canvas",
          "leaflet-heatmap-layer leaflet-layer"
        ) as HTMLCanvasElement;
        canvas.style.transformOrigin = "50% 50%";
        const size = map.getSize();
        canvas.width = size.x;
        canvas.height = size.y;
        const animated = Boolean(map.options.zoomAnimation && L.Browser.any3d);
        L.DomUtil.addClass(canvas, `leaflet-zoom-${animated ? "animated" : "hide"}`);
        heat = new SimpleHeat(canvas);
        updateHeatOptions();
      }
      const paneName = options.pane || "overlayPane";
      const targetPane = map.getPane(paneName) ?? map.getPane("overlayPane");
      targetPane?.appendChild(canvas);

      map.on("moveend", reset);
      if (map.options.zoomAnimation && L.Browser.any3d) {
        map.on("zoomanim", animateZoom as LType.LeafletEventHandlerFn);
      }
      reset();
    },
    onRemove(map: LType.Map) {
      if (frameId !== null) {
        L.Util.cancelAnimFrame(frameId);
        frameId = null;
      }
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      map.off("moveend", reset);
      map.off("zoomanim", animateZoom as LType.LeafletEventHandlerFn);
      mapRef = null;
    },
  });

  const layer = new CustomHeatLayer();

  return {
    layer,
    setOptions(next: HeatLayerOptions) {
      Object.assign(options, next);
      updateHeatOptions();
      scheduleRedraw();
    },
    setLatLngs(next: WeightedLatLng[]) {
      latlngs = next;
      scheduleRedraw();
    },
  };
}
