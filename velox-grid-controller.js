/*global define*/
; (function (global, factory) {
if (typeof exports === 'object' && typeof module !== 'undefined') {
    var VeloxViewController = require("velox-controller").ViewController ;
    module.exports = factory(VeloxViewController) ;
} else if (typeof define === 'function' && define.amd) {
    define(['VeloxViewController'], factory);
} else {
    global.VeloxGridController = factory(global.VeloxViewController, global.VeloxWebView);
}
}(this, (function (VeloxViewController, VeloxWebView) { 'use strict';

    var VeloxGridController = function(table, viewOptions){    
        this.table = table;
        var options = {} ;
        if(viewOptions){
            Object.keys(viewOptions).forEach(function(k){
                options[k] = viewOptions[k] ;
            }) ;
        }
        
        if(!options.name && !options.html){
            options.html = "" ;
        }

        this.joinFetch = options.joinFetch ;    
            
        VeloxViewController.call(this,options, null) ;

        this.on("initView", function(){
            this._doInitView() ;
        }.bind(this)) ;
    } ;
    VeloxGridController.prototype = Object.create(VeloxViewController.prototype);
    VeloxGridController.prototype.constructor = VeloxGridController;

    VeloxGridController.prototype._getScriptAndTable = function(html){
        var tableHTML = null;
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
        
        
        if(htmlLower.indexOf("<table") === startIndex && htmlLower.lastIndexOf("</table>") === htmlLower.length-"</table>".length){
            //just <table></table> element in the HTML, it is just the column customization
            tableHTML=html.substring(startIndex) ;
            html = "" ;
        }
        return {
            script: script,
            tableHTML: tableHTML
        } ;
    } ;
    VeloxGridController.prototype._doInitView = function(){
        //always load this CSS
        this.view.loadStaticCss([
                ".velox-grid-container {",
                    /* Ye Olde Flexbox for Webkit */
                    "display: -webkit-box;",
                    /* Tweener flexbox */
                    "display: -ms-flexbox;",
                    /* Prefixed "new flexbox" */
                    "display: -webkit-flex;",
                    /* unprefixed standard "new flexbox" version */
                    "display: flex;",
                    /* Your grandparents flexbox for Webkit */
                    "-webkit-box-orient: vertical;",
                    /* Prefixed new syntax: */
                    "-webkit-flex-direction: column;",
                    /* Same syntax for weird IE tweener */
                    "-ms-flex-direction: column;",
                    /* unprefixed new syntax */
                    "flex-direction: column;",
                    "height: 100%;",
                "}",
                ".velox-grid {",
                    "-webkit-box-flex: 1;",
                    "-ms-flex: 1 0 auto;",
                    "flex: 1 0 auto;",
                    "-webkit-flex: 1 0 auto;",
                "}",
            ].join("\n")) ;

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

                var scriptAndTable = this._getScriptAndTable(html);

                var tableHTML = scriptAndTable.tableHTML;
                var script = scriptAndTable.script;
                if(tableHTML){
                    html = "" ;
                }
                
                if(!html){
                    //no HTML
                    var gridShowOptions = [] ;
                    if(this.viewOptions.grid && this.viewOptions.grid.show){
                        Object.keys(this.viewOptions.grid.show).forEach(function(k){
                            gridShowOptions.push(k+'="'+this.viewOptions.grid.show[k]+'"') ;
                        }.bind(this)) ;
                    }
                    var title = this.viewOptions.title ;
                    if(!title) {
                        title = VeloxWebView.tr?VeloxWebView.tr("fields.table."+this.table):"List" ;
                    }

                    if(!tableHTML){
                        tableHTML = '<table></table>' ;
                    }

                    if(this.viewOptions.filters){
                        if(!this.viewOptions.grid){
                            this.viewOptions.grid = {} ;
                        }
                        if(!this.viewOptions.grid.show){
                            this.viewOptions.grid.show = {} ;
                        }
                        this.viewOptions.grid.show.toolbar = true ;
                    }
                    var div = document.createElement('div');
                    div.innerHTML = tableHTML;
                    var thead = div.querySelector("thead") ;
                    if(!thead){
                        thead = document.createElement("thead") ;
                        div.querySelector("table").appendChild(thead) ;
                    }
                    // Object.keys(this.viewOptions.grid.show).forEach(function(k){
                    //     if(!thead.hasAttribute(k)){//attribute not present, add it
                    //         thead.setAttribute(k, ''+this.viewOptions.grid.show[k]) ;
                    //     }
                    // }.bind(this)) ;
                    var trToolbar;
                    
                    if(this.viewOptions.canRefresh){
                        var trToolbar =  document.createElement("tr") ;
                        trToolbar.setAttribute("data-toolbar", true) ;
                        trToolbar.setAttribute("data-toolbar-prepend", true) ;
                        thead.appendChild(trToolbar) ;
                        var thToolbar = document.createElement("th") ;
                        trToolbar.appendChild(thToolbar) ;
                        thToolbar.innerHTML = VeloxWebView.tr?VeloxWebView.tr("form.refresh"):"Refresh";
                        thToolbar.id = "refresh";
                    }
                    if(this.viewOptions.canImport){
                        var trToolbar =  document.createElement("tr") ;
                        trToolbar.setAttribute("data-toolbar", true) ;
                        trToolbar.setAttribute("data-toolbar-prepend", true) ;
                        thead.appendChild(trToolbar) ;
                        var thToolbar = document.createElement("th") ;
                        trToolbar.appendChild(thToolbar) ;
                        thToolbar.innerHTML = VeloxWebView.tr?VeloxWebView.tr("form.import"):"Import";
                        thToolbar.id = "import";
                    }
                    if(this.viewOptions.canCreate){
                        var trToolbar =  document.createElement("tr") ;
                        trToolbar.setAttribute("data-toolbar", true) ;
                        thead.appendChild(trToolbar) ;
                        var thToolbar = document.createElement("th") ;
                        trToolbar.appendChild(thToolbar) ;
                        thToolbar.innerHTML = VeloxWebView.tr?VeloxWebView.tr("form.create"):"New";
                        thToolbar.id = "createNew";
                    }
                    if(this.viewOptions.filters){
                        var trToolbar =  document.createElement("tr") ;
                        trToolbar.setAttribute("data-toolbar", true) ;
                        thead.appendChild(trToolbar) ;
                        this.viewOptions.filters.forEach(function(filter){
                            var thToolbar = document.createElement("th") ;
                            trToolbar.appendChild(thToolbar) ;
                            thToolbar.innerHTML = filter.label;
                            thToolbar.id = "filter-"+filter.name;
                            thToolbar.setAttribute("data-type", "check");
                            Object.keys(filter).forEach(function(k){
                                if(["label", "name"].indexOf(k) === -1){
                                    thToolbar.setAttribute("data-"+k, filter[k]) ;
                                }
                            });
                        }.bind(this)) ;
                    }


                    tableHTML = div.innerHTML ;

                    html = script+'<div class="velox-grid-container">'+
                        '<h1>'+title+'</h1>'+
                        '<div id="'+this.table+'Grid" class="velox-grid" data-field-def="'+this.table+'.grid" data-bind="results">'+
                            tableHTML+
                        '</div>'+
                    '</div>' ;
                }
                callback(html) ;
            }.bind(this)) ;
        }.bind(this) ;
        this.view.getFilters = function(){
            // var items = this.viewOptions.filters;
            // if(this.view.initDone){
            //     items = this.view.EL[this.table+"Grid"].toolbar.items ;
            //     items.forEach(function(item){
            //         if(item.id.indexOf("filter-") === 0){
            //             item.name = item.id.substring(item.id.indexOf("-")+1) ;
            //         }
            //     }) ;
            // }
            var filters = [] ;
            // if(!items){ return filters; }
            // items.forEach(function(item){
            //     if(item.name){
            //         if(item.checked){
            //             this.viewOptions.filters.some(function(f){
            //                 if(f.name === item.name){
            //                     filters.push(f) ;
            //                     return true;
            //                 }
            //             }) ;
            //         }
            //     }
            // }.bind(this)) ;
            return filters;
        }.bind(this) ;
        
    } ;

    VeloxGridController.prototype.initEvents = function(){
        this.view.on("displayed", function(){
            //force grid re-render on display
            this.view.EL[this.table+"Grid"].render() ;
        }.bind(this)) ;
        this.view.on("initDone", function(){
            this.view.EL[this.table+"Grid"].addEventListener("rowClick", function(ev){
                this.view.emit("rowClick", ev.rowData) ;
            }.bind(this)) ;
            // if(this.view.EL[this.table+"Grid"] && this.view.EL[this.table+"Grid"].toolbar){
            //     this.view.EL[this.table+"Grid"].toolbar.on('click', function(event) {
            //         if(event.target.indexOf("filter-") === 0){
            //             event.onComplete = function(){
            //                 this.view.emit("filterChanged", this.view.getFilters()) ;
            //             }.bind(this) ;
            //         }
            //         if(event.target === "w2ui-reload"){
            //             event.onComplete = function(){
            //                 this.view.emit("reloadGrid") ;
            //             }.bind(this) ;
            //         }
            //     }.bind(this)) ;
            // }
        }.bind(this)) ;
        this.view.on("filterChanged", this.refresh.bind(this)) ;
        this.view.on("refresh", this.refresh.bind(this)) ;
    };
    VeloxGridController.prototype.prepareDataOnEnter = function(data, callback){
        var refreshValues = this.view.refreshValues?this.view.refreshValues.bind(this.view):function(cb){ cb() ;} ;
        refreshValues(function(err){
            if(err){ return callback(err); }
            this.routeData = data ;
            this.searchRecords(function(err, results){
                if(err){ return callback(err); }
                callback(null, {results: results}) ;
            }) ;
        }.bind(this)) ;
    } ;

    /**
     * Search the records to display, by default call server to get all record of the table
     * Override this function to customize search
     * 
     * @param {function} callback the callback to call when search is done
     */
    VeloxGridController.prototype.searchRecords = function(callback){
        if(!this.api || !this.api.__velox_database){
            return callback("No Velox Database API found, provide it or implement searchRecords on your grid controller") ;
        }
        this.api.__velox_database.getSchema(function(err, schema){
            if(err){ return callback(err) ;}
            this.api.__velox_database[this.table].search(
                this.createSearch(), 
                this.joinFetch, 
                this.orderBy || schema[this.table].pk.join(","), 
                callback);
        }.bind(this)) ;
    } ;

    /**
     * Create the search condition following filter conditions.
     * By default, it use the filters conditions
     * 
     * @return {object} the search to do on table
     */
    VeloxGridController.prototype.createSearch = function(){
        var search = {} ;
        var activeFilters = this.view.getFilters() ;
        activeFilters.forEach(function(f){
            if(search[f.searchField]){
                //already exist
                if(!Array.isArray(search[f.searchField])){
                    search[f.searchField] = [search[f.searchField]] ;
                }
                if(Array.isArray(f.searchValue)){
                    search[f.searchField] = search[f.searchField].concat(f.searchValue) ;
                }else{
                    search[f.searchField].push(f.searchValue) ;
                }
            }else{
                search[f.searchField] = f.searchValue ;
            }
        }) ;
        return search ;
    } ;


    //TODO : refresh only the modified line and keep grid status
    VeloxGridController.prototype.unstack = function(data){
        this.emit("beforeUnstack") ;
        this.refresh(data, function(){
            this.view.show();
            this.emit("unstack") ;
        }.bind(this)) ;
    } ;


    return VeloxGridController ;
})));