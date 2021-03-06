'use strict';

var fs = require('../');
var rimraf = require('rimraf');
var mkdirp = require('mkdirp');
var test = require('tap').test;
var p = require('path').resolve(__dirname, 'files');

process.chdir(__dirname);

// Make sure to reserve the stderr fd
process.stderr.write('');

var num = 4097;
var paths = new Array(num);

test('write files', function (t) {
  rimraf.sync(p);
  mkdirp.sync(p);

  var done = 0;
  for (var i = 0; i < num; ++i) {
    paths[i] = 'files/file-' + i;
    var stream = fs.createWriteStream(paths[i]);
    stream.on('end', function () {
      ++done;
      if (done === num) {
        t.pass('success');
        t.end();
      }
    });
    stream.write('content');
    stream.end();
  }

  t.end();
});

test('read files', function (t) {
  // now read them
  var done = 0;
  for (var i = 0; i < num; ++i) {
    var stream = fs.createReadStream(paths[i]);
    stream.on('data', function (data) {});
    stream.on('end', function () {
      ++done;
      if (done === num) {
        t.pass('success');
        t.end();
      }
    });
  }
});

test('cleanup', function (t) {
  rimraf.sync(p);
  t.end();
});
