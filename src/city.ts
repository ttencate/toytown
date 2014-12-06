/// <reference path="../typings/tsd.d.ts" />

class Coord {
  constructor(public i: number, public j: number) {
  }

  toString(): string {
    return this.i + ',' + this.j;
  }
}

enum CellType {
  GRASS,
  HOUSE,
}

class Cell {
  type: CellType;
  variant: number;
}

class City {
  size = 24;
  private grid: Array<Array<Cell>>;

  constructor() {
    this.grid = [];
    for (var i = 0; i < this.size; i++) {
      this.grid[i] = [];
      for (var j = 0; j < this.size; j++) {
        var cell = new Cell();
        cell.type = CellType.GRASS;
        cell.variant = 0;
        this.grid[i][j] = cell;
      }
    }
  }

  getCell(coord: Coord): Cell {
    return this.grid[coord.i][coord.j];
  }
}
