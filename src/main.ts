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

  highlight: {i: number; j: number};

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
      this.city.grid[this.highlight.i][this.highlight.j].type = CellType.HOUSE;
    }
  }

  run() {
    this.frame();
  }

  private frame() {
    this.context.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    this.backToFront((i: number, j: number) => {
      var cell = this.city.grid[i][j];
      this.drawSprite(i, j, this.assets.ground);
      switch (cell.type) {
        case CellType.GRASS: this.drawSprite(i, j, this.assets.grass); break;
        case CellType.HOUSE: this.drawSprite(i, j, this.assets.house); break;
      }
    });
    if (this.highlight) {
      this.drawSprite(this.highlight.i, this.highlight.j, this.assets.highlight);
    }

    requestAnimationFrame(this.frame.bind(this));
  }

  private backToFront(callback: (i: number, j: number) => void) {
    var s = this.city.size;
    for (var y = -s + 1; y < this.city.size; y++) {
      for (var x = 0; x < s - Math.abs(y); x++) {
        if (y > 0) {
          callback(y + x, x);
        } else {
          callback(x, Math.abs(y) + x);
        }
      }
    }
  }

  private drawSprite(i: number, j: number, sprite: Sprite, variant: number = 0, ox: number = 0, oy: number = 0) {
    var x = this.getCenterX(i, j);
    var y = this.getCenterY(i, j);
    this.context.drawImage(this.assets.sprites,
        sprite.x, sprite.y, sprite.w, sprite.h,
        x + this.scale * (ox - sprite.ox),
        y + this.scale * (oy - sprite.oy),
        this.scale * sprite.w, this.scale * sprite.h);
  }

  private getCenterX(i: number, j: number): number {
    return this.canvasWidth / 2 + this.scale * SPRITE_WIDTH / 2 * (i + j + 1 - this.city.size);
  }

  private getCenterY(i: number, j: number): number {
    return this.canvasHeight / 2 + this.scale * Y_OFFSET + this.scale * SPRITE_HEIGHT / 2 * (i - j);
  }

  private getIJ(x: number, y: number): Coord {
    x -= this.canvasWidth / 2;
    y -= this.canvasHeight / 2 + this.scale * Y_OFFSET;
    x /= this.scale * SPRITE_WIDTH / 2;
    y /= this.scale * SPRITE_HEIGHT / 2;
    var i = Math.round((x + y - 1 + this.city.size) / 2);
    var j = Math.round((x - y - 1 + this.city.size) / 2);
    return i >= 0 && i < this.city.size && j >= 0 && j < this.city.size ? {i: i, j: j} : null;
  }
}

new Game(new Assets(), $('canvas')).run();
