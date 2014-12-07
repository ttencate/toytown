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

function clamp(min: number, max: number, x: number) {
  return x < min ? min : x > max ? max : x;
}

function shuffle<T>(array: Array<T>): Array<T> {
  for (var i = 0; i < array.length; i++) {
    var index = i + Math.floor(Math.random() * (array.length - i));
    var tmp = array[i];
    array[i] = array[index];
    array[index] = tmp;
  }
  return array;
}

function randInt(upper: number): number {
  return Math.floor(Math.random() * upper);
}
