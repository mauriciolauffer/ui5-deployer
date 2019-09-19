const {promisify} = require('util');
const request = promisify(require('request'));
const fs = require('fs');
const {isBinaryFile} = require('isbinaryfile');
const ADT_PATH = '/sap/bc/adt';
const BSP_PATH = ADT_PATH + '/filestore/ui5-bsp/objects';
const CTS_PATH = ADT_PATH + '/cts/transportrequests';
const CTS_CHECKS_PATH = '/consistencychecks';
const PACKAGE_PATH = ADT_PATH + '/packages';
const CONTENT_PATH = '/content';
const DISCOVERY_PATH = ADT_PATH + '/discovery';
const escapedForwardSlash = '%2f';
const fileCharset = 'UTF-8';

/**
 * Class to handle SAP ABAP Development Tools (ADT) APIs
 *
 */
class AdtClient {
  /**
   * Constructor
   *
   * @param {Object} parameters
   * @param {Object} parameters.project Project configuration
   * @param {GroupLogger} parameters.parentLogger Logger to use
   */
  constructor({project, parentLogger}) {
    this.logger = parentLogger;
    this.project = project;
    this._credentials = project.deployer.credentials;
    this._abapRepository = project.deployer.abapRepository;
    this._connection = project.deployer.connection;
    this._csrfToken = '';
    this._client = this._getDefaultRequest(project.deployer);
  }

  /**
   * Returns client/request object
   *
   * @return {object} client/request object
   */
  getClient() {
    return this._client;
  }

  /**
   * Connects to the server and deploys the project
   */
  async connect() {
    const response = await this._authenticate(this._credentials);
    this._validateAdtDiscovery(response);
    await this._getPackage(this._abapRepository.package);
    if (this._isLocalPackage(this._abapRepository.package)) {
      this._abapRepository.transportRequest = '';
    } else {
      await this._getTransportRequest(this._abapRepository.transportRequest);
    }
    await this._getBspApplication(this._abapRepository.bspApplication);
  }

  /**
   * Validates ADT discovery XML file
   *
   * @param {object} response HTTP response
   * @throw Will throw an error if ADT doesn't support all needed operations
   */
  _validateAdtDiscovery(response) {
    let isValid = true;
    const errorMessage = ' not found in discovery!';
    if (!this._validateAdtPath(BSP_PATH, response.body)) {
      isValid = false;
      this.logger.error(BSP_PATH + errorMessage);
    }
    if (!this._validateAdtPath(CTS_PATH, response.body)) {
      isValid = false;
      this.logger.error(CTS_PATH + errorMessage);
    }
    if (!this._validateAdtPath(PACKAGE_PATH, response.body)) {
      isValid = false;
      this.logger.error(PACKAGE_PATH + errorMessage);
    }
    if (!isValid) {
      this.logger.error('For more information, check ' + DISCOVERY_PATH);
      throw new Error('ADT does not have all required services available!');
    }
  }

  /**
   * Validates ADT paths used by this class
   *
   * @param {string} path ADT path to be validated
   * @param {string} xml ADT path to be validated
   * @return {boolean} True if the ADT path is valid
   */
  _validateAdtPath(path, xml) {
    const regxp = new RegExp('<app:collection href="' + path + '">');
    return regxp.test(xml);
  }

  /**
   * Authenticates given credentials against the backend
   */
  async _authenticate({username, password}) {
    this.logger.info('Connecting to', this._connection.url);
    const reqOptions = {
      uri: DISCOVERY_PATH,
      headers: {
        'x-csrf-token': 'Fetch',
      },
      auth: {
        user: username,
        pass: password,
        sendImmediately: true,
      },
    };
    const response = await this._client(reqOptions);
    if (response.statusCode !== 200) {
      this._responseError(response);
    }
    this._csrfToken = response.headers['x-csrf-token'];
    return response;
  }

  /**
   * Gets ABAP Package
   *
   * @param {string} abapPackage ABAP Package
   * @return {object} HTTP response
   */
  async _getPackage(abapPackage) {
    this.logger.info('Getting ABAP package', PACKAGE_PATH + '/' + abapPackage);
    const response = await this._client({uri: PACKAGE_PATH + '/' + encodeURIComponent(abapPackage)});
    if (response.statusCode !== 200) {
      this._responseError(response);
    }
    return response;
  }

  /**
   * Gets ABAP Transport Request
   *
   * @param {string} transportRequest ABAP Transport Request
   * @return {object} HTTP response
   */
  async _getTransportRequest(transportRequest) {
    this.logger.info('Getting ABAP Transport Request', CTS_PATH + '/' + transportRequest);
    const reqOptions = {
      uri: CTS_PATH + '/' + encodeURIComponent(transportRequest) + CTS_CHECKS_PATH,
      method: 'POST',
      headers: {
        'x-csrf-token': this._csrfToken,
      },
    };
    const response = await this._client(reqOptions);
    if (response.statusCode !== 200) {
      this._responseError(response);
    }
    return response;
  }

  /**
   * Gets ABAP BSP Application
   *
   * @param {string} bspApplication ABAP BSP Application
   * @return {object} HTTP response
   */
  async _getBspApplication(bspApplication) {
    this.logger.info('Getting BSP Application', BSP_PATH + '/' + bspApplication);
    const response = await this._client({uri: BSP_PATH + '/' + encodeURIComponent(bspApplication)});
    if (response.statusCode === 404) {
      return await this._createBspApplication();
    } else if (response.statusCode !== 200) {
      this._responseError(response);
    }
    return response;
  }

  /**
   * Creates ABAP BSP Application
   *
   * @return {object} HTTP response
   */
  async _createBspApplication() {
    this.logger.info('Creating BSP Application', BSP_PATH + '/' + this._abapRepository.bspApplication);
    const path = BSP_PATH + '/%20' + CONTENT_PATH;
    const qs = {
      type: 'folder',
      isBinary: false,
      name: this._abapRepository.bspApplication,
      description: this._abapRepository.bspApplicationText,
      devclass: this._abapRepository.package,
      corrNr: this._abapRepository.transportRequest,
    };
    const reqOptions = {
      method: 'POST',
      url: path,
      qs: qs,
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-csrf-token': this._csrfToken,
      },
    };
    const response = await this._client(reqOptions);
    if (response.statusCode !== 201) {
      this._responseError(response);
    }
    return response;
  }

  /**
   * Gets remote resources
   *
   * @param {string} resourcePath Path to the remote resource
   * @return {object} HTTP request
   */
  async getResources(resourcePath) {
    const regex = new RegExp(escapedForwardSlash, 'g');
    this.logger.info('Getting files from', resourcePath.replace(regex, '/'));
    return this._client({uri: BSP_PATH + '/' + resourcePath + CONTENT_PATH})
        .then((response) => {
          if (response.statusCode === 200) {
            return response;
          } else {
            this._responseError(response);
          }
        });
  }

  /**
   * Creates a remote folder
   *
   * @param {string} folderPath Folder to be created
   * @return {object} HTTP response
   */
  async createFolder(folderPath) {
    this.logger.info('Creating folder', this._abapRepository.bspApplication + folderPath);
    const folderStructure = folderPath.split('/');
    const folderName = folderStructure.pop();
    const path = BSP_PATH + '/' + this._abapRepository.bspApplication + encodeURIComponent(folderStructure.join('/')) + CONTENT_PATH;
    const qs = {
      type: 'folder',
      isBinary: false,
      name: folderName,
      devclass: this._abapRepository.package,
      corrNr: this._abapRepository.transportRequest,
    };
    const reqOptions = {
      method: 'POST',
      url: path,
      qs: qs,
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-csrf-token': this._csrfToken,
        'If-Match': '*',
      },
    };
    const response = await this._client(reqOptions);
    if (response.statusCode !== 201) {
      this._responseError(response);
    }
    return response;
  }

  /**
   * Deletes a remote folder
   *
   * @param {string} folderPath Folder to be deleted
   * @return {object} HTTP response
   */
  async deleteFolder(folderPath) {
    this.logger.info('Deleting folder', this._abapRepository.bspApplication + folderPath);
    const path = BSP_PATH + '/' + this._abapRepository.bspApplication + encodeURIComponent(folderPath) + CONTENT_PATH;
    const qs = {
      deleteChildren: true,
      corrNr: this._abapRepository.transportRequest,
    };
    const reqOptions = {
      method: 'DELETE',
      url: path,
      qs: qs,
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-csrf-token': this._csrfToken,
        'If-Match': '*',
      },
    };
    const response = await this._client(reqOptions);
    if (response.statusCode !== 200) {
      this._responseError(response);
    }
    return response;
  }

  /**
   * Creates remote file
   *
   * @param {string} filePath File path to be created
   * @param {string} fileContent File content to be created
   * @return {object} HTTP response
   */
  async createFile(filePath, fileContent) {
    this.logger.info('Creating file', this._abapRepository.bspApplication + filePath);
    const isBinary = await isBinaryFile(fileContent);
    const folderStructure = filePath.split('/');
    const fileName = folderStructure.pop();
    const path = BSP_PATH + '/' + this._abapRepository.bspApplication + encodeURIComponent(folderStructure.join('/')) + CONTENT_PATH;
    const qs = {
      type: 'file',
      isBinary,
      name: fileName,
      charset: fileCharset,
      devclass: this._abapRepository.package,
      corrNr: this._abapRepository.transportRequest,
    };
    const reqOptions = {
      method: 'POST',
      url: path,
      qs: qs,
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-csrf-token': this._csrfToken,
        'If-Match': '*',
      },
    };
    reqOptions.body = (fileContent.length > 0) ? fileContent : ' ';
    const response = await this._client(reqOptions);
    if (response.statusCode !== 201) {
      this._responseError(response);
    }
    return response;
  }

  /**
   * Updates remote file
   *
   * @param {string} filePath File path to be updated
   * @param {string} fileContent File content to be updated
   * @return {object} HTTP response
   */
  async updateFile(filePath, fileContent) {
    this.logger.info('Updating file', this._abapRepository.bspApplication + filePath);
    const isBinary = await isBinaryFile(fileContent);
    const path = BSP_PATH + '/' + this._abapRepository.bspApplication + encodeURIComponent(filePath) + CONTENT_PATH;
    const qs = {
      charset: fileCharset,
      isBinary,
      corrNr: this._abapRepository.transportRequest,
    };
    const reqOptions = {
      method: 'PUT',
      url: path,
      qs: qs,
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-csrf-token': this._csrfToken,
        'If-Match': '*',
      },
    };
    reqOptions.body = (fileContent.length > 0) ? fileContent : ' ';
    const response = await this._client(reqOptions);
    if (response.statusCode !== 200) {
      this._responseError(response);
    }
    return response;
  }

  /**
   * Deletes remote file
   *
   * @param {string} filePath File path to be deleted
   * @return {object} HTTP response
   */
  async deleteFile(filePath) {
    this.logger.info('Deleting file', this._abapRepository.bspApplication + filePath);
    const path = BSP_PATH + '/' + this._abapRepository.bspApplication + encodeURIComponent(filePath) + CONTENT_PATH;
    const qs = {
      corrNr: this._abapRepository.transportRequest,
    };
    const reqOptions = {
      method: 'DELETE',
      url: path,
      qs: qs,
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-csrf-token': this._csrfToken,
        'If-Match': '*',
      },
    };
    const response = await this._client(reqOptions);
    if (response.statusCode !== 200) {
      this._responseError(response);
    }
    return response;
  }

  /**
   * Checks whether a given ABAP Package is local
   *
   * @param {string} abapPackage ABAP Package
   * @return {boolean} True if it's a local ABAP Package
   */
  _isLocalPackage(abapPackage) {
    return abapPackage.substring(0, 1) === '$';
  }

  /**
   * Returns a client/request with new default values
   *
   * @param {object} options Parameters to be set as default for HTTP requests
   * @return {object} Client/Request object
   */
  _getDefaultRequest(options = {}) {
    const query = {};
    if (options.abapRepository && options.abapRepository.client) {
      query['sap-client'] = options.abapRepository.client;
    }
    if (options.abapRepository && options.abapRepository.language) {
      query['sap-language'] = options.abapRepository.language.toUpperCase();
    }
    const reqOptions = {
      baseUrl: options.connection.url,
      uri: '',
      gzip: true,
      jar: true,
      headers: {
        'accept': '*/*',
      },
      qs: query,
      strictSSL: !!options.connection.strictSSL,
    };
    if (options.proxy) {
      reqOptions.proxy = options.connection.proxy;
    }
    if (options.connection.strictSSL && options.connection.SSLCertificatePath) {
      reqOptions.agentOptions = {
        ca: fs.readFileSync(options.connection.SSLCertificatePath),
      };
    }
    return request.defaults(reqOptions);
  }

  /**
   * Triggers response error
   *
   * @param {object} response HTTP response
   * @throw Will throw an error for failed HTTP responses
   */
  _responseError(response) {
    this.logger.error(response.statusCode, response.statusMessage);
    this.logger.error(response.body);
    throw new Error(response.statusCode + ' - ' + response.statusMessage);
  }
}

module.exports = AdtClient;
