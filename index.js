var RuleEngine = require('./RuleEngine'),
	RDFStoreEngine = require('./RDFStoreEngine'),
	ontologyDirectory,
	fs = require('fs');

var ms = new Date().getTime();

for (var i = 0; i < process.argv.length; i++) {
    var argv = process.argv;
    if (argv[i] === "-od") {
        ontologyDirectory = argv[i+1];
    } else {

    }
}

async function init() {
    await RDFStoreEngine.createStore();
}

init();

var engine = new RuleEngine(ontologyDirectory),
	purposes = [], dimensions, situations, possibilities;

console.log(`Generation started`);

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
		var rules = engine.generateScoredAdaptationRules(scores.results.bindings);		
		console.log(`${rules.size()} rules generated`);		
		try {
			fs.writeFileSync(ontologyDirectory+"/rules.json", JSON.stringify(rules.asHyLARRules(), null, 4));						
			console.log(`Rules written in file ${ontologyDirectory}rules.json`);
			console.log(`Generation finished in 0.${new Date().getTime() - ms} seconds`);
		} catch(e) {
			console.error(`Could not write: ${e}`);
		}
	});

