/// <reference path="../typings/tsd.d.ts" />
/// <reference path="util.ts" />

class Coord {
  asString: string;

  constructor(public i: number, public j: number) {
    this.asString = i + ',' + j;
  }

  static patch(c: {i: number; j: number}) {
    return new Coord(c.i, c.j);
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
  employers = 0;
  employees = 0;

  oldTraffic = 0;
  newTraffic = 0;

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
    return this.maxJobs() - this.employees;
  }

  distance(): number {
    // This must never return < 1 or A* will be confused.
    return this.type == CellType.ROAD ? 1 : 10;
  }
  
  static DEFAULT = new Cell();
}

class Contract {
  constructor(public employee: Coord, public employer: Coord) {
  }

  patchAfterLoad() {
    this.employee = Coord.patch(this.employee);
    this.employer = Coord.patch(this.employer);
  }
}

class Contracts {
  asArray: Array<Contract> = [];
  private employer: {[employer: string]: Array<Contract>} = {};
  private employee: {[employee: string]: Array<Contract>} = {};

  add(contract: Contract) {
    this.asArray.push(contract);
    this.employer[contract.employer.asString] = this.employer[contract.employer.asString] || [];
    this.employer[contract.employer.asString].push(contract);
    this.employee[contract.employee.asString] = this.employee[contract.employee.asString] || [];
    this.employee[contract.employee.asString].push(contract);
  }

  remove(contract: Contract) {
    removeReference(this.asArray, contract);
    removeReference(this.byEmployer(contract.employer), contract);
    removeReference(this.byEmployee(contract.employee), contract);
  }

  byEmployer(coord: Coord): Array<Contract> {
    return this.employer[coord.asString] || [];
  }

  byEmployee(coord: Coord): Array<Contract> {
    return this.employee[coord.asString] || [];
  }

  patchAfterLoad() {
    var jsonArray = this.asArray;
    this.asArray = [];
    this.employer = {};
    this.employee = {};
    for (var i = 0; i < jsonArray.length; i++) {
      var c = jsonArray[i];
      this.add(new Contract(Coord.patch(c.employee), Coord.patch(c.employer)));
    }
  }
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
  private contracts = new Contracts();

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
    city.contracts.patchAfterLoad();
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
    if (type == CellType.ROAD) {
      this.invalidateRoutes();
    }
    return true;
  }

  destroy(coord: Coord): boolean {
    var cell = this.getCell(coord);
    if (cell.type == CellType.GRASS) {
      return false;
    }
    if (cell.type == CellType.ROAD) {
      this.invalidateRoutes();
    }
    cell.type = CellType.GRASS;
    cell.stage = 0;
    cell.population = 0;
    this.contracts.byEmployee(coord).forEach((contract) => {
      this.contracts.remove(contract);
    });
    this.contracts.byEmployer(coord).forEach((contract) => {
      this.contracts.remove(contract);
    });
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
    // var heap = new BinaryHeap(function(coord) { return fScore[coord.asString]; })
    var cameFrom = {};

    //heap.push(from);
    openSet[from.asString] = from;
    gScore[from.asString] = 0;
    fScore[from.asString] = heuristic(from, to);

    var current;
    while (openSet != {}) {
      // current = heap.pop();
      current = null;
      for (var key in openSet) {
        if (!current || fScore[key] < fScore[current.asString]) {
          current = openSet[key];
        }
      }
      delete openSet[current.asString];
      if (current.equals(to)) {
        var path = [to];
        while (!to.equals(from)) {
          to = cameFrom[to.asString];
          path.unshift(to);
        }
        return path;
      }
      closedSet[current.asString] = true;
      for (var i = 0; i < 4; i++) {
        var neighbor = current.offset(i < 2 ? (i == 0 ? -1 : 1) : 0, i < 2 ? 0 : (i == 2 ? -1 : 1));
        if (closedSet[neighbor.asString]) {
          continue;
        }
        var neighborCell = this.getCell(neighbor);
        if (!neighborCell) {
          continue;
        }
        var distToNeighbor = (this.getCell(current).distance() + neighborCell.distance()) / 2;
        var tentativeGScore = gScore[current] + distToNeighbor;
        if (!(neighbor.asString in openSet) || tentativeGScore < gScore[neighbor.asString]) {
          cameFrom[neighbor.asString] = current;
          gScore[neighbor.asString] = tentativeGScore;
          fScore[neighbor.asString] = tentativeGScore + heuristic(neighbor, to);
          if (!openSet[neighbor.asString]) {
            // heap.push(neighbor);
            openSet[neighbor.asString] = neighbor;
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

        // Have some people randomly be fired.
        var contracts = this.contracts.byEmployee(coord);
        for (var i = 0; i < contracts.length; i++) {
          if (Math.random() < 0.01) {
            this.removeContract(contracts[i]);
          }
        }

        // Go job hunting.
        var unemployed = cell.population - cell.employers;
        for (var i = 0; i < unemployed; i++) {
          this.findJob(coord);
        }
        break;
      case CellType.OFFICE:
        var workerSupply = this.population - this.jobs + FUDGE_FACTOR;
        if (this.population - this.jobs > 0) {
          if (cell.stage < JOB_STAGES.length - 1
              && workerSupply > JOB_STAGES[cell.stage + 1] - cell.employees) {
            cell.stage++;
          }
        }
        break;
    }
  }

  private addContract(contract: Contract) {
    this.contracts.add(contract);
    this.getCell(contract.employee).employers++;
    this.getCell(contract.employer).employees++;
  }

  private removeContract(contract: Contract) {
    this.contracts.remove(contract);
    this.getCell(contract.employee).employers--;
    this.getCell(contract.employer).employees--;
  }

  private findJob(employee: Coord) {
    var edge = [employee];
    var edgeSet = {}; edgeSet[employee.asString] = true;
    var visited = {};
    var attempts = 0;
    while (edge.length && attempts < 100) {
      attempts++;

      var current = removeRandom(edge);
      delete edgeSet[current.asString];

      var cell = this.getCell(current);
      if (!cell) continue;

      visited[current.asString] = true;
      if (cell.vacancies() > 0) {
        this.addContract(new Contract(employee, current));
        return;
      }

      current.neighbors().forEach((neighbor) => {
        if (!visited[neighbor.asString] && !edgeSet[neighbor.asString]) {
          edge.push(neighbor);
          edgeSet[neighbor.asString] = true;
        }
      });
    }
  }

  private invalidateRoutes() {
    this.forEachCell(function(coord, cell) {
      cell.oldTraffic = cell.newTraffic;
      cell.newTraffic = 0;
    });
  }

  private updateStats() {
    this.population = 0;
    this.jobs = 0;
    this.employments = 0;
    this.forEachCell((coord, cell) => {
      this.population += cell.population;
      this.jobs += cell.maxJobs();
      this.employments += cell.employees;
    });
  }
}
