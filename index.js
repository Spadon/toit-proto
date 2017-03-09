var RuleEngine = require('./RuleEngine'),
	ontologyDirectory,
	fs = require('fs');

for (var i = 0; i < process.argv.length; i++) {
	var argv = process.argv;
	if (argv[i] === "-od") {
		ontologyDirectory = argv[i+1];
	}
}

var engine = new RuleEngine(ontologyDirectory),
	purposes = [], dimensions, situations, possibilities;

engine.getPurposes()
	.then(function(p) {
		purposes = p;
		return engine.getDimensions();
	}).then(function(d) {
		dimensions = d;
		return engine.generateSituations(dimensions, purposes);
	}).then(function(s) {
		situations = s;
		return engine.generateAdaptationPossibilities();
	}).then(function(p) {
		possibilities = p;
		return engine.insertData(situations + possibilities);
	}).then(function(status) {
		return engine.calculateScores();
	}).then(function(scores) {
		var rules = engine.generateScoredAdaptationRules(scores.results.bindings),
			rules_stardog = engine.generateScoredAdaptationRulesStardog(scores.results.bindings);
		try {
			fs.writeFileSync(ontologyDirectory+"rules.json", JSON.stringify(rules, null, 4));
			fs.writeFileSync(ontologyDirectory+"rules-stardog.ttl", rules_stardog);
			console.log(`Written ${rules.length} rules.`);
		} catch(e) {
			console.error(e);
		}
	});