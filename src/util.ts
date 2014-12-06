/// <reference path="../typings/tsd.d.ts" />

interface Equatable {
  equals(other: any): boolean;
}

function removeValue(array: Array<Equatable>, value: Equatable) {
  for (var i = 0; i < array.length; i++) {
    if (!array[i].equals) console.log(array[i]);
    if (array[i].equals(value)) {
      array.splice(i, 1);
      i--;
    }
  }
}

function removeRandom<T>(array: Array<T>) {
  var index = Math.floor(array.length * Math.random());
  var item = array[index];
  array.splice(index, 1);
  return item;
}
