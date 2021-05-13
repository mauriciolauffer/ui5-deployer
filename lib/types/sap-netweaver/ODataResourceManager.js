'use strict';

const fs = require('fs');
const archiver = require('archiver');

/**
   * Class to handle project's resources
   */
class ODataResourceManager {
  /**
   * Constructor
   *
   * @param {object} parameters
   * @param {object} parameters.project Project configuration
   * @param {module:@ui5/fs.adapters.FileSystem} parameters.workspace Workspace Resource
   * @param {GroupLogger} parameters.parentLogger Logger to use
   */
  constructor({project, workspace, parentLogger}) {
    this._project = project;
    this._workspace = workspace;
    this.logger = parentLogger;
    this._localResources = [];
  }

  /**
   * Prepare resources to be uploaded
   *
   * @param {array} localResources Local resources
   */
  async prepareResources(localResources) {
    this._localResources = localResources;
    return this.createArchive();
  }

  async createArchive() {
    const archivePath = `${ this._workspace._fsBasePath }/${ this._project.metadata.name }-archive.zip`;
    const output = fs.createWriteStream(archivePath);
    const archive = archiver('zip', {
      store: true,
    });
    archive.on('error', function(err) {
      throw err;
    });
    archive.pipe(output);
    await this.zipFiles(archive);
    await archive.finalize();
    this.logger.info('Archive has been created:', archivePath);
    return archivePath;
  }

  async zipFiles(archive) {
    for (const resource of this._localResources) {
      archive.append(await resource.getBuffer(), {name: resource.getPath()});
    }
  }
}

module.exports = ODataResourceManager;
