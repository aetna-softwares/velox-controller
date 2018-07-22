/*global define*/
; (function (global, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        var VeloxViewController = require("velox-controller").ViewController ;
        module.exports = factory(VeloxViewController) ;
    } else if (typeof define === 'function' && define.amd) {
        define(['VeloxViewController'], factory);
    } else {
        global.VeloxGridFormAndImporterController = factory(global.VeloxGridAndFormController, global.VeloxImporterController);
    }
}(this, (function (VeloxGridAndFormController, VeloxImporterController) { 'use strict';
    var VeloxGridFormAndImporterController = function(table, options){

        VeloxGridAndFormController.call(this, table, options) ;
        
        if(!this.options.importer){ this.options.importer = {}; }
        
        if(!this.options.importer.route){
            this.options.importer.route = table+"/importer" ;
        }
        if(!this.options.importer.openInPopup === undefined){
            this.options.importer.openInPopup = true ;
        }

        this.importerRoute = this.options.importer.route ;

        if(this.options.noRouting){
            this.options.importer.noRouting = this.options.noRouting;
        }
        
        if(this.options.joinFetch){
            this.options.importer.joinFetch = this.options.joinFetch ;
        }

        this.importerController = new VeloxImporterController(this.table, options.importer) ;

        var _gridInitEvents = this.gridController.initEvents ;
        this.gridController.initEvents = function(){
            _gridInitEvents(this) ;
            this.gridController.view.on("import", this._onImport.bind(this)) ;
        }.bind(this) ;

        // this.formController.initEvents = function(){
        //     VeloxFormController.prototype.initEvents.apply(this.formController) ;
        //     this.formController.view.on("back", this._onBackToGrid.bind(this)) ;
        // }.bind(this) ;
    } ;

    VeloxGridFormAndImporterController.prototype = Object.create(VeloxGridAndFormController.prototype);
    VeloxGridFormAndImporterController.prototype.constructor = VeloxGridFormAndImporterController;

    VeloxGridFormAndImporterController.prototype.init = function(){
        VeloxGridAndFormController.prototype.init.apply(this) ;
        //this may contains all 
        this.registerController(this.importerController) ;
        
        this.viewImporter = this.importerController.view ;
    } ;

    VeloxGridFormAndImporterController.prototype._onImport = function(){
        this.navigate( this.importerRoute, null) ;
    } ;

    return VeloxGridFormAndImporterController ;
})));