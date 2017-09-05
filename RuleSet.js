var RuleSet = function(bindings) {
    this.bindings = bindings;
}

RuleSet.prototype.asHyLARRules = function() {
    var adaptationRules = [],
        scoreBindings = this.bindings;

    for (var entry in scoreBindings) {
        var b = scoreBindings[entry][0],
            instances = b.instances.value.split(' ');


        for (var j = 0; j < instances.length; j++) {
            instances[j] = `(${instances[j]} ${rdftype} ${ctxInstance})`;
        }

        var cause = instances.join(' ^ '),
            consequence = `(__bnode__ ${rdfsub} ${b.adapted.value}) ^ (__bnode__ ${rdfpred} ${b.purposePred.value}) ^ (__bnode__ ${rdfobj} ${b.candidate.value}) ^ (__bnode__ ${rdfval} "${b.candidateScore.value}")`,
            rule = `${cause} -> ${consequence}`;

        adaptationRules.push(rule);
    }
    return adaptationRules;
}

RuleSet.prototype.size = function() {
    return Object.keys(this.bindings).length;
};

module.exports = RuleSet;