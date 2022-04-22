'use strict';

/**
 * Base class for the deployer implementation of a project type
 *
 * @abstract
 */
class AbstractDeployer {
  /**
   * Constructor
   *
   * @param {object} parameters Parameters
   * @param {object} parameters.resourceCollections Resource collections
   * @param {object} parameters.project Project configuration
   * @param {object} parameters.parentLogger Logger to use
   */
  constructor({resourceCollections, project, parentLogger}) {
    if (new.target === AbstractDeployer) {
      throw new TypeError('Class *AbstractDeployer* is abstract');
    }

    this.project = project;
    this.logger = parentLogger.createSubLogger(project.type + ' ' + project.metadata.name, 0.2);
    this.resourceCollections = resourceCollections;
  }

  /**
   * Gets project's local resources
   *
   * @returns {module:@ui5/fs.adapters.FileSystem} Returns promise chain with workspace resources
   */
  getLocalResources() {
    return this.resourceCollections.workspace.byGlob('**');
  }

  /**
   * Deploys the project to a remote server
   *
   * @abstract
   * @returns {Promise} Returns promise with deployment results
   */
  deploy() {
    throw new Error('Function *deploy* is not implemented');
  }

  /**
   * Encapsulates child processes in Promises
   *
   * @abstract
   * @param {module:child_process} spawn Child Process to be executed
   * @returns {Promise} Returns promise with child process results
   */
  promisifyChildProcess(spawn) {
    return new Promise((resolve, reject) => {
      spawn.addListener('error', reject);
      spawn.addListener('exit', (code) => {
        const message = `Child process exited with code ${code}`;
        return (code === 0) ? resolve(message) : reject(message);
      });
      spawn.stdout.on('data', (data) => {
        this.logger.info(data.toString());
      });
      spawn.stderr.on('data', (data) => {
        this.logger.error(data.toString());
      });
      spawn.on('error', (err) => {
        this.logger.error('Failed to start subprocess.');
      });
    });
  }
}

module.exports = AbstractDeployer;
