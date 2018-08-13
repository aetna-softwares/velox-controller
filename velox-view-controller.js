/*global define, VeloxWebView*/
; (function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
        typeof define === 'function' && define.amd ? define(factory) :
            global.VeloxViewController = factory() ;
}(this, (function () { 'use strict';

    /**
     * Execute many function in series
     * 
     * @param {function(Error)[]} calls array of function to run
     * @param {function(Error)} callback called when all calls are done
     */
    var series = function(calls, callback){
        if(calls.length === 0){ return callback(); }
        calls = calls.slice() ;
        var doOne = function(){
            var call = calls.shift() ;
            call(function(err){
                if(err){ return callback(err) ;}
                if(calls.length === 0){
                    callback() ;
                }else{
                    doOne() ;
                }
            }) ;
        } ;
        doOne() ;
    } ;

    /**
     * Event emiter
     * 
     * @constructor
     */
    function EventEmiter() {
        
    }

    /**
     * Listen to event
     * 
     * @param {string} type - the event type name
     * @param {function} listener - the listener that will be called on event
     */
    EventEmiter.prototype.on = function (type, listener) {
        if (!this.listeners){ this.listeners = {}; }
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
        if (!this.listeners){ this.listeners = {}; }
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
        if (!this.listeners){ this.listeners = {}; }
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
     * @param {function} [callback] - if given, called when all listener are called. listeners can be async
     */
    EventEmiter.prototype.emit = function (type, data, callback) {
        if(typeof(data) === "function"){
            callback = data;
            data = null;
        }
        if(!callback){ callback = function(){} ;}
        if (!this.listeners){ this.listeners = {}; }
        var listeners = this.listeners[type];
        if (!listeners) {
            return callback() ;
        }
        var calls = [] ;
        listeners.forEach(function(listener){
            calls.push(function(cb){
                if(listener.length <= 1){
                    try{
                        listener({ type: type, data: data });
                        cb() ;
                    }catch(err){
                        cb(err) ;
                    }
                }else{
                    listener({ type: type, data: data }, cb);
                }
            }) ;
        }) ;

        series(calls, callback) ;
    };

    var extendsEmiter = function(clazz){
        Object.keys(EventEmiter.prototype).forEach(function(m){
            clazz.prototype[m] = EventEmiter.prototype[m] ;
        });
    } ;

    var defaultContainerParent = null;

    /**
     * Get all functions of object starting by onXXX
     * 
     * @param {*} obj 
     */
    function getOnFunctions(obj) {
        var p = [];
        for (; obj != null; obj = Object.getPrototypeOf(obj)) {
            var op = Object.getOwnPropertyNames(obj);
            for (var i=0; i<op.length; i++){
                if(typeof(obj[op[i]]) === "function" && op[i].indexOf("on") === 0 && op[i].length > 2){
                    if (p.indexOf(op[i]) === -1){
                        p.push(op[i]);
                    }
                }
            }
        }
        return p;
    }

    /**
     * Create a new VeloxViewController
     * 
     * By default this controller control one view and present the open and close method
     * 
     * By default, it will link listener on all function onXXX for the corresponding event of the view.
     * For example, if your subclass has a function onValidate, it will be listen to event "validate" of the view
     * 
     * If you need further init action on view creation, you can implement the initView function on your sub class
     * 
     * @param {object} viewOptions the view options
     * @param {object} [data] the data to bind to the view 
     */
    function VeloxViewController(viewOptions, data){
        this.viewOptions = viewOptions ;
        if(this.viewOptions.route === undefined){
            this.viewOptions.route = this.viewOptions.directory.substring(this.viewOptions.directory.lastIndexOf("/")-1)+this.viewOptions.name ;
        }
        this.data = data || {} ;
        if(VeloxWebView.i18n){
            VeloxWebView.i18n.onLanguageChanged(function(){
                if(this.view && this.view.isDisplayed()){
                    this.refresh() ;
                }
            }.bind(this));
        }
    }

    extendsEmiter(VeloxViewController); //make it an emiter

    VeloxViewController.prototype._createView = function(){
        var options = {
            bindObject: this.data,
            containerParent: defaultContainerParent
        } ;
        Object.keys(this.viewOptions).forEach(function(k){
            options[k] = this.viewOptions[k] ;
        }.bind(this)) ;
        this.view = new VeloxWebView(this.viewOptions.directory, this.viewOptions.name, options) ;

    } ;

    /**
     * Create the view and bind event.
     * Will call this.initView if exists
     */
    VeloxViewController.prototype.init = function(){
        this._createView() ;

        this._initEvents() ;

        if(!this.viewOptions.noRouting){
            if(this.viewOptions.route !== undefined){
                this.addRoute(this.viewOptions.route, this) ;
            }
        }
        this.emit("initView") ;
    } ;

    VeloxViewController._linkOnFunctions = function(controller, view, bind){
        var onFunctions = getOnFunctions(controller) ;
        onFunctions.forEach(function(onFunName){
            var eventName = onFunName[2].toLowerCase()+onFunName.substring(3) ;
            view.on(eventName, controller[onFunName].bind(bind)) ;
        }) ;
    } ;

    /**
     * Do event registration here, it will be called on view creation
     */
    VeloxViewController.prototype.initEvents = function(){
    } ;

    VeloxViewController.prototype._initEvents = function(){
        if(!this.view.listeners.__controllerInitEventsDone){
            this.view.listeners.__controllerInitEventsDone = true ;
            VeloxViewController._linkOnFunctions(this, this.view, this) ;
            this.initEvents() ;
        }
    } ;


    /**
     * Close the view (remove from DOM)
     */
    VeloxViewController.prototype.leave = function(){
        this.emit("beforeLeave") ;
        this.view.close();
        this.emit("leave") ;
    } ;

    /**
     * Open the view (add to the DOM)
     */
    VeloxViewController.prototype.enter = function(data, callback){
        if(typeof(data) === "function"){
            callback = data;
            data = null;
        }
        if(!callback){ callback = function(){} ; }
        this.enterData = data;
        this._initEvents() ;
        this.view.longTask(function(done){
            this.emit("beforeEnter", function(err){
                if(err){ return done(err) ;}
                this._prepareDataOnEnter(data, function(err, data){
                    if(err){ return done(err); }
                    if(data){
                        this.data = data ;
                    }
                    if(this.viewOptions.openInPopup){
                        this.view.openInPopup(this.viewOptions.popup, function(err){
                            if(err){ return done(err); }
                            this.view.render(data);
                            this.emit("enter", done) ;
                        }.bind(this));
                        this.view.once("close", function(){
                            var currentRoutes = this.appController._getRoutes(this.appController.currentRoute) ;
                            if(currentRoutes.length > 0 && currentRoutes[currentRoutes.length-1].route === this.viewOptions.route){
                                this.navigate("..") ;
                            }
                        }.bind(this)) ;
                    }else{
                        this.view.open(data, function(err){
                            if(err){ return done(err); }
                            this.emit("enter", done) ;
                        }.bind(this));
                    }
                    
                }.bind(this)) ;
            }.bind(this)) ;
        }.bind(this), callback) ;
    } ;

    /**
     * modify the data should reopen the view with new data
     */
    VeloxViewController.prototype.modify = function(data, callback){
        if(typeof(data) === "function"){
            callback = data;
            data = null;
        }
        if(!callback){ callback = function(){} ; }
        this.enter(data, callback) ;
    };

    VeloxViewController.prototype._prepareDataOnEnter = function(data, callback){
        if(this.prepareDataOnEnter){
            if(this.prepareDataOnEnter.length === 2){
                this.prepareDataOnEnter(data, callback) ;
            }else{
                try{
                    var modifiedData = this.prepareDataOnEnter(data) ;
                    callback(null, modifiedData) ;
                }catch(err){
                    return callback(err) ;
                }   
            }
        }else{
            return callback(null, data||this.data) ;
        }
    } ;

    /**
     * Open the view (add to the DOM)
     */
    VeloxViewController.prototype.refresh = function(data, callback){
        if(typeof(data) === "function"){
            callback = data;
            data = null;
        }
        if(!callback){ callback = function(){} ; }
        if(!data){ data = this.enterData ; }
        this.view.longTask(function(done){
            this.emit("beforeRefresh") ;
            this._prepareDataOnEnter(data, function(err, data){
                if(err){ return done(err); }
                if(data){
                    this.data = data ;
                }
                this.view.render(data) ;
                this.emit("refresh") ;
                done() ;
            }.bind(this)) ;
        }.bind(this), callback) ;
    } ;

    /**
     * hide the view (add to the DOM)
     */
    VeloxViewController.prototype.stack = function(){
        this.emit("beforeStack") ;
        this.view.hide();
        this.emit("stack") ;
    } ;

    /**
     * show the view (add to the DOM)
     */
    VeloxViewController.prototype.unstack = function(/*data*/){
        this.emit("beforeUnstack") ;
        this.view.show();
        this.emit("unstack") ;
    } ;

    /**
     * Set default parent container for all views controller that don't define a container or parentContainer
     * 
     * Usually you have a main content area in which you need to display most of the view, this function is too avoid to 
     * give your main area id on all view
     * 
     * @param {string} containerParent default container parent id
     */
    VeloxViewController.setDefaultContainerParent = function(containerParent){
        defaultContainerParent = containerParent ;
    } ;

    /**
     * Create new subclass of VeloxViewController
     * 
     * @example
     * var MyController = VeloxViewController.create({
     *  directory : "views/myView",
     *  name: "myView", //load view/myView/myView.html / .css
     * }) ;
     * 
     * MyController.prototype.onValidate = function(ev){
     *      //do something on validate event
     * };
     * 
     * @param {object} viewOptions the view options
     * @param {object} [data] the data to link
     */
    VeloxViewController.create = function(viewOptions, data){
        var construct = function(){
            VeloxViewController.call(this,viewOptions, data) ;
        } ;
        construct.prototype = Object.create(VeloxViewController.prototype);
        construct.prototype.constructor = construct;
        return construct ;
    } ;

    return VeloxViewController ;
})));