const AdtClient = require('./AdtClient');
const AdtResourceManager = require('./AdtResourceManager');
const AbstractDeployer = require('../AbstractDeployer');

/**
 * Deployer Class for SAP NetWeaver
 *
 * @extends AbstractDeployer
 */
class SapNetWeaverDeployer extends AbstractDeployer {
  /**
   * Deploys the project to a remote SAP NetWeaver server
   *
   * @return {Promise} Returns promise with deployment results
   */
  deploy() {
    const adtClient = this.buildAdtClient({
      project: this.project,
      parentLogger: this.logger,
    });
    const adtResourceManager = this.buildAdtResourceManager({
      adtClient,
      project: this.project,
    });
    return adtClient.connect()
        .then(this.getLocalResources.bind(this))
        .then(adtResourceManager.saveResources.bind(adtResourceManager));
  }

  /**
   * Builds an instance of the ADT Client
   *
   * @return {AdtClient} Returns ADT Client
   */
  buildAdtClient({project, parentLogger}) {
    return new AdtClient({project, parentLogger});
  }

  /**
   * Builds an instance of the ADT Resource Manager
   *
   * @return {AdtResourceManager} Returns ADT Resource Manager
   */
  buildAdtResourceManager({adtClient, project}) {
    return new AdtResourceManager({adtClient, project});
  }
}

module.exports = SapNetWeaverDeployer;
