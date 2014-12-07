/// <reference path="../typings/tsd.d.ts" />
/// <reference path="util.ts" />

var POPULATION_STAGES = [
  0, 2, 4, 8, 16, 32, 64, 128
];

var JOB_STAGES = [
  0, 8, 16, 32, 64, 128, 256, 512
];

var DRIVE_TIME = 1;
var WALK_TIME = 10;
var TRAFFIC_FALLOFF = 200;
var ROAD_CAPACITY = 250;
var ROAD_SPEED_FALLOFF = 4;
var MAX_COMMUTE_TIME = 60;

class Coord {
  private static cache: {[key: string]: Coord} = {};

  // DO NOT USE. Use the cache instead.
  constructor(public i: number, public j: number, public asString: string) {
  }

  static of(i: number, j: number) {
    var asString = i + ',' + j;
    var coord = Coord.cache[asString];
    if (!coord) {
      coord = Coord.cache[asString] = new Coord(i, j, asString);
    }
    return coord;
  }

  static patch(c: {i: number; j: number}) {
    return Coord.of(c.i, c.j);
  }

  offset(di: number, dj: number): Coord {
    return Coord.of(this.i + di, this.j + dj);
  }

  neighbors(): Array<Coord> {
    return [
      this.offset(-1, 0), this.offset(1, 0),
      this.offset(0, -1), this.offset(0, 1)
    ];
  }

  manhattanDistance(other: Coord): number {
    return Math.abs(this.i - other.i) + Math.abs(this.j - other.j);
  }

  static fromNumber(n: number, size: number): Coord {
    return Coord.of(Math.floor(n / size), n % size);
  }
}

interface Route extends Array<Coord> {
  time: number;
}

enum CellType {
  DESTROY, // Not actually a cell type.
  GRASS,
  HOUSE,
  OFFICE,
  ROAD,
}

class PathStep {
  constructor(public travelTime: number, public next: Coord) {
  }
}

class Cell {
  type = CellType.GRASS;
  stage = 0;

  population = 0;
  employers = 0;
  employees = 0;
  commuteTime = 0;

  trafficSamples = 0;
  traffic = 0;
  cars = 0;

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

  travelTime(): number {
    // This must never return < 1 or A* will be confused.
    if (this.type == CellType.ROAD) {
      return DRIVE_TIME / Math.max(0.1, Math.pow(Math.max(0, ROAD_CAPACITY - this.traffic) / ROAD_CAPACITY, 1 / ROAD_SPEED_FALLOFF));
    } else {
      return WALK_TIME;
    }
  }

  updateCars(n: boolean, e: boolean, s: boolean, w: boolean) {
    this.cars = 0;
    var allowed = (n?0x03:0) | (e?0x0c:0) | (s?0x30:0) | (w?0xc0:0);
    var totalSpace = (n?2:0) + (e?2:0) + (s?2:0) + (w?2:0);
    var num = Math.min(totalSpace, totalSpace * this.traffic / ROAD_CAPACITY);
    for (; num > 0; num--) {
      do {
        var bit = 1 << Math.floor(Math.random() * 8);
      } while (!(allowed & bit) || this.cars & bit);
      this.cars |= bit;
    }
  }
  
  static DEFAULT = new Cell();
}

class Contract {
  commuteTime = 0;

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
    removeReference(this.asArray, contract) || console.error('missing in array', contract);
    removeReference(this.byEmployer(contract.employer), contract) || console.error('missing in employer', contract);
    removeReference(this.byEmployee(contract.employee), contract) || console.error('missing in employee', contract);
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

class City {
  size = 20;

  private grid: Array<Array<Cell>>;
  contracts = new Contracts();

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
        var coord = Coord.of(i, j);
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
    this.contracts.byEmployee(coord).slice().forEach((contract) => {
      this.removeContract(contract);
    });
    this.contracts.byEmployer(coord).slice().forEach((contract) => {
      this.removeContract(contract);
    });
    return true;
  }

  getShortestPath(from: Coord, to: Coord): Route {
    function heuristic(from: Coord, to: Coord) {
      return from.manhattanDistance(to);
    }

    var gScore = {};
    var fScore = {};
    var closedSet = {};
    var openSet = {};
    var cameFrom = {};

    openSet[from.asString] = from;
    gScore[from.asString] = 0;
    fScore[from.asString] = heuristic(from, to);

    var current;
    while (openSet != {}) {
      current = null;
      for (var key in openSet) {
        if (!current || fScore[key] < fScore[current.asString]) {
          current = openSet[key];
        }
      }
      delete openSet[current.asString];
      if (current == to) {
        var path = <Route>[to];
        path.time = gScore[to.asString];
        while (to != from) {
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
        var distToNeighbor = (this.getCell(current).travelTime() + neighborCell.travelTime()) / 2;
        var tentativeGScore = gScore[current.asString] + distToNeighbor;
        if (!(neighbor.asString in openSet) || tentativeGScore < gScore[neighbor.asString]) {
          cameFrom[neighbor.asString] = current;
          gScore[neighbor.asString] = tentativeGScore;
          fScore[neighbor.asString] = tentativeGScore + heuristic(neighbor, to);
          if (!openSet[neighbor.asString]) {
            openSet[neighbor.asString] = neighbor;
          }
        }
      }
    }
    return undefined;
  }

  tickCount = 0;

  tick() {
    this.tickCount++;
    this.tickCell(Coord.of(Math.floor(Math.random() * this.size), Math.floor(Math.random() * this.size)));
    this.tickContract(pickRandom(this.contracts.asArray));
    this.updateStats();
    if (this.tickCount % 200 == 0) {
      this.forEachCell((coord, cell) => {
        var n = this.getCellOrDefault(coord.offset(-1, 0)).type == CellType.ROAD;
        var e = this.getCellOrDefault(coord.offset(0, 1)).type == CellType.ROAD;
        var s = this.getCellOrDefault(coord.offset(1, 0)).type == CellType.ROAD;
        var w = this.getCellOrDefault(coord.offset(0, -1)).type == CellType.ROAD;
        cell.updateCars(n, e, s, w);
      });
    }
  }

  // Public only for debugging.
  tickCell(coord: Coord) {
    var cell = this.getCell(coord);
    // TODO shrink if things are going badly
    switch (cell.type) {
      case CellType.HOUSE:
        // Immigration if there are enough jobs.
        var populationDemand = this.jobs - this.population + Math.ceil(POPULATION_STAGES[1] + 0.01 * (this.jobs + this.population));
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
            // TODO this.removeContract(contracts[i]);
          }
        }

        // Go job hunting.
        var unemployed = cell.population - cell.employers;
        for (var i = 0; i < unemployed; i++) {
          this.findJob(coord);
        }

        // Compute average commute length.
        var contracts = this.contracts.byEmployee(coord);
        if (contracts.length > 0) {
          var sum = 0;
          contracts.forEach((contract) => { sum += contract.commuteTime; });
          cell.commuteTime = sum / contracts.length;
        } else {
          cell.commuteTime = 0;
        }
        break;
      case CellType.OFFICE:
        var workerSupply = this.population - this.jobs + Math.ceil(JOB_STAGES[1] + 0.01 * (this.jobs + this.population));
        if (workerSupply > 0) {
          if (cell.stage < JOB_STAGES.length - 1
              && workerSupply > JOB_STAGES[cell.stage + 1] - cell.employees) {
            cell.stage++;
          }
        }
        break;
    }
  }

  private tickContract(contract: Contract) {
    if (!contract) return;
    this.forEachCell((coord, cell) => {
      cell.trafficSamples *= 1 - 1/TRAFFIC_FALLOFF;
    });
    var route = this.getShortestPath(contract.employee, contract.employer);
    route.forEach((coord) => {
      this.getCell(coord).trafficSamples++;
    });
    contract.commuteTime = route.time;
  }

  private addContract(contract: Contract) {
    this.contracts.add(contract);
    this.getCell(contract.employee).employers++;
    this.getCell(contract.employer).employees++;
  }

  private removeContract(contract: Contract) {
    this.getCell(contract.employee).employers--;
    this.getCell(contract.employer).employees--;
    this.contracts.remove(contract);
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

  private updateStats() {
    this.employments = this.contracts.asArray.length;
    this.population = 0;
    this.jobs = 0;
    this.forEachCell((coord, cell) => {
      this.population += cell.population;
      this.jobs += cell.maxJobs();
      cell.traffic = Math.round(cell.trafficSamples * this.employments / TRAFFIC_FALLOFF);
    });
  }
}
