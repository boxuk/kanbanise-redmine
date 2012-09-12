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

        var msgWin = null;
        function showMessage(msg) {
            if(msgWin === null) {
                $('#msgWin').remove();
                msgWin = $('<div id="msgWin" style=""></div>');
                $('body').append(msgWin);
            }
            $(msgWin).text(msg).show();
        }

        var $ = jQuery;

        if($('body.action-index') == null || $('body.action-index').length === 0) {
            alert("This page doesn't look like a Redmine issues list! Please find some issues");
            return;
        }

        var VERSION = '0.8';
        var API_KEY = null;
        // note: redmineRoot will not work if it's installed anywhere other than /, so
        // foo.com/redmine will not work
        var redmineRoot = window.location.protocol + "//" + window.location.host + "/";

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
                    showMessage("Saving changes...");
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
                            $(msgWin).fadeOut('slow');
                        }
                    });
                },
                connectWith: '.column'
            }).disableSelection();
        }

        /**
         * Make a request to the account page and extract the API access key
         * User has to be logged in for this to work
         */
        function loadApiKey(issues) {
            showMessage("Loading API key...");
            jQuery.ajax(redmineRoot + 'my/account', {complete: function(jqHRX, text) {
                var responseText = jqHRX.responseText;
                var start = responseText.indexOf("id='api-access-key'");
                var hunk = responseText.substring(start, start+100);
                var startKey = hunk.indexOf('>') + 1;
                API_KEY = hunk.substring(startKey, startKey + 40);

                setUpSorting();
                showMessage("Loaded API key");

                $(msgWin).delay(3000).fadeOut('slow');
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
                    storyPoints = jQuery(value).children('.cf_30')[0].textContent;
                    if(storyPoints && storyPoints.length > 0) {
                        storyPoints = storyPoints + " story points";
                    }
                }


                if( jQuery(value).children('.assigned_to').length > 0) {
                    assignedTo = jQuery(value).children('.assigned_to')[0].textContent;
                    if(assignedTo && assignedTo.length > 0) {
                        assignedTo = "Assigned to " + assignedTo;
                    }
                }

                issues[category].push({
                    'id': jQuery(value).children('.id')[0].textContent,
                    'priority': jQuery(value).children('.priority')[0].textContent,
                    'subject': jQuery(value).children('.subject')[0].textContent,
                    'assignedTo': assignedTo,
                    'storyPoints': storyPoints
                });
            });

            return issues;
        }

        /**
         * Draw a Kanban-style board on screen
         */
        function createBoard() {
            $('div#kanban').remove();
            var div = $('<div id="kanban"></div>');
            return div;
        }

        function drawBoard(issues) {
            var div = $('div#kanban');

            var ticket = '<div id="issue-${id}" class="card ticket">'
                               + '<span class="story-points">${storyPoints}</span>'
                               + '<h3><a href="/issues/${id}">${subject}</a></h3>'
                               + '<span class="assigned-to">${assignedTo}</span>'
                               + '</div>';
            var col = '<div class="list columnWrapper">'
                            + '  <div id="${id}" class="column">'
                            + '    <h1>${title}</h1>'
                            + '  </div>'
                            + '</div>';

            var col1Content = '', col2Content = '', col3Content = '', col4Content = '';
            var i = 0;

            for(i = 0; i < issues['backlog'].length; i++) {
                col1Content += ticket.replace(/\$\{id\}/gi, issues['backlog'][i].id)
                                  .replace('${subject}', issues['backlog'][i].subject)
                                  .replace('${storyPoints}', issues['backlog'][i].storyPoints ? issues['backlog'][i].storyPoints: '' )
                                  .replace('${assignedTo}', issues['backlog'][i].assignedTo);
            }
            for(i = 0; i < issues['inProgress'].length; i++) {
                col2Content += ticket.replace(/\$\{id\}/gi, issues['inProgress'][i].id)
                                  .replace('${subject}', issues['inProgress'][i].subject)
                                  .replace('${storyPoints}', issues['inProgress'][i].storyPoints ? issues['inProgress'][i].storyPoints: '' )
                                  .replace('${assignedTo}', issues['inProgress'][i].assignedTo);
            }
            for(i = 0; i < issues['resolved'].length; i++) {
                col3Content += ticket.replace(/\$\{id\}/gi, issues['resolved'][i].id)
                                  .replace('${subject}', issues['resolved'][i].subject)
                                  .replace('${storyPoints}', issues['resolved'][i].storyPoints ? issues['resolved'][i].storyPoints: '' )
                                  .replace('${assignedTo}', issues['resolved'][i].assignedTo);
            }
            for(i = 0; i < issues['done'].length; i++) {
                col4Content += ticket.replace(/\$\{id\}/gi, issues['done'][i].id)
                                  .replace('${subject}', issues['done'][i].subject)
                                  .replace('${storyPoints}', issues['done'][i].storyPoints ? issues['done'][i].storyPoints: '' )
                                  .replace('${assignedTo}', issues['done'][i].assignedTo);
            }

            $(div).append(col.replace('${title}', 'Backlog').replace('${id}', 'col1'));
            $(div).find('#col1').append(col1Content);
            $(div).append(col.replace('${title}', 'In progress').replace('${id}', 'col2'));
            $(div).find('#col2').append(col2Content);
            $(div).append(col.replace('${title}', 'Resolved/with QA').replace('${id}', 'col3'));
            $(div).find('#col3').append(col3Content);
            $(div).append(col.replace('${title}', 'Done').replace('${id}', 'col4'));
            $(div).find('#col4').append(col4Content);
            $(div).append($('<div class="credits">Kanbanise ' + VERSION + ' - brought to you by <a href="http://www.boxuk.com/">Box UK</a></div>'));

            $(div).click(function() {
                $('#kanban').remove();
            });

            // Close Kanbanise on `esc`
            $(document).keyup(function(e) {
                if(e.keyCode == 27){
                    $('#kanban').remove();
                }
            });

            return div;
        }

        /**
         * Add CSS rules to document header
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
            + ".credits a { color: #fff; font-weight: bold}"
            + "div#msgWin {position:fixed;right:0px;top:0px;z-index:30000;background:black;border:white 1px solid;padding: 3px; color: #fff}"
            + "</style>").appendTo("head");
        }

        // main
        addStyling();
        var issues = getIssues();
        var div = createBoard();
        $('body').append(div);
        drawBoard(issues);
        loadApiKey(issues);
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
                // jQuery plugin to do templating - TODO load this better
                log("Loaded jQuery UI");
                done = true;
                init_kanbanise();
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
        init_kanbanise();
    }

}());

