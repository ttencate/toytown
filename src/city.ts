/// <reference path="../typings/tsd.d.ts" />

enum CellType {
  GRASS,
  HOUSE,
}

class Cell {
  type: CellType;
  variant: number;
}

class City {
  width = 32;
  height = 32;
  grid: Array<Array<Cell>>;

  constructor() {
    this.grid = [];
    for (var i = 0; i < this.height; i++) {
      this.grid[i] = [];
      for (var j = 0; j < this.width; j++) {
        var cell = new Cell();
        cell.type = CellType.GRASS;
        cell.variant = 0;
        this.grid[i][j] = cell;
      }
    }
  }
}
