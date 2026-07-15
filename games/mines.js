// games/mines.js

const { shuffledIndices } = require('./rng');

const GRID_SIZE = 25;
const HOUSE_EDGE = 0.03;
const MIN_MINES = 1;
const MAX_MINES = 24;

function placeMines(mineCount) {
  return shuffledIndices(GRID_SIZE).slice(0, mineCount).sort((a, b) => a - b);
}

function multiplierFor(revealed, mines) {
  let mult = 1;
  for (let i = 0; i < revealed; i++) {
    mult *= (GRID_SIZE - i) / (GRID_SIZE - mines - i);
  }
  return mult * (1 - HOUSE_EDGE);
}

module.exports = { GRID_SIZE, MIN_MINES, MAX_MINES, placeMines, multiplierFor };
