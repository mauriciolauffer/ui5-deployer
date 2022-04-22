'use strict';

const AbstractDeployer = require('../AbstractDeployer');
const path = require('path');
// eslint-disable-next-line security/detect-child-process
const {spawn} = require('child_process');

/**
 * Deployer Class for SAP Cloud Platform, Cloud Foundry environment
 *
 * @augments AbstractDeployer
 */
class SapCpCfDeployer extends AbstractDeployer {
  /**
   * Deploys the project to a remote SAP Cloud Platform, Cloud Foundry environment
   *
   * @returns {Promise} Returns promise with deployment results
   */
  deploy() {
    return this.getLocalResources()
        .then(() => {
          const cfCliPath = path.normalize(this.project.deployer.sapCloudPlatform.cloudFoundry.cliPath || '');
          const cfLogin = spawn(this.buildLoginCommand(this.project), {shell: true, cwd: cfCliPath});
          return this.promisifyChildProcess(cfLogin, this.logger)
              .then(() => {
                const cfPush = spawn(this.buildPushCommand(this.project.deployer.sourcePath), {shell: true, cwd: cfCliPath});
                return this.promisifyChildProcess(cfPush, this.logger);
              });
        });
  }

  /**
   * Builds the CF CLI command for deployment
   *
   * @param {object} project Project configuration
   * @returns {string} Returns the command to be executed
   */
  buildLoginCommand(project) {
    return ['cf login',
      '-a', project.deployer.connection.url,
      '-u', project.deployer.credentials.username,
      '-p', project.deployer.credentials.password,
      '-o', project.deployer.sapCloudPlatform.cloudFoundry.org,
      '-s', project.deployer.sapCloudPlatform.cloudFoundry.space].join(' ');
  }

  /**
   * Builds the CF CLI command for deployment
   *
   * @param {string} sourcePath Path to the file to be deployed
   * @returns {string} Returns the command to be executed
   */
  buildPushCommand(sourcePath) {
    return ['cf push',
      '-f', sourcePath].join(' ');
  }
}

module.exports = SapCpCfDeployer;
