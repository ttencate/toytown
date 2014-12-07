/// <reference path="../typings/tsd.d.ts" />
/// <reference path="city.ts" />

class Renderer {
  private context: CanvasRenderingContext2D;
  private canvasElt: HTMLCanvasElement;
  private canvasWidth: number;
  private canvasHeight: number;
  private scale: number;

  shakeOffset = 0;

  constructor(private city: City, private canvas: JQuery) {
    this.canvasElt = <HTMLCanvasElement>canvas[0];
    this.context = this.canvasElt.getContext('2d');

    $(window).on('resize', this.onResize.bind(this));
    this.onResize();
  }

  clear() {
    this.context.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  setAlpha(alpha: number) {
    this.context.globalAlpha = alpha;
  }

  drawSprite(coord: Coord, sprite: Sprite, variantX: number = 0, variantY: number = 0, ox: number = 0, oy: number = 0, scale: number = 1) {
    var x = this.getCenterX(coord);
    var y = this.getCenterY(coord);
    this.context.drawImage(sprite.image,
        sprite.x + variantX * sprite.w, sprite.y + variantY * sprite.h, sprite.w, sprite.h,
        x + this.scale * (ox - scale * sprite.ox),
        y + this.scale * (oy - scale * sprite.oy),
        this.scale * scale * sprite.w, this.scale * scale * sprite.h);
  }

  unproject(x: number, y: number): Coord {
    x -= this.canvasWidth / 2;
    y -= this.canvasHeight / 2 + this.scale * (Y_OFFSET + this.shakeOffset);
    x /= this.scale * SPRITE_WIDTH / 2;
    y /= this.scale * SPRITE_HEIGHT / 2;
    var i = Math.round((x + y - 1 + this.city.size) / 2);
    var j = Math.round((x - y - 1 + this.city.size) / 2);
    return i >= 0 && i < this.city.size && j >= 0 && j < this.city.size ? Coord.of(i, j) : null;
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

  private getCenterX(coord: Coord): number {
    return this.canvasWidth / 2 + this.scale * SPRITE_WIDTH / 2 * (coord.i + coord.j + 1 - this.city.size);
  }

  private getCenterY(coord: Coord): number {
    return this.canvasHeight / 2 + this.scale * (Y_OFFSET + this.shakeOffset) + this.scale * SPRITE_HEIGHT / 2 * (coord.i - coord.j);
  }
}
