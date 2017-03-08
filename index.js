var RuleEngine = require('./RuleEngine'),
	ontologyDirectory;

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
		console.log(p);
	})