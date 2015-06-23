// Copyright (c) 2015, Ben Noordhuis <info@bnoordhuis.nl>
//
// Permission to use, copy, modify, and/or distribute this software for any
// purpose with or without fee is hereby granted, provided that the above
// copyright notice and this permission notice appear in all copies.
//
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
// WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
// ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
// WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
// ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
// OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

'use strict';

var fs = require('fs');

module.exports = clone(fs);
module.exports.FileReadStream = ReadStream;  // Legacy name.
module.exports.FileWriteStream = WriteStream;  // Legacy name.
module.exports.ReadStream = ReadStream;
module.exports.WriteStream = WriteStream;
module.exports.close = close;
module.exports.closeSync = closeSync;
module.exports.createReadStream = createReadStream;
module.exports.createWriteStream = createWriteStream;
module.exports.open = open;
module.exports.readFile = readFile;
module.exports.readdir = readdir;

ReadStream.prototype = Object.create(fs.ReadStream.prototype);
ReadStream.prototype.open = ReadStream$open;

WriteStream.prototype = Object.create(fs.WriteStream.prototype);
WriteStream.prototype.open = WriteStream$open;

var queue = [];

function ReadStream(path, options) {
  if (this instanceof ReadStream)
    return fs.ReadStream.apply(this, arguments), this;
  else
    return ReadStream.apply(Object.create(ReadStream.prototype), arguments);
}

function ReadStream$open() {
  var that = this;
  open(that.path, that.flags, that.mode, function(err, fd) {
    if (err) {
      if (that.autoClose)
        that.destroy();

      that.emit('error', err);
    } else {
      that.fd = fd;
      that.emit('open', fd);
      that.read();
    }
  });
}

function WriteStream(path, options) {
  if (this instanceof WriteStream)
    return fs.WriteStream.apply(this, arguments), this;
  else
    return WriteStream.apply(Object.create(WriteStream.prototype), arguments);
}

function WriteStream$open() {
  var that = this;
  open(that.path, that.flags, that.mode, function(err, fd) {
    if (err) {
      that.destroy();
      that.emit('error', err);
    } else {
      that.fd = fd;
      that.emit('open', fd);
    }
  });
}

function close(fd, cb) {
  return fs.close(fd, function(err) {
    if (!err)
      retry();

    if (typeof cb === 'function')
      cb.apply(this, arguments);
  });
}

function closeSync() {
  // Note that graceful-fs also retries when fs.closeSync() fails.
  // Looks like a bug to me, although it's probably a harmless one.
  var rval = fs.closeSync.apply(fs, arguments);
  retry();
  return rval;
}

function createReadStream(path, options) {
  return new ReadStream(path, options);
}

function createWriteStream(path, options) {
  return new WriteStream(path, options);
}

function open(path, flags, mode, cb) {
  if (typeof mode === 'function')
    cb = mode, mode = null;

  return go(path, flags, mode, cb);

  function go(path, flags, mode, cb) {
    return fs.open(path, flags, mode, function(err, fd) {
      if (err && (err.code === 'EMFILE' || err.code === 'ENFILE'))
        queue.push([go, [path, flags, mode, cb]]);
      else if (typeof cb === 'function')
        cb.apply(this, arguments);
    });
  }
}

function readFile(path, options, cb) {
  if (typeof options === 'function')
    cb = options, options = null;

  return go(path, options, cb);

  function go(path, flags, mode, cb) {
    return fs.readFile(path, options, function(err, fd) {
      if (err && (err.code === 'EMFILE' || err.code === 'ENFILE'))
        queue.push([go, [path, options, cb]]);
      else if (typeof cb === 'function')
        cb.apply(this, arguments);
    });
  }
}

function readdir(path, cb) {
  return go(path, cb);

  function go() {
    return fs.readdir(path, function(err, files) {
      if (files && files.sort)
        files.sort();  // Backwards compatibility with graceful-fs.

      if (err && (err.code === 'EMFILE' || err.code === 'ENFILE'))
        queue.push([go, [path, cb]]);
      else if (typeof cb === 'function')
        cb.apply(this, arguments);
    });
  }
}

function retry() {
  var elem = queue.shift();
  if (elem)
    elem[0].apply(null, elem[1]);
}

function clone(obj) {
  if (obj === null || typeof obj !== 'object')
    return obj;

  if ('__proto__' in obj)
    var copy = { __proto__: obj.__proto__ };
  else
    var copy = Object.create(null);

  Object.getOwnPropertyNames(obj).forEach(function(key) {
    Object.defineProperty(copy, key, Object.getOwnPropertyDescriptor(obj, key));
  });

  return copy;
}
