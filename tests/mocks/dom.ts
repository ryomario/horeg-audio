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
  classList: any;
  style: any;
  children: MockDOMElement[] = [];
  innerHTML: string = '';
  width: number = 800;
  height: number = 400;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
    const self = this;
    this.classList = {
      contains: (cls: string) => self.className.split(/\s+/).includes(cls),
      add: (...clss: string[]) => {
        const set = new Set(self.className.split(/\s+/).filter(Boolean));
        clss.forEach((c) => set.add(c));
        self.className = Array.from(set).join(' ');
      },
      remove: (...clss: string[]) => {
        const set = new Set(self.className.split(/\s+/).filter(Boolean));
        clss.forEach((c) => set.delete(c));
        self.className = Array.from(set).join(' ');
      },
      toggle: (cls: string, force?: boolean) => {
        const set = new Set(self.className.split(/\s+/).filter(Boolean));
        const has = set.has(cls);
        const shouldAdd = force !== undefined ? force : !has;
        if (shouldAdd) set.add(cls);
        else set.delete(cls);
        self.className = Array.from(set).join(' ');
        return shouldAdd;
      }
    };
    this.style = {
      removeProperty: (prop: string) => {
        delete self.style[prop];
      },
      setProperty: (prop: string, val: string) => {
        self.style[prop] = val;
      },
      getPropertyValue: (prop: string) => {
        return self.style[prop] || '';
      }
    };
  }

  parentNode: any = null;

  appendChild(child: any) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: any) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    child.parentNode = null;
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
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

  attachShadow(_init?: { mode: string }) {
    const shadow = new MockDOMElement('shadow-root');
    (this as any).shadowRoot = shadow;
    return shadow;
  }
}

export function setupDomMocks() {
  if (typeof globalThis.HTMLElement === 'undefined') {
    (globalThis as any).HTMLElement = class HTMLElementMock extends MockDOMElement {
      attributes: Record<string, string> = {};
      eventListeners: Record<string, Function[]> = {};

      constructor() {
        super('div');
      }

      getAttribute(name: string) {
        return this.attributes[name] ?? null;
      }

      setAttribute(name: string, val: string) {
        const old = this.attributes[name] ?? null;
        this.attributes[name] = String(val);
        if ((this as any).attributeChangedCallback) {
          (this as any).attributeChangedCallback(name, old, String(val));
        }
      }

      hasAttribute(name: string) {
        return name in this.attributes;
      }

      removeAttribute(name: string) {
        const old = this.attributes[name] ?? null;
        delete this.attributes[name];
        if ((this as any).attributeChangedCallback) {
          (this as any).attributeChangedCallback(name, old, null);
        }
      }

      addEventListener(event: string, fn: Function) {
        this.eventListeners[event] = this.eventListeners[event] || [];
        this.eventListeners[event].push(fn);
      }

      removeEventListener(event: string, fn: Function) {
        if (!this.eventListeners[event]) return;
        this.eventListeners[event] = this.eventListeners[event].filter(f => f !== fn);
      }

      dispatchEvent(evt: any) {
        const list = this.eventListeners[evt.type] || [];
        list.forEach(f => f(evt));
        return true;
      }
    };
  }

  if (typeof globalThis.customElements === 'undefined') {
    const registry = new Map<string, any>();
    (globalThis as any).customElements = {
      define(name: string, ctor: any) {
        registry.set(name, ctor);
      },
      get(name: string) {
        return registry.get(name);
      }
    };
  }

  if (typeof globalThis.CustomEvent === 'undefined') {
    (globalThis as any).CustomEvent = class CustomEventMock {
      type: string;
      detail: any;
      constructor(type: string, init?: any) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
  }

  if (typeof globalThis.document === 'undefined') {
    (globalThis as any).document = {
      createElement(tag: string) {
        const CustomCtor = (globalThis as any).customElements?.get(tag);
        if (CustomCtor) {
          return new CustomCtor();
        }
        return new (globalThis as any).HTMLElement(tag);
      },
      querySelector() {
        return new (globalThis as any).HTMLElement('div');
      }
    };
  }
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = {
      devicePixelRatio: 2,
      customElements: (globalThis as any).customElements
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

setupDomMocks();

