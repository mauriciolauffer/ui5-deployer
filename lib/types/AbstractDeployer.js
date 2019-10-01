/**
 * Base class for the deployer implementation of a project type
 *
 * @abstract
 */
class AbstractDeployer {
  /**
   * Constructor
   *
   * @param {Object} parameters
   * @param {Object} parameters.resourceCollections Resource collections
   * @param {module:@ui5/fs.adapters.FileSystem} parameters.resourceCollections.workspace Workspace Resource
   * @param {Object} parameters.project Project configuration
   * @param {GroupLogger} parameters.parentLogger Logger to use
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
   * @return {module:@ui5/fs.adapters.FileSystem} Returns promise chain with workspace resources
   */
  getLocalResources() {
    return this.resourceCollections.workspace.byGlob(this.project.deployer.sourcePath);
  }

  /**
   * Deploys the project to a remote server
   *
   * @abstract
   * @return {Promise} Returns promise with deployment results
   */
  deploy() {
    throw new Error('Function *deploy* is not implemented');
  }
}

module.exports = AbstractDeployer;
