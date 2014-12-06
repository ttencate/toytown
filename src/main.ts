/// <reference path="../typings/tsd.d.ts" />

window.requestAnimationFrame =
  window['requestAnimationFrame'] ||
  window['webkitRequestAnimationFrame'] ||
  window['mozRequestAnimationFrame'] ||
  function(callback) { window.setTimeout(callback, 1000 / 60); };

class Assets {
  jump: Howl = new Howl({urls: ['jump.mp3', 'jump.ogg']});
}

var MARGIN = 20;

class Game {
  context: CanvasRenderingContext2D;
  canvasElt: HTMLCanvasElement;
  canvasWidth: number;
  canvasHeight: number;

  city: City;

  constructor(private assets: Assets, private canvas: JQuery) {
    this.canvasElt = <HTMLCanvasElement>canvas[0];
    this.context = this.canvasElt.getContext('2d');

    $(window).on('resize', this.onResize.bind(this));
    this.onResize();

    this.city = new City();
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
    $(document.documentElement).css('font-size', w/100 + 'px');
  }

  run() {
    this.frame();
  }

  private frame() {
    this.context.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    requestAnimationFrame(this.frame.bind(this));
  }
}

new Game(new Assets(), $('canvas')).run();
