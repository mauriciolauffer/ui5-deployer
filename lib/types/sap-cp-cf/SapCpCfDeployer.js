const AbstractDeployer = require('../AbstractDeployer');

class SapCpCfDeployer extends AbstractDeployer {
  deploy() {
    throw new Error('Function *deploy* is not implemented');
  }
}

module.exports = SapCpCfDeployer;
