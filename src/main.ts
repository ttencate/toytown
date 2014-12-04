/// <reference path="../typings/tsd.d.ts" />

class Game {
  context: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;

  constructor(private canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d');
    this.canvasWidth = canvas.width;
    this.canvasHeight = canvas.height;
  }

  run() {
    this.context.fillStyle = '#fed';
    this.context.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
  }
}

new Game(<HTMLCanvasElement>$('canvas')[0]).run();
