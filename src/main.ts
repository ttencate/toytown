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

class Assets {
  jump: Howl = new Howl({urls: ['jump.mp3', 'jump.ogg']});
  sprites: HTMLImageElement = loadImage('sprites.png');
}

var MARGIN = 20;

class Game {
  context: CanvasRenderingContext2D;
  canvasElt: HTMLCanvasElement;

  canvasWidth: number;
  canvasHeight: number;
  cellWidth: number;
  cellHeight: number;

  city: City = new City();

  constructor(private assets: Assets, private canvas: JQuery) {
    this.canvasElt = <HTMLCanvasElement>canvas[0];
    this.context = this.canvasElt.getContext('2d');

    $(window).on('resize', this.onResize.bind(this));
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
    this.cellWidth = w / Math.max(this.city.width, this.city.height);
    this.cellHeight = this.cellWidth / 2;
    $(document.documentElement).css('font-size', w/100 + 'px');
  }

  run() {
    this.frame();
  }

  private frame() {
    this.context.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    for (var i = 0; i < this.city.height; i++) {
      for (var j = 0; j < this.city.width; j++) {
        this.drawTile(i, j, this.city.grid[i][j]);
      }
    }

    requestAnimationFrame(this.frame.bind(this));
  }

  private drawTile(i: number, j: number, cell: Cell) {
    var x = this.getCenterX(i, j);
    var y = this.getCenterY(i, j);
    this.context.drawImage(this.assets.sprites, 0, 0, 40, 20, x - this.cellWidth / 2, y - this.cellHeight / 2, this.cellWidth, this.cellHeight);
  }

  private getCenterX(i: number, j: number) {
    return this.canvasWidth / 2 + this.cellWidth / 2 * (i + 0.5 - this.city.height / 2 + j + 0.5 - this.city.width / 2);
  }

  private getCenterY(i: number, j: number) {
    return this.canvasHeight / 2 + this.cellHeight / 2 * (i+ 0.5  - this.city.height / 2 - j - 0.5 + this.city.width / 2);
  }
}

new Game(new Assets(), $('canvas')).run();
