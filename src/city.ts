/// <reference path="../typings/tsd.d.ts" />
/// <reference path="util.ts" />

class Coord {
  constructor(public i: number, public j: number) {
  }

  toString(): string {
    return this.i + ',' + this.j;
  }

  offset(di: number, dj: number): Coord {
    return new Coord(this.i + di, this.j + dj);
  }

  neighbors(): Array<Coord> {
    return [
      this.offset(-1, 0), this.offset(1, 0),
      this.offset(0, -1), this.offset(0, 1)
    ];
  }

  equals(other: Coord): boolean {
    return this.i == other.i && this.j == other.j;
  }

  manhattanDistance(other: Coord): number {
    return Math.abs(this.i - other.i) + Math.abs(this.j - other.j);
  }

  static fromNumber(n: number, size: number): Coord {
    return new Coord(Math.floor(n / size), n % size);
  }
}

enum CellType {
  DESTROY, // Not actually a cell type.
  GRASS,
  HOUSE,
  OFFICE,
  ROAD,
}

class PathStep {
  constructor(public distance: number, public next: Coord) {
  }
}

class Cell {
  type = CellType.GRASS;
  stage = 0;
  population = 0;
  employees: Array<Coord> = [];
  jobs: Array<Coord> = [];

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

  vacancies(): number {
    if (this.type != CellType.OFFICE) {
      return 0;
    }
    return this.maxJobs() - this.employees.length;
  }

  distance(): number {
    // This must never return < 1 or A* will be confused.
    return this.type == CellType.ROAD ? 1 : 10;
  }

  patchAfterLoad() {
    for (var i = 0; i < this.employees.length; i++) {
      var c = this.employees[i];
      this.employees[i] = new Coord(c.i, c.j);
    }
    for (var i = 0; i < this.jobs.length; i++) {
      var c = this.jobs[i];
      this.jobs[i] = new Coord(c.i, c.j);
    }
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
  employments = 0;

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
    city.forEachCell(function(coord, cell) { cell.patchAfterLoad(); })
    city.updateStats();
    return city;
  }

  toJson(): string {
    return JSON.stringify(this);
  }

  getCell(coord: Coord): Cell {
    var row = this.grid[coord.i];
    if (!row) return undefined;
    return row[coord.j];
  }

  getCellOrDefault(coord: Coord): Cell {
    return this.getCell(coord) || Cell.DEFAULT;
  }

  forEachCell(callback: (coord: Coord, cell: Cell) => void) {
    for (var i = 0; i < this.size; i++) {
      for (var j = 0; j < this.size; j++) {
        var coord = new Coord(i, j);
        callback(coord, this.getCell(coord));
      }
    }
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
    cell.jobs.forEach((job) => {
      this.removeJob(coord, job);
    });
    cell.jobs = [];
    cell.employees.forEach((employee) => {
      this.removeJob(employee, coord);
    });
    cell.employees = [];
    return true;
  }

  getShortestPath(from: Coord, to: Coord): Array<Coord> {
    function heuristic(from: Coord, to: Coord) {
      return from.manhattanDistance(to);
    }

    var gScore = {};
    var fScore = {};
    var closedSet = {};
    var openSet = {};
    // var heap = new BinaryHeap(function(coord) { return fScore[coord.toString()]; })
    var cameFrom = {};

    //heap.push(from);
    openSet[from.toString()] = from;
    gScore[from.toString()] = 0;
    fScore[from.toString()] = heuristic(from, to);

    var current;
    while (openSet != {}) {
      // current = heap.pop();
      current = null;
      for (var key in openSet) {
        if (!current || fScore[key] < fScore[current.toString()]) {
          current = openSet[key];
        }
      }
      delete openSet[current.toString()];
      if (current.equals(to)) {
        var path = [to];
        while (!to.equals(from)) {
          to = cameFrom[to.toString()];
          path.unshift(to);
        }
        return path;
      }
      closedSet[current.toString()] = true;
      for (var i = 0; i < 4; i++) {
        var neighbor = current.offset(i < 2 ? (i == 0 ? -1 : 1) : 0, i < 2 ? 0 : (i == 2 ? -1 : 1));
        if (closedSet[neighbor.toString()]) {
          continue;
        }
        var neighborCell = this.getCell(neighbor);
        if (!neighborCell) {
          continue;
        }
        var distToNeighbor = (this.getCell(current).distance() + neighborCell.distance()) / 2;
        var tentativeGScore = gScore[current] + distToNeighbor;
        if (!(neighbor.toString() in openSet) || tentativeGScore < gScore[neighbor.toString()]) {
          cameFrom[neighbor.toString()] = current;
          gScore[neighbor.toString()] = tentativeGScore;
          fScore[neighbor.toString()] = tentativeGScore + heuristic(neighbor, to);
          if (!openSet[neighbor.toString()]) {
            // heap.push(neighbor);
            openSet[neighbor.toString()] = neighbor;
          }
        }
      }
    }
    return undefined;
  }

  tick() {
    this.tickCell(new Coord(Math.floor(Math.random() * this.size), Math.floor(Math.random() * this.size)));
    this.updateStats();
  }

  // Public only for debugging.
  tickCell(coord: Coord) {
    var FUDGE_FACTOR = Math.ceil(4 + 0.01 * (this.jobs + this.population));
    var cell = this.getCell(coord);
    // TODO shrink if things are going badly
    switch (cell.type) {
      case CellType.HOUSE:
        // Immigration if there are enough jobs.
        var populationDemand = this.jobs - this.population + FUDGE_FACTOR;
        if (populationDemand > 0) {
          if (cell.stage < POPULATION_STAGES.length - 1
              && populationDemand >= POPULATION_STAGES[cell.stage + 1] - cell.population) {
            cell.stage++;
          }
          cell.population = Math.min(cell.maxPopulation(), cell.population + Math.min(10, populationDemand));
        }

        // Fire some people randomly.
        for (var i = 0; i < cell.jobs.length; i++) {
          if (Math.random() < 0.01) {
            this.removeJob(coord, cell.jobs[i]);
          }
        }

        // Go job hunting.
        var unemployed = cell.population - cell.jobs.length;
        for (var i = 0; i < unemployed; i++) {
          this.findJob(coord);
        }
        break;
      case CellType.OFFICE:
        var workerSupply = this.population - this.jobs + FUDGE_FACTOR;
        if (this.population - this.jobs > 0) {
          if (cell.stage < JOB_STAGES.length - 1
              && workerSupply > JOB_STAGES[cell.stage + 1] - cell.employees.length) {
            cell.stage++;
          }
        }
        break;
    }
  }

  private addJob(employee: Coord, job: Coord) {
    this.getCell(employee).jobs.push(job);
    this.getCell(job).employees.push(employee);
  }

  private removeJob(employee: Coord, job: Coord) {
    removeValue(this.getCell(employee).jobs, job);
    removeValue(this.getCell(job).employees, employee);
  }

  private findJob(employee: Coord) {
    var edge = [employee];
    var edgeSet = {}; edgeSet[employee.toString()] = true;
    var visited = {};
    var attempts = 0;
    while (edge.length && attempts < 100) {
      attempts++;

      var current = removeRandom(edge);
      delete edgeSet[current.toString()];

      var cell = this.getCell(current);
      if (!cell) continue;

      visited[current.toString()] = true;
      if (cell.vacancies() > 0) {
        this.addJob(employee, current);
        return;
      }

      current.neighbors().forEach((neighbor) => {
        if (!visited[neighbor.toString()] && !edgeSet[neighbor.toString()]) {
          edge.push(neighbor);
          edgeSet[neighbor.toString()] = true;
        }
      });
    }
  }

  private updateStats() {
    this.population = 0;
    this.jobs = 0;
    this.employments = 0;
    this.forEachCell((coord, cell) => {
      this.population += cell.population;
      this.jobs += cell.maxJobs();
      this.employments += cell.employees.length;
    });
  }
}
