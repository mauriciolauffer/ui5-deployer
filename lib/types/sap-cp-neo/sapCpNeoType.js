const SapCpNeoDeployer = require('./SapCpNeoDeployer');

module.exports = {
  deploy: function({resourceCollections, project, parentLogger}) {
    return new SapCpNeoDeployer({resourceCollections, project, parentLogger}).deploy();
  },

  // Export type classes for extensibility
  Deployer: SapCpNeoDeployer,
};
