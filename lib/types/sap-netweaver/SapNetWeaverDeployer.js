'use strict';

const AdtClient = require('./AdtClient');
const AdtResourceManager = require('./AdtResourceManager');
const ODataClient = require('./ODataClient');
const ODataResourceManager = require('./ODataResourceManager');
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
  async deploy() {
    if (this.project.deployer.abapRepository.method === 'odata') {
      return this.deployByODataMethod();
    } else {
      return this.deployByAdtMethod();
    }
  }

  /**
   * Deploy to remote server via OData
   *
   * @return {Promise} Returns promise with deployment results
   */
  async deployByODataMethod() {
    const odataClient = this.buildODataClient({
      project: this.project,
      parentLogger: this.logger,
    });
    const odataResourceManager = this.buildODataResourceManager({
      project: this.project,
      parentLogger: this.logger,
      workspace: this.resourceCollections.workspace,
    });
    await odataClient.connect();
    const localResources = await this.getLocalResources();
    const archivePath = await odataResourceManager.prepareResources(localResources);
    return odataClient.syncRemoteServer(archivePath);
  }

  /**
   * Deploy to remote server via ADT
   *
   * @return {Promise} Returns promise with deployment results
   */
  async deployByAdtMethod() {
    const adtClient = this.buildAdtClient({
      project: this.project,
      parentLogger: this.logger,
    });
    const adtResourceManager = this.buildAdtResourceManager({
      adtClient,
      project: this.project,
    });
    await adtClient.connect();
    const localResources = await this.getLocalResources();
    await adtResourceManager.saveResources(localResources);
    return adtClient.appIndexCalculation();
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

  /**
   * Builds an instance of the OData Client
   *
   * @return {ODataClient} Returns OData Client
   */
  buildODataClient({project, parentLogger}) {
    return new ODataClient({project, parentLogger});
  }

  /**
   * Builds an instance of the OData Resource Manager
   *
   * @return {ODataResourceManager} Returns OData Resource Manager
   */
  buildODataResourceManager({project, parentLogger, workspace}) {
    return new ODataResourceManager({project, parentLogger, workspace});
  }
}

module.exports = SapNetWeaverDeployer;
