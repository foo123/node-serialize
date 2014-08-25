!function ( root, name, deps, factory ) {

    //
    // export the module in a umd-style generic way
    deps = ( deps ) ? [].concat(deps) : [];
    var i, dl = deps.length, ids = new Array( dl ), paths = new Array( dl ), mods = new Array( dl );
    for (i=0; i<dl; i++) { ids[i] = deps[i][0]; paths[i] = deps[i][1]; }
    
    // node, commonjs, etc..
    if ( 'object' == typeof( module ) && module.exports ) 
    {
        if ( 'undefined' == typeof(module.exports[name]) )
        {
            for (i=0; i<dl; i++)
                mods[i] = module.exports[ ids[i] ] || require( paths[i] )[ ids[i] ];
            module.exports[ name ] = factory.apply(root, mods );
        }
    }
    
    // amd, etc..
    else if ( 'function' == typeof( define ) && define.amd ) 
    {
        define( ['exports'].concat( paths ), function( exports ) {
            if ( 'undefined' == typeof(exports[name]) )
            {
                var args = Array.prototype.slice.call( arguments, 1 );
                for (var i=0, dl=args.length; i<dl; i++)
                    mods[i] = exports[ ids[i] ];
                exports[name] = factory.apply(root, mods );
            }
        });
    }
    
    // browsers, other loaders, etc..
    else 
    {
        if ( 'undefined' == typeof(root[name]) )
        {
            for (i=0; i<dl; i++)
                mods[i] = root[ ids[i] ];
            root[name] = factory.apply(root, mods );
        }
    }


}( this, "serializer", null, /* module factory */ function( undef ) {

    var slice = Array.prototype.slice;
    var queues = [];
    
    // a task queue with key/value store
    var Queue = function(name) {
        this.name = name;
        this.running = null;
        this.pending = [];
        this.results = null;
        this.rewire = null;
        this.store = null;
    };
    Queue.prototype = {
        
        constructor: Queue,
        
        name: null,
        running: null,
        pending: null,
        results: null,
        rewire: null,
        // a key/value store for the queue
        store: null,
        
        getStore: function(key) {
            if ( this.store )
                return this.store[key];
        },
        
        setStore: function(key, val) {
            this.store = this.store || {};
            this.store[key] = val;
            return this;
        },
        
        existsStore: function(key) {
            return ( this.store && 'undefined' !== typeof(this.store[key]) );
        },
        
        clearStore: function(key) {
            if ( this.store && 'undefined' !== typeof(this.store[key]) )
                delete this.store[key];
            return this;
        },
        
        resetStore: function() {
            this.store = null;
            return this;
        },
        
        clearQueue: function() {
            this.running = null;
            this.pending = [];
            this.results = null;
            this.rewire = null;
            return this;
        },
        
        addTask: function(_this, func, args, noCallback, ctx) {
            var that = this;
            
            if ( noCallback ) 
            {
                args.push(function( err ) { 
                    var _args = slice.call( arguments );
                    
                    // get current rewire
                    that.rewire = ctx._rewire || null;
                    // store current result for rewire
                    that.results = (that.rewire) ? _args.slice() : null;
                    
                    // store current results
                    if ( ctx._store )
                    {
                        for (var i=0; i<ctx._store.length; i++)
                        {
                            if ( ctx._store[i][0] < _args.length )
                                that.setStore( ctx._store[i][1], _args[ ctx._store[i][0] ] );
                        }
                    }
                    
                    // call next task
                    that.nextTask( err ) 
                });
            } 
            else 
            {
                callback = args.pop();
                args.push(function( ) {
                    var _args = slice.call( arguments );
                    
                    // get current rewire
                    that.rewire = ctx._rewire || null;
                    // store current result for rewire
                    that.results = (that.rewire) ? _args.slice() : null;
                    
                    // store current results
                    if ( ctx._store )
                    {
                        for (var i=0; i<ctx._store.length; i++)
                        {
                            if ( ctx._store[i][0] < _args.length )
                                that.setStore( ctx._store[i][1], _args[ ctx._store[i][0] ] );
                        }
                    }
                    
                    // call callback if any
                    callback.apply(this, arguments);
                    
                    // call next task
                    that.nextTask( arguments[0] );
                });
            }

            var task = function( err ) { 
                if (err && err instanceof Error) 
                {
                    // re-set
                    that.rewire = null;
                    that.results = null;
                    
                    args[args.length - 1].call(global, err);
                }
                else 
                {
                    if ( that.results && that.rewire )
                    {
                        // rewire prev results to current task args
                        for (var i=0; i<that.rewire.length; i++)
                        {
                            if ( that.rewire[i].length > 1 && 
                                that.rewire[i][0] < that.results.length && 
                                that.rewire[i][1] < args.length
                            )
                                args[ that.rewire[i][1] ] = that.results[ that.rewire[i][0] ];
                        }
                    }
                    else if ( ctx._use )
                    {
                        // use already stored results
                        for (var i=0; i<ctx._use.length; i++)
                        {
                            if ( that.existsStore( ctx._use[i][0] ) && ctx._use[i][1] < args.length )
                                args[ ctx._use[i][1] ] = that.getStore( ctx._use[i][0] );
                        }
                    }
                    
                    // re-set
                    that.rewire = null;
                    that.results = null;
                    
                    func.apply(_this, args);
                }
            };

            if ( !this.running ) 
            {
                (this.running = task)();
            }
            else 
            {
                this.pending.push( task );
            }
                
            return this;
        },

        nextTask: function(err) {
            var run = this.running = this.pending.shift();
            if (run) run(err);
                
            return this;
        }
    };
    // static
    Queue.get = function(name) {
        name = name || 'default';
        queues[name] = queues[name] || new Queue(name);
        return queues[name];
    };

    
    // a context for storing/rewiring task args/results
    var Context = function(queue) {
        this._queue = queue;
        this._rewire = null;
        this._store = null;
        this._use = null;
    };
    Context.prototype = {
        
        constructor: Context,
        
        _queue: null,
        _rewire: null, 
        _store: null,
        _use: null,
        
        // allow to get the actual queue for this serialized
        getQueue: function() { 
            return this._queue; 
        },
        
        // rewire functionality
        rewire: function() { 
            var args = slice.call( arguments );
            if ( args.length ) 
            {
                // add them
                if ( !this._rewire )
                    this._rewire = args;
                // or append, if called again
                else
                    this._rewire = this._rewire.concat( args );
            }
            return this; 
        },
        
        // store functionality
        storeTo: function() { 
            var args = slice.call( arguments );
            if ( args.length ) 
            {
                // add them
                if ( !this._store )
                    this._store = args;
                // or append, if called again
                else
                    this._store = this._store.concat( args );
            }
            return this; 
        },
        
        // use functionality
        useAs: function() { 
            var args = slice.call( arguments );
            if ( args.length ) 
            {
                // add them
                if ( !this._use )
                    this._use = args;
                // or append, if called again
                else
                    this._use = this._use.concat( args );
            }
            return this; 
        }
    };
    
    var serializer = function(func, name, scope) {
        var queue = Queue.get(name), 
            length = func.length;
        
        var serialized = function() {
            var ctx = new Context( queue/*, func*/ );
            queue.addTask( scope || this, func, slice.call(arguments), arguments.length < length, ctx );
            // context allows methods to be called after the serialized is executed
            // to add rewire / use / store functionality
            return ctx;
        };
        
        // get this serialized's queue
        serialized.getQueue = function() { return queue; };
        
        // free the serialized func
        serialized.free = function() { return func; };
        
        return serialized;
    }
    
    serializer.getQueue = Queue.get;
    
    serializer.VERSION = "0.3.2";
    
    // export it
    return serializer;
});