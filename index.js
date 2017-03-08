var RuleEngine = require('./RuleEngine'),
	ontologyDirectory;

for (var i = 0; i < process.argv.length; i++) {
	var argv = process.argv;
	if (argv[i] === "-od") {
		ontologyDirectory = argv[i+1];
	}
}

var engine = new RuleEngine(ontologyDirectory),
	purposes, dimensions;

engine.clear()	
	.then(function() {
		engine.load("purposes.ttl")
			.then(function(status) {
				return engine.getPurposes();
			}).then(function(p) {
				purposes = p;
				return engine.load("dimensions_instances.ttl")
					.then(function(status) {
						return engine.getDimensions();
					});
			}).then(function(d) {
				dimensions = d;
				return engine.generateSituations(dimensions, purposes);
			}).then(function(s) {
				console.log(JSON.stringify(s));
			});
	});	