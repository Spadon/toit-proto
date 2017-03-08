var rdfstore = require('rdfstore'),
	request = require('request'),
	fs = require('fs'),
	Prefixes = 	"PREFIX asawoo-vocab: <http://liris.cnrs.fr/asawoo/vocab#> \n" +
				"PREFIX asawoo-ctx: <http://liris.cnrs.fr/asawoo/vocab/context/> \n " +
				"PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> \n" +
				"PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> \n" +
				"PREFIX owl: <http://www.w3.org/2002/07/owl#> \n",
	Triplestore;

var executeQuery = function(query) {			
	var deferred = Promise.defer(),
		options = {
    		url: 'http://localhost:5820/annex/toit/sparql/query',
    		method: 'POST',
    		form: {
    			'query': Prefixes + query
    		},
    		headers: {
    			'Accept': 'application/sparql-results+json'
    		}    
		};		

	if (arguments.length > 1) {
		options.headers['Accept'] = arguments[1];
	}

	request(options, function(err, res, body) {		
		try {
			body = JSON.parse(body)			
		} catch(e) {}
		deferred.resolve(body);
	});

	return deferred.promise;
}

var RuleEngine = function(od) {
	this.ontologyDirectory = od;
	console.log("Ontology directory set to: '" + od + "'.");
};

RuleEngine.prototype.getDimensions = function() {
	var deferred = Promise.defer(),
		dimensions = [];
	executeQuery("SELECT ?dimension { ?dimension a asawoo-ctx:ContextualDimension . }")
		.then(function(response) {						
			var bindings = response.results.bindings;
			for (var i = 0; i < bindings.length; i++) {				
				dimensions.push(bindings[i].dimension.value);
			}			
			deferred.resolve(dimensions);
		});
	return deferred.promise;
};

RuleEngine.prototype.getPurposes = function() {
	var deferred = Promise.defer(),
		purposes = [];
	executeQuery("SELECT ?purpose { ?purpose a asawoo-ctx:AdaptationPurpose . }")
		.then(function(response) {						
			var bindings = response.results.bindings;
			for (var i = 0; i < bindings.length; i++) {				
				purposes.push(bindings[i].purpose.value);
			}
			deferred.resolve(purposes);
		});
	return deferred.promise;
};


RuleEngine.prototype.generateSPARQLSituationQuery = function(dimensions, purpose) {	
	var bodyQuery = '', variables = '', filters = '';

	var instances = [];

	for (var k = 0; k < dimensions.length; k++) {
		var i = "?i"+k;

		instances.push(i);

		bodyQuery += " OPTIONAL { " +
			i + " a asawoo-ctx:ContextualInstance . \n" +
			i + " asawoo-ctx:instanceForPurpose <" + purpose + "> . \n" +		
			i + " asawoo-ctx:instanceFromDimension <" + dimensions[k] + "> . \n\n";

		bodyQuery += " } ";

		variables += i + ' ';
	}

	return " SELECT DISTINCT " + variables + " { " + bodyQuery + " } ";
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
		situations = [],
		deferred = Promise.defer(),
		queries = this.generateSPARQLSituationQueries(dimensions, purposes),
		that = this;

	for (var i = 0; i < queries.length; i++) {				
		promises.push(executeQuery(queries[i]));
	}

	Promise.all(promises)
		.then(function(responses) {
			for (i = 0; i < responses.length; i++) {
				var bindings = responses[i].results.bindings;				
				for (j = 0; j < bindings.length; j++) {
					var conjunction = '',
						currentSituation = '<http://liris.cnrs.fr/asawoo/vocab/context/S-'+i+'-'+j+'> ';
						situations += currentSituation + ' a <http://liris.cnrs.fr/asawoo/vocab/context/ContextualSituation> . \n'
					
					for (var key in bindings[j]) {						
						situations += 	currentSituation +
										'<http://liris.cnrs.fr/asawoo/vocab/context/containsInstance> ' +
										'<' + bindings[j][key].value + '> . \n';
					}

				}								
			}			
			deferred.resolve(situations);
		});

	return deferred.promise;
};

RuleEngine.prototype.generateAdaptationPossibilities = function() {
	return executeQuery(
			'CONSTRUCT { ?adapted ?possibilityPred ?candidate } ' +
			'WHERE { ' +
			'	?purpose asawoo-ctx:purposePredicate ?possibilityPred . ' +
			'	?possibilityPred rdfs:domain ?adaptedClass . ' +
			'	?possibilityPred rdfs:range ?candidateClass . ' +
			'	?adapted a ?adaptedClass . ' +
			'	?candidate a ?candidateClass . ' +
			'}', 'application/n-triples');
};

RuleEngine.prototype.calculateScores = function() {
	return executeQuery(
		`SELECT DISTINCT ?adapted ?purposePred ?candidate
		  (SUM(?score) AS ?candidateScore)
		  (GROUP_CONCAT(?contextualInstance) AS ?instances) {
			?adapted ?purposePred ?candidate .
			?purpose asawoo-ctx:purposePredicate ?purposePred .	
		    ?contextualSituation asawoo-ctx:containsInstance ?contextualInstance .	
			
			?scoringFunction asawoo-ctx:scores ?BN .
			?scoringFunction asawoo-ctx:applicableTo ?purpose .    
			?BN asawoo-ctx:withInstance ?contextualInstance .
			?BN asawoo-ctx:forCandidate ?candidate .
			?BN rdf:value ?score .	
		 
		} GROUP BY ?adapted ?purposePred ?candidate ?contextualSituation`);
}

RuleEngine.prototype.generateScoredAdaptationRules = function() {

}

RuleEngine.prototype.insertData = function(data) {
	return executeQuery('INSERT DATA { ' + data + ' }', 'text/boolean');
};

module.exports = RuleEngine;

/*RuleEngine.prototype.load = function(file) {
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
};*/