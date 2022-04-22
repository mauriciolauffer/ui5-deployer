'use strict';

const SapCpNeoDeployer = require('./SapCpNeoDeployer');

module.exports = {
  deploy: function({resourceCollections, project, parentLogger}) {
    parentLogger.info('to SAP Cloud Platform NEO');
    return new SapCpNeoDeployer({resourceCollections, project, parentLogger}).deploy();
  },

  // Export type classes for extensibility
  Deployer: SapCpNeoDeployer
};
