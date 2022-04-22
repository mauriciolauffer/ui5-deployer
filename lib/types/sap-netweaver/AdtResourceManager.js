'use strict';

const {XmlDocument} = require('xmldoc');
const ESCAPED_FORWARDSLASH = '%2f';

/**
 * Returns resources to be updated
 *
 * @param {Array} localResources Local resources
 * @param {Array} remoteResources Remote resources
 * @returns {Array} Local resources to be updated in the remote server
 */
function getResourcesToBeUpdated(localResources = [], remoteResources = []) {
  return localResources.filter((local) => remoteResources.find((remote) => {
    // eslint-disable-next-line security/detect-non-literal-regexp
    const regxp = new RegExp(remote + '$');
    return regxp.test(local);
  }));
}

/**
 * Returns resources to be created
 *
 * @param {Array} localResources Local resources
 * @param {Array} remoteResources Remote resources
 * @returns {Array} Local resources to be created in the remote server
 */
function getResourcesToBeCreated(localResources = [], remoteResources = []) {
  return localResources.filter((local) => {
    const foundIndex = remoteResources.findIndex((remote) => {
      // eslint-disable-next-line security/detect-non-literal-regexp
      const regxp = new RegExp(remote + '$');
      return regxp.test(local);
    });
    return foundIndex < 0;
  });
}

/**
 * Returns resources to be deleted
 *
 * @param {Array} localResources Local resources
 * @param {Array} remoteResources Remote resources
 * @returns {Array} Remote resources to be delete from the remote server
 */
function getResourcesToBeDeleted(localResources = [], remoteResources = []) {
  return remoteResources.filter((remote) => {
    const foundIndex = localResources.findIndex((local) => {
      // eslint-disable-next-line security/detect-non-literal-regexp
      const regxp = new RegExp(remote + '$');
      return regxp.test(local);
    });
    return foundIndex < 0;
  });
}

/**
 * Returns array of folders sorted from the highest level to the lowest
 *
 * @param {Array} a Array
 * @param {Array} b Array
 * @returns {number} Array sorted from root to bottom
 */
function sortFromRootToBottomFolder(a, b) {
  return a.split('/').length - b.split('/').length;
}

/**
 * Returns array of folders sorted from the lowest level to the highest
 *
 * @param {Array} a Array
 * @param {Array} b Array
 * @returns {number} Array sorted from bottom to the root
 */
function sortFromBottomToRootFolder(a, b) {
  return b.split('/').length - a.split('/').length;
}

/**
 * Class to handle project's resources
 */
class AdtResourceManager {
  /**
   * Constructor
   *
   * @param {object} parameters Parameters
   * @param {object} parameters.adtClient ADT Client
   * @param {object} parameters.project Project configuration
   */
  constructor({adtClient, project}) {
    this._adtClient = adtClient;
    this._project = project;
    this._localResources = [];
    this._localFolders = [];
    this._localFiles = [];
    this._remoteFolders = [];
    this._remoteFiles = [];
    this.crud = {
      files: {create: [], update: [], delete: []},
      folders: {create: [], update: [], delete: []}
    };
  }

  /**
   * Save local resources into a remote server
   *
   * @param {Array} localResources Local resources
   */
  async saveResources(localResources) {
    this._localResources = localResources;
    const path = encodeURIComponent(this._project.deployer.abapRepository.bspApplication);
    await this._getRemoteResources(path);
    this._getLocalResources();
    this._defineCrudOperations();
    await this._syncResources();
  }

  /**
   * Gets all remote resources, folders and files
   *
   * @param {string} path Path to fetch the resources from
   */
  async _getRemoteResources(path) {
    return this._adtClient.getResources(path)
        .then((response) => {
          // eslint-disable-next-line security/detect-non-literal-regexp
          const regex = new RegExp(ESCAPED_FORWARDSLASH, 'g');
          const bspApplication = this._project.deployer.abapRepository.bspApplication;
          const xml = new XmlDocument(response.body);
          const xmlNodes = xml.childrenNamed('atom:entry');
          const folderNodes = xmlNodes.filter((node) => node.valueWithPath('atom:category@term') === 'folder');
          const fileNodes = xmlNodes.filter((node) => node.valueWithPath('atom:category@term') === 'file');
          const remoteFiles = fileNodes.map((node) => node.valueWithPath('atom:id').replace(regex, '/').replace(bspApplication, ''));
          const remoteFolders = folderNodes.map((node) => node.valueWithPath('atom:id').replace(regex, '/').replace(bspApplication, ''));
          this._remoteFiles.push(...remoteFiles);
          this._remoteFolders.push(...remoteFolders);
          return Promise.all(
              folderNodes.map((folder) => this._getRemoteResources(folder.valueWithPath('atom:id')))
          );
        });
  }

  /**
   * Gets local resources, folders and files
   */
  _getLocalResources() {
    this._localFiles = this._getLocalFiles();
    this._localFolders = this._getLocalFolders();
  }

  /**
   * Returns local files
   *
   * @returns {Array} Local files
   */
  _getLocalFiles() {
    return this._localResources.map((resource) => resource._path);
  }

  /**
   * Returns local folders
   *
   * @returns {Array} Local remotes
   */
  _getLocalFolders() {
    const folders = [];
    this._localResources.map((resource) => {
      const pathParts = resource._path.split('/');
      for (let i = 0; pathParts.length > 2; i++) {
        pathParts.pop();
        folders.push(pathParts.join('/'));
      }
    });
    return [...new Set(folders)];
  }

  /**
   * Defines CRUD operations to be executed for all resources (local and remote)
   */
  _defineCrudOperations() {
    this._localFiles.sort().sort(sortFromRootToBottomFolder);
    this._localFolders.sort().sort(sortFromRootToBottomFolder);
    this._remoteFiles.sort().sort(sortFromRootToBottomFolder);
    this._remoteFolders.sort().sort(sortFromRootToBottomFolder);
    this._defineCrudOperationForFolders();
    this._defineCrudOperationForFiles();
  }

  /**
   * Defines CRUD operations to be executed for all folders
   */
  _defineCrudOperationForFolders() {
    this.crud.folders.create = getResourcesToBeCreated(this._localFolders, this._remoteFolders);
    this.crud.folders.update = getResourcesToBeUpdated(this._localFolders, this._remoteFolders);
    this.crud.folders.delete = getResourcesToBeDeleted(this._localFolders, this._remoteFolders);
    this.crud.folders.delete.sort(sortFromBottomToRootFolder);
  }

  /**
   * Defines CRUD operations to be executed for all files
   */
  _defineCrudOperationForFiles() {
    this.crud.files.create = getResourcesToBeCreated(this._localFiles, this._remoteFiles);
    this.crud.files.update = getResourcesToBeUpdated(this._localFiles, this._remoteFiles);
    this.crud.files.delete = getResourcesToBeDeleted(this._localFiles, this._remoteFiles);
  }

  /**
   * Executes CRUD operations, synchronizes local and remote resources
   */
  async _syncResources() {
    await this.deleteRemoteResources();
    await this.updateRemoteResources();
    await this.createRemoteResources();
  }

  /**
   * Creates remote resources
   */
  async createRemoteResources() {
    for (const folder of this.crud.folders.create) {
      await this._adtClient.createFolder(folder);
    }
    for (const file of this.crud.files.create) {
      const localResource = this._localResources.find((resource) => file === resource._path);
      if (localResource) {
        await this._adtClient.createFile(file, await localResource.getBuffer());
      }
    }
  }

  /**
   * Updates remote resources
   */
  async updateRemoteResources() {
    for (const file of this.crud.files.update) {
      const localResource = this._localResources.find((resource) => file === resource._path);
      if (localResource) {
        await this._adtClient.updateFile(file, await localResource.getBuffer());
      }
    }
  }

  /**
   * Deletes remote resources
   */
  async deleteRemoteResources() {
    for (const file of this.crud.files.delete) {
      await this._adtClient.deleteFile(file);
    }
    for (const folder of this.crud.folders.delete) {
      await this._adtClient.deleteFolder(folder);
    }
  }
}

module.exports = AdtResourceManager;
