describe("Kanbanise", function() {
    var k;
    var sampleIssues = {
        "backlog":[{"id":"6290","priority":"Normal","subject":"[ML08]Ability to track and report on use of links contained within list emails","assignedTo":"","storyPoints":""},{"id":"6279","priority":"Normal","subject":"[NL04] Support file attachments","assignedTo":"Assigned to John Chapp","storyPoints":""}],
        "inProgress":[],
        "resolved":[{"id":"13239","priority":"Normal","subject":"Reintegrate branch","assignedTo":"Assigned to Steve Martins","storyPoints":""},{"id":"12862","priority":"Normal","subject":"Image not contained with Email","assignedTo":"Assigned to Martin Jones","storyPoints":""},{"id":"6289","priority":"Normal","subject":"[ML10] [ML11] styles in templates","assignedTo":"","storyPoints":""},{"id":"6288","priority":"Normal","subject":"[NL05] Web page: It will be possible to view the list of messages through a web interface.","assignedTo":"","storyPoints":""},{"id":"6287","priority":"Normal","subject":"[NL07] access restrictions on lists","assignedTo":"","storyPoints":""},{"id":"6284","priority":"Normal","subject":"[ML10] [ML11] Support templates","assignedTo":"Assigned to John Chapp","storyPoints":""},{"id":"6282","priority":"Normal","subject":"[NL01] [NL05] [NL07] Publish RSS for lists","assignedTo":"","storyPoints":""},{"id":"6281","priority":"Low","subject":"[ML06] Send ad-hoc message","assignedTo":"Assigned to Brian Fergus","storyPoints":""}],
        "done":[]
    };

    beforeEach(function() {
        k = new Kanbanise();
    });

    it("cannot apply templates to whole issue collection", function() {
        expect(k.applyTemplateTicket(sampleIssues)).toEqual('');
    });

    it("can apply templates to ticket arrays", function() {
        expect(k.applyTemplateTicket(sampleIssues['backlog'])).toContain('<h3><a href="/issues/6290">[ML08]');
    });

    it("can apply templates to lists of tickets", function() {
        var backlogContent = k.applyTemplateTicket(sampleIssues['backlog']);
        var colContent = k.applyTemplateCol('Test', 'colTest', backlogContent).html();
        expect(colContent).toContain('<h1>Test</h1>')
        expect(colContent).toContain('assigned-to">Assigned to John Chapp');
    });
});
