var hyperdrive = require('hyperdrive')
var toilet = require('toiletdb')
var memdb = require('memdb')
var test = require('tape')
var fs = require('fs')

function flushToilet () {
  try {
    fs.unlinkSync('state.json')
  } catch (e) {}
}

flushToilet()

var noop = function () {}
var multidrive = require('./')

test('drive = multidrive', function (t) {
  t.test('should assert input types', function (t) {
    t.plan(3)
    t.throws(multidrive.bind(null), /object/)
    t.throws(multidrive.bind(null, {}), /function/)
    t.throws(multidrive.bind(null, {}, noop), /function/)
  })
})

test('drive.create', function (t) {
  t.test('should create an archive', function (t) {
    t.plan(5)

    var store = toilet('state.json')
    multidrive(store, createArchive, noop, function (err, drive) {
      t.ifError(err, 'no err')
      t.equal(typeof drive, 'object', 'drive was returned')
      drive.create(null, function (err, archive) {
        t.ifError(err, 'no err')
        t.equal(typeof archive, 'object', 'archive was created')
        t.ok(Buffer.isBuffer(archive.metadata.key), 'archive has a key')
      })
    })

    function createArchive (data, done) {
      var db = memdb()
      var drive = hyperdrive(db)
      var archive = drive.createArchive()
      done(null, archive)
    }
  })

  t.test('should recreate archives', function (t) {
    t.plan(4)
    flushToilet()
    var store = toilet('state.json')
    multidrive(store, createArchive, noop, function (err, drive) {
      t.ifError(err, 'no err')

      drive.create({ hello: 'world' }, function (err, archive) {
        t.ifError(err, 'no err')

        var newStore = toilet('state.json')
        multidrive(newStore, createArchive, noop, function (err, drive) {
          t.ifError(err, 'no err')
          var drives = drive.list()
          t.equal(drives.length, 1, 'one drive on init')
        })
      })
    })

    function createArchive (data, done) {
      var db = memdb()
      var drive = hyperdrive(db)
      var archive = drive.createArchive()
      done(null, archive)
    }
  })

  t.test('should noop on duplicates', function (t) {
    t.plan(5)
    flushToilet()
    var store = toilet('state.json')
    var db = memdb()
    var drive = hyperdrive(db)
    multidrive(store, createArchive, noop, function (err, drive) {
      t.ifError(err, 'no err')

      drive.create({ hello: 'world' }, function (err, archive) {
        t.ifError(err, 'no err')

        drive.create({ key: archive.key }, function (err, _archive, duplicate) {
          t.ifError(err, 'no err')
          t.equal(_archive, archive)
          t.equal(duplicate, true)
        })
      })
    })

    function createArchive (data, done) {
      var archive = drive.createArchive({ key: data.key })
      done(null, archive)
    }
  })

  t.test('should properly compare different key types', function (t) {
    t.plan(5)
    flushToilet()
    var store = toilet('state.json')
    var db = memdb()
    var drive = hyperdrive(db)
    multidrive(store, createArchive, noop, function (err, drive) {
      t.ifError(err, 'no err')

      drive.create({ hello: 'world' }, function (err, archive) {
        t.ifError(err, 'no err')

        drive.create({ key: archive.key }, function (err, _archive, duplicate) {
          t.ifError(err, 'no err')
          t.equal(_archive, archive)
          t.equal(duplicate, true)
        })
      })
    })

    function createArchive (data, done) {
      var archive = drive.createArchive({ key: data.key })
      if (data.key) archive.key = Buffer(archive.key)
      done(null, archive)
    }
  })
})

test('drive.list', function (t) {
  t.test('should list archives', function (t) {
    t.plan(3)
    flushToilet()

    var store = toilet('state.json')
    multidrive(store, createArchive, noop, function (err, drive) {
      t.ifError(err, 'no err')
      drive.create(null, function (err, archive) {
        t.ifError(err, 'no err')
        var drives = drive.list()
        t.equal(drives.length, 1, 'one drive')
      })
    })

    function createArchive (data, done) {
      var db = memdb()
      var drive = hyperdrive(db)
      var archive = drive.createArchive()
      done(null, archive)
    }
  })

  t.test('should not fail on initial archive creation errors', function (t) {
    t.plan(7)
    flushToilet()

    var store = toilet('state.json')
    var createArchive = function (data, done) {
      var db = memdb()
      var drive = hyperdrive(db)
      var archive = drive.createArchive()
      done(null, archive)
    }
    multidrive(store, createArchive, noop, function (err, drive) {
      t.ifError(err, 'no err')
      drive.create({ some: 'data' }, function (err, archive) {
        t.ifError(err, 'no err')
        var createArchive = function (data, done) {
          done(Error('not today'))
        }
        multidrive(store, createArchive, noop, function (err, drive) {
          t.ifError(err, 'no err')
          var drives = drive.list()
          t.equal(drives.length, 1, 'one drive')
          t.ok(drives[0] instanceof Error)
          t.equal(drives[0].data.some, 'data')
          t.equal(drives[0].data.key, archive.key.toString('hex'))
        })
      })
    })
  })
})

test('drive.close', function (t) {
  t.test('close an archive', function (t) {
    t.plan(4)
    flushToilet()

    var store = toilet('state.json')
    multidrive(store, createArchive, closeArchive, function (err, drive) {
      t.ifError(err, 'no err')
      drive.create(null, function (err, archive) {
        t.ifError(err, 'no err')
        drive.close(archive.key, function (err) {
          t.ifError(err, 'no err')
          var drives = drive.list()
          t.equal(drives.length, 0, 'no drives left')
        })
      })
    })

    function createArchive (data, done) {
      var db = memdb()
      var drive = hyperdrive(db)
      var archive = drive.createArchive()
      done(null, archive)
    }

    function closeArchive (archive, done) {
      archive.close()
      done()
    }
  })

  t.test('close an archive instanceof Error', function (t) {
    t.plan(5)
    flushToilet()

    var store = toilet('state.json')
    multidrive(store, createArchive, closeArchive, function (err, drive) {
      t.ifError(err, 'no err')
      drive.create({}, function (err, archive) {
        t.ifError(err, 'no err')
        var createArchive = function (data, done) {
          done(Error('not today'))
        }
        multidrive(store, createArchive, noop, function (err, drive) {
          t.ifError(err, 'no err')
          var errDat = drive.list()[0]
          drive.close(errDat.data.key, function (err) {
            t.ifError(err, 'no err')
            var drives = drive.list()
            t.equal(drives.length, 0, 'no drives left')
          })
        })
      })
    })

    function createArchive (data, done) {
      var db = memdb()
      var drive = hyperdrive(db)
      var archive = drive.createArchive()
      done(null, archive)
    }

    function closeArchive (archive, done) {
      archive.close()
      done()
    }
  })
  t.end()
})

test('cleanup toilet', function (t) {
  flushToilet()
  t.ok(true, 'flushed toilet')
  process.nextTick(t.end)
})
