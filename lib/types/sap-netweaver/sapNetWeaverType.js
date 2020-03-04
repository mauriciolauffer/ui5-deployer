'use strict';

const SapNetWeaverDeployer = require('./SapNetWeaverDeployer');

module.exports = {
  deploy: function({resourceCollections, project, parentLogger}) {
    parentLogger.info('to SAP Netweaver');
    return new SapNetWeaverDeployer({resourceCollections, project, parentLogger}).deploy();
  },

  // Export type classes for extensibility
  Deployer: SapNetWeaverDeployer,
};
