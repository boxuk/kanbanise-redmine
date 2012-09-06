(function () {
    "use strict";

    var MIN_JQUERY_VERSION = '1.8.1';

    function log(msg) {
        if(window.console && window.console.log) {
            console.log(msg);
        }
    }

    function init_kanbanise() {

        var $ = jQuery;

        if($('body.action-index') == null || $('body.action-index').length === 0) {
            alert("This page doesn't look like a Redmine issues list! Please find some issues");
            return;
        }

        var VERSION = '0.5';
        var API_KEY = null;
        // note: redmineRoot will not work if it's installed anywhere other than /, so
        // foo.com/redmine will not work
        var redmineRoot = window.location.protocol + "//" + window.location.host + "/";

        /**
         * Make a request to the account page and extract the API access key
         * User has to be logged in for this to work
         */    
        function loadApiKey() {
            
            jQuery.ajax(redmineRoot + 'my/account', {complete: function(jqHRX, text) {
                var responseText = jqHRX.responseText;
                var start = responseText.indexOf("id='api-access-key'");
                var hunk = responseText.substring(start, start+100);
                var startKey = hunk.indexOf('>') + 1;
                API_KEY = hunk.substring(startKey, startKey + 40);
            }});
        }

        /**
         * Scrape a screenful of issues in Redmine
         */
        function getIssues() {

            var issues = {
                'backlog': [],
                'inProgress': [],
                'resolved': [],
                'done': []
            };

            var rows = $('table.issues tr.issue');
            rows.each(function(index, value) {
                var category = 'backlog';

                switch(jQuery(value).children('.status')[0].innerHTML) {
                    case 'Closed':
                        category = 'done';
                        break;
                    case 'In Progress':
                        category = 'inProgress';
                        break;
                    case 'Resolved':
                    case 'Ready for QA':
                        category = 'resolved';
                        break;            
                }

                var storyPoints = null;
                var assignedTo = null;

                if( jQuery(value).children('.cf_30').length > 0) {
                    storyPoints = jQuery(value).children('.cf_30')[0].innerText;
                    if(storyPoints && storyPoints.length > 0) {
                        storyPoints = storyPoints + " story points";
                    }
                }

            
                if( jQuery(value).children('.assigned_to').length > 0) {
                    assignedTo = jQuery(value).children('.assigned_to')[0].innerText;
                    if(assignedTo && assignedTo.length > 0) {
                        assignedTo = "Assigned to " + assignedTo;
                    }
                }

                issues[category].push({
                    'id': jQuery(value).children('.id')[0].innerText,
                    'priority': jQuery(value).children('.priority')[0].innerText,
                    'subject': jQuery(value).children('.subject')[0].innerText,
                    'assignedTo': assignedTo,
                    'storyPoints': storyPoints
                });
            });

            return issues;
        }

        /**
         * Draw a Kanban-style board on screen
         */
        function createBoard(issues) {
            var div = $('<div id="kanban"></div>');

            $.template('ticket', '<div id="issue-${id}" class="card ticket">'
                               + '<span class="story-points">${storyPoints}</span>'
                               + '<h3>${subject}</h3>'
                               + '<span class="assigned-to">${assignedTo}</span>'
                               + '</div>');
            $.template('col', '<div class="list columnWrapper">'
                            + '  <div id="${id}" class="column">'
                            + '    <h1>${title}</h1>'
                            + '  </div>'
                            + '</div>');

            var col1Content = $.tmpl('ticket', issues['backlog']);
            var col2Content = $.tmpl('ticket', issues['inProgress']);
            var col3Content = $.tmpl('ticket', issues['resolved']);
            var col4Content = $.tmpl('ticket', issues['done']);

            $(div).append($.tmpl('col', {title: 'Backlog', id: 'col1'}));
            $(div).find('#col1').append(col1Content);
            $(div).append($.tmpl('col', {title: 'In progress', id: 'col2'}));
            $(div).find('#col2').append(col2Content);
            $(div).append($.tmpl('col', {title: 'Resolved/with QA', id: 'col3'}));
            $(div).find('#col3').append(col3Content);
            $(div).append($.tmpl('col', {title: 'Done', id: 'col4'}));
            $(div).find('#col4').append(col4Content);
            $(div).append($('<div class="credits">Kanbanise ' + VERSION + ' - brought to you by <a href="http://www.boxuk.com/">Box UK</a></div>'));

            $(div).click(function() {
                $('#kanban').remove();
            });

            return div;
        }

        /**
         * The boards on the Kanban board should resize to fit content,
         * then all resize to the height of the tallest board, to make it
         * easy to drag/drop into them
         */
        function resizeColumns() {
            var maxH = 0;
            for(var i = 1; i <= 4; i++) {
                $('#col' + i).height('auto');
                if($('#col' + i).height() > maxH) {
                    maxH = $('#col' + i).height();
                }
            }
            $('.column').height(maxH);
        }

        /**
         * Set up the board so it is sortable, draggable, droppable
         */
        function setUpSorting() {
            $('#col1, #col2, #col3, #col4').sortable({
                stop: function(event, ui) {
                    resizeColumns();

                    var newStatus = $(ui.item).parent().find('h1').text();
                    var newStatusId = 1;
                    switch(newStatus.toLowerCase()) {
                        case "backlog":
                            newStatusId = 1; break;
                        case "in progress":
                            newStatusId = 2; break;
                        case "resolved/with qa":
                            newStatusId = 3; break;
                        case "done":
                            newStatusId = 5; break;
                        default:
                            return; // no action if unrecognised
                    }

                    if (API_KEY === null) {
                        alert("No API key was set. Are you definitely logged in?");
                    }

                    var issueId = ui.item[0].id.replace('issue-', '');
                    // only works if status codes are defaults that come with redmine! No funny business!

                    jQuery.ajax(redmineRoot + 'issues/' + issueId + '.json', {
                        headers: {
                            'X-Redmine-API-Key': API_KEY,
                            'Content-Type': 'application/json'
                        },
                        processData: false,
                        dataType: 'json',
                        //data: '{issue:{status_id:"' + newStatusId + '"}}',
                        data: JSON.stringify({issue:{status_id: newStatusId}}),
                        type: 'PUT',
                        complete: function(jqHXR, textStatus) {
                        }
                    });
                },
                connectWith: '.column'
            }).disableSelection();
        }

        /**
         * Add CSS rules
         */
        function addStyling() {
            $("<style type='text/css'> .ui-state-hover{ background: blue !important; }"
            + "#kanban { z-index:1000;position:absolute;left:0;top:0;width:100%;min-height:100%;background:#164B69; }"
            + ".story-points { float:right;font-size:11px;}" 
            + ".card, .column { border-radius: 4px; box-shadow: 0 0 8px rgba(0, 0, 0, 0.6), inset 0px 0px 6px rgba(64, 116, 188, 0.4); margin: 0 0 7px 0; }"
            + ".card { background: #fefefe; padding: 5px;}"
            + ".card h3{ display: block; margin-bottom: 0.2em; overflow: hidden;}"
            + ".column { margin:10px;padding:10px;background: #084563; box-shadow: 0 0 20px rgba(0, 0, 0, 0.6)}"
            + ".column h1 { color: #fff;margin-bottom:4px;display:block; }"
            + ".columnWrapper { float:left;width: 25%; }"
            + ".assigned-to {display: block; font-size: 11px; text-transform: uppercase;}"
            + ".credits { clear:both;color:#fff;font-size:0.7em;margin-left:20px;margin-bottom: 20px;}"
            + ".credits a { color: #fff; font-weight: bold"
            + "</style>").appendTo("head");
        }

        // main
        loadApiKey();
        addStyling();
        var issues = getIssues();
        var div = createBoard(issues);
        $('body').append(div);
        setUpSorting();
        resizeColumns();
    }

    function loadJQueryUI() {
        log("Loading jQuery UI...");
        var done = false;
        var script = document.createElement("script");
        script.src = "//ajax.googleapis.com/ajax/libs/jqueryui/1.8.23/jquery-ui.min.js";
        script.onload = script.onreadystatechange = function() {
            if(!done && (!this.readyState || this.readyState === "loaded"
                || this.readyState == "complete"))
            {

                // jQuery plugin to do templating
                (function(a){var r=a.fn.domManip,d="_tmplitem",q=/^[^<]*(<[\w\W]+>)[^>]*$|\{\{\! /,b={},f={},e,p={key:0,data:{}},h=0,c=0,l=[];function g(e,d,g,i){var c={data:i||(d?d.data:{}),_wrap:d?d._wrap:null,tmpl:null,parent:d||null,nodes:[],calls:u,nest:w,wrap:x,html:v,update:t};e&&a.extend(c,e,{nodes:[],parent:d});if(g){c.tmpl=g;c._ctnt=c._ctnt||c.tmpl(a,c);c.key=++h;(l.length?f:b)[h]=c}return c}a.each({appendTo:"append",prependTo:"prepend",insertBefore:"before",insertAfter:"after",replaceAll:"replaceWith"},function(f,d){a.fn[f]=function(n){var g=[],i=a(n),k,h,m,l,j=this.length===1&&this[0].parentNode;e=b||{};if(j&&j.nodeType===11&&j.childNodes.length===1&&i.length===1){i[d](this[0]);g=this}else{for(h=0,m=i.length;h<m;h++){c=h;k=(h>0?this.clone(true):this).get();a.fn[d].apply(a(i[h]),k);g=g.concat(k)}c=0;g=this.pushStack(g,f,i.selector)}l=e;e=null;a.tmpl.complete(l);return g}});a.fn.extend({tmpl:function(d,c,b){return a.tmpl(this[0],d,c,b)},tmplItem:function(){return a.tmplItem(this[0])},template:function(b){return a.template(b,this[0])},domManip:function(d,l,j){if(d[0]&&d[0].nodeType){var f=a.makeArray(arguments),g=d.length,i=0,h;while(i<g&&!(h=a.data(d[i++],"tmplItem")));if(g>1)f[0]=[a.makeArray(d)];if(h&&c)f[2]=function(b){a.tmpl.afterManip(this,b,j)};r.apply(this,f)}else r.apply(this,arguments);c=0;!e&&a.tmpl.complete(b);return this}});a.extend({tmpl:function(d,h,e,c){var j,k=!c;if(k){c=p;d=a.template[d]||a.template(null,d);f={}}else if(!d){d=c.tmpl;b[c.key]=c;c.nodes=[];c.wrapped&&n(c,c.wrapped);return a(i(c,null,c.tmpl(a,c)))}if(!d)return[];if(typeof h==="function")h=h.call(c||{});e&&e.wrapped&&n(e,e.wrapped);j=a.isArray(h)?a.map(h,function(a){return a?g(e,c,d,a):null}):[g(e,c,d,h)];return k?a(i(c,null,j)):j},tmplItem:function(b){var c;if(b instanceof a)b=b[0];while(b&&b.nodeType===1&&!(c=a.data(b,"tmplItem"))&&(b=b.parentNode));return c||p},template:function(c,b){if(b){if(typeof b==="string")b=o(b);else if(b instanceof a)b=b[0]||{};if(b.nodeType)b=a.data(b,"tmpl")||a.data(b,"tmpl",o(b.innerHTML));return typeof c==="string"?(a.template[c]=b):b}return c?typeof c!=="string"?a.template(null,c):a.template[c]||a.template(null,q.test(c)?c:a(c)):null},encode:function(a){return(""+a).split("<").join("&lt;").split(">").join("&gt;").split('"').join("&#34;").split("'").join("&#39;")}});a.extend(a.tmpl,{tag:{tmpl:{_default:{$2:"null"},open:"if($notnull_1){_=_.concat($item.nest($1,$2));}"},wrap:{_default:{$2:"null"},open:"$item.calls(_,$1,$2);_=[];",close:"call=$item.calls();_=call._.concat($item.wrap(call,_));"},each:{_default:{$2:"$index, $value"},open:"if($notnull_1){$.each($1a,function($2){with(this){",close:"}});}"},"if":{open:"if(($notnull_1) && $1a){",close:"}"},"else":{_default:{$1:"true"},open:"}else if(($notnull_1) && $1a){"},html:{open:"if($notnull_1){_.push($1a);}"},"=":{_default:{$1:"$data"},open:"if($notnull_1){_.push($.encode($1a));}"},"!":{open:""}},complete:function(){b={}},afterManip:function(f,b,d){var e=b.nodeType===11?a.makeArray(b.childNodes):b.nodeType===1?[b]:[];d.call(f,b);m(e);c++}});function i(e,g,f){var b,c=f?a.map(f,function(a){return typeof a==="string"?e.key?a.replace(/(<\w+)(?=[\s>])(?![^>]*_tmplitem)([^>]*)/g,"$1 "+d+'="'+e.key+'" $2'):a:i(a,e,a._ctnt)}):e;if(g)return c;c=c.join("");c.replace(/^\s*([^<\s][^<]*)?(<[\w\W]+>)([^>]*[^>\s])?\s*$/,function(f,c,e,d){b=a(e).get();m(b);if(c)b=j(c).concat(b);if(d)b=b.concat(j(d))});return b?b:j(c)}function j(c){var b=document.createElement("div");b.innerHTML=c;return a.makeArray(b.childNodes)}function o(b){return new Function("jQuery","$item","var $=jQuery,call,_=[],$data=$item.data;with($data){_.push('"+a.trim(b).replace(/([\\'])/g,"\\$1").replace(/[\r\t\n]/g," ").replace(/\$\{([^\}]*)\}/g,"{{= $1}}").replace(/\{\{(\/?)(\w+|.)(?:\(((?:[^\}]|\}(?!\}))*?)?\))?(?:\s+(.*?)?)?(\(((?:[^\}]|\}(?!\}))*?)\))?\s*\}\}/g,function(m,l,j,d,b,c,e){var i=a.tmpl.tag[j],h,f,g;if(!i)throw"Template command not found: "+j;h=i._default||[];if(c&&!/\w$/.test(b)){b+=c;c=""}if(b){b=k(b);e=e?","+k(e)+")":c?")":"";f=c?b.indexOf(".")>-1?b+c:"("+b+").call($item"+e:b;g=c?f:"(typeof("+b+")==='function'?("+b+").call($item):("+b+"))"}else g=f=h.$1||"null";d=k(d);return"');"+i[l?"close":"open"].split("$notnull_1").join(b?"typeof("+b+")!=='undefined' && ("+b+")!=null":"true").split("$1a").join(g).split("$1").join(f).split("$2").join(d?d.replace(/\s*([^\(]+)\s*(\((.*?)\))?/g,function(d,c,b,a){a=a?","+a+")":b?")":"";return a?"("+c+").call($item"+a:d}):h.$2||"")+"_.push('"})+"');}return _;")}function n(c,b){c._wrap=i(c,true,a.isArray(b)?b:[q.test(b)?b:a(b).html()]).join("")}function k(a){return a?a.replace(/\\'/g,"'").replace(/\\\\/g,"\\"):null}function s(b){var a=document.createElement("div");a.appendChild(b.cloneNode(true));return a.innerHTML}function m(o){var n="_"+c,k,j,l={},e,p,i;for(e=0,p=o.length;e<p;e++){if((k=o[e]).nodeType!==1)continue;j=k.getElementsByTagName("*");for(i=j.length-1;i>=0;i--)m(j[i]);m(k)}function m(j){var p,i=j,k,e,m;if(m=j.getAttribute(d)){while(i.parentNode&&(i=i.parentNode).nodeType===1&&!(p=i.getAttribute(d)));if(p!==m){i=i.parentNode?i.nodeType===11?0:i.getAttribute(d)||0:0;if(!(e=b[m])){e=f[m];e=g(e,b[i]||f[i],null,true);e.key=++h;b[h]=e}c&&o(m)}j.removeAttribute(d)}else if(c&&(e=a.data(j,"tmplItem"))){o(e.key);b[e.key]=e;i=a.data(j.parentNode,"tmplItem");i=i?i.key:0}if(e){k=e;while(k&&k.key!=i){k.nodes.push(j);k=k.parent}delete e._ctnt;delete e._wrap;a.data(j,"tmplItem",e)}function o(a){a=a+n;e=l[a]=l[a]||g(e,b[e.parent.key+n]||e.parent,null,true)}}}function u(a,d,c,b){if(!a)return l.pop();l.push({_:a,tmpl:d,item:this,data:c,options:b})}function w(d,c,b){return a.tmpl(a.template(d),c,b,this)}function x(b,d){var c=b.options||{};c.wrapped=d;return a.tmpl(a.template(b.tmpl),b.data,c,b.item)}function v(d,c){var b=this._wrap;return a.map(a(a.isArray(b)?b.join(""):b).filter(d||"*"),function(a){return c?a.innerText||a.textContent:a.outerHTML||s(a)})}function t(){var b=this.nodes;a.tmpl(null,null,null,this).insertBefore(b[0]);a(b).remove()}})(jQuery);


                log("Loaded jQuery UI");
                done = true;
                init_kanbanise();
            }
        }
        document.getElementsByTagName("head")[0].appendChild(script);
    }

    function loadJQuery() {
        log("Loading jQuery...");
        var done = false;
        var script = document.createElement("script");
        script.src = "//ajax.googleapis.com/ajax/libs/jquery/" + MIN_JQUERY_VERSION + "/jquery.min.js";
        script.onload = script.onreadystatechange = function() {
            if(!done && (!this.readyState || this.readyState === "loaded"
                || this.readyState == "complete"))
            {
                log("loaded jQuery");
                done = true;
                loadJQueryUI();
            }
        }
        document.getElementsByTagName("head")[0].appendChild(script);
    }

    // Ensure jQuery and jQuery UI are loaded and available before
    // loading kanbanise
    if(    window.jQuery === undefined
        || window.jQuery.fn.jquery < MIN_JQUERY_VERSION
        || window.jQueryUI === undefined)
    {
        loadJQuery();
    } else {
        init_kanbanise();
    }

}());

