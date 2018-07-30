/*global define*/
; (function (global, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        var VeloxViewController = require("velox-controller").ViewController ;
        var VeloxFormController = require("velox-controller").FormController ;
        module.exports = factory(VeloxFormController, VeloxViewController) ;
    } else if (typeof define === 'function' && define.amd) {
        define(['VeloxViewController'], factory);
    } else {
        global.VeloxImporterController = factory(global.VeloxFormController, global.VeloxViewController, global.VeloxWebView);
    }
}(this, (function (VeloxFormController, VeloxViewController, VeloxWebView) { 'use strict';

    var importerCSSLoaded = false;

    /**
     * @typedef VeloxImporterControllerOptionLabels
     * @type {object}
     * @property {string} [confirmDelete] message to display on confirm delete (default translation of "form.confirmDelete" or "Are you sure to delete ?" if no i18n
     * @property {string} [cantDelete] message to display on can't delete (default translation of "form.cantDelete" or "Can't delete this element because it is already used" if no i18n
     * @property {string} [back] button back label (default translation of "form.back" or "Back" if no i18n
     * @property {string} [create] button create label (default translation of "form.create" or "Create" if no i18n
     * @property {string} [modify] button modify label (default translation of "form.modify" or "Modify" if no i18n
     * @property {string} [delete] button delete label (default translation of "form.delete" or "Delete" if no i18n
     * @property {string} [validate] button validate label (default translation of "form.validate" or "Validate" if no i18n
     * @property {string} [cancel] button cancel label (default translation of "form.cancel" or "Cancel" if no i18n
     */

    /**
     * @typedef VeloxImporterControllerOption
     * @type {object}
     * @property {string} [title] title to display (default : translation of fields.table.{table} or "Form" if no i18n)
     * @property {VeloxImporterControllerOptionLabels} [labels] customize button labels
     * @property {object} [defaultData] the default value when creating a new record
     * @property {object[]} [joinFetch] the sub tables to fetch
     */


    /**
     * Create a standard importer controller
     * 
     * @param {string} table table corresponding to this form
     * @param {VeloxImporterControllerOption} viewOptions form options
     */
    var VeloxImporterController = function(table, viewOptions){   
        
        VeloxFormController.call(this,table, viewOptions) ;
        
        if(!this.options.labels){
            this.options.labels = {} ;
        }
        if(!this.options.labels.chooseFileToImport){
            this.options.labels.chooseFileToImport = VeloxWebView.tr?VeloxWebView.tr("importer.chooseFileToImport"):"Choose file to import" ;
        }
        if(!this.options.labels.firstLineContainsColumnNames){
            this.options.labels.firstLineContainsColumnNames = VeloxWebView.tr?VeloxWebView.tr("importer.firstLineContainsColumnNames"):"First line contains column names" ;
        }
        if(!this.options.labels.copyToTheField){
            this.options.labels.copyToTheField = VeloxWebView.tr?VeloxWebView.tr("importer.copyToTheField"):"Copy to the field..." ;
        }
        if(!this.options.labels.startImport){
            this.options.labels.startImport = VeloxWebView.tr?VeloxWebView.tr("importer.startImport"):"Start import" ;
        }
        if(!this.options.labels.ignoreThisColumn){
            this.options.labels.ignoreThisColumn = VeloxWebView.tr?VeloxWebView.tr("importer.ignoreThisColumn"):"Ignore this column" ;
        }
        if(!this.options.labels.fileIsEmpty){
            this.options.labels.fileIsEmpty = VeloxWebView.tr?VeloxWebView.tr("importer.fileIsEmpty"):"The file is empty" ;
        }
        if(!this.options.labels.importSuccess){
            this.options.labels.importSuccess = VeloxWebView.tr?VeloxWebView.tr("importer.importSuccess"):"Import succeed" ;
        }
        if(!this.options.labels.validate){
            this.options.labels.validate = VeloxWebView.tr?VeloxWebView.tr("importer.validate"):"Validate" ;
        }
        if(!this.options.labels.tooMuchValues){
            this.options.labels.tooMuchValues = VeloxWebView.tr?VeloxWebView.tr("importer.tooMuchValues"):"There are too many different values in this column to be used with this field" ;
        }
        if(!this.options.labels.mustChooseDest){
            this.options.labels.mustChooseDest = VeloxWebView.tr?VeloxWebView.tr("importer.mustChooseDest"):"Please select a destination field for all columns" ;
        }
        if(!this.options.labels.requiredField){
            this.options.labels.requiredField = VeloxWebView.tr?VeloxWebView.tr("importer.requiredField"):"This field is required" ;
        }
        if(!this.options.labels.errorsOnLine){
            this.options.labels.errorsOnLine = VeloxWebView.tr?VeloxWebView.tr("importer.errorsOnLine"):"Error on line" ;
        }

        this.validations.push(this.checkRequiredFields.bind(this)) ;
    } ;


    VeloxImporterController.prototype = Object.create(VeloxFormController.prototype);
    VeloxImporterController.prototype.constructor = VeloxImporterController;

    /**
     * load the importer view CSS
     * 
     * This CSS make the table take the whole height on container
     */
    function loadImporterCSS(){
        if(importerCSSLoaded){ return ;}

        //
        var css = "";

        var head = document.getElementsByTagName('head')[0];
        var s = document.createElement('style');
        s.setAttribute('type', 'text/css');
        if (s.styleSheet) {   // IE
            s.styleSheet.cssText = css;
        } else {                // the world
            s.appendChild(document.createTextNode(css));
        }
        head.appendChild(s);
        importerCSSLoaded = true ;
    }


    VeloxImporterController.prototype.prepareHTML = function(html, script, formHTML, header, customButtons){
        //no HTML
        var schema = VeloxWebView.fieldsSchema.getSchema();
        if(!html){
            //no HTML
            html = '' ;//script;
            html += '<div>';
            html += '<div id="chooseContainer">';
            html += '<button id="chooseFile" type="button" data-emit>'+this.options.labels.chooseFileToImport+'</button>';
            html += '<button id="startImport" type="button" data-emit>'+this.options.labels.startImport+'</button>';
            html += '</div>' ;
            html += '<div id="importTableContainer"></div>';
            html += '</div>' ;
            if(!formHTML){
                formHTML = '<form id="mainForm" >';
                schema[this.table].columns.forEach(function(col){
                    if(col.name.indexOf("velox_")!==0){
                        formHTML += '<div data-field-def="'+this.table+'.'+col.name+'"></div>' ;
                    }
                }.bind(this)) ;
                formHTML += '</form>';
            }
            html += '<div style="display: none">'+formHTML+'</div>' ;
        }
        loadImporterCSS() ;
        return html;
    };

    VeloxImporterController.prototype.onChooseFile = function(){
        var input = document.createElement("INPUT") ;
        input.type = "file" ;
        input.accept = ".xlsx,.csv,.xls" ;
        this.view.EL.chooseContainer.appendChild(input) ;
        input.focus() ;
        input.addEventListener("change", function(){
            if(input.files[0]){
                this.view.longTask(function(done){
                    setTimeout(function(){
                        this.readFile(input.files[0], function(err, contents){
                            if(err){ return done(err) ;}

                            var fieldsByCode = {} ;
                            var fieldsets = this.view.EL.mainForm.querySelectorAll("fieldset") ;
                            for(var i=0; i<fieldsets.length; i++){
                                var legend = fieldsets[i].querySelector("legend") ;
                                var fieldSetLabel = legend?legend.innerHTML:"" ;
                                var fields = fieldsets[i].querySelectorAll("[data-field-def]") ;
                                for(var y=0; y<fields.length; y++){
                                    var f = fields[y] ;
                                    fieldsByCode[f.getAttribute("data-bind")] = {
                                        field: f,
                                        fieldSet: fieldSetLabel
                                    } ;
                                }
                            }

                            var optionsFooter = '<option value="__ignore">'+this.options.labels.ignoreThisColumn+'</option>' ;
                            var currentGroup = null;
                            var fields = this.view.EL.mainForm.querySelectorAll("[data-field-def]") ;
                            for(var y=0; y<fields.length; y++){
                                var f = fields[y] ;
                                if(f.getAttribute("data-field") === "grid"){ continue ; }
                                var label = f.querySelector("label") ;
                                var bindAttr = f.getAttribute("data-bind");
                                var fieldLabel = label?label.innerHTML:VeloxWebView.tr?VeloxWebView.tr("fields."+f.getAttribute("data-field-def")):bindAttr ;
                                if(!fieldsByCode[bindAttr]){
                                    fieldsByCode[bindAttr] = { field: f, fieldSet: null } ;
                                }
                                fieldsByCode[bindAttr].label = fieldLabel ;
                                if(fieldsByCode[bindAttr].fieldSet !== currentGroup){
                                    if(currentGroup){
                                        optionsFooter += "</optgroup>" ;
                                    }
                                    if(fieldsByCode[bindAttr].fieldSet){
                                        optionsFooter += '<optgroup label="'+fieldsByCode[bindAttr].fieldSet+'">' ;
                                    }
                                    currentGroup = fieldsByCode[bindAttr].fieldSet ;
                                }
                                optionsFooter += '<option value="'+bindAttr+'">'+fieldLabel+'</option>' ;
                            }
                            if(currentGroup){
                                optionsFooter += "</optgroup>" ;
                            }

                            var htmlTable = '<div style="height: calc(100% - 40px)" class="velox-grid"><table cellspacing="0" data-responsive="false" data-no-toolbar data-no-search>' ;
                            htmlTable += "<thead><tr>"+contents[0].map(function(c, i){ return '<th data-field-name="'+i+'">'+String.fromCharCode(65+i)+"</th>" ;}).join("")+"</tr></thead>" ;
                            htmlTable += "<tfoot>"+
                            "<tr>"+contents[0].map(function(c, i){ 
                                return '<th><select style="max-width:200px" data-field-name="'+i+'">'+optionsFooter+'</select></th>' ;
                            }).join("")+"</tr></tfoot></table></div>" ;


                            
                            this.view.EL.importTableContainer.innerHTML = htmlTable ;
                            var table = this.view.EL.importTableContainer.querySelector("div") ;
                            this.grid = table ;

                            //http://live.datatables.net/sadipaji/1/edit
                            //https://datatables.net/examples/advanced_init/footer_callback.html
                            table.addEventListener("tableinit", function(){
                                table.setValue(contents) ;
                                done() ;
                            }) ;
                            this.view.createField(table, "grid", 0, {}, function(err){
                                if(err){ return done(err) ;}
                            }) ;


                        }.bind(this)) ;
                    }.bind(this), 200) ;
                }.bind(this), function(){
                    this.view.EL.chooseContainer.removeChild(input) ;
                }.bind(this)) ;
            }else{
                this.view.EL.chooseContainer.removeChild(input) ;
            }
        }.bind(this)) ;
        input.click() ;
        input.style.display = "none" ;
    } ;


    VeloxImporterController.prototype.checkRequiredFields = function(validationData){
        //{form: form, data: viewData, dataBeforeModif : dataBeforeModif}
        if(!this.requiredFields){
            this.requiredFields = [] ;
            var requireds = this.view.EL.mainForm.querySelectorAll("[required]") ;
            for(var i=0; i<requireds.length; i++){
                var f = requireds[i] ;
                var bindAttr = f.getAttribute("data-bind");
                var label = f.querySelector("label") ;
                var fieldLabel = label?label.innerHTML:VeloxWebView.tr?VeloxWebView.tr("fields."+f.getAttribute("data-field-def")):bindAttr ;
                if(bindAttr){
                    this.requiredFields.push({
                        bind : bindAttr,
                        label : fieldLabel
                    }) ;
                }
            }
        }
        var detectedErrors = [];
        for(var i=0; i<this.requiredFields.length; i++){
            if(!VeloxWebView.pathExtract(validationData.data,this.requiredFields[i].bind)){
                detectedErrors.push(this.options.labels.requiredField + " : "+this.requiredFields[i].label) ;
            }
        }
        return detectedErrors ;
    } ;

    VeloxImporterController.prototype.onStartImport = function(){
        var lines = this.grid.getValue() ;
        
        var bindings = {} ;
        for(var i=0; i<lines[0].length; i++){
            var select = this.grid.querySelector('.dataTables_scrollFoot select[data-field-name="'+i+'"]') ;
            var bind = select.value ;
            if(bind !== "__ignore"){
                bindings[i] = bind.split(".") ;
            }
        }
        
        this.view.longTask(function(done){
            this.prepareDataOnEnter(null, function(err, defaultData){
                if(err){ return done(err) ;}
                var schema = VeloxWebView.fieldsSchema.getSchema();
                schema[this.table].columns.forEach(function(col){
                    if(col.autoGen){
                        delete defaultData[col.name] ; //compute autogen on each line
                    } 
                }) ;
                defaultData = JSON.stringify(defaultData) ;
                var recordsToSave = [] ;
                for(var i=0; i<lines.length; i++){
                    var line = lines[i] ;
                    //initiate with default values
                    var lineToImport = JSON.parse(defaultData) ;
                    //add values from table binding
                    for(var y=0; y<line.length; y++){
                        var bind = bindings[y] ;
                        if(bind){
                            VeloxWebView.pathSetValue(lineToImport, bind, line[y]) ;
                        }
                    }
                    //check data
                    for(var z=0; z<this.validations.length; z++){
                        var validation = this.validations[z] ;
                        var detectedErrors = validation({data: lineToImport}) ;
                        if(detectedErrors && detectedErrors.length > 0){
                            return done(this.options.labels.errorsOnLine+i+" : \n"+detectedErrors.join("\n")) ;
                        }
                    }

                    var callbackDone = false;
                    this.getRecordsToSave(lineToImport, null, function(err, records){
                        if(err){ return done(err) ;}
                        for(var a=0; a<records.length; a++){
                            recordsToSave.push(records[a]) ;
                        }
                        callbackDone = true ;
                    }) ;
                    if(!callbackDone) {
                        return done("The getRecordsToSave should not be async in importers !") ;
                    }
                }

                if(!this.api || !this.api.__velox_database){
                    return done("No Velox Database API found, provide it or implement saveRecords on your form controller") ;
                }
                this.api.__velox_database.transactionalChanges(recordsToSave, function(err, recordsSaved){
                    if(err){ return done(err); }

                    done() ;
                }.bind(this))  ;
            }.bind(this))  ;
        }.bind(this))  ;
    } ;

    VeloxImporterController.prototype.readFile = function(file, callback){
        if(!window.XLSX){
            throw 'You must import XLSX lib (https://github.com/sheetjs/js-xlsx)' ;
        }

        var XLSX = window.XLSX;

        var reader = new FileReader();

        reader.onload = function(e) {
            var data = e.target.result;
            var workbook = XLSX.read(data, {
              type: 'binary'
            });
      
            if(workbook.SheetNames.length === 0){
                return callback(this.options.labels.fileIsEmpty) ;
            }

            var firstSheet = workbook.Sheets[workbook.SheetNames[0]] ;
            var sheetContents = window.XLSX.utils.sheet_to_json(firstSheet, {header: 1});

            callback(null, sheetContents) ;
        };
      
        reader.onerror = function(ex) {
            callback(ex);
        };
    
        reader.readAsBinaryString(file);
    } ;

    return VeloxImporterController ;
})));