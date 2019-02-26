#! /usr/bin/env node
"use strict";

var _lib = _interopRequireDefault(require("./lib"));

var _underscore = _interopRequireDefault(require("underscore"));

var _progress = _interopRequireDefault(require("progress"));

var _fs = _interopRequireDefault(require("fs"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const USEFUL_COLORS = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'];

const colors = require('colors/safe');

let options = require('optimist').argv;

let files = options._;
let bar;

if (options.version || options.v) {
  console.log(JSON.parse(_fs.default.readFileSync(__dirname + '/../package.json').toString()).version);
  process.exit();
}

if (!files.length) {
  handler(new Error('No argument or file specified'));
  process.exit();
}

if (options.start) {
  options.start = String(options.start);

  if (new Date(options.start).toString() === 'Invalid Date') {
    handler(new Error('Start date is invalid'));
    process.exit();
  } else {
    options.start = new Date(options.start);
  }
}

if (options.end) {
  options.end = String(options.end);

  if (new Date(options.end).toString() === 'Invalid Date') {
    handler(new Error('End date is invalid'));
    process.exit();
  } else {
    options.end = new Date(options.end);
  }
}

options.sortBy = options.sortBy || options.s || 1;

if (typeof options.sortBy !== 'number') {
  handler(new Error('--sortBy must be a number'));
  process.exit();
} // Assign default columns


options.cols = ['count', 'requested_resource'];
options.prefixes = [];
options.sortBy = options.sortBy - 1; // lib.js accepts sortBy starting with 0 while cli accepts starting with 1

options.limit = options.limit || 10;
options.ascending = options.a; // Parse prefixes and column choices

_underscore.default.each(options, function (arg, key) {
  let match = key.match(/^p(refix){0,1}([0-9]+)$/);

  if (match && !isNaN(Number(match[2]))) {
    let index = Number(match[2]) - 1;
    return options.prefixes[index] = arg;
  }

  match = key.match(/^c(ol){0,1}([0-9]+)$/);

  if (match && !isNaN(Number(match[2]))) {
    let index = Number(match[2]) - 1;
    options.cols[index] = arg;
  }
});

(0, _lib.default)({
  files,
  ...options,

  onProgress() {
    bar.tick();
  },

  onStart(filenames) {
    bar = new _progress.default(' processing [:bar] :percent :etas', {
      complete: '=',
      incomplete: ' ',
      width: 30,
      total: filenames.length
    });
  }

}).then(function (logs) {
  _underscore.default.each(logs, (log, i) => {
    const coloredText = _underscore.default.map(log, (l, index) => {
      const colorName = USEFUL_COLORS[index % USEFUL_COLORS.length];
      return colors[colorName](l);
    }).join(colors.white(' - '));

    console.log(colors.white(String(i + 1)) + ' - ' + coloredText);
  });
}).catch(handler);

function handler(err) {
  console.log(`${colors.red('An error occured')}: `, colors.cyan(err.toString()));
}