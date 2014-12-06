/// <reference path="../typings/tsd.d.ts" />

class Coord {
  constructor(public i: number, public j: number) {
  }

  toString(): string {
    return this.i + ',' + this.j;
  }

  offset(di: number, dj: number): Coord {
    return new Coord(this.i + di, this.j + dj);
  }
}

enum CellType {
  DESTROY, // Not actually a cell type.
  GRASS,
  HOUSE,
  OFFICE,
  ROAD,
}

class Cell {
  type = CellType.GRASS;
  stage = 0;
  population = 0;
  jobs = 0;

  maxPopulation(): number {
    if (this.type != CellType.HOUSE) {
      return 0;
    }
    return POPULATION_STAGES[this.stage];
  }

  maxJobs(): number {
    if (this.type != CellType.OFFICE) {
      return 0;
    }
    return JOB_STAGES[this.stage];
  }
  
  static DEFAULT = new Cell();
}

var POPULATION_STAGES = [
  0, 4, 8, 16, 32, 64, 128, 256
];

var JOB_STAGES = [
  0, 8, 16, 32, 64, 128, 256, 512
];

class City {
  size = 20;

  private grid: Array<Array<Cell>>;

  population = 0;
  jobs = 0;

  constructor() {
    this.grid = [];
    for (var i = 0; i < this.size; i++) {
      this.grid[i] = [];
      for (var j = 0; j < this.size; j++) {
        this.grid[i][j] = new Cell();
      }
    }
  }

  static fromJson(json: string) {
    function copyInto(obj: Object, json: Object) {
      for (var key in json) {
        if (typeof obj[key] == 'object') {
          copyInto(obj[key], json[key]);
        } else {
          obj[key] = json[key];
        }
      }
    }
    var city = new City();
    copyInto(city, JSON.parse(json));
    city.updateStats();
    return city;
  }

  toJson(): string {
    return JSON.stringify(this);
  }

  getCell(coord: Coord): Cell {
    return this.grid[coord.i][coord.j];
  }

  getCellOrDefault(coord: Coord): Cell {
    return this.grid[coord.i][coord.j] || Cell.DEFAULT;
  }

  build(coord: Coord, type: CellType): boolean {
    var cell = this.getCell(coord);
    if (cell.type != CellType.GRASS) {
      return false;
    }
    cell.type = type;
    return true;
  }

  destroy(coord: Coord): boolean {
    var cell = this.getCell(coord);
    if (cell.type == CellType.GRASS) {
      return false;
    }
    cell.type = CellType.GRASS;
    cell.stage = 0;
    cell.population = 0;
    cell.jobs = 0;
    return true;
  }

  tick() {
    this.tickCell(new Coord(Math.floor(Math.random() * this.size), Math.floor(Math.random() * this.size)));
    this.updateStats();
  }

  // Public only for debugging.
  tickCell(coord: Coord) {
    var FUDGE_FACTOR = Math.ceil(10 + 0.01 * (this.jobs + this.population));
    var cell = this.getCell(coord);
    switch (cell.type) {
      case CellType.HOUSE:
        var populationDemand = this.jobs - this.population + FUDGE_FACTOR;
        if (populationDemand > 0) {
          if (cell.stage < POPULATION_STAGES.length - 1
              && populationDemand >= POPULATION_STAGES[cell.stage + 1] - cell.population) {
            cell.stage++;
          }
          if (populationDemand > 0 && cell.population < cell.maxPopulation()) {
            cell.population = Math.min(cell.population + populationDemand, cell.maxPopulation());
          }
        }
        break;
      case CellType.OFFICE:
        var jobDemand = this.population - this.jobs + FUDGE_FACTOR;
        if (this.population - this.jobs > 0) {
          if (cell.stage < JOB_STAGES.length - 1
              && jobDemand > JOB_STAGES[cell.stage + 1] - cell.jobs) {
            cell.stage++;
          }
          if (jobDemand > 0 && cell.jobs < cell.maxJobs()) {
            cell.jobs = Math.min(cell.jobs + jobDemand, cell.maxJobs());
          }
        }
        break;
    }
  }

  private updateStats() {
    this.population = 0;
    this.jobs = 0;
    for (var i = 0; i < this.size; i++) {
      for (var j = 0; j < this.size; j++) {
        var cell = this.grid[i][j];
        this.population += cell.population;
        this.jobs += cell.jobs;
      }
    }
  }
}
