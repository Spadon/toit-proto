var rdfstore = require('rdfstore'),
    q = require('q');

var store = null;

var executeQuery = function(query) {
    var deferred = q.defer();
    store.execute(query, function(res) {
        deferred.resolve(res);
    });
    return deferred.promise;
};

var createStore = function() {
    var deferred = q.defer();

    rdfstore.create(function (err, done) {
        store = done;
        deferred.resolve(true);
        console.log('RDFStore ready');
    });

    return deferred.promise;
}

module.exports = {
    executeQuery: executeQuery,
    createStore: createStore,
    test_dir: 'eval_data/loaded_data'
};