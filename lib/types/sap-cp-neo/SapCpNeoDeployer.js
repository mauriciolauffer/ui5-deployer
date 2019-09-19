const AbstractDeployer = require('../AbstractDeployer');

class SapCpNeoDeployer extends AbstractDeployer {
  deploy() {
    throw new Error('Function *deploy* is not implemented');
  }
}

module.exports = SapCpNeoDeployer;
