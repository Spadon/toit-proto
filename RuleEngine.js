var request = require('request'),
	fs = require('fs'),
	q = require('q');

var RuleSet = require('./RuleSet'),
	//executeQuery = require('./HttpQueryEngine').executeQuery;
	RDFStoreEngine = require('./RDFStoreEngine'),
	executeQuery = RDFStoreEngine.executeQuery;

Prefixes = 	`PREFIX asawoo-vocab: <http://liris.cnrs.fr/asawoo/vocab#>
			PREFIX asawoo-ctx: <http://liris.cnrs.fr/asawoo/vocab/context/> 
			PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#> 
			PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> 
			PREFIX owl: <http://www.w3.org/2002/07/owl#> `;

rdftype = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
rdfsub = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#subject',
rdfpred = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#predicate',
rdfobj = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#object',
rdfval = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#value',
ctxInstance = 'http://liris.cnrs.fr/asawoo/vocab/context/ContextualInstance';

var RuleEngine = function(od) {
	if (od === undefined) {
		console.log(`Ontology directory not set. Using default test directory ${RDFStoreEngine.test_dir}`);
        od = RDFStoreEngine.test_dir;
	}
	this.ontologyDirectory = od;
	console.log("Ontology directory set to: '" + od + "'.");
};

RuleEngine.prototype.getDimensions = function() {
	var deferred = q.defer(),
		dimensions = [];
	executeQuery("SELECT ?dimension { ?dimension a asawoo-ctx:ContextualDimension . }")
		.then(function(response) {						
			var bindings = response.results.bindings;
			for (var i = 0; i < bindings.length; i++) {				
				dimensions.push(bindings[i].dimension.value);
			}			
			console.log(`${dimensions.length} contextual dimensions found.`);
			deferred.resolve(dimensions);
		});
	return deferred.promise;
};

RuleEngine.prototype.getPurposes = function() {
	var deferred = q.defer(),
		purposes = [];
	executeQuery("SELECT ?purpose { ?purpose a asawoo-ctx:AdaptationPurpose . }")
		.then(function(response) {									
			var bindings = response.results.bindings;			
			for (var i = 0; i < bindings.length; i++) {				
				purposes.push(bindings[i].purpose.value);
			}
			console.log(`${purposes.length} adaptation purposes found.`);
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

		bodyQuery += ` OPTIONAL { 
			${i} a asawoo-ctx:ContextualInstance . 
			${i}  asawoo-ctx:instanceForPurpose <" + purpose + "> . 		
			${i}  asawoo-ctx:instanceFromDimension <" + dimensions[k] + "> . `;

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
		deferred = q.defer(),
		queries = this.generateSPARQLSituationQueries(dimensions, purposes),
		that = this;

	for (var i = 0; i < queries.length; i++) {				
		promises.push(executeQuery(queries[i]));
	}

	q.all(promises)
		.then(function(responses) {
			for (i = 0; i < responses.length; i++) {
				var bindings = responses[i].results.bindings;				
				for (j = 0; j < bindings.length; j++) {
					var conjunction = '',
						currentSituation = `<http://liris.cnrs.fr/asawoo/vocab/context/S-${i}-${j}> `;
						situations += `${currentSituation} a <http://liris.cnrs.fr/asawoo/vocab/context/ContextualSituation> . `;
					
					for (var key in bindings[j]) {						
						situations += 	`${currentSituation}
										<http://liris.cnrs.fr/asawoo/vocab/context/containsInstance>
										<${bindings[j][key].value}> . `;
					}

				}								
			}			
			deferred.resolve(situations);
		});

	return deferred.promise;
};

RuleEngine.prototype.generateAdaptationPossibilities = function() {
	return executeQuery(
			`CONSTRUCT { ?adapted ?possibilityPred ?candidate }
			 WHERE {
			 	?purpose asawoo-ctx:purposePredicate ?possibilityPred .			 	
			 	?possibilityPred rdfs:domain ?adaptedClass . 			
			 	?possibilityPred rdfs:range ?candidateClass .  	
				?adapted a ?adaptedClass . 
				?candidate a ?candidateClass .
			}`, 'application/n-triples');
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
			?BN asawoo-ctx:forAdapted ?adapted .
			?BN rdf:value ?score .	
		 
		} GROUP BY ?adapted ?purposePred ?candidate ?contextualSituation`);
}

RuleEngine.prototype.generateScoredAdaptationRules = function(scoreBindings) {
	var rules = {};		

	for (var i = 0; i < scoreBindings.length; i++) {				
		var b = scoreBindings[i],			
		 	causeIndex = b.instances.value;
		if (!rules[causeIndex]) {
			rules[causeIndex] = [];
		} 
		rules[causeIndex].push(b);
		
	}

	return new RuleSet(rules);
}

/*RuleEngine.prototype.asHyLARRules = function(rules) {
	var adaptationRules = `@prefix rule: <tag:stardog:api:rule:> .`;
		

	for (var i = 0; i < scoreBindings.length; i++) {				
		var b = scoreBindings[i],
			cause = `IF { `,
			consequences = `THEN { `,
		 	instances = b.instances.value.split(' ');

		for (var j = 0; j < instances.length; j++) {
			cause = `${cause}
						<${instances[j]}> <${rdftype}> <${ctxInstance}> .
					`;
		}			 	

		cause = `${cause}
				 }
				`;

		consequence = `${consequence}
						[]	<${rdfsub}> <${b.adapted.value}> ; 
							<${rdfpred}> <${b.purposePred.value}> ; 
							<${rdfobj}> <${b.candidate.value}> ; 
							<${rdfval}> "${b.candidateScore.value}"
						. 
					}
					`,		
		adaptationRules = `${adaptationRules}

				[] a rule:SPARQLRule ;
  				rule:content """
  				${cause}
  				${consequence}
  				""" . `;
	}
	return adaptationRules;
};*/

RuleEngine.prototype.insertData = function(data) {
	return executeQuery(`INSERT DATA { ${data} }`, 'text/boolean');
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