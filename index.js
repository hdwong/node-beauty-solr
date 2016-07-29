"use strict";
let core, config, logger, client, m = require('solr-client');

let serviceName = 'solr';
let solr = {
  assert: (error) => {
    if (error) {
      logger.error(error);
      throw '[' + serviceName + '] ' + error;
    }
  },
  init: (name, c) => {
    serviceName = name;
    core = c;
    logger = core.getLogger(serviceName);
    config = core.getConfig(serviceName);
    client = require('solr-client').createClient({
      host: config.host || '127.0.0.1',
      port: config.port || 8983,
      core: config.name || 'core',
    });
  },
  get_ping: (req, res, next) => {
    client.ping((error, result) => {
      solr.assert(error);
      next(result);
    });
  },
  get_document: (req, res, next) => {
    if (req.query.collection === undefined || req.query.q === undefined) {
      throw 'Params is wrong';
    }
    let start = parseInt(req.query.start || 0, 10),
        rows = parseInt(req.query.rows || 10, 10), solrQuery;
    solrQuery = client.createQuery()
        .matchFilter('collection', req.query.collection)
        .q(req.query.q)
        .start(start)
        .rows(rows);
    if (req.query.uid) {
      solrQuery.matchFilter('uid', req.query.uid);
    }
    if (req.query.fq) {
      solrQuery.set('fq=' + req.query.fq);
    }
    client.search(solrQuery, (error, result) => {
      solr.assert(error);
      next(result);
    });
  },
  post_document: (req, res, next) => {
    if (!req.body || req.body.data === undefined) {
      throw 'Params is wrong';
    }
    try {
      let docs = JSON.parse(req.body.data);
      if (docs.length) {
        client.add(docs, (error) => {
          solr.assert(error);
          client.commit((error, result) => {
            solr.assert(error);
            next(result);
          });
        });
      } else {
        next({responseHeader: {status: 0}});
      }
    } catch (error) {
      solr.assert(error);
    }
  },
  delete_document: (req, res, next) => {
    if (!req.body || req.body.data === undefined) {
      throw 'Params is wrong';
    }
    try {
      let solrQueries = [];
      JSON.parse(req.body.data).forEach(function(id) {
        solrQueries.push('id:' + id);
      });
      if (solrQueries.length) {
        core.forEach(solrQueries, (query, next) => {
          client.deleteByQuery(query, (error, result) => {
            setImmediate(next);
          });
        }, () => {
          client.commit((error, result) => {
            solr.assert(error);
            next(result);
          });
        });
      } else {
        next({responseHeader: {status: 0}});
      }
    } catch (error) {
      solr.assert(error);
    }
  }
};

module.exports = solr;
