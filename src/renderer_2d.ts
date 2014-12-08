/// <reference path="../typings/tsd.d.ts" />
/// <reference path="city.ts" />
/// <reference path="renderer.ts" />

class Renderer2D extends AbstractRenderer {
  private context: CanvasRenderingContext2D;

  constructor(city: City, canvas: JQuery) {
    super(city, canvas);
    this.context = this.canvasElt.getContext('2d');
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
}
