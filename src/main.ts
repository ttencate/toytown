/// <reference path="../typings/tsd.d.ts" />

class Assets {
  jump: Howl = new Howl({urls: ['jump.mp3', 'jump.ogg']});
}

class Game {
  context: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;

  constructor(private assets: Assets, private canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d');
    this.canvasWidth = canvas.width;
    this.canvasHeight = canvas.height;
  }

  run() {
    this.context.fillStyle = '#fed';
    this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    this.assets.jump.play();
  }
}

new Game(new Assets(), <HTMLCanvasElement>$('canvas')[0]).run();
