/// <reference path="../typings/tsd.d.ts" />

class Coord {
  i: number;
  j: number;
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
  grid: Array<Array<Cell>>;

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
}
