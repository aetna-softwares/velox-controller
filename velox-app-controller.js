; (function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
            global.VeloxAppController = factory() ;
}(this, (function () { 'use strict';
    /**
     * Create an unique ID
     */
    function uuidv4() {
        if(typeof(window.crypto) !== "undefined" && crypto.getRandomValues){
            return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function(c) {
                return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            }) ;
        }else{
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    }

    /**
     * Event emiter
     * 
     * @constructor
     */
    function EventEmiter() {
        this.listeners = {};
    }

    /**
     * Listen to event
     * 
     * @param {string} type - the event type name
     * @param {function} listener - the listener that will be called on event
     */
    EventEmiter.prototype.on = function (type, listener) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(listener);
        return this;
    };

    /**
     * Unregister an event listener
     * 
     * @param {string} type - the event type name
     * @param {function} listener - the listener that will stop to listen
     */
    EventEmiter.prototype.off = function (type, listener) {
        var listeners = this.listeners[type];
        if (!listeners) {
            return this;
        }
        for (var i = 0; i < listeners.length; i++) {
            if (listeners[i] === listener) {
                listeners.splice(i, 1);
                break;
            }
        }
        return this;
    };

    /**
     * Listen to an event only once
     * 
     * @param {string} type - the event type name
     * @param {function} listener - the listener that will be called on event
     */
    EventEmiter.prototype.once = function (type, listener) {
        var self = this;
        var once;
        this.on(type, once = function () {
            self.off(type, once);
            listener.call(self, arguments);
        });
    };

    /**
     * Emit an event
     * 
     * @private
     * @param {string} type - the event type name
     * @param {object} [data=undefined] - the data to send with the event
     */
    EventEmiter.prototype.emit = function (type, data, source) {
        var listeners = this.listeners[type];
        if (!listeners) {
            return;
        }
        for (var i = 0; i < listeners.length; i++) {
            var listener = listeners[i];
            listener({ type: type, data: data, source: source||this });
        }
    };


    /**
     * @typedef VeloxController
     * @type {object}
     * @property {function} [init] called when the controller is registred
     * @property {function} [open] default function to call when a route leads to this controller 
     */

    /**
     * Interceptor called on routing
     * @callback VeloxRouteInterceptor
     * @param {string} [currentPosition] the current position of route (URL)
     * @param {string} [data] the data linked to the current routing
     * @param {function} next function to call to execute the routing (if you don't want to execute the route, just don't call it)
     */

    /**
     * @class VeloxAppController The Velox App controller
     * 
     * This class handle individual controllers of your app and the navigation between them
     */
    function VeloxAppController(options){
        EventEmiter.call(this);

        this.controllers = [] ;
        this.routes = [];
        this.interceptors = [] ;
        window.addEventListener("hashchange", this.onNavigate.bind(this)) ;
        this.initInProgress = 0 ;
        this.injections = [] ;
        this.dataMode = "bookmarkable" ;
        if(options && options.dataMode){
            if(["bookmarkable", "anonymous"].indexOf(options.dataMode) === -1){
                throw 'Option dataMode should be "bookmarkable" or "anonymous"' ;
            }
            this.dataMode = options.dataMode ;
        }
    }

    VeloxAppController.prototype = Object.create(EventEmiter.prototype);
    VeloxAppController.prototype.constructor = VeloxAppController;

    /**
     * Register a controller in the app.
     * 
     * If the controller has init function, it is called when register.
     * If the init function is async, it must provide a callback in the function signature and called the callback when init is done
     * 
     * @param {VeloxController} controller a VeloxController instance
     */
    VeloxAppController.prototype.registerController = function(controller){
        if(this.controllers.indexOf(controller) !== -1){ return controller; }

        this.initInProgress++ ;

        this.controllers.push(controller) ;

        controller.appController = this;

        controller.navigate = function(destination, data, dataMode){
            this.navigate(destination, data, dataMode) ;
        }.bind(this) ;
        controller.resumeNavigation = function(defaultRoute){
            this.resumeNavigation(defaultRoute) ;
        }.bind(this) ;
        controller.addRoute = function(){
            this.addRoute.apply(this, arguments) ;
        }.bind(this) ;
        controller.registerController = function(controller){
            return this.registerController(controller) ;
        }.bind(this) ;
        controller.getRoutes = function(){
            return this._getRoutes(this._currentPosition()) ;
        }.bind(this) ;
        controller.getRoute = function(routeName){
            var routes = this._getRoutes(this._currentPosition()) ;
            for(var i=0; i<routes.length; i++){
                if(routes[i].route === routeName){
                    return routes[i];
                }
            }
            return null;
        }.bind(this) ;
        controller.updateRouteData = function(routeName, newData){
            return this.updateRouteData(routeName, newData) ;
        }.bind(this) ;

        

        this.injections.forEach(function(inj){
            controller[inj.name] = inj.object ;
        }) ;

        if(!controller.init){
            this.initInProgress-- ;
            return; //no init to do
        }
        if(controller.init.length === 0){
            //init without callback
            try{
                controller.init() ;
            }catch(e){
                console.error("Error while initialize controller", e) ;
            }
            this.initInProgress-- ;
        } else {
            //init with callback
            var initFinished = false;
            var checkFinish = setTimeout(function(){
                if(!initFinished){
                    console.error("This controller init is not finished after 5s, either you forgot a callback or it needs some performance check", controller) ;
                }
            }, 5000) ;
            controller.init(function(err){
                this.initInProgress-- ;
                initFinished = true ;
                clearTimeout(checkFinish) ;
                if(err){
                    console.error("Error while initialize controller", err) ;
                }
            }.bind(this)) ;
        
        }
        return controller;
    } ;

    /**
     * Inject objects to all controller
     * 
     * @param {string} name name of the object
     * @param {*} object the object to inject
     */
    VeloxAppController.prototype.injectToControllers = function(name, object){
        this.injections.push({name : name, object: object}) ;
    } ;

    /**
     * Add interceptor on a route or globally.
     * 
     * Interceptor are called before route is applied. It can stop the routing or alter the data
     * 
     * @param {string} [route] the route for which apply the interceptor. If not given, the interceptor will be run for all routes
     * @param {VeloxRouteInterceptor} listener the interceptor to run on routing
     */
    VeloxAppController.prototype.addInterceptor = function(route, listener){
        if(typeof(route) === "function"){
            listener = route ;
            route = "" ;
        }
        this.interceptors.push({
            route : route,
            listener : listener
        }) ;
    } ;

    /**
     * Add a route.
     * 
     * The route are applied on hash URL changed (ex: from mysite.com/#page1 to mysite.com/#page2, page2 is the new route)
     * 
     * When the URL change, the route are examined and the most accurate one is chosen
     * For example, if the new URL is mysite.com/#foo$bar$12345
     * 
     * and we have the 2 routes "foo" and "foo$bar", the route foo$bar is applied as it is the most accurate one
     * 
     * @example
     * app.addRoute(welcomeController) //defined the default route to lead to welcomeController (will call welcomeController.enter)
     * app.addRoute("foo", fooController) //defined the route to fooController
     * app.addRoute("foo$many", fooController, {displayMany: true}) //define a route linked with data
     * app.addRoute("bar", function(data){ ... do something ... }) //define a route that run a function
     * 
     * @param {string} [route] the route to defined. If not given, it defines the default route that will applied when no other route is found (it could be your welcome page or a 404)
     * @param {*} listener the listener to call. It can be a controller instance (so it will call the controller open method) or a function to call directly
     * @param {object} [data] the data linked to this route
     */
    VeloxAppController.prototype.addRoute = function(route, listeners, data){
        this.routes.push(this._createRoute(route, listeners, data)) ;
        return route;
    } ;



    VeloxAppController.prototype._createRoute = function(route, listeners, data){
        if(typeof(route) !== "string"){
            data = listeners ;
            listeners = route;
            route = "" ;
        }

        this.registerController(listeners) ;

        return{
            route : route,
            listenerEnter: listeners.enter?listeners.enter.bind(listeners):function(){},
            listenerLeave: listeners.leave?listeners.leave.bind(listeners):function(){},
            listenerStack: listeners.stack?listeners.stack.bind(listeners):function(){},
            listenerUnstack: listeners.unstack?listeners.unstack.bind(listeners):function(){},
            listenerModify: listeners.modify?listeners.modify.bind(listeners):function(){},
            defaultData: data,
            mapData: {}
        };
    } ;

    /**
     * Start navigation to a route.
     * 
     * navigate() can be called on all controllers as the function is injected in the controller
     * 
     * @example
     * app.navigate() //no route given will re-execute the current route
     * app.navigate("foo") //start route "foo"
     * //start the route "foo" with some data. 
     * app.navigate("foo", {bar: data}) // append a path to current url like #foo$bar=data
     * app.navigate("foo", {bar: data}, "anonymous") // append a path to current url like #foo$$uuid, data is in memory behind uuid. handle prev/next in browser but can't be used as bookmark
     * 
     * app.navigate([route: "foo", data: {bar: data}}) // set the whole url like #foo$bar=data
     * 
     * //create a new "anonymous" route for this controller and navigate to the controller
     * //this should be reserved to exceptionnal cases, it is usually not a good idea that your controllers knows each other
     * app.navigate(barController, {some:data})
     * 
     * //create a new "anonymous" route for this function and navigate to it
     * //this should be reserved to exceptionnal cases, it is usually better to define all route in startup place and avoiding create on the fly route
     * //like this for your long term maintenance
     * app.navigate(function(data){ ... do something ... }, {some:data})
     * 
     * @param {*} [destination] the destination to navigate. can be a route name, an array or routes, a controller or a function (if not given the current route is re-applied)
     * @param {object} [data] the data to link with this navigation
     * @param {string} [dataMode] bookmarkable or anonymous
     */
    VeloxAppController.prototype.navigate = function(destination, data, dataMode){
        if(destination === undefined){
            return this.onNavigate(); //no destination given, just execute route
        }

        var currentPosition = this._currentPosition() ;
        if(destination === ".."){
            //move back
            var lastHashIndex = currentPosition.lastIndexOf("#") ;
            if(lastHashIndex === -1){
                location.hash = "" ;
            }else{
                var newPosition = currentPosition.substring(0, lastHashIndex) ;
                if(newPosition[0] === "#"){
                    newPosition = newPosition.substring(1) ;
                }
                location.hash = newPosition ;
            }
            return;
        }

        if(!Array.isArray(destination)){
            //just add a path at the end
            destination = [{route : destination, data: data, dataMode: dataMode}] ;
        }
        destination = destination.map(function(d){
            if(typeof(d) === "string"){
                return {route : d} ;
            } else {
                if(!d.dataMode){
                    d.dataMode = dataMode;
                }
                return d;
            }
        }) ;

        var path = currentPosition ;
        if(destination[0].route[0] === "/"){
            path = "" ;
            destination[0].route = destination[0].route.substring(1) ;
        }

        var previousRouteAddr = null;
        destination.forEach(function(routeDestination){
            dataMode = routeDestination.dataMode ;
            if(!dataMode){
                dataMode = this.dataMode ;
            }
            //move to an existing route
            var routeAddr = routeDestination.route?"#!"+routeDestination.route:"" ;
            if(routeDestination.data){
                var dataId = "" ;
                var dataStr = routeDestination.data ;
                if(typeof(dataStr) !== "string" && typeof(dataStr) != "number"){
                    dataStr = JSON.stringify(routeDestination.data) ;
                }
                var mapKey = null;
                this.routes.forEach(function(route){
                    if(route.route === routeDestination.route){
                        if(dataStr !== JSON.stringify(route.defaultData)){
                            //given data is different from default data
                            if(dataMode === "bookmarkable"){
                                //bookmarkable mode, use the serialized object
                                dataId = "$"+encodeURIComponent(dataStr) ;
                            }else{
                                Object.keys(route.mapData).some(function(k){
                                    if(dataStr === JSON.stringify(route.mapData[k])){
                                        mapKey = k ;
                                        return true ;
                                    }
                                }) ;
                                if(!mapKey){
                                    //not found in map
                                    mapKey = "£"+uuidv4() ;
                                    route.mapData[mapKey] = data ;
                                }
                                dataId = "$"+mapKey ;
                            }
                        }
                    }
                }.bind(this)) ;
                routeAddr += dataId ;
            }
            if(previousRouteAddr !== routeAddr){
                path += routeAddr ;                
            }
            previousRouteAddr = routeAddr ;
        }.bind(this)) ;

        if(path === currentPosition){
            //already on this destination, do a reload
            return this.onNavigate(); //no destination given, just execute route
        }
        location.hash = path ;    
    } ;

    /**
     * update the data of a route
     * 
     * @example
     * // the current position is #foo$1#bar$2
     * app.updateRouteData("foo", 3) ;
     * // new position is #foo$3#bar$2
     * 
     * // the current position is #foo$1
     * app.updateRouteData("bar", 3) ;
     * // the current position is #foo$1#bar$3
     * 
     * @param {string} routeName the name of route to modify
     * @param {*} newData the new data value
     */
    VeloxAppController.prototype.updateRouteData = function(routeName, newData){
        var currentRoutes = this._getRoutes(this._currentPosition());
        var found = false;
        currentRoutes.forEach(function(r){
            if(r.route === routeName){
                r.data = newData ;
                found = true;
            }
        }) ;
        if(!found){
            currentRoutes.push({
                route : routeName,
                data: newData
            }) ;
        }
        currentRoutes[0].route = "/"+currentRoutes[0].route ;
        this.navigate(currentRoutes) ;
    } ;

    /**
     * Suspend the navigation and display another route
     * 
     * You can then go back to the current navigation with resumeNavigation
     * 
     * It is a common pattern for login interception
     * 
     * @example
     * app.addInterceptor(function(next){
     *          if(api.currentUser){ return next() ; } //OK logged
     *          //not logged, open the login controller
     *          app.suspendNavigation("login", loginController) ;
     *      }) ;
     * 
     */
    VeloxAppController.prototype.suspendNavigation = function(routeName, listeners, data){
        this.suspendedRoute = this.currentRoute ?"/"+this.currentRoute:null ;
        var route = null;
        if(typeof(routeName) === "string" && arguments.length < 3 && (!listeners || listeners.enter === "null")){
            //activate an existing route
            route = this.routes.filter(function(r){ return r.route === routeName ;})[0] ;
            if(route){
                route.data = listeners;
            }
        }
        if(!route){
            route = this._createRoute(routeName, listeners) ;
            route.def = {active: false} ;
            route.data = data ;
        }
        this.forcedRoute = route;
        this.navigate() ;
    };

    /**
     * Check if the routing is suspended
     * 
     * @return if suspended, return the name of suspension route (or true if no name). return false if not suspended
     */
    VeloxAppController.prototype.isSuspended = function(){
        if(this.forcedRoute){
            return this.forcedRoute.route || true ;
        }
        return false;
    } ;

    /**
     * Resume the navigation that was suspended with suspendNavigation
     * 
     * If not suspension is active, the defaultRoute is executed
     * 
     * @param {string} [defaultRoute] the default route to use if the navigation is not suspended
     */
    VeloxAppController.prototype.resumeNavigation = function(defaultRoute){
        var routeToResume = this.suspendedRoute ;
        this.suspendedRoute = null;
        var routesToRemove = [] ;
        if(this.forcedRoute){
            routesToRemove.push(this.forcedRoute) ;
        }
        this._removeOldRoutes(routesToRemove, function(err){
            if(err){ throw "Error while remove old route "+err ;}
            this.forcedRoute = null;
            this.navigate(routeToResume || defaultRoute) ;
        }.bind(this));
    };


    /**
     * Get the current position from URL
     * 
     * @private
     */
    VeloxAppController.prototype._currentPosition = function(){
        var currentPosition = location.hash ;
        currentPosition = currentPosition.replace(/#+/g, '#') ; //change ## to #
        if(currentPosition[currentPosition.length-1] === "#"){
            //remove trailing #
            currentPosition = currentPosition.substring(0, currentPosition.length-1) ;
        }
        return currentPosition ;
    } ;

    /**
     * Get the route corresponding to the given destination (URL)
     * 
     * @param {string} destination the destination
     */
    VeloxAppController.prototype._getRoutes = function(destination){
        var destinationRoutes = destination.split("#") ;
        if(destination.indexOf("#$") === 0){
            //special case when destination is #$data, split will give "", "$data" 
            //but we want only 1 "" route
            destinationRoutes = destinationRoutes.slice(1) ;
        }
        var foundRoutes = [];
        destinationRoutes.forEach(function(r, urlPosition){
            var routeAndDataId = r.split("$") ;
            var routeDestName = routeAndDataId[0].replace(/^!/, "") ;
            var dataId = routeAndDataId[1] ;
            this.routes.forEach(function(r){
                if(r.route === routeDestName){
                    var data = r.defaultData;
                    if(dataId){
                        dataId = decodeURIComponent(dataId);
                        if(dataId[0] === "£"){
                            //start by $, it is an id in data map (anonymous data)
                            data = r.mapData[dataId] ;
                        }else{
                            //it is urlEncoded data
                            var data = dataId;
                            if(data.length > 0 && ['"', '[', '{'].indexOf(data[0]) !== -1){
                                data = JSON.parse(data) ;
                            }
                        }
                    }

                    foundRoutes.push({
                        route : r.route,
                        urlPosition: urlPosition,
                        listenerEnter : r.listenerEnter,
                        listenerLeave: r.listenerLeave,
                        listenerStack : r.listenerStack,
                        listenerUnstack : r.listenerUnstack,
                        listenerModify : r.listenerModify,
                        def: r,
                        data: data
                    });
                }
            }) ;
        }.bind(this)) ;
        
        
        return foundRoutes ;
    } ;

    /**
     * Set the current route without triggering a navigation
     * 
     * @param {string} currentRoute the current route
     */
    VeloxAppController.prototype.setCurrentRoute = function(currentRoute){
        this.currentRoute = currentRoute ;
        history.pushState(null, "", currentRoute);
    } ;

    /**
     * Called when browser change URL
     * 
     * @private
     */
    VeloxAppController.prototype.onNavigate = function(){
        
        if(this.initInProgress>0){
            //wait for init done
            return setTimeout(function(){
                this.onNavigate() ;
            }.bind(this), 50) ;
        }

        var interc = [] ;
        var newRoutes = null;
        if(this.forcedRoute){
            //route is forced, use it
            newRoutes = [this.forcedRoute] ;
        }else{
            //normal routing, look at current position
            var currentPosition = this._currentPosition() ;

            //get routes from new path
            newRoutes = this._getRoutes(currentPosition);
            if(newRoutes.length === 0){
                console.info("No route found for "+currentPosition) ;
                return;
            }

            interc = this.interceptors.filter(function(int){
                return newRoutes.some(function(n){ return n.route === int.route ;}) ;
            }) ;
        }
        
        //get routes from previous path
        var previousRoutes = [] ;
        if(this.currentRoute !== null && this.currentRoute !== undefined){
            //execute leave listener on previous position
            var previousRoutes = this._getRoutes(this.currentRoute);
        }

        //check wich route has been removed from old path to new path
        var removedRoutes = [] ;
        previousRoutes.forEach(function(oldRoute){
            if(!newRoutes.some(function(n){ return n.route === oldRoute.route ;})){
                removedRoutes.push(oldRoute) ;
            }
        }.bind(this)) ;

        //check which route has been added from old path to new path
        var addedRoutes = [] ;
        newRoutes.forEach(function(newRoute){
            if(!previousRoutes.some(function(o){ return o.route === newRoute.route ;})){
                addedRoutes.push(newRoute) ;
            }
        }.bind(this)) ;

        //check which route is in previous and new but was on top in previous and not in top in new
        var stackedRoutes = [] ;
        if(previousRoutes.length > 0 && newRoutes.length > 0){
            var previousTopRoute = previousRoutes[previousRoutes.length-1] ;
            var newTopRoute = newRoutes[newRoutes.length-1] ;
            if(newTopRoute.urlPosition !== previousTopRoute.urlPosition &&
                newRoutes.some(function(n, i){ return n.route === previousTopRoute.route && i<newRoutes.length-1 ;})){
                stackedRoutes.push(previousTopRoute) ;
            }
        }else{
            //no previous, it may be because the user just paste the whole url in, all new route except the last is stacked
            stackedRoutes = newRoutes.slice(0, newRoutes.length-1) ;
        }

        //check which route is in previous but not in the top and is at the top in new
        var unstackedRoutes = [] ;
        if(newRoutes.length>0){
            var newTopRoute = newRoutes[newRoutes.length-1] ;
            if(previousRoutes.some(function(o, i){ return o.route === newTopRoute.route && i<previousRoutes.length-1 ;})){
                unstackedRoutes.push(newTopRoute) ;
            }
        }

        //check which route is both in previous and current but with different data value
        var modifiedRoutes = [] ;
        newRoutes.forEach(function(newRoute){
            if(previousRoutes.some(function(o){ return o.route === newRoute.route && JSON.stringify(o.data) !== JSON.stringify(newRoute.data) ;})){
                modifiedRoutes.push(newRoute) ;
            }
        }.bind(this)) ;
    
        var previousPosition = this.currentRoute ;
        this.currentRoute = currentPosition ;

        this._runInterceptor(interc.slice(), { 
            currentPosition : currentPosition, previousPosition: previousPosition,
            removedRoutes: removedRoutes, stackedRoutes: stackedRoutes,
            addedRoutes: addedRoutes, unstackedRoutes: unstackedRoutes, modifiedRoutes: modifiedRoutes,
        }, function(err){
            if(err){ throw "Error while running interceptor "+(err instanceof Error ?err.stack:JSON.stringify(err)) ;}
            this._removeOldRoutes(removedRoutes, function(err){
                if(err){ throw "Error while leaving routes "+(err instanceof Error ?err.stack:JSON.stringify(err)) ;}
                this._openNewRoutes(addedRoutes, stackedRoutes, currentPosition, function(err){
                    if(err){ throw "Error while opening routes "+(err instanceof Error ?err.stack:JSON.stringify(err)) ;}

                    this._stackRoutes(stackedRoutes, function(err){
                        if(err){ throw "Error while stack routes "+(err instanceof Error ?err.stack:JSON.stringify(err)) ;}

                        this._unstackRoutes(unstackedRoutes, function(err){
                            if(err){ throw "Error while unstack routes "+(err instanceof Error ?err.stack:JSON.stringify(err)) ;}
                        
                            this._modifyRoutes(modifiedRoutes, function(err){
                                if(err){ throw "Error while modify routes "+(err instanceof Error ?err.stack:JSON.stringify(err)) ;}

                                this.emit("routeChanged", {
                                    previousRoutes: previousRoutes,
                                    newRoutes: newRoutes,
                                    removedRoutes: removedRoutes,
                                    addedRoutes: addedRoutes,
                                    stackedRoutes: stackedRoutes,
                                    unstackedRoutes: unstackedRoutes,
                                    modifiedRoutes: modifiedRoutes,
                                }) ;
                            }.bind(this)) ;
                        }.bind(this)) ;
                    }.bind(this)) ;
                }.bind(this)) ;
            }.bind(this)) ;
        }.bind(this)) ;

    } ;


    /**
     * leave old routes
     * 
     * @private
     */
    VeloxAppController.prototype._removeOldRoutes = function(removedRoutes,callback){
        if(removedRoutes.length === 0){
            return callback() ;//finished
        }
        var route = removedRoutes[0] ;

        var next = function next(err){
            if(err){ return callback(err); }
            this._removeOldRoutes(removedRoutes.slice(1), callback) ;
        }.bind(this) ;

        if(route.def.active){
            route.def.active = false ;
            if(route.listenerLeave){
                this._callListener(route, "listenerLeave", next) ;
            }else{
                next() ;
            }
        }else{
            next(); //remove before beeing active
        }
    } ;


    /**
     * stack route
     * 
     * @private
     */
    VeloxAppController.prototype._stackRoutes = function(stackedRoutes,callback){
        if(stackedRoutes.length === 0){
            return callback() ;//finished
        }
        var route = stackedRoutes[0] ;

        var next = function next(err){
            if(err){ return callback(err); }
            this._stackRoutes(stackedRoutes.slice(1), callback) ;
        }.bind(this) ;

        if(route.def.active){
            if(route.listenerStack){
                this._callListener(route, "listenerStack", next) ;
            }else{
                next() ;
            }
        }
    } ;


    /**
     * unstack route
     * 
     * @private
     */
    VeloxAppController.prototype._unstackRoutes = function(unstackedRoutes,callback){
        if(unstackedRoutes.length === 0){
            return callback() ;//finished
        }
        var route = unstackedRoutes[0] ;

        var next = function next(err){
            if(err){ return callback(err); }
            this._unstackRoutes(unstackedRoutes.slice(1), callback) ;
        }.bind(this) ;

        if(route.def.active){
            if(route.listenerUnstack){
                this._callListener(route, "listenerUnstack", next) ;
            }else{
                next() ;
            }
        }
    } ;
    
    /**
     * modify route
     * 
     * @private
     */
    VeloxAppController.prototype._modifyRoutes = function(modifiedRoutes,callback){
        if(modifiedRoutes.length === 0){
            return callback() ;//finished
        }
        var route = modifiedRoutes.shift() ;

        var next = function next(err){
            if(err){ return callback(err); }
            this._modifyRoutes(modifiedRoutes, callback) ;
        }.bind(this) ;

        if(route.def.active){
            if(route.listenerModify){
                this._callListener(route, "listenerModify", next) ;
            }else{
                next() ;
            }
        }
    } ;


   

    /**
     * open new routes
     */
    VeloxAppController.prototype._openNewRoutes = function(newRoutes, stackedRoutes, currentPosition, callback){
        if(newRoutes.length === 0){
            return callback() ;//finished
        }
        var route = newRoutes[0] ;

        var next = function next(err){
            if(err){ return callback(err); }
            this._openNewRoutes(newRoutes.slice(1), stackedRoutes, currentPosition, callback) ;
        }.bind(this) ;

        route.def.active = true ;
        this._callListener(route, "listenerEnter", next) ;
        var indexStacked = stackedRoutes.indexOf(route) ;
        if(indexStacked !== -1){
            //this route is open but immediatly stacked, call the stack in the open process to avoid display to user
            var routesToStack = stackedRoutes.splice(indexStacked, 1) ;
            this._stackRoutes(routesToStack, function(){}) ;
        }
    } ;

    VeloxAppController.prototype._callListener = function(route, listenerName, callback){
        if(route[listenerName].length===2){
            var callFinished = false ;
            var checkCallFinished = setTimeout(function(){
                if(!callFinished){
                    console.error("Calling listener "+listenerName+" take more than 5sec, either you forgot a callback or there is some performance improvement to do", route) ;
                }
            }, 5000) ;
            route[listenerName](route.data, function(err){
                callFinished = true ;
                clearTimeout(checkCallFinished) ;
                callback(err) ;
            }) ;
        }else{
            route[listenerName](route.data) ;
            callback() ;
        }
    } ;

    /**
     * Run interceptors until all interceptor has been done
     * 
     * @private
     */
    VeloxAppController.prototype._runInterceptor = function(interceptors, context, callback){
        if(interceptors.length === 0){
            return callback() ;//finished
        }
        var inter = interceptors[0] ;

        var next = function next(){
            this._runInterceptor(interceptors.slice(1), context, callback) ;
        }.bind(this) ;

        var args = [context, next] ;
        if(inter.listener.length === 1){
            args = [next] ;
        }
        inter.listener.apply(null, args) ;
    } ;

    return VeloxAppController ;
})));