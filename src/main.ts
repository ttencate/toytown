/// <reference path="../typings/tsd.d.ts" />
/// <reference path="city.ts" />
/// <reference path="dom.ts" />
/// <reference path="renderer.ts" />

var DEBUG = true; // TODO switch to false for launch

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
  traffic = new Sprite(this.sprites, 320, 520, 80, 40, 40, 20);

  highlight = new Sprite(this.sprites, 0, 120, 80, 40, 40, 20);
  overlay = new Sprite(this.sprites, 0, 680, 80, 40, 40, 20);
  smoke = new Sprite(this.sprites, 0, 160, 20, 20, 10, 10);

  click = loadSound('click');
  build = loadSound('build');
  buildRoad = loadSound('road');
  destroy = loadSound('destroy');
  noCash = loadSound('nocash');
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
  overlay: string = null;

  private shakeDelta: number = null;
  private highlight: Coord;
  private highlightedCell: Cell;
  private builtSomething = false;
  private particles: {[key: string]: Array<Particle>} = {};

  constructor(private $scope: ng.IScope, private $timeout, $interval) {
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

    $interval(this.save.bind(this), 1000);
    $interval(function() {}, 200); // Side effect: trigger digest loop.
    $scope['speed'] = 1;
    $scope['build'] = null;
    $scope.$watch('build', (newValue, oldValue) => {
      this.builtSomething = false;
    });
    $scope.$watch('speed', (newValue, oldValue) => {
      if (newValue != oldValue) this.assets.click.play();
    });

    this.run();
  }

  reset() {
    this.city = new City();
  }

  steal() {
    if (DEBUG) {
      this.city.cash += 1000000;
    }
  }

  cashFlashing = false;
  flashCash() {
    this.cashFlashing = true;
    this.$timeout(() => { this.cashFlashing = false; }, 1000);
    this.$scope.$digest();
  }

  buildCost(type: string): number {
    return BUILD_COSTS[CellType[type]];
  }

  private save() {
    if (window.localStorage) {
      window.localStorage['toytownCity'] = this.city.toJson();
    }
  }

  private isMouseDown = false;

  private mouseMove(e: MouseEvent) {
    var oldHighlight = this.highlight;
    var coord = this.updateHighlight(e);
    if (this.isMouseDown && coord && coord != oldHighlight) {
      this.click(e, coord);
      e.preventDefault();
    }
  }

  private mouseDown(e: MouseEvent) {
    if (e.which != 1) return;
    this.isMouseDown = true;
    var coord = this.updateHighlight(e);
    if (coord) {
      this.click(e, coord);
      e.preventDefault();
    }
  }

  private mouseUp(e: MouseEvent) {
    if (e.which != 1) return;
    this.isMouseDown = false;
    this.startPoint = null;
    this.shortestPath = null;
  }

  private updateHighlight(e: MouseEvent): Coord {
    var x = e.clientX - this.canvas.offset().left;
    var y = e.clientY - this.canvas.offset().top;
    var oldHighlight = this.highlight;
    this.highlight = this.renderer.unproject(x, y);
    this.highlightedCell = this.highlight ? this.city.getCell(this.highlight) : null;
    if (this.highlight != oldHighlight) {
      this.$scope.$digest();
    }
    return this.highlight;
  }

  // For debugging.
  private startPoint: Coord;
  private shortestPath: Array<Coord>;

  private click(e: MouseEvent, coord: Coord) {
    if (DEBUG && e.shiftKey) {
      this.city.tickCell(coord);
      return;
    }

    if (DEBUG && e.ctrlKey) {
      if (this.startPoint) {
        this.shortestPath = this.city.getShortestPath(this.startPoint, coord);
      } else {
        this.startPoint = coord;
      }
      return;
    }

    var buildMode = this.buildMode();
    if (buildMode && this.highlightedCell) {
      switch (buildMode) {
        case CellType.GRASS:
          if (this.highlightedCell.type != CellType.GRASS) {
            if (this.city.destroy(coord)) {
              this.assets.destroy.play();
              this.shake(1);
              this.smoke(coord, 4);
              this.builtSomething = true;
            }
          } else {
            this.assets.noCash.play();
            this.flashCash();
          }
          break;
        default:
          if (this.highlightedCell.type == CellType.GRASS) {
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
              this.smoke(coord, 1);
              this.builtSomething = true;
            } else {
              this.assets.noCash.play();
              this.flashCash();
            }
          }
          break;
      }
    }
  }

  private buildMode(): CellType {
    return <CellType><any>CellType[this.$scope['build']];
  }

  private stopBuilding() {
    this.$scope['build'] = null;
    this.$scope.$digest();
  }

  private speed(): number {
    return parseInt(this.$scope['speed']);
  }

  private shake(amount: number) {
    this.shakeDelta = 25 * amount;
    this.renderer.shakeOffset = 2 * amount;
  }

  private smoke(coord: Coord, speed: number) {
    var particles = [];
    for (var i = 0; i < 20; i++) {
      var x = SPRITE_WIDTH / 2 * (Math.random() - 0.5);
      var y = SPRITE_HEIGHT / 2 * (Math.random() - 0.5);
      var p = new Particle(this.assets.smoke);
      p.x = x;
      p.y = y;
      p.vx = speed * x;
      p.vy = speed * (y - SPRITE_HEIGHT / 2);
      p.scale = 0.5 + Math.random();
      p.vscale = 1;
      particles.push(p);
    }
    this.particles[coord.asString] = particles;
  }

  private lastFrame: number;
  private accumulator = 0;

  ticksPerSecond = 0;
  private ticks = 0;
  framesPerSecond = 0;
  private frames = 0;

  run() {
    this.lastFrame = Date.now();
    this.frame();
  }

  private frame() {
    var now = Date.now();
    var delta = Math.min(0.2, (now - this.lastFrame) / 1000);
    if (Math.floor(now / 1000) != Math.floor(this.lastFrame / 1000)) {
      this.ticksPerSecond = this.ticks;
      this.ticks = 0;
      this.framesPerSecond = this.frames;
      this.frames = 0;
    }
    this.lastFrame = now;
    this.frames++;

    if (this.speed() > 0) {
      this.accumulator += delta;
      var ticksPerSecond = TICKS_PER_SECOND[this.speed()];
      while (this.accumulator > 1/ticksPerSecond) {
        this.accumulator -= 1/ticksPerSecond;
        this.city.tick();
        this.ticks++;
        if (Date.now() - this.lastFrame > 100) {
          this.accumulator = 0;
          break;
        }
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
    this.backToFront(this.drawGround.bind(this));
    this.backToFront(this.drawContents.bind(this));
    if (this.shortestPath) {
      for (var i = 0; i < this.shortestPath.length; i++) {
        this.renderer.drawSprite(this.shortestPath[i], this.assets.highlight, 1);
      }
    }
    if (this.overlay) {
      switch (this.overlay) {
        case 'OCCUPANCY':
          this.backToFront((coord, cell) => {
            this.renderer.drawSprite(coord, this.assets.overlay, 0,
              Math.min(7, Math.ceil(7 * (1 - cell.population / cell.maxPopulation()))));
          });
          break;
        case 'UNEMPLOYMENT':
          this.backToFront((coord, cell) => {
            this.renderer.drawSprite(coord, this.assets.overlay, 0,
              Math.min(7, Math.ceil(7 * (1 - cell.employers / cell.population))));
          });
          break;
        case 'VACANCY':
          this.backToFront((coord, cell) => {
            this.renderer.drawSprite(coord, this.assets.overlay, 0,
              Math.min(7, Math.ceil(7 * (1 - cell.employees / cell.maxJobs()))));
          });
          break;
        case 'TRAFFIC':
          this.backToFront((coord, cell) => {
            this.renderer.drawSprite(coord, this.assets.overlay, 0,
              Math.min(7, Math.ceil(7 * cell.traffic / ROAD_CAPACITY)));
          });
          break;
        case 'COMMUTE':
          this.backToFront((coord, cell) => {
            this.renderer.drawSprite(coord, this.assets.overlay, 0,
              Math.min(7, Math.ceil(7 * cell.commuteTime / MAX_COMMUTE_TIME)));
          });
          break;
        case 'POLLUTION':
          this.backToFront((coord, cell) => {
            this.renderer.drawSprite(coord, this.assets.overlay, 0,
              Math.min(7, Math.ceil(7 * cell.pollution)));
          });
          break;
        case 'HOUSING_DESIRABILITY':
          this.backToFront((coord, cell) => {
            this.renderer.drawSprite(coord, this.assets.overlay, 0,
              Math.min(7, Math.ceil(0.0001 + 7 * (1 - cell.houseDesirability))));
          });
          break;
        case 'OFFICE_DESIRABILITY':
          this.backToFront((coord, cell) => {
            this.renderer.drawSprite(coord, this.assets.overlay, 0,
              Math.min(7, Math.ceil(0.0001 + 7 * (1 - cell.officeDesirability))));
          });
          break;
      }
    }
    if (this.highlight) {
      if (this.buildMode() == null) {
        this.city.contracts.byEmployee(this.highlight).forEach((contract) => {
          this.renderer.drawSprite(contract.employer, this.assets.highlight, 1);
        });
        this.city.contracts.byEmployer(this.highlight).forEach((contract) => {
          this.renderer.drawSprite(contract.employee, this.assets.highlight, 2);
        });
      } else {
        if ((this.buildMode() == CellType.GRASS) != (this.highlightedCell.type == CellType.GRASS)) {
          this.renderer.drawSprite(this.highlight, this.assets.highlight,
              BUILD_COSTS[this.buildMode()] <= this.city.cash ? 0 : 2);
        }
      }
    }

    requestAnimationFrame(this.frame.bind(this));
  }

  private backToFront(callback: (coord: Coord, cell: Cell) => void) {
    var s = this.city.size;
    for (var y = -s + 1; y < this.city.size; y++) {
      for (var x = 0; x < s - Math.abs(y); x++) {
        var coord;
        if (y > 0) {
          coord = Coord.of(y + x, x);
        } else {
          coord = Coord.of(x, Math.abs(y) + x);
        }
        callback(coord, this.city.getCell(coord));
      }
    }
  }

  private drawGround(coord: Coord, cell: Cell) {
    this.renderer.drawSprite(coord, this.assets.underground);
    switch (cell.type) {
      case CellType.GRASS:
        this.renderer.drawSprite(coord, this.assets.ground, 0);
        break;
      case CellType.HOUSE:
        this.renderer.drawSprite(coord, this.assets.ground, 1);
        break;
      case CellType.OFFICE:
        this.renderer.drawSprite(coord, this.assets.ground, 2);
        break;
      case CellType.ROAD:
        this.renderer.drawSprite(coord, this.assets.ground, 1);
        var n = this.city.getCellOrDefault(coord.offset(-1, 0)).type == CellType.ROAD;
        var e = this.city.getCellOrDefault(coord.offset(0, 1)).type == CellType.ROAD;
        var s = this.city.getCellOrDefault(coord.offset(1, 0)).type == CellType.ROAD;
        var w = this.city.getCellOrDefault(coord.offset(0, -1)).type == CellType.ROAD;
        this.renderer.drawSprite(coord, this.assets.road,
            (n?1:0) + (e?2:0),
            (s?1:0) + (w?2:0));
        break;
    }
  }

  private drawContents(coord: Coord, cell: Cell) {
    switch (cell.type) {
      case CellType.HOUSE:
        this.renderer.drawSprite(coord, this.assets.house, cell.stage);
        break;
      case CellType.OFFICE:
        this.renderer.drawSprite(coord, this.assets.office, cell.stage);
        break;
      case CellType.ROAD:
        var frame = Math.floor(this.city.tickCount % 100 / 25)
        for (var i = 0; i < 8; i++) {
          if (cell.cars & (1 << i)) {
            this.renderer.drawSprite(coord, this.assets.traffic, i >> 1, 4 * (i & 1) + frame);
          }
        }
        break;
    }
    var particles = this.particles[coord.asString];
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
