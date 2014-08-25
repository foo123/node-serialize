Serializer
==============

This is a fork of the original [node-serialize](https://github.com/chaoran/node-serialize)

The purpose for this fork is to extend the functionality (and also work in browser) in a way, not currently compatible
with the original lib ( https://github.com/chaoran/node-serialize/issues/1 ).

**Note** For a newer approach to asynchronous serialisation (and other stuff), see [Asynchronous](https://github.com/foo123/asynchronous.js) a simple manager for async, linearised, parallelised, interleaved and sequential tasks for JavaScript


##Extra methods

* works in node and browser
* __rewire__ : allow results of current task to be rewired selectively to the arguments of next task in queue
* __storeTo__ : allow results of current task to be stored selectively in the queue's key-value store
* __useAs__ : allow arguments of current task to be replaced by values stored selectively in the queue's key-value store
* __getQueue__ : get the current/serialized tasks queue
* __Queue:getStore__ : get the value from store by key
* __Queue:setStore__ : set a key-value pair in store
* __Queue:existsStore__ : check if key exists in store
* __Queue:clearStore__ : clear the key-value pair in store by key
* __Queue:resetStore__ : clear all key-value pairs in store
* __Queue:clearQueue__ : clear all pending tasks from queue
* __serializer:getQueue__ : get any queue

__Example__:

```javascript

var serialize = require('./serializer').serializer;
var fs = require('fs');

// you can avoid overwriting the fs.readFile, fs.writeFile, if you dont want to..
var serialWrite = serialize( fs.writeFile );
var serialRead = serialize( fs.readFile );

serialWrite('./foo1.txt', 'test1', { encoding: 'utf8'});

// rewire this tasks results[1] to next tasks args[1]

serialRead('./foo1.txt', { encoding: 'utf8'}).rewire([1 /* current result index */, 1 /* next argument index */] /*, ... more rewires here */ )/* .rewire(...) or even more rewires here */;
serialWrite('./foo2.txt', 'this arg should be replaced with test1', { encoding: 'utf8'});

// previous rewire is not valid anymore, if needed a new rewire call should be made

serialRead('./foo1.txt', { encoding: 'utf8'});
serialWrite('./foo3.txt', 'this arg should not be replaced', { encoding: 'utf8'});

// store this tasks results[1] to 'fileContent'

serialRead('./foo1.txt', { encoding: 'utf8'}).storeTo( [1 /* current result index */, 'fileContent' /* key */] );
serialWrite('./foo4.txt', 'this arg should be replaced with test1', { encoding: 'utf8'}).useAs( ['fileContent' /* key */, 1 /* current arg index */] );

// previous store/use are not valid anymore, if needed new calls should be made

serialRead('./foo1.txt', { encoding: 'utf8'});
serialWrite('./foo5.txt', 'this arg should not be replaced', { encoding: 'utf8'});


// after all is finished, eg in a last callback

// clear any stored values
serialize.getQueue( /*"default"*/ ).resetStore();

// or clear just the 'fileContent' key-value
serialWrite.getQueue().clearStore('fileContent');


// get the original funcs back
origRead = serialRead.free();
origWrite = serialWrite.free();

```

-------------------------------------------------------------------------------------------------------------------------

A simple node utility to serialize execution of asynchronous functions.

## What does it do?

Asynchrony in nodejs is great, except that it makes your code looks horrible because of all the callbacks. If you use synchronous functions, which give you good-looking, easy-to-read code, they will block the thread and make your server not responsive.

Here's `serailize` to the rescue! `serialize` converts your asynchronous functions into serialized versions. Serialized functions are executed one after another, without explicitly chaining them with callback functions. `serialize` does __NOT__ execute the function synchronously (block the thread), it just serialize the execution of asynchronous functions. So that it makes the code looks synchronous, but it is actually ascynhronous underneath.

## How to use it?

To create a serialized version of an asynchronous function, call `serialize` with it. For example, if you want to make serialized versions of `fs.writeFile` and `fs.mkdir`, you do:
```javascript
var serialize = require('serialize');

fs.mkdir = serialize(fs.mkdir);
fs.writeFile = serialize(fs.writeFile);
```
Then, you can use `fs.mkdir` and `fs.writeFile` like they are synchronous functions:
```javascript
fs.mkdir('new');
fs.mkdir('new/folder');
fs.writeFile('new/folder/hello.txt', "hello world", callback);
```
These function will be executed one after another, but they will not block the thread as their synchronous versions do. The `callback` will be invoked after the last call completes.

If you want to restore `fs.writeFile` and `fs.mkdir` to their original version, just do:
```javascript
fs.mkdir = fs.mkdir.free();
fs.writeFile = fs.writeFile.free();
```

### What if an error happens? 

If an error happens, the error will be passed to the corresponding callback function, and the execution of all serialized calls after it will be aborted. If an error happens in a function call that does not have a callback, the error will be passed down to the first call that has a callback function. 
For example, if the `fs.mkdir('new')` call in the above code throws an error, because there's no callback attached to that call, the error will be passed down to the callback of `fs.writeFile(...)`. And, of course, `fs.mkdir('new/folder')` and `fs.writeFile(...)` won't be executed because an error occurred before them.

### What's more to it?

If you want to serialize calls to file system, and serialize calls to database, but allow calls to file system and calls to database to happen concurrently, how to do it? 
You can serialize different functions into different queues. Functions belong to the same queue will be executed in serial, but functions between different queues can run concurrently. 
To serialize a function to a queue other than the default queue, give a queue name as the second argument of `serialize`:
```javascript
conn.query = serialize(conn.query, "db");
```

### Is any function *serializable*?

Current version of `serialize` can only serialize a function that satisfies the following conditions:

1. It accepts a callback function, and invokes the callback when it is done;
2. If an error occurs, it must invoke callback with the error as the first argument; the error must be an instance of `Error`.

Note: Future version of `serialize` may be able to serialize a function that emits `end` and `error` events.
