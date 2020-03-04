'use strict';

const SapCpCfDeployer = require('./SapCpCfDeployer');

module.exports = {
  deploy: function({resourceCollections, project, parentLogger}) {
    parentLogger.info('to SAP Cloud Platform Cloud Foundry');
    return new SapCpCfDeployer({resourceCollections, project, parentLogger}).deploy();
  },

  // Export type classes for extensibility
  Deployer: SapCpCfDeployer,
};
