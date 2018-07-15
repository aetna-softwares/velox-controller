/*global define*/
; (function (global, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        var VeloxViewController = require("velox-controller").ViewController ;
        module.exports = factory(VeloxViewController) ;
    } else if (typeof define === 'function' && define.amd) {
        define(['VeloxViewController'], factory);
    } else {
        global.VeloxGridAndFormController = factory(global.VeloxGridController, global.VeloxFormController);
    }
}(this, (function (VeloxGridController, VeloxFormController) { 'use strict';
    var VeloxGridAndFormController = function(table, options){
        if(!options){
            options = {form: {}, grid: {}} ;
        }
        if(!options.grid){ options.grid = {}; }
        if(!options.form){ options.form = {}; }
        
        if(options.grid.canCreate === undefined){
            options.grid.canCreate = true;
        }
        if(options.grid.canRefresh === undefined){
            options.grid.canRefresh = true;
        }

        if(!options.grid.route){
            options.grid.route = table+"/list" ;
        }
        if(!options.form.route){
            options.form.route = table+"/form" ;
        }
        this.baseRoute = options.grid.route ;
        this.formRoute = options.form.route ;

        if(options.noRouting){
            options.form.noRouting = options.noRouting;
            options.grid.noRouting = options.noRouting;
        }
        
        if(options.joinFetch){
            options.grid.joinFetch = options.joinFetch ;
            options.form.joinFetch = options.joinFetch ;
        }

        this.table = table;
        this.gridController = new VeloxGridController(this.table, options.grid) ;
        this.formController = new VeloxFormController(this.table, options.form) ;  

        this.gridController.initEvents = function(){
            VeloxGridController.prototype.initEvents.apply(this.gridController) ;
            this.gridController.view.on("initDone", this._onInitDone.bind(this)) ;
            this.gridController.view.on("rowClick", this._onOpenRecord.bind(this)) ;
            this.gridController.view.on("createNew", this._onCreateNew.bind(this)) ;
        }.bind(this) ;

        this.formController.initEvents = function(){
            VeloxFormController.prototype.initEvents.apply(this.formController) ;
            this.formController.view.on("back", this._onBackToGrid.bind(this)) ;
        }.bind(this) ;

        this.leave = this.gridController.leave.bind(this.gridController);
        this.enter = this.gridController.enter.bind(this.gridController);
        this.stack = this.gridController.stack.bind(this.gridController);
        this.unstack = this.gridController.unstack.bind(this.gridController);
    } ;

    VeloxGridAndFormController.prototype.init = function(){
        //this may contains all 
        this.registerController(this.formController) ;
        this.registerController(this.gridController) ;
        
        this.viewGrid = this.gridController.view ;
        this.viewForm = this.formController.view ;
    } ;

    VeloxGridAndFormController.prototype._onBackToGrid = function(){
        this.navigate("..") ;
    };

    VeloxGridAndFormController.prototype._onOpenRecord = function(ev){
        var record = ev.data ;
        
        this.viewGrid.longTask(function(done){
            if(this.api && this.api.__velox_database){
                this.api.__velox_database[this.table].getPk(record, function(err, pk){
                    if(err){ return done(err) ;}
                    this.navigate( this.formRoute, pk) ;
                    done() ;
                }.bind(this)) ;
            }else{
                this.navigate(this.formRoute, record, "anonymous") ;
                done() ;
            }
        }.bind(this)) ;
    } ;

    VeloxGridAndFormController.prototype._onCreateNew = function(){
        this.navigate( this.formRoute, null) ;
    } ;

    VeloxGridAndFormController.prototype._onInitDone = function(){
        // var gridEl = this.viewGrid.elementsHavingAttribute('data-field-def="'+this.table+'.grid"')[0];
        // if(gridEl){
        //     gridEl.addEventListener("dblClick", function(ev){
        //         this.viewGrid.emit("openRecord", ev.record) ;
        //     }.bind(this)) ;
        //     gridEl.addEventListener("add", function(){
        //         this.viewGrid.emit("addRecord") ;
        //     }.bind(this)) ;
        // }
    } ;


    /**
     * Create new subclass of VeloxGridAndFormController
     * 
     * @example
     * var MyController = VeloxGridAndFormController.create({
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
    VeloxGridAndFormController.create = function(table, viewGridOptions, viewFormOptions){
        var construct = function(){
            VeloxGridAndFormController.call(this, table, viewGridOptions, viewFormOptions) ;
        } ;
        construct.prototype = Object.create(VeloxGridAndFormController.prototype);
        construct.prototype.constructor = construct;
        return construct ;
    } ;


    return VeloxGridAndFormController ;
})));