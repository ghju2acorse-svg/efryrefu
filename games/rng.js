// games/rng.js

const crypto = require('crypto');

function randInt(min, max) {
  return min + crypto.randomInt(max - min + 1);
}

function randFloat() {
  return crypto.randomInt(0, 1_000_000) / 1_000_000;
}

function weightedPick(entries) {
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let r = randFloat() * total;
  for (const e of entries) {
    if (r < e.weight) return e.value;
    r -= e.weight;
  }
  return entries[entries.length - 1].value;
}

function shuffledIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

module.exports = { randInt, randFloat, weightedPick, shuffledIndices };
