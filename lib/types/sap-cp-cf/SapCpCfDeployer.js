const AbstractDeployer = require('../AbstractDeployer');
const path = require('path');
const {spawn} = require('child_process');

/**
 * Deployer Class for SAP Cloud Platform, Cloud Foundry environment
 *
 * @extends AbstractDeployer
 */
class SapCpCfDeployer extends AbstractDeployer {
  /**
   * Deploys the project to a remote SAP Cloud Platform, Cloud Foundry environment
   *
   * @return {Promise} Returns promise with deployment results
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
   * @param {Object} project Project configuration
   * @return {String} Returns the command to be executed
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
   * @param {String} sourcePath Path to the file to be deployed
   * @return {String} Returns the command to be executed
   */
  buildPushCommand(sourcePath) {
    return ['cf push',
      '-f', sourcePath].join(' ');
  }
}

module.exports = SapCpCfDeployer;
