/*global console, alert*/
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
                               + '<h3><a href="/issues/${id}">${subject}</a></h3>'
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

    // TODO a lot of copypasta to tidy up here

    function loadTemplating() {
        log("Loading templating...");
        var done = false;
        var script = document.createElement("script");
        script.src = "//ajax.aspnetcdn.com/ajax/jquery.templates/beta1/jquery.tmpl.min.js";
        script.onload = script.onreadystatechange = function() {
            if(!done && (!this.readyState || this.readyState === "loaded"
                || this.readyState == "complete"))
            {
                log("Loaded templating");
                done = true;
                init_kanbanise();
            }
        };
        document.getElementsByTagName("head")[0].appendChild(script);
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
                // jQuery plugin to do templating - TODO load this better
                log("Loaded jQuery UI");
                done = true;
                loadTemplating();
            }
        };
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
        };
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
        loadTemplating();
    }

}());

