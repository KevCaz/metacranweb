var express = require('express');
var router = express.Router();
var elasticsearch = require('elasticsearch');
var urls = require('../lib/urls');
var clean_package = require('../lib/clean_package');

router.get("/search.html", function(req, res, next) {
    req.query.page = + req.query.page || 1;
    if (!!req.query['q']) {
	do_query(req, res, next);
    } else {
	show_empty(res, next);
    }
})

function do_query(req, res, next) {
    
    var client = new elasticsearch.Client({
	host: urls['seer']
    });

    var fields = [ "Package^10", "Title^5", "Description^2",
		   "Author^3", "Maintainer^4", "_all" ];

    client.search({
	index: 'package',
	from: ((req.query['page'] || 1) - 1) * 10,
	size: 10,
	"body": {
	    "query": {
		"function_score": {
		    "functions": [
			{
			    "field_value_factor": {
				"field": "revdeps",
				"modifier": "sqrt",
				"factor": 1
			    }
			}
		    ],
		    "query": {
			"bool": {
			    "must": [
				{
				    "multi_match": {
					"query": req.query['q'],
					"type": "most_fields"
				    }
				}
			    ],
			    "should": [
				{
				    "multi_match": {
					"query": req.query['q'],
					"fields": ["Title^10", "Description^2", "_all"],
					"type": "phrase",
					"analyzer": "english_and_synonyms",
					"boost": 10
				    }
				},
				{
				    "multi_match": {
					"query": req.query['q'],
					"fields": ["Package^20", "Title^10", "Description^2", "Author^5", "Maintainer^6", "_all"],
					"operator": "and",
					"analyzer": "english_and_synonyms",
					"boost": 5
				    }
				}
			    ]
			}
		    }
		}
	    }
	}
    }).then(function(resp) {
	show_results(resp, req, res);
    }).catch(function(err) {
        next(err);
    });
}

// Errors here will be caught by the promise, and forwarded to next()

function show_results(resp, req, res) {

    var hits = resp.hits.hits.map(function(x) {
	x._source = clean_package(x._source);
	return x;
    });
    var no_hits = resp.hits.total;
    var took = resp.took;
    var no_pages = Math.min(Math.ceil(no_hits / 10), 10);

    res.render('search', { 'q': req.query.q,
			   'page': req.query.page,
			   'no_hits': no_hits,
			   'took': took,
			   'hits': hits,
			   'no_pages': no_pages,
			   'pagetitle': 'METACRAN search results'
			 });
}

function show_empty(res, next) {
    res.redirect('/');
}

module.exports = router;
