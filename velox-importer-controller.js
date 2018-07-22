/*global define*/
; (function (global, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        var VeloxViewController = require("velox-controller").ViewController ;
        module.exports = factory(VeloxViewController) ;
    } else if (typeof define === 'function' && define.amd) {
        define(['VeloxViewController'], factory);
    } else {
        global.VeloxImporterController = factory(global.VeloxViewController, global.VeloxWebView);
    }
}(this, (function (VeloxViewController, VeloxWebView) { 'use strict';

    var importerCSSLoaded = false;

    var uuidv4 = function(){
        if(typeof(window.crypto) !== "undefined" && crypto.getRandomValues){
            return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function(c) {
                return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16) ;
            }) ;
        }else{
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }
    } ;

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
        this.table = table;
        var options = {
            
        } ;
        if(viewOptions){
            Object.keys(viewOptions).forEach(function(k){
                options[k] = viewOptions[k] ;
            }) ;
        }

        this.joinFetch = options.joinFetch ;

        if(this.joinFetch){
            if(!options.defaultData){
                options.defaultData = {} ;
            }
            this.joinFetch.forEach(function(join){
                if(!options.defaultData[join.name]){
                    if(join.type === "2many"){
                        options.defaultData[join.name] = [] ;
                    }else{
                        options.defaultData[join.name] = {} ;
                    }
                }
            }) ;
        }

        if(!options.labels){
            options.labels = {} ;
        }
        if(!options.labels.chooseFileToImport){
            options.labels.chooseFileToImport = VeloxWebView.tr?VeloxWebView.tr("importer.chooseFileToImport"):"Choose file to import" ;
        }
        if(!options.labels.firstLineContainsColumnNames){
            options.labels.firstLineContainsColumnNames = VeloxWebView.tr?VeloxWebView.tr("importer.firstLineContainsColumnNames"):"First line contains column names" ;
        }
        if(!options.labels.copyToTheField){
            options.labels.copyToTheField = VeloxWebView.tr?VeloxWebView.tr("importer.copyToTheField"):"Copy to the field..." ;
        }
        if(!options.labels.startImport){
            options.labels.startImport = VeloxWebView.tr?VeloxWebView.tr("importer.startImport"):"Start import" ;
        }
        if(!options.labels.ignoreThisColumn){
            options.labels.ignoreThisColumn = VeloxWebView.tr?VeloxWebView.tr("importer.ignoreThisColumn"):"Ignore this column" ;
        }
        if(!options.labels.fileIsEmpty){
            options.labels.fileIsEmpty = VeloxWebView.tr?VeloxWebView.tr("importer.fileIsEmpty"):"The file is empty" ;
        }
        if(!options.labels.importSuccess){
            options.labels.importSuccess = VeloxWebView.tr?VeloxWebView.tr("importer.importSuccess"):"Import succeed" ;
        }
        if(!options.labels.validate){
            options.labels.validate = VeloxWebView.tr?VeloxWebView.tr("importer.validate"):"Validate" ;
        }
        if(!options.labels.tooMuchValues){
            options.labels.tooMuchValues = VeloxWebView.tr?VeloxWebView.tr("importer.tooMuchValues"):"There are too many different values in this column to be used with this field" ;
        }
        if(!options.labels.mustChooseDest){
            options.labels.mustChooseDest = VeloxWebView.tr?VeloxWebView.tr("importer.mustChooseDest"):"Please select a destination field for all columns" ;
        }

        this.options = options;

        this.validations = [] ;

        VeloxViewController.call(this,options, null) ;

        this.on("initView", doInitView.bind(this)) ;
    } ;


    VeloxImporterController.prototype = Object.create(VeloxViewController.prototype);
    VeloxImporterController.prototype.constructor = VeloxImporterController;

    /**
     * load the Datatables CSS
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


    /**
     * Init view, handle the HTML customization
     */
    function doInitView(){
        //override getHTML to append buttons
        this.view.getHTML = function(callback){

            var getHTMLNormal = function(callback){
                if(this.view.staticHTML || this.view.name){
                    Object.getPrototypeOf(this.view).getHTML.call(this.view, callback) ;
                }else{
                    callback("") ;
                }
            }.bind(this) ;

            getHTMLNormal(function(html){
                var formHTML = null;
                html = html.trim() ;
                var htmlLower = html.toLowerCase() ;
                var script = "" ;
                var startIndex = 0;
                
                var indexScript = htmlLower.indexOf("<script") ;
                var indexStyle = htmlLower.indexOf("<style") ;
                
                var indexSecurity = 0;
                while(true){
                    if(indexScript === startIndex /*script is first tag*/
                        || (indexScript !== -1 && indexStyle === 0 && indexScript < htmlLower.indexOf("</style>")+10) /*script follow style that is first tag */
                    ){
                        //allow <script> at the beggining
                        var newStartIndex = htmlLower.indexOf("<", htmlLower.indexOf("</script>", startIndex)+"</script>".length, startIndex) ;
                        script += html.substring(startIndex, newStartIndex) ;
                        startIndex = newStartIndex;
                    }else if(indexStyle === startIndex){
                        //having <style> but no <script>
                        var newStartIndex = htmlLower.indexOf("<", htmlLower.indexOf("</style>", startIndex)+"</style>".length, startIndex) ;
                        script += html.substring(startIndex, newStartIndex) ;
                        startIndex = newStartIndex;
                    }else{
                        break;
                    }
                    indexScript = htmlLower.indexOf("<script", startIndex) ;
                    indexStyle = htmlLower.indexOf("<style", startIndex) ;
                    indexSecurity++;
                    if(indexSecurity>10){
                        //more than 10 loop, this should not happen
                        break;
                    }
                }
                
                
                if(htmlLower.indexOf("<form") === startIndex && htmlLower.lastIndexOf("</form>") === htmlLower.length-"</form>".length){
                    //just <form></form> element in the HTML, it is just the column customization
                    formHTML= '<form id="mainForm" '+html.substring(startIndex+5) ;
                    html = "" ;
                }

                //no html view file is given, generate automatic HTML
                var schema = VeloxWebView.fieldsSchema.getSchema();
                if(!html){
                    //no HTML
                    html = script;
                    html += '<div>';
                    html += '<div id="chooseContainer">';
                    html += '<button id="chooseFile" type="button" data-emit>'+this.options.labels.chooseFileToImport+'</button>';
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
                    /*html += formHTML ;*/
                }
                
                loadImporterCSS() ;
                callback(html) ;
            }.bind(this)) ;
        }.bind(this) ;
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

                            var htmlTable = "<div><table>" ;
                            htmlTable += "<thead><tr>"+contents[0].map(function(c, i){ return "<th>"+String.fromCharCode(65+i)+"</th>" ;}).join("")+"</tr></thead>" ;
                            htmlTable += "</table></div>" ;

                            this.view.EL.importTableContainer.innerHTML = htmlTable ;
                            var table = this.view.EL.importTableContainer.querySelector("div") ;
                            this.view.createField(table, "grid", 0, {}, function(err){
                                if(err){ return done(err) ;}
                                table.setValue(contents) ;
    
                                done() ;
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

    /**
     * Get the default data when create a new record
     * 
     * @return {object} based on defaultData option with VeloxImporterController.UUID_AUTO replaced
     */
    VeloxImporterController.prototype._getDefaultData = function(callback){
        this.getDefaultData(function(err, defaultData){
            if(err){ return callback(err) ;}
            var schema = VeloxWebView.fieldsSchema.getSchema();
            prepareRecord(schema, this.table, defaultData) ;
            callback(null,defaultData);
        }.bind(this)) ;
    } ;


    /**
     * Get the default data when create a new record
     * 
     * @return {object} based on defaultData option with VeloxImporterController.UUID_AUTO replaced
     */
    VeloxImporterController.prototype.getDefaultData = function(callback){
        var defaultData = this.viewOptions.defaultData || {} ;
        var defaultDataStr = JSON.stringify(defaultData) ;
        defaultData = JSON.parse(defaultDataStr) ;        
        callback(null,defaultData);
    } ;


    /**
     * Return the records to save in database.
     * By default, it does the simple case where the view render the record and we save the record
     * 
     * You can override it to create more complexe saving (with sub table for example). the return 
     * record set will be save transactionnaly.
     * 
     * expected format : 
     * [
     *   {table: "", record: {}, action: "insert|update|remove"} (if action not given it will do update if exists or insert if not exists)
     * ]
     * 
     * @param {object} viewData the data from view input
     * @param {function} callback should return (err, recordsToSave)
     */
    VeloxImporterController.prototype.getRecordsToSave = function(viewData, dataBeforeModif, callback){
        var schema = VeloxWebView.fieldsSchema.getSchema();
        prepareRecord(schema, this.table, viewData) ;
        var recordsToSave = [{ table: this.table, record: viewData }] ;
        if(this.joinFetch){
            var hasError = this.joinFetch.some(function(join){
                var thisColumn = join.thisColumn ;
                var otherColumn = join.otherColumn;
                if(!thisColumn || !otherColumn){
                    schema[join.otherTable].fk.some(function(fk){
                        if(fk.targetTable === this.table){
                            thisColumn = fk.targetColumn ;
                            otherColumn = fk.thisColumn;
                            return;
                        }
                    }.bind(this)) ;
                }
                if(!thisColumn || !otherColumn){
                    //this table is not a sub table, assume that it is fetch for information only
                    return false;
                }
                var name = join.name||join.otherTable ;
                if(join.otherTable && viewData[name]){
                    if(join.type === "2many"){
                        if(Array.isArray(viewData[name])){

                            viewData[name].forEach(function(r){
                                r[otherColumn] = viewData[thisColumn] ;
                                prepareRecord(schema, join.otherTable, r) ;
                                recordsToSave.push({table: join.otherTable, record : r}) ;
                            }.bind(this)) ;

                            if(dataBeforeModif[name] && Array.isArray(dataBeforeModif[name])){
                                //search records removed
                                dataBeforeModif[name].forEach(function(oldRecord){
                                    //check if still exists in new data
                                    var stillExists = viewData[name].some(function(r){
                                        return schema[join.otherTable].pk.every(function(pk){
                                            return r[pk] === oldRecord[pk] ;
                                        }) ;
                                    }) ;
                                    if(!stillExists){
                                        recordsToSave.push({table: join.otherTable, record : oldRecord, action: "remove"}) ;
                                    }
                                }); 
                            }
                            

                        }else{
                            callback("join 2many expect an array object in "+name) ;
                            return true;
                        }
                    }else if (join.type === "2one"){
                        viewData[name][otherColumn] = viewData[thisColumn] ;
                        prepareRecord(schema, join.otherTable, viewData[name]) ;
                        recordsToSave.push({table: join.otherTable, record : viewData[name]}) ;
                    }else{
                        callback("join type should be 2one or 2many") ;
                        return true;
                    }
                    delete viewData[name] ;
                }
            }.bind(this)) ;
            if(!hasError){
                callback(null, recordsToSave) ;
            }
        }else{
            callback(null, recordsToSave) ;
        }
    };

    /**
     * Prepare a record according to rules defined in the schema
     * @param {object} schema the schema definition
     * @param {string} table the table name
     * @param {object} record the record to update
     */
    function prepareRecord(schema, table, record){
        schema[table].columns.forEach(function(col){
            if(col.autoGen && !record[col.name]){
                if(col.autoGen === "uuid"){
                    record[col.name] = uuidv4() ;
                }else if(col.autoGen.type &&  col.autoGen.type === "copy" && col.autoGen.column){
                    record[col.name] = record[col.autoGen.column] ;
                }else{
                    throw "Illegal autoGen value "+JSON.stringify(col.autoGen) ;
                }
            }
        }) ;
    }

    VeloxImporterController.prototype.prepareRecord = prepareRecord ;

    /**
     * Save the record on validation.
     * 
     * By default it use the Velox Database API to save to database. If you don't want to use this, override this to do your own save
     * 
     * @param {Array} recordsToSave list of records to save
     * @param {Function} callback call this when your saving is done. first argument is error, second argument is the new record to display
     */
    VeloxImporterController.prototype.saveRecords = function(recordsToSave, callback){
        if(!this.api || !this.api.__velox_database){
            return callback("No Velox Database API found, provide it or implement saveRecords on your form controller") ;
        }
        this.api.__velox_database.transactionalChanges(recordsToSave, function(err, recordsSaved){
            if(err){ return callback(err); }

            var thisTableRecord = null;
            recordsSaved.some(function(r){
                if(r.table === this.table){
                    thisTableRecord = r.record ;
                    return true ;
                }
            }.bind(this)) ;

            if(thisTableRecord){
                if(recordsToSave.length === 1){
                    callback(null, thisTableRecord) ;
                }else{
                    //there is some joins, reread data
                    this.searchRecord(thisTableRecord, function(err, newReadRecord){
                        if(err){ return callback(err);}
                        callback(null, newReadRecord) ;
                    }.bind(this)) ;
                }
            }else{
                callback({err : "Can't find this table record in results", records: recordsSaved}) ;
            }
        }.bind(this)) ;
    } ;



    VeloxImporterController.prototype.doValidate = function(done){
        var dataBeforeModif = JSON.parse(JSON.stringify(this.view.getBoundObject())) ;
        var dataAfterModif = JSON.parse(JSON.stringify(dataBeforeModif)) ;
        var viewData = this.view.updateData(dataAfterModif) ;
        
        this.view.clearFormError() ;
        this.view.checkForm(this.view.EL.mainForm, this.validations,function(err, checkOk){
            if(err){ return done(err); }
            if(!checkOk){
                return done(null, false) ;
            }
            this.view.EL.mainForm.className = this.view.EL.mainForm.className.replace(/ was\-validated/g, "");
            this.getRecordsToSave(viewData, dataBeforeModif, function(err, recordsToSave){
                if(err){ return done(err) ;}

                this.saveRecords(recordsToSave, function(err, savedRecord){
                    if(err){ return done(err) ;}
                    done(null, savedRecord) ;
                }.bind(this)) ;
            }.bind(this)) ;
        }.bind(this)) ;
    };

    VeloxImporterController.prototype._onBtValidate = function(){
        this.view.longTask(function(done){

            this.doValidate(function(err, savedRecord){
                if(err){ return done(err); }
                if(!savedRecord){
                    //check failed
                    return done() ;
                }
                if(this.mode === "create"){
                    if(this.api && this.api.__velox_database){
                        this.api.__velox_database[this.table].getPk(savedRecord, function(err, pk){
                            if(err){ return done(err) ;}
                            this.updateRouteData(this.viewOptions.route, pk);
                            done() ;
                        }.bind(this)) ;
                    }else{
                        this.currentRecord = savedRecord ;
                        this.navigate(this.viewOptions.route, savedRecord, "anonymous") ;
                        done() ;
                    }
                }else{
                    this.currentRecord = savedRecord ;
                    this.refresh() ;
                    done() ;
                }
            }.bind(this)) ;
        }.bind(this)) ;
    };

    VeloxImporterController.prototype.checkRequired = function(view){
        var errors = [] ;
        var requiredElements = view.elementsHavingAttribute("required");
        for(var i=0; i<requiredElements.length; i++){
            var el = requiredElements[i] ;
            var val = el.getValue?el.getValue():el.value ;
            if(!val){
                var label = el.getAttribute("data-field-label") ;
                errors.push({
                    el: el,
                    field: el.getAttribute("data-bind"),
                    fieldDef: el.getAttribute("data-field-def"),
                    label: label,
                    msg: VeloxWebView.tr?VeloxWebView.tr("form.missingRequiredField", {field: label}):"The field "+label+" is missing"
                }) ;
            }
        }
        return errors ;
    };

    VeloxImporterController.globalsOptions = {} ;

    /**
     * @typedef VeloxImporterControllerGlobalOptions
     * @type {object}
     * @property {string} [buttonsHTML] The HTML to use for toolbar buttons, it must have buttons "btBack", "btCreate", "btModify",  "btCancel",  "btValidate", "btDelete" which emit the corresponding events
     * @property {string} [titleHTML] The HTML to use for title
     */


    /**
     * Set global options for VeloxImporterController
     * 
     * @example
     * 
     * @param {VeloxImporterControllerGlobalOptions} globalsOptions options
     */
    VeloxImporterController.setOptions = function(globalsOptions){
        VeloxImporterController.globalsOptions = globalsOptions ;
    } ;

    return VeloxImporterController ;
})));