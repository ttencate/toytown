/// <reference path="../typings/tsd.d.ts" />
/// <reference path="city.ts" />
/// <reference path="dom.ts" />
/// <reference path="renderer.ts" />

window.requestAnimationFrame =
  window['requestAnimationFrame'] ||
  window['webkitRequestAnimationFrame'] ||
  window['mozRequestAnimationFrame'] ||
  function(callback) { window.setTimeout(callback, 1000 / 60); };

function loadSound(name: string): Howl {
  return new Howl({urls: [name + '.mp3', name + '.ogg']});
}

function loadImage(url: string) {
  var img = <HTMLImageElement>document.createElement('img');
  img.src = url;
  return img;
}

class Sprite {
  constructor(public image: HTMLImageElement, public x: number, public y: number, public w: number, public h: number, public ox: number, public oy: number) {
  }
}

class Assets {
  sprites = loadImage('sprites.png');

  underground = new Sprite(this.sprites, 0, 40, 80, 80, 40, 0);
  ground = new Sprite(this.sprites, 0, 0, 80, 40, 40, 20);
  house = new Sprite(this.sprites, 0, 200, 80, 160, 40, 140);
  office = new Sprite(this.sprites, 0, 360, 80, 160, 40, 140);
  road = new Sprite(this.sprites, 0, 520, 80, 40, 40, 20);

  highlight = new Sprite(this.sprites, 0, 120, 80, 40, 40, 20);
  smoke = new Sprite(this.sprites, 0, 160, 20, 20, 10, 10);

  click = loadSound('click');
  build = loadSound('build');
  buildRoad = loadSound('road');
  destroy = loadSound('destroy');
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
var TICKS_PER_SECOND = [0, 50, 100, 200];

class GameCtrl {
  private assets = new Assets();
  private canvas = $('#canvas');
  private renderer: Renderer;

  city: City;

  private shakeDelta: number = null;
  private highlight: Coord;
  private particles: {[key: string]: Array<Particle>} = {};

  constructor(private $scope: ng.IScope, $interval) {
    if (window.localStorage && window.localStorage['toytownCity']) {
      this.city = City.fromJson(window.localStorage['toytownCity']);
    } else {
      this.city = new City();
    }
    this.renderer = new Renderer(this.city, this.canvas);

    var all = $('#all');
    all.on('mousemove', this.mouseMove.bind(this));
    all.on('mousedown', this.mouseDown.bind(this));
    all.on('mouseup', this.mouseUp.bind(this));

    $interval(this.save.bind(this), 1000); // Side effect: trigger digest loop once a second.
    $scope['speed'] = 1;
    $scope['build'] = null;
    $scope.$watch('build', (newValue, oldValue) => {
      if (newValue != oldValue) this.assets.click.play();
    });
    $scope.$watch('speed', (newValue, oldValue) => {
      if (newValue != oldValue) this.assets.click.play();
    });

    this.run();
  }

  reset() {
    this.city = new City();
  }

  private save() {
    if (window.localStorage) {
      window.localStorage['toytownCity'] = this.city.toJson();
    }
  }

  private mouseMove(e: MouseEvent) {
    var coord = this.updateHighlight(e);
    if (coord && e.which == 1) {
      this.click(e, coord);
      e.preventDefault();
    }
  }

  private mouseDown(e: MouseEvent) {
    var coord = this.updateHighlight(e);
    if (coord) {
      this.click(e, coord);
      e.preventDefault();
    }
  }

  private mouseUp(e: MouseEvent) {
    this.startPoint = null;
    this.shortestPath = null;
  }

  private updateHighlight(e: MouseEvent): Coord {
    var x = e.clientX - this.canvas.offset().left;
    var y = e.clientY - this.canvas.offset().top;
    return this.highlight = this.renderer.unproject(x, y);
  }

  // For debugging.
  private startPoint: Coord;
  private shortestPath: Array<Coord>;

  private click(e: MouseEvent, coord: Coord) {
    // For debugging.
    if (e.shiftKey) {
      this.city.tickCell(coord);
      return;
    }

    // For debugging.
    if (e.ctrlKey) {
      if (this.startPoint) {
        this.shortestPath = this.city.getShortestPath(this.startPoint, coord);
      } else {
        this.startPoint = coord;
      }
      return;
    }

    var buildMode = this.buildMode();
    if (buildMode != null) {
      if (buildMode == CellType.DESTROY) {
        if (this.city.destroy(coord)) {
          this.assets.destroy.play();
          this.shake(1);
          this.smoke(coord);
        }
      } else {
        if (this.city.build(coord, buildMode)) {
          switch (buildMode) {
            case CellType.HOUSE:
            case CellType.OFFICE:
              this.assets.build.play();
              this.shake(1);
              break;
            case CellType.ROAD:
              this.assets.buildRoad.play();
              break;
          }
          this.smoke(coord);
        }
      }
    }
  }

  private buildMode(): CellType {
    return <CellType><any>CellType[this.$scope['build']];
  }

  private speed(): number {
    return parseInt(this.$scope['speed']);
  }

  private shake(amount: number) {
    this.shakeDelta = 25 * amount;
    this.renderer.shakeOffset = 2 * amount;
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
  private accumulator = 0;

  run() {
    this.lastFrame = Date.now();
    this.frame();
  }

  private frame() {
    var now = Date.now();
    var delta = (now - this.lastFrame) / 1000;
    this.lastFrame = now;

    if (this.speed() > 0) {
      this.accumulator += delta;
      var ticksPerSecond = TICKS_PER_SECOND[this.speed()];
      while (this.accumulator > 1/ticksPerSecond) {
        this.accumulator -= 1/ticksPerSecond;
        this.city.tick();
      }
    } else {
      this.accumulator = 0;
    }

    if (this.shakeDelta != null) {
      this.renderer.shakeOffset += delta * this.shakeDelta;
      this.shakeDelta -= delta * 5000;
      if (this.renderer.shakeOffset < 0) {
        this.renderer.shakeOffset = 0;
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

    this.renderer.clear();
    this.backToFront(this.drawCell.bind(this));
    if (this.shortestPath) {
      for (var i = 0; i < this.shortestPath.length; i++) {
        this.renderer.drawSprite(this.shortestPath[i], this.assets.highlight, 1);
      }
    }
    if (this.highlight && this.buildMode() != null) {
      this.renderer.drawSprite(this.highlight, this.assets.highlight);
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
    this.renderer.drawSprite(coord, this.assets.underground);
    switch (cell.type) {
      case CellType.GRASS:
        this.renderer.drawSprite(coord, this.assets.ground, 0);
        break;
      case CellType.HOUSE:
        this.renderer.drawSprite(coord, this.assets.ground, 1);
        this.renderer.drawSprite(coord, this.assets.house, cell.stage);
        break;
      case CellType.OFFICE:
        this.renderer.drawSprite(coord, this.assets.ground, 2);
        this.renderer.drawSprite(coord, this.assets.office, cell.stage);
        break;
      case CellType.ROAD:
        this.renderer.drawSprite(coord, this.assets.ground, 1);
        this.renderer.drawSprite(coord, this.assets.road,
            (this.city.getCellOrDefault(coord.offset(-1, 0)).type == CellType.ROAD ? 1 : 0) +
            (this.city.getCellOrDefault(coord.offset(0, 1)).type == CellType.ROAD ? 2 : 0),
            (this.city.getCellOrDefault(coord.offset(1, 0)).type == CellType.ROAD ? 1 : 0) +
            (this.city.getCellOrDefault(coord.offset(0, -1)).type == CellType.ROAD ? 2 : 0));
    }
    var particles = this.particles[coord.toString()];
    if (particles) {
      this.drawParticles(coord, particles);
    }
  }

  private drawParticles(coord: Coord, particles: Array<Particle>) {
    particles.forEach((particle) => {
      this.renderer.setAlpha(particle.alpha);
      this.renderer.drawSprite(coord, particle.sprite, 0, 0, particle.x, particle.y, particle.scale);
    });
    this.renderer.setAlpha(1);
  }
}

angular.module('toytown', [])
  .controller('GameCtrl', GameCtrl)
  .directive('offable', offable);
angular.bootstrap(document, ['toytown']);
