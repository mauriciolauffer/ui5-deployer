'use strict';

const AbstractDeployer = require('../AbstractDeployer');
const path = require('path');
// eslint-disable-next-line security/detect-child-process
const {spawn} = require('child_process');

/**
 * Deployer Class for SAP Cloud Platform, NEO environment
 *
 * @extends AbstractDeployer
 */
class SapCpNeoDeployer extends AbstractDeployer {
  /**
   * Deploys the project to a remote SAP Cloud Platform, NEO environment
   *
   * @return {Promise} Returns promise with deployment results
   */
  deploy() {
    return this.getLocalResources()
        .then((resources) => {
          const neoCliPath = path.normalize(this.project.deployer.sapCloudPlatform.neo.cliPath || '');
          const neoDeploy = spawn(this.buildNeoCommand(this.project, this.project.deployer.sourcePath), {shell: true, cwd: neoCliPath});
          return this.promisifyChildProcess(neoDeploy);
        });
  }

  /**
   * Builds the NEO CLI command for deployment
   *
   * @param {object} project Project configuration
   * @param {string} filename Path to the file to be deployed
   * @return {string} Returns the command to be executed
   */
  buildNeoCommand(project, filename) {
    const mtaFilePath = path.join(project.path, filename);
    return ['neo deploy-mta',
      '--host', project.deployer.connection.url,
      '--account', project.deployer.sapCloudPlatform.neo.account,
      '--user', project.deployer.credentials.username,
      '--password', project.deployer.credentials.password,
      '--source', mtaFilePath,
      '--synchronous'].join(' ');
  }
}

module.exports = SapCpNeoDeployer;
