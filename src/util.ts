/// <reference path="../typings/tsd.d.ts" />

function removeReference<T>(array: Array<T>, value: T) {
  var index = array.indexOf(value);
  if (index >= 0) {
    array.splice(index, 1);
    return true;
  }
  return false;
}

function removeRandom<T>(array: Array<T>) {
  var index = Math.floor(array.length * Math.random());
  var item = array[index];
  array.splice(index, 1);
  return item;
}

function pickRandom<T>(array: Array<T>): T {
  return array[Math.floor(array.length * Math.random())];
}
