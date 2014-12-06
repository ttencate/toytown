/// <reference path="../typings/tsd.d.ts" />

window.requestAnimationFrame =
  window['requestAnimationFrame'] ||
  window['webkitRequestAnimationFrame'] ||
  window['mozRequestAnimationFrame'] ||
  function(callback) { window.setTimeout(callback, 1000 / 60); };

function loadImage(url: string) {
  var img = <HTMLImageElement>document.createElement('img');
  img.src = url;
  return img;
}

class Sprite {
  constructor(public x: number, public y: number, public w: number, public h: number, public ox: number, public oy: number) {
  }
}

class Assets {
  jump = new Howl({urls: ['jump.mp3', 'jump.ogg']});
  sprites = loadImage('sprites.png');

  ground = new Sprite(0, 40, 80, 80, 40, 0);
  grass = new Sprite(0, 0, 80, 40, 40, 20);
  house = new Sprite(320, 0, 80, 60, 40, 40);

  highlight = new Sprite(0, 120, 80, 40, 40, 20);
  smoke = new Sprite(0, 160, 20, 20, 10, 10);
}

class Particle {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  scale = 1;
  vscale = 0;
  alpha = 1;
  valpha = -1;

  constructor(public sprite: Sprite) {
  }

  tick(delta: number): boolean {
    this.x += delta * this.vx;
    this.y += delta * this.vy;
    this.scale += delta * this.vscale;
    this.alpha += delta * this.valpha;
    return this.alpha > 0;
  }
}

var MARGIN = 20;
var SPRITE_WIDTH = 80;
var SPRITE_HEIGHT = 40;
var Y_OFFSET = 0.5 * SPRITE_HEIGHT;

class Game {
  context: CanvasRenderingContext2D;
  canvasElt: HTMLCanvasElement;

  city: City = new City();

  canvasWidth: number;
  canvasHeight: number;
  scale: number;
  shakeOffset = 0;
  shakeDelta: number = null;

  highlight: {i: number; j: number};
  particles: {[key: string]: Array<Particle>} = {};

  constructor(private assets: Assets, private canvas: JQuery) {
    this.canvasElt = <HTMLCanvasElement>canvas[0];
    this.context = this.canvasElt.getContext('2d');

    $(window).on('resize', this.onResize.bind(this));
    var all = $('#all');
    all.on('mousemove', this.mouseMove.bind(this));
    all.on('mousedown', this.mouseDown.bind(this));
    this.onResize();
  }

  private onResize() {
    var w = window.innerWidth - 2*MARGIN;
    var h = window.innerHeight - 2*MARGIN;
    if (w*3 > h*5) {
      w = h*5/3;
    } else {
      h = w*3/5;
    }
    w = Math.floor(w);
    h = Math.floor(h);
    this.canvasElt.width = this.canvasWidth = w;
    this.canvasElt.height = this.canvasHeight = h;
    $('#all').css({
      width: w + 'px',
      height: h + 'px',
    });
    this.scale = w / (SPRITE_WIDTH * this.city.size);
    $(document.documentElement).css('font-size', w/100 + 'px');
  }

  private mouseMove(e: MouseEvent) {
    var x = e.clientX - this.canvas.offset().left;
    var y = e.clientY - this.canvas.offset().top;
    this.highlight = this.getIJ(x, y);
  }

  private mouseDown(e: MouseEvent) {
    this.mouseMove(e);
    if (this.highlight) {
      this.city.getCell(this.highlight).type = CellType.HOUSE;
      this.shake();
      this.smoke(this.highlight);
    }
  }

  private shake() {
    this.shakeDelta = 50;
    this.shakeOffset = 4;
  }

  private smoke(coord: Coord) {
    var particles = [];
    for (var i = 0; i < 20; i++) {
      var x = SPRITE_WIDTH / 2 * (Math.random() - 0.5);
      var y = SPRITE_HEIGHT / 2 * (Math.random() - 0.5);
      var p = new Particle(this.assets.smoke);
      p.x = x;
      p.y = y;
      p.vx = x;
      p.vy = y - SPRITE_HEIGHT / 2;
      p.scale = 0.5 + Math.random();
      p.vscale = 1;
      particles.push(p);
    }
    this.particles[coord.toString()] = particles;
  }

  private lastFrame: number;

  run() {
    this.lastFrame = Date.now();
    this.frame();
  }

  private frame() {
    var now = Date.now();
    var delta = (now - this.lastFrame) / 1000;
    this.lastFrame = now;

    this.context.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    if (this.shakeDelta != null) {
      this.shakeOffset += delta * this.shakeDelta;
      this.shakeDelta -= delta * 5000;
      if (this.shakeOffset < 0) {
        this.shakeOffset = 0;
        this.shakeDelta = null;
      }
    }

    for (var key in this.particles) {
      var p = this.particles[key];
      for (var i = 0; i < p.length; i++) {
        if (!p[i].tick(delta)) {
          p.splice(i, 1);
          i--;
        }
      }
      if (p.length == 0) {
        delete this.particles[key];
      }
    }

    this.backToFront(this.drawCell.bind(this));
    if (this.highlight) {
      this.drawSprite(this.highlight, this.assets.highlight);
    }

    requestAnimationFrame(this.frame.bind(this));
  }

  private backToFront(callback: (coord: Coord) => void) {
    var s = this.city.size;
    for (var y = -s + 1; y < this.city.size; y++) {
      for (var x = 0; x < s - Math.abs(y); x++) {
        if (y > 0) {
          callback(new Coord(y + x, x));
        } else {
          callback(new Coord(x, Math.abs(y) + x));
        }
      }
    }
  }

  private drawCell(coord: Coord, cell: Cell) {
    var cell = this.city.getCell(coord);
    this.drawSprite(coord, this.assets.ground);
    switch (cell.type) {
      case CellType.GRASS: this.drawSprite(coord, this.assets.grass); break;
      case CellType.HOUSE: this.drawSprite(coord, this.assets.house); break;
    }
    var particles = this.particles[coord.toString()];
    if (particles) {
      this.drawParticles(coord, particles);
    }
  }

  private drawParticles(coord: Coord, particles: Array<Particle>) {
    this.context.globalCompositeOperation = 'source-over';
    particles.forEach((particle) => {
      this.context.globalAlpha = particle.alpha;
      this.drawSprite(coord, particle.sprite, 0, particle.x, particle.y, particle.scale);
    });
    this.context.globalAlpha = 1;
  }

  private drawSprite(coord: Coord, sprite: Sprite, variant: number = 0, ox: number = 0, oy: number = 0, scale: number = 1) {
    var x = this.getCenterX(coord);
    var y = this.getCenterY(coord);
    this.context.drawImage(this.assets.sprites,
        sprite.x, sprite.y, sprite.w, sprite.h,
        x + this.scale * (ox - scale * sprite.ox),
        y + this.scale * (oy - scale * sprite.oy),
        this.scale * scale * sprite.w, this.scale * scale * sprite.h);
  }

  private getCenterX(coord: Coord): number {
    return this.canvasWidth / 2 + this.scale * SPRITE_WIDTH / 2 * (coord.i + coord.j + 1 - this.city.size);
  }

  private getCenterY(coord: Coord): number {
    return this.canvasHeight / 2 + this.scale * (Y_OFFSET + this.shakeOffset) + this.scale * SPRITE_HEIGHT / 2 * (coord.i - coord.j);
  }

  private getIJ(x: number, y: number): Coord {
    x -= this.canvasWidth / 2;
    y -= this.canvasHeight / 2 + this.scale * (Y_OFFSET + this.shakeOffset);
    x /= this.scale * SPRITE_WIDTH / 2;
    y /= this.scale * SPRITE_HEIGHT / 2;
    var i = Math.round((x + y - 1 + this.city.size) / 2);
    var j = Math.round((x - y - 1 + this.city.size) / 2);
    return i >= 0 && i < this.city.size && j >= 0 && j < this.city.size ? new Coord(i, j) : null;
  }
}

new Game(new Assets(), $('canvas')).run();
