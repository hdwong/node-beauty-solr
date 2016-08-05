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
    if (req.query.q === undefined) {
      throw 'Params is wrong';
    }
    console.log(req.query);
    let start = parseInt(req.query.start || 0, 10),
        rows = parseInt(req.query.rows || 10, 10), solrQuery;
    solrQuery = client.createQuery()
        .q(req.query.q)
        .start(start)
        .rows(rows);
    if (req.query.fl !== undefined && req.query.fl != '') {
      solrQuery.set('fl=' + encodeURIComponent(req.query.fl));
    }
    if (req.query.fq !== undefined && req.query.fq != '') {
      solrQuery.set('fq=' + encodeURIComponent(req.query.fq));
    }
    if (req.query.defType !== undefined && req.query.defType != '') {
      solrQuery.set('defType=' + encodeURIComponent(req.query.defType));
    }
    if (req.query.qf !== undefined && req.query.qf != '') {
      solrQuery.set('qf=' + encodeURIComponent(req.query.qf));
    }
    if (req.query.hl !== undefined && req.query.hl != '') {
      solrQuery.set('hl=true');
      solrQuery.set('hl.snippets=1');
      solrQuery.set('hl.fragsize=0');
      try {
        let hl = JSON.parse(req.query.hl);
        solrQuery.set('hl.simple.pre=' + encodeURIComponent(hl.pre || '<em>'));
        solrQuery.set('hl.simple.post=' + encodeURIComponent(hl.post || '</em>'));
        if (hl.fl && hl.fl != '') {
          solrQuery.set('hl.fl=' + encodeURIComponent(hl.fl));
        }
      } catch (e) {
        solrQuery.set('hl.simple.pre', '<em>');
        solrQuery.set('hl.simple.post', '</em>');
      }
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
          client.deleteByQuery(query, () => {
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
