/*global define*/
; (function (global, factory) {
    if (typeof exports === 'object' && typeof module !== 'undefined') {
        var VeloxViewController = require("velox-controller").ViewController ;
        module.exports = factory(VeloxViewController) ;
    } else if (typeof define === 'function' && define.amd) {
        define(['VeloxViewController'], factory);
    } else {
        global.VeloxFormController = factory(global.VeloxViewController, global.VeloxWebView);
    }
}(this, (function (VeloxViewController, VeloxWebView) { 'use strict';

    var formCSSLoaded = false;

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

    //closest polyfill
    if (!Element.prototype.matches)
        Element.prototype.matches = Element.prototype.msMatchesSelector || 
                                Element.prototype.webkitMatchesSelector;

    if (!Element.prototype.closest)
        Element.prototype.closest = function(s) {
            var el = this;
            if (!document.documentElement.contains(el)) return null;
            do {
                if (el.matches(s)) return el;
                el = el.parentElement || el.parentNode;
            } while (el !== null); 
            return null;
        };

    /**
     * @typedef VeloxFormControllerOptionLabels
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
     * @typedef VeloxFormControllerOption
     * @type {object}
     * @property {string} [title] title to display (default : translation of fields.table.{table} or "Form" if no i18n)
     * @property {VeloxFormControllerOptionLabels} [labels] customize button labels
     * @property {object} [defaultData] the default value when creating a new record
     * @property {object[]} [joinFetch] the sub tables to fetch
     */


    /**
     * Create a standard CRUD form controller
     * 
     * @param {string} table table corresponding to this form
     * @param {VeloxFormControllerOption} viewOptions form options
     */
    var VeloxFormController = function(table, viewOptions){    
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
        if(!options.labels.confirmDelete){
            options.labels.confirmDelete = VeloxWebView.tr?VeloxWebView.tr("form.confirmDelete"):"Are you sure to delete ?" ;
        }
        if(!options.labels.cantDelete){
            options.labels.cantDelete = VeloxWebView.tr?VeloxWebView.tr("form.cantDelete"):"Can't delete this element because it is already used" ;
        }
        if(!options.labels.back){
            options.labels.back = VeloxWebView.tr?VeloxWebView.tr("form.back"):"Back" ;
        }
        if(!options.labels.create){
            options.labels.create = VeloxWebView.tr?VeloxWebView.tr("form.create"):"Create" ;
        }
        if(!options.labels.modify){
            options.labels.modify = VeloxWebView.tr?VeloxWebView.tr("form.modify"):"Modify" ;
        }
        if(!options.labels.delete){
            options.labels.delete = VeloxWebView.tr?VeloxWebView.tr("form.delete"):"Delete" ;
        }
        if(!options.labels.validate){
            options.labels.validate = VeloxWebView.tr?VeloxWebView.tr("form.validate"):"Validate" ;
        }
        if(!options.labels.cancel){
            options.labels.cancel = VeloxWebView.tr?VeloxWebView.tr("form.cancel"):"Cancel" ;
        }

        this.mode = "read" ;
        this.validations = [] ;

        VeloxViewController.call(this,options, null) ;

        this.on("initView", doInitView.bind(this)) ;
        this.on("enter", doEnterView.bind(this)) ;
        this.on("leave", doLeaveView.bind(this)) ;
    } ;


    VeloxFormController.prototype = Object.create(VeloxViewController.prototype);
    VeloxFormController.prototype.constructor = VeloxFormController;

    /**
     * load the Datatables CSS
     * 
     * This CSS make the table take the whole height on container
     */
    function loadFormCSS(){
        if(formCSSLoaded){ return ;}

        //
        var css = "div.readonly[required] label::after { display: none; } div[required] label::after { content: ' *'; color: red; }";
        css += ".form-invalid-feedback { margin-top: 5px; margin-bottom: 5px;  }";
        css += ".form-invalid-feedback:empty { display:none }";

        var head = document.getElementsByTagName('head')[0];
        var s = document.createElement('style');
        s.setAttribute('type', 'text/css');
        if (s.styleSheet) {   // IE
            s.styleSheet.cssText = css;
        } else {                // the world
            s.appendChild(document.createTextNode(css));
        }
        head.appendChild(s);
        formCSSLoaded = true ;
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
                var customButtons = "" ;
                html = html.trim() ;
                var htmlLower = html.toLowerCase() ;
                var script = "" ;
                var header = "" ;
                var startIndex = 0;
                
                var indexScript = htmlLower.indexOf("<script") ;
                var indexStyle = htmlLower.indexOf("<style") ;
                var indexHeader = htmlLower.indexOf("<header") ;
                
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
                    }else if(indexHeader === startIndex){
                        //having <style> but no <script>
                        var newStartIndex = htmlLower.indexOf("<", htmlLower.indexOf("</header>", startIndex)+"</header>".length, startIndex) ;
                        header += html.substring(htmlLower.indexOf(">", indexHeader)+1, htmlLower.indexOf("</header>", indexHeader)) ;
                        startIndex = newStartIndex;
                    }else{
                        break;
                    }
                    indexScript = htmlLower.indexOf("<script", startIndex) ;
                    indexStyle = htmlLower.indexOf("<style", startIndex) ;
                    indexHeader = htmlLower.indexOf("<header", startIndex) ;
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

                    if(formHTML.toLowerCase().indexOf("data-form-buttons") !== -1){
                        //has custom buttons to add to the button bar
                        var div = document.createElement("DIV") ;
                        div.innerHTML = formHTML ;
                        var buttons = div.querySelector("[data-form-buttons]") ;
                        if(buttons){
                            customButtons = buttons.innerHTML ;
                            buttons.parentElement.removeChild(buttons) ;
                            formHTML = div.innerHTML ;
                        }
                    }
                }

                //no html view file is given, generate automatic HTML
                var schema = VeloxWebView.fieldsSchema.getSchema();
                if(!html){
                    //no HTML
                    var title = this.viewOptions.title ;
                    if(!title) {
                        title = VeloxWebView.tr?VeloxWebView.tr("fields.table."+this.table):"Form" ;
                    }
                    html = script+'$FORM_TITLE<div id="formControlButtons">$FORM_BUTTONS</div>' ;
                    if(!formHTML){
                        formHTML = '<form id="mainForm" >';
                        schema[this.table].columns.forEach(function(col){
                            if(col.name.indexOf("velox_")!==0){
                                formHTML += '<div data-field-def="'+this.table+'.'+col.name+'"></div>' ;
                            }
                        }.bind(this)) ;
                        formHTML += '</form>';
                    }

                    var indexEndFormTag = formHTML.indexOf(">") ;
                    formHTML = formHTML.substring(0, indexEndFormTag+1) +'<div class="alert alert-danger form-invalid-feedback" id="formErrorMsg"></div>'+formHTML.substring(indexEndFormTag+1) ;
                    html += formHTML ;
                }
                
                var buttons = this.viewOptions.buttonsHTML || VeloxFormController.globalsOptions.buttonsHTML ;
                if(!buttons){
                    buttons = '' ;
                    buttons += '<button id="btBack" data-emit>'+this.viewOptions.labels.back+'</button>' ;
                    buttons += '<button id="btCreate" data-emit>'+this.viewOptions.labels.create+'</button>' ;
                    buttons += '<button id="btModify" data-emit>'+this.viewOptions.labels.modify+'</button>' ;
                    buttons += '<button id="btCancel" data-emit>'+this.viewOptions.labels.cancel+'</button>' ;
                    buttons += '<button id="btValidate" data-emit>'+this.viewOptions.labels.validate+'</button>' ;
                    buttons += '<button id="btDelete" data-emit>'+this.viewOptions.labels.delete+'</button>' ;
                    buttons += '$HEADER' ;
                }
                buttons += customButtons.trim();
                html = html.replace("$FORM_BUTTONS", buttons) ;
                html = html.replace("$HEADER", header) ;

                var titleHTML = this.viewOptions.titleHTML || VeloxFormController.globalsOptions.titleHTML ;
                if(!titleHTML){
                    titleHTML = '<h1 class="velox-form-title">'+title+'</h1>' ;
                }

                html = html.replace("$FORM_TITLE", titleHTML) ;
                loadFormCSS() ;
                callback(html) ;
            }.bind(this)) ;
        }.bind(this) ;
        
        this.view.formError = function(msg){
            this.EL.formErrorMsg.innerHTML = msg ;
        } ;
        this.view.clearFormError = function(){
            var errorFields = this.container.querySelectorAll(".has-error");
            for(var i=0; i<errorFields.length; i++){
                errorFields[i].className = errorFields[i].className.replace(/has-error/g, "") ;
            }
            this.EL.formErrorMsg.innerHTML = "" ;
        } ;
    };

    /**
     * Change the mode of the form (read, create, modify)
     * 
     * will display buttons and fields accordingly and set read only fields
     */
    VeloxFormController.prototype.setMode = function(mode){
        this.mode = mode ;
        this.applyMode(this.mode) ;
        this.view.emit("changeMode", this.mode) ;
    } ;

    /**
     * Apply the mode to the form (display buttons, handle readonly)
     */
    VeloxFormController.prototype.applyMode = function(mode){
        if(mode === "read"){
            this.view.EL.btCreate && this.view.EL.btCreate.style && (this.view.EL.btCreate.style.display = "");
            this.view.EL.btModify && this.view.EL.btModify.style && (this.view.EL.btModify.style.display = "");
            this.view.EL.btCancel && this.view.EL.btCancel.style && (this.view.EL.btCancel.style.display = "none");
            this.view.EL.btValidate && this.view.EL.btValidate.style && (this.view.EL.btValidate.style.display = "none");
            this.view.EL.btDelete && this.view.EL.btDelete.style && (this.view.EL.btDelete.style.display = "");
            this.view.EL.btBack && this.view.EL.btBack.style && (this.view.EL.btBack.style.display = "");
            this.view.clearFormError() ;
            this.view.setReadOnly(true) ;
        }else if(mode === "create"){
            this.view.EL.btCreate && this.view.EL.btCreate.style && (this.view.EL.btCreate.style.display = "none");
            this.view.EL.btModify && this.view.EL.btModify.style && (this.view.EL.btModify.style.display = "none");
            this.view.EL.btCancel && this.view.EL.btCancel.style && (this.view.EL.btCancel.style.display = "");
            this.view.EL.btValidate && this.view.EL.btValidate.style && (this.view.EL.btValidate.style.display = "");
            this.view.EL.btDelete && this.view.EL.btDelete.style && (this.view.EL.btDelete.style.display = "none");
            this.view.EL.btBack && this.view.EL.btBack.style && (this.view.EL.btBack.style.display = "none");
            this.view.setReadOnly(false) ;
            this.view.elementsHavingAttribute("data-always-readonly").concat(this.view.elementsHavingAttribute("data-create-readonly")).forEach(function(el){
                el.setReadOnly(true) ;
            }) ;                                                    
        }else if(mode === "modify"){
            this.view.EL.btCreate && this.view.EL.btCreate.style && (this.view.EL.btCreate.style.display = "none");
            this.view.EL.btModify && this.view.EL.btModify.style && (this.view.EL.btModify.style.display = "none");
            this.view.EL.btCancel && this.view.EL.btCancel.style && (this.view.EL.btCancel.style.display = "");
            this.view.EL.btValidate && this.view.EL.btValidate.style && (this.view.EL.btValidate.style.display = "");
            this.view.EL.btDelete && this.view.EL.btDelete.style && (this.view.EL.btDelete.style.display = "none");
            this.view.EL.btBack && this.view.EL.btBack.style && (this.view.EL.btBack.style.display = "none");
            this.view.setReadOnly(false) ;
            this.view.elementsHavingAttribute("data-always-readonly").concat(this.view.elementsHavingAttribute("data-modify-readonly")).forEach(function(el){
                el.setReadOnly(true) ;
            }) ;
        }
        this.view.viewRootEl.className = this.view.viewRootEl.className.replace(/form-mode-.*/g, "") ;
        this.view.viewRootEl.className += " form-mode-"+mode ;
        Array.prototype.slice.apply(this.view.container.querySelectorAll("[data-form-show]")).forEach(function(showEl){
            var attrShow = showEl.getAttribute("data-form-show") ;
            if(attrShow){
                var listModeShow = attrShow.split(",").map(function(m){ return m.trim();}) ;
                if(listModeShow.indexOf(mode) !== -1){
                    //show
                    showEl.style.display = "" ;
                }else{
                    //hide
                    showEl.style.setProperty("display", "none", "important") ;
                }
            }
        }) ;
    } ;

    /**
     * Get the default data when create a new record
     * 
     * @return {object} based on defaultData option with VeloxFormController.UUID_AUTO replaced
     */
    VeloxFormController.prototype._getDefaultData = function(callback){
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
     * @return {object} based on defaultData option with VeloxFormController.UUID_AUTO replaced
     */
    VeloxFormController.prototype.getDefaultData = function(callback){
        var defaultData = this.viewOptions.defaultData || {} ;
        var defaultDataStr = JSON.stringify(defaultData) ;
        defaultData = JSON.parse(defaultDataStr) ;        
        callback(null,defaultData);
    } ;


    VeloxFormController.prototype._onBtCreate = function(){
        this._getDefaultData(function(err, defaultData){
            if(err){ throw err; }
            this.view.render(defaultData);
            this._toggleListAuto(true) ;
            this.setMode("create") ;
        }.bind(this)) ;
    };
    VeloxFormController.prototype._onBtModify = function(){
        this._toggleListAuto(true);
        this.setMode("modify") ;
    };
    VeloxFormController.prototype._onBtCancel = function(){
        this._toggleListAuto(false);
        if(this.currentRecord){
            this.view.render(this.currentRecord);
            this.setMode("read") ;
        }else{
            //render nothing in the case nobody listen to back event
            this.view.render({});
            this.setMode("read") ;
            this.view.emit("back") ;
        }
    };

    VeloxFormController.prototype._onBtBack = function(){
        this.view.emit("back") ;
    };

    VeloxFormController.prototype._toggleListAuto = function(active){
        if(this.view.setListAuto){
            this.view.setListAuto(active);
        }
    };


   

    function doLeaveView(){
        this.currentRecord = null;
    }


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
    VeloxFormController.prototype.getRecordsToSave = function(viewData, dataBeforeModif, callback){
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

    VeloxFormController.prototype.prepareRecord = prepareRecord ;

    /**
     * Save the record on validation.
     * 
     * By default it use the Velox Database API to save to database. If you don't want to use this, override this to do your own save
     * 
     * @param {Array} recordsToSave list of records to save
     * @param {Function} callback call this when your saving is done. first argument is error, second argument is the new record to display
     */
    VeloxFormController.prototype.saveRecords = function(recordsToSave, callback){
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



    VeloxFormController.prototype.doValidate = function(done){
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

    VeloxFormController.prototype._onBtValidate = function(){
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

    VeloxFormController.prototype.checkRequired = function(view){
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

    /**
     * Check if the record can be deleted
     * 
     * The default behaviour is to check foreign keys
     * 
     * @param {object} record The record to delete
     * @param {function} callback 
     */
    VeloxFormController.prototype.checkBeforeDelete = function(record, callback){
        var schema = VeloxWebView.fieldsSchema.getSchema();
        var multiread = {} ;
        Object.keys(schema).forEach(function(t){
            if(schema[t].fk){
                for(var y=0; y<schema[t].fk.length; y++){
                    var fk = schema[t].fk[y] ;
                    if(fk.targetTable === this.table){
                        var s = {} ;
                        s[fk.thisColumn] = record[fk.targetColumn] ;
                        multiread[t+"_"+fk.thisColumn] = { table: t, searchFirst: s } ;
                    }
                }
            }
        }.bind(this)) ;
        this.api.__velox_database.multiread(multiread, function(err, reads){
            if(err){ return callback(err) ;}
            var isUsed = Object.keys(reads).some(function(k){
                return !!reads[k] ;
            }) ;
            callback(null, isUsed) ;
        }) ;
    };
    
    /**
     * Get the records to delete
     * 
     * The default behaviour is to delete the current record
     * 
     * @param {object} record The record to delete
     * @param {function} callback 
     */
    VeloxFormController.prototype.getRecordsToDelete = function(record, callback){
        callback(null, [{action : "remove", table: this.table, record: record}]) ;
    };

    /**
     * Delete the record 
     * 
     * By default it use the Velox Database API to delete in database. If you don't want to use this, override this to do your own delete
     * 
     * @param {object} record the record to delete
     * @param {Function} callback call this when your delete is done. first argument is error
     */
    VeloxFormController.prototype.deleteRecord = function(record, callback){
        if(!this.api || !this.api.__velox_database){
            return callback("No Velox Database API found, provide it or implement deleteRecord on your form controller") ;
        }
        this.checkBeforeDelete(record, function(err, isUsed){
            if(err){ return callback(err) ;}
            if(isUsed){
                return callback(this.viewOptions.labels.cantDelete) ;
            }
            this.getRecordsToDelete(record, function(err, changes){
                if(err){ return callback(err) ;}
                this.api.__velox_database.transactionalChanges(changes, callback) ;
            }.bind(this)) ;
        }.bind(this)) ;
    } ;

    VeloxFormController.prototype._onBtDelete = function(){
        this.view.confirm(this.viewOptions.labels.confirmDelete, function(yes){
            if(yes){
                this.view.longTask(function(done){
                    this.deleteRecord(this.currentRecord, function(err){
                        if(err){ return done(err); }
                        this._toggleListAuto(false);
                        this.view.render({}) ;//render nothing in the case nobody listen to back event
                        this.setMode("read") ;
                        this.view.emit("back") ;
                        done() ;
                    }.bind(this)) ;
                }.bind(this)) ;
            }
        }.bind(this)) ;
        
    };

    /**
     * called to prepare data when enter screen
     */
    VeloxFormController.prototype.prepareDataOnEnter = function(data, callback){
        if(!data){
            //no data given, use default data
            this.mode = "create" ;
            return this._getDefaultData(callback);
        }else{
            //get fresh data from database
            this.mode = data.$formMode || "read" ;
            return this.searchRecord(data, function(err, record){
                if(err){ return callback(err); }
                this.currentRecord = record ;
                callback(null, record);
            }.bind(this)) ;
        }
    } ;

    function doEnterView(){
        //toggle the list auto input
        this._toggleListAuto(this.mode !== "read");
        this.setMode(this.mode) ;
        this.view.on("btBack", this._onBtBack.bind(this)) ;
        this.view.on("btCreate", this._onBtCreate.bind(this)) ;
        this.view.on("btModify", this._onBtModify.bind(this)) ;
        this.view.on("btCancel", this._onBtCancel.bind(this)) ;
        this.view.on("btValidate", this._onBtValidate.bind(this)) ;
        this.view.on("btDelete", this._onBtDelete.bind(this)) ;
    }

    VeloxFormController.prototype.refresh = function(data, callback){
        if(typeof(data) === "function"){
            callback = data;
            data = null;
        }
        if(!data){
            data = this.currentRecord ;
        }
        if(!callback){
            callback = function(){} ;
        }
        this.enter(this.currentRecord, function(err){
            if(err){ callback(err) ;}
            callback() ;
        }) ;
    } ;


    /**
     * Search the record to display, by default call server with primary key
     * Override this function to customize search
     * 
     * @param {object} data the data received by the controller
     * @param {function} callback the callback to call when search is done
     */
    VeloxFormController.prototype.searchRecord = function(data, callback){
        if(!this.api || !this.api.__velox_database){
            return callback(null, data) ;
        }
        this.api.__velox_database[this.table].getPk(data, function(err, pk){
            if(err){ return callback(err) ;}
            this.api.__velox_database[this.table].getByPk(pk, this.joinFetch, callback);
        }.bind(this));
    } ;



    VeloxFormController.globalsOptions = {} ;

    /**
     * @typedef VeloxFormControllerGlobalOptions
     * @type {object}
     * @property {string} [buttonsHTML] The HTML to use for toolbar buttons, it must have buttons "btBack", "btCreate", "btModify",  "btCancel",  "btValidate", "btDelete" which emit the corresponding events
     * @property {string} [titleHTML] The HTML to use for title
     */


    /**
     * Set global options for VeloxFormController
     * 
     * @example
     * 
     * @param {VeloxFormControllerGlobalOptions} globalsOptions options
     */
    VeloxFormController.setOptions = function(globalsOptions){
        VeloxFormController.globalsOptions = globalsOptions ;
    } ;

    return VeloxFormController ;
})));