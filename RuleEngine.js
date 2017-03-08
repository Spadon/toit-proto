var rdfstore = require('rdfstore'),
	fs = require('fs'),
	Prefixes = 	"PREFIX asawoo-vocab: <http://liris.cnrs.fr/asawoo/vocab#> \n" +
				"PREFIX asawoo-ctx: <http://liris.cnrs.fr/asawoo/vocab/context/> \n " +
				"PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> \n" +
				"PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n" +
				"PREFIX owl: <http://www.w3.org/2002/07/owl#> \n",
	Triplestore;

var executeQuery = function(query) {		
	var deferred = Promise.defer();					
	Triplestore.execute(Prefixes + query, function(err, results) {						
		deferred.resolve(results);								
	});
	return deferred.promise;
}

var RuleEngine = function(od) {
	this.ontologyDirectory = od;
	console.log("Ontology directory set to: '" + od + "'.");
};

RuleEngine.prototype.load = function(file) {
	if (!Triplestore) {
		console.error("Triplestore not ready.");
	}

	var deferred = Promise.defer(),
		fileContent;

	try {
		fileContent = fs.readFileSync(this.ontologyDirectory + file).toString();		
	} catch(err) {
		deferred.reject(err);
	}

	Triplestore.load("text/turtle", fileContent,
		function(err, results) {
			if (err) {
				deferred.reject(err);
			} else {				
				deferred.resolve(results);
			}
		});	

	return deferred.promise;
};

RuleEngine.prototype.clear = function() {
	var deferred = Promise.defer();
	rdfstore.create(function(err, store) {
		if (err) {
			deferred.reject(err);
		} else {
			Triplestore = store;
			deferred.resolve();
		}		
	});

	return deferred.promise;
};

RuleEngine.prototype.getDimensions = function() {
	var deferred = Promise.defer(),
		dimensions = [];
	Triplestore.execute(Prefixes + "SELECT ?dimension { ?dimension a asawoo-ctx:ContextualDimension . }",
		function(err, results) {
			if (err) {
				deferred.reject(err);
			} else {
				for (var i = 0; i < results.length; i++) {
					dimensions.push(results[i].dimension.value);
				}
				deferred.resolve(dimensions);
			}
		});

	return deferred.promise;
};

RuleEngine.prototype.getPurposes = function() {
	var deferred = Promise.defer(),
		purposes = [];
	Triplestore.execute(Prefixes + "SELECT ?purpose { ?purpose a asawoo-ctx:AdaptationPurpose . }",
		function(err, results) {
			if (err) {
				deferred.reject(err);
			} else {
				for (var i = 0; i < results.length; i++) {
					purposes.push(results[i].purpose.value);
				}
				deferred.resolve(purposes);
			}
		});

	return deferred.promise;
};


RuleEngine.prototype.generateSPARQLSituationQuery = function(dimensions, purpose) {	
	var bodyQuery = '', variables = '';

	var instances = [];

	for (var k = 0; k < dimensions.length; k++) {
		var i = "?i"+k;

		instances.push(i);

		bodyQuery += " OPTIONAL { " +
			i + " a asawoo-ctx:ContextualInstance . \n" +
			i + " asawoo-ctx:instanceForPurpose <" + purpose + "> . \n" +		
			i + " asawoo-ctx:instanceFromDimension <" + dimensions[k] + "> . \n\n";

		for (var j = 0; j < instances.length; j++) {
			if (instances[j] != i) {
				bodyQuery += " FILTER (" + i + " != " + instances[j] + ") . \n"
			}
		}

		bodyQuery += " } ";

		variables += i + ' ';
	}

	return " SELECT DISTINCT " + variables + " { " + bodyQuery + " } "
};

RuleEngine.prototype.generateSPARQLSituationQueries = function(dimensions, purposes) {
	var queries = [];
	for (var i = 0; i < purposes.length; i++) {
		queries.push(this.generateSPARQLSituationQuery(dimensions, purposes[i]));
	}
	return queries;
};

RuleEngine.prototype.generateSituations = function(dimensions, purposes) {
	var promises = [],
		queries = this.generateSPARQLSituationQueries(dimensions, purposes),
		that = this;
	for (var i = 0; i < queries.length; i++) {				
		promises.push(executeQuery(queries[i]));
	}
	return Promise.all(promises);
};

module.exports = RuleEngine;