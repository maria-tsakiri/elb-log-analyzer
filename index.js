#! /usr/bin/env node

'use strict';

const fs = require('fs')
  , readline = require('readline')
  , _ = require('underscore')
  , async = require('async')
  , glob = require('glob')
  , colors = require('colors/safe')
  , usefulColors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan']
  , VERSION = 'v0.2.0'

let argv = require('optimist').argv
  , OUTPUT_LIMIT = 10
  , files = argv._;


if (argv.version || argv.v) {
  return console.log(VERSION);
}

if (files == 0) {
  throw new Error('No argument or file specified');
}

// Assign default columns
argv.cols = [ 'count', 'requested_resource' ];
argv.prefixes = [];
argv.sortBy = argv.sortBy || argv.s;

// Parse prefixes and column choices
_.each(argv, function (arg, key) {
  let match = key.match(/^p(refix){0,1}([0-9]+)$/);

  if (match) {
    argv.prefixes[match[2] - 1] = arg;
    return;
  }

  match = key.match(/^c(ol){0,1}([0-9]+)$/);

  if (match)
    argv.cols[match[2] - 1] = arg;
});

// If files array consists of only one value it could
// be either a single file or a directory of files
// to be processed.
if (files.length == 1) {
  async.auto({
    // Check if the file is a directory
    directory: function (next) {
      glob(files[0] + '/*', next);
    },

    // If it's not directory, pass single file
    singleFile: ['directory', function (next, results) {
      if (results.directory && !!results.directory.length) return next(null, results.directory);
      glob(files[0], next);
    }]
  }, function (err, results) {
    if (err) throw err;
    if (!results.singleFile.length) throw new Error('No file found.');

    readFiles(results.singleFile);
  });
}
else {
  readFiles(files);
}

function readFiles(files) {
  // Loop through files
  let lines = [];

  async.map(files, function (file, next) {
    const rl = readline.createInterface({
      input: fs.createReadStream(file)
    });

    // Read file contents
    rl.on('line', line => {
      lines.push(processLine(line));
    });

    rl.on('close', next);
  }, err => processLogs(err, lines));
}

function processLine(line) {
  let attributes = line.split(' ');
  let user_agent = '';

  for (let i = 14; i < attributes.length - 2; i++) {
    user_agent = user_agent + attributes[i] + " ";
  }

  return {
    'timestamp': attributes[0],
    'elb': attributes[1],
    'client:port': attributes[2],
    'backend:port': attributes[3],
    'request_processing_time': attributes[4],
    'backend_processing_time': attributes[5],
    'response_processing_time': attributes[6],
    'elb_status_code': attributes[7],
    'backend_status_code': attributes[8],
    'received_bytes': attributes[9],
    'sent_bytes': attributes[10],
    'request': attributes[11] +' '+ attributes[12] +' '+ attributes[13],
    'requested_resource': attributes[12],
    'user_agent': user_agent,
    'total_time': parseFloat(attributes[4]) + parseFloat(attributes[5]) + parseFloat(attributes[6])
  };
}


// Processing logs
function processLogs(err, logs) {
  if (err) throw err;

  let countIndex = argv.cols.indexOf('count');

  // Return count
  if (countIndex > -1) {
    let tempCols = argv.cols.slice(0);

    tempCols.splice(countIndex, 1);

    logs = _.chain(logs)
    .countBy(function (l) {
      return JSON.stringify(_.map(tempCols, function (c) { return l[c]; }));
    })
    .pairs()
    .map(function (l) {
      let count = l[1];
      l = JSON.parse(l[0]);
      l.splice(countIndex, 0, count);
      return l;
    });

    if (argv.prefixes.length)
      logs = logs.filter(filterLogs)

    logs = logs
    .sortBy(argv.sortBy ? argv.sortBy - 1 : 0)
    .value();
  }
  // Return custom column2
  else {
    let tempCols = argv.cols.slice(0);
    let logs = _.chain(logs)
    .map(function (log) {
      return _.values(_.pick.apply(this, [log].concat(tempCols)));
    });

    if (argv.prefixes.length)
      logs = logs.filter(filterLogs)

    logs = logs
    .sortBy(argv.sortBy ? argv.sortBy - 1 : 0)
    .value();
  }

  // Overwrite output limit according to --limit argument
  OUTPUT_LIMIT = argv.limit || OUTPUT_LIMIT;
  OUTPUT_LIMIT = OUTPUT_LIMIT <= logs.length ? OUTPUT_LIMIT : logs.length;

  // Output results
  var i = 0, log;
  // Ascending
  if (argv.a) {
    while (i++ < OUTPUT_LIMIT) {
      log = logs.shift();
      console.log(colors.white(i) + ' - ' + _.map(log, function (l, index) { return colors[usefulColors[index % usefulColors.length]](l) }).join(colors.white(' - ')));
    }
  }
  // Descending
  else {
    while (i++ < OUTPUT_LIMIT) {
      log = logs.pop();
      console.log(colors.white(i) + ' - ' + _.map(log, function (l, index) { return colors[usefulColors[index % usefulColors.length]](l) }).join(colors.white(' - ')));
    }
  }
}

// Function to filter logs by prefixes
function filterLogs(log) {
  // Prefixes are strings that queried resources starts with.
  // For example, to find URL's starting with http://example.com
  // argument should be --prefix1=http:/example.com
  for (var i = 1; i < argv.prefixes.length; i++) {
    var p = argv.prefixes[i];
    if (!p) continue;

    if (String(log[i]).indexOf(p) != 0)
      return false;
  }

  return true;
}
