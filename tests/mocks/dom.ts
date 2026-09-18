// Minimal mock for DOM and Canvas in Node.js test environment

export class MockCanvasRenderingContext2D {
  canvas: any;
  fillStyle: any = '#000';
  strokeStyle: any = '#000';
  lineWidth: number = 1;

  save() {}
  restore() {}
  scale(_x: number, _y: number) {}
  clearRect(_x: number, _y: number, _w: number, _h: number) {}
  fillRect(_x: number, _y: number, _w: number, _h: number) {}
  strokeRect(_x: number, _y: number, _w: number, _h: number) {}
  beginPath() {}
  closePath() {}
  arc(_x: number, _y: number, _r: number, _s: number, _e: number) {}
  rect(_x: number, _y: number, _w: number, _h: number) {}
  roundRect(_x: number, _y: number, _w: number, _h: number, _r?: any) {}
  fill() {}
  stroke() {}
  createRadialGradient(_x0: number, _y0: number, _r0: number, _x1: number, _y1: number, _r1: number) {
    return {
      addColorStop(_offset: number, _color: string) {}
    };
  }
  createLinearGradient(_x0: number, _y0: number, _x1: number, _y1: number) {
    return {
      addColorStop(_offset: number, _color: string) {}
    };
  }
}

export class MockDOMElement {
  tagName: string;
  className: string = '';
  classList: { contains: (cls: string) => boolean };
  style: Record<string, string> = {};
  children: MockDOMElement[] = [];
  innerHTML: string = '';
  width: number = 800;
  height: number = 400;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
    this.classList = {
      contains: (cls: string) => this.className.includes(cls)
    };
  }

  appendChild(child: any) {
    this.children.push(child);
    return child;
  }

  removeChild(child: any) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    return child;
  }

  contains(child: any) {
    return this.children.includes(child);
  }

  querySelector(_sel: string) {
    return new MockDOMElement('div');
  }

  querySelectorAll(_sel: string) {
    return [new MockDOMElement('span'), new MockDOMElement('span')];
  }

  getBoundingClientRect() {
    return { width: 800, height: 400, top: 0, left: 0, bottom: 400, right: 800 };
  }

  getContext(type: string) {
    if (type === '2d') {
      const ctx = new MockCanvasRenderingContext2D();
      ctx.canvas = this;
      return ctx;
    }
    return null;
  }
}

export function setupDomMocks() {
  if (typeof globalThis.document === 'undefined') {
    (globalThis as any).document = {
      createElement(tag: string) {
        return new MockDOMElement(tag);
      }
    };
  }
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = {
      devicePixelRatio: 2
    };
  }
  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    (globalThis as any).requestAnimationFrame = (cb: (time: number) => void) => {
      return setTimeout(() => cb(Date.now()), 16);
    };
    (globalThis as any).cancelAnimationFrame = (id: any) => {
      clearTimeout(id);
    };
  }
}
