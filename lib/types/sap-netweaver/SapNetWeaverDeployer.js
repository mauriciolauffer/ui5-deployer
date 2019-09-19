const AdtClient = require('./AdtClient');
const AdtResourceManager = require('./AdtResourceManager');
const AbstractDeployer = require('../AbstractDeployer');

/**
 * Deployer Class for SAP NetWeaver
 *
 * @abstract
 */
class SapNetWeaverDeployer extends AbstractDeployer {
  /**
   * Takes a list of tasks which should be executed from the available task list of the current deployer
   *
   * @return {Promise} Returns promise chain with tasks
   */
  deploy() {
    const adtClient = new AdtClient({
      project: this.project,
      parentLogger: this.taskLog,
    });
    const adtResourceManager = new AdtResourceManager({
      adtClient,
      project: this.project,
    });
    return adtClient.connect()
        .then(this.getLocalResources.bind(this))
        .then(adtResourceManager.saveResources.bind(adtResourceManager));
  }
}

module.exports = SapNetWeaverDeployer;
