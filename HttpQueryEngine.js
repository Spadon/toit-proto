var executeQuery = function(query) {
	var deferred = q.defer(),
		options = {
    		url: 'http://localhost:5820/toit/query',
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
};

module.exports = {
    executeQuery: executeQuery
};