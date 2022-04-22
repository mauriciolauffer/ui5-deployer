'use strict';

const got = require('got');
const {CookieJar} = require('tough-cookie');
const fs = require('fs');
const {isBinaryFile} = require('isbinaryfile');
const ADT_PATH = 'sap/bc/adt';
const BSP_PATH = ADT_PATH + '/filestore/ui5-bsp/objects';
const CTS_PATH = ADT_PATH + '/cts/transportrequests';
const CTS_CHECKS_PATH = '/consistencychecks';
const PACKAGE_PATH = ADT_PATH + '/packages';
const CONTENT_PATH = '/content';
const DISCOVERY_PATH = ADT_PATH + '/discovery';
const APP_INDEX_CALCULATE = 'sap/bc/adt/filestore/ui5-bsp/appindex';
const escapedForwardSlash = '%2f';
const fileCharset = 'UTF-8';
const contentType = {
  applicationOctetStream: 'application/octet-stream'
};

/**
 * Class to handle SAP ABAP Development Tools (ADT) APIs
 *
 */
class AdtClient {
  /**
   * Constructor
   *
   * @param {object} parameters Parameters
   * @param {object} parameters.project Project configuration
   * @param {object} parameters.parentLogger Logger to use
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
   * @returns {object} client/request object
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
   * @throws Will throw an error if ADT doesn't support all needed operations
   */
  _validateAdtDiscovery(response) {
    if (this._abapRepository.skipAdtValidations) {
      this.logger.warn('All ADT validations will be skipped!');
      return;
    }
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
   * @returns {boolean} True if the ADT path is valid
   */
  _validateAdtPath(path, xml) {
    // eslint-disable-next-line security/detect-non-literal-regexp
    const regxp = new RegExp('<app:collection href="' + path + '">');
    return regxp.test(xml);
  }

  /**
   * Authenticates given credentials against the backend
   *
   * @param {object} credentials Credentials
   * @param {string} credentials.username Username
   * @param {string} credentials.password Password
   */
  async _authenticate({username, password}) {
    this.logger.info('Connecting to', this._connection.url);
    const authToken = username + ':' + password;
    const reqOptions = {
      url: DISCOVERY_PATH,
      headers: {
        'Authorization': 'Basic ' + Buffer.from(authToken).toString('base64'),
        'x-csrf-token': 'Fetch'
      }
    };
    const response = await this._client.get(reqOptions);
    this._csrfToken = response.headers['x-csrf-token'];
    return response;
  }

  /**
   * Gets ABAP Package
   *
   * @param {string} abapPackage ABAP Package
   * @returns {Promise} HTTP response
   */
  async _getPackage(abapPackage) {
    this.logger.info('Getting ABAP package', PACKAGE_PATH + '/' + abapPackage);
    if (this._abapRepository.skipAdtValidations) {
      return;
    }
    const reqOptions = {
      url: PACKAGE_PATH + '/' + encodeURIComponent(abapPackage),
      headers: {
        'x-csrf-token': this._csrfToken
      }
    };
    return this._client.get(reqOptions);
  }

  /**
   * Gets ABAP Transport Request
   *
   * @param {string} transportRequest ABAP Transport Request
   * @returns {Promise} HTTP response
   */
  async _getTransportRequest(transportRequest) {
    this.logger.info('Getting ABAP Transport Request', CTS_PATH + '/' + transportRequest);
    if (this._abapRepository.skipAdtValidations) {
      return;
    }
    const reqOptions = {
      url: CTS_PATH + '/' + encodeURIComponent(transportRequest) + CTS_CHECKS_PATH,
      headers: {
        'x-csrf-token': this._csrfToken
      }
    };
    return this._client.post(reqOptions);
  }

  /**
   * Gets ABAP BSP Application
   *
   * @param {string} bspApplication ABAP BSP Application
   * @returns {Promise} HTTP response
   */
  async _getBspApplication(bspApplication) {
    this.logger.info('Getting BSP Application', BSP_PATH + '/' + bspApplication);
    const reqOptions = {
      url: BSP_PATH + '/' + encodeURIComponent(bspApplication)
    };
    try {
      return await this._client.get(reqOptions);
    } catch (err) {
      if (err.response.statusCode === 404) {
        return await this._createBspApplication();
      } else {
        throw err;
      }
    }
  }

  /**
   * Creates ABAP BSP Application
   *
   * @returns {Promise} HTTP response
   */
  async _createBspApplication() {
    this.logger.info('Creating BSP Application', BSP_PATH + '/' + this._abapRepository.bspApplication);
    const path = BSP_PATH + '/%20' + CONTENT_PATH;
    const reqOptions = {
      url: path,
      searchParams: {
        type: 'folder',
        isBinary: false,
        name: this._abapRepository.bspApplication,
        description: this._abapRepository.bspApplicationText,
        devclass: this._abapRepository.package,
        corrNr: this._abapRepository.transportRequest
      },
      headers: {
        'Content-Type': contentType.applicationOctetStream,
        'x-csrf-token': this._csrfToken
      }
    };
    return this._client.post(reqOptions);
  }

  /**
   * Gets remote resources
   *
   * @param {string} resourcePath Path to the remote resource
   * @returns {Promise} HTTP request
   */
  async getResources(resourcePath) {
    // eslint-disable-next-line security/detect-non-literal-regexp
    const regex = new RegExp(escapedForwardSlash, 'g');
    this.logger.info('Getting files from', resourcePath.replace(regex, '/'));
    const reqOptions = {
      url: BSP_PATH + '/' + resourcePath + CONTENT_PATH
    };
    return this._client.get(reqOptions);
  }

  /**
   * Creates a remote folder
   *
   * @param {string} folderPath Folder to be created
   * @returns {Promise} HTTP response
   */
  async createFolder(folderPath) {
    this.logger.info('Creating folder', this._abapRepository.bspApplication + folderPath);
    const folderStructure = folderPath.split('/');
    const folderName = folderStructure.pop();
    const path = BSP_PATH + '/' + encodeURIComponent(this._abapRepository.bspApplication) + encodeURIComponent(folderStructure.join('/')) + CONTENT_PATH;
    const reqOptions = {
      url: path,
      searchParams: {
        type: 'folder',
        isBinary: false,
        name: folderName,
        devclass: this._abapRepository.package,
        corrNr: this._abapRepository.transportRequest
      },
      headers: {
        'Content-Type': contentType.applicationOctetStream,
        'x-csrf-token': this._csrfToken,
        'If-Match': '*'
      }
    };
    return this._client.post(reqOptions);
  }

  /**
   * Deletes a remote folder
   *
   * @param {string} folderPath Folder to be deleted
   * @returns {Promise} HTTP response
   */
  async deleteFolder(folderPath) {
    this.logger.info('Deleting folder', this._abapRepository.bspApplication + folderPath);
    const path = BSP_PATH + '/' + encodeURIComponent(this._abapRepository.bspApplication) + encodeURIComponent(folderPath) + CONTENT_PATH;
    const reqOptions = {
      url: path,
      searchParams: {
        deleteChildren: true,
        corrNr: this._abapRepository.transportRequest
      },
      headers: {
        'Content-Type': contentType.applicationOctetStream,
        'x-csrf-token': this._csrfToken,
        'If-Match': '*'
      }
    };
    return this._client.delete(reqOptions);
  }

  /**
   * Creates remote file
   *
   * @param {string} filePath File path to be created
   * @param {string} fileContent File content to be created
   * @returns {Promise} HTTP response
   */
  async createFile(filePath, fileContent) {
    this.logger.info('Creating file', this._abapRepository.bspApplication + filePath);
    const isBinary = await isBinaryFile(fileContent);
    const folderStructure = filePath.split('/');
    const fileName = folderStructure.pop();
    const path = BSP_PATH + '/' + encodeURIComponent(this._abapRepository.bspApplication) + encodeURIComponent(folderStructure.join('/')) + CONTENT_PATH;
    const reqOptions = {
      url: path,
      body: (fileContent.length > 0) ? fileContent : ' ',
      searchParams: {
        type: 'file',
        isBinary,
        name: fileName,
        charset: fileCharset,
        devclass: this._abapRepository.package,
        corrNr: this._abapRepository.transportRequest
      },
      headers: {
        'Content-Type': contentType.applicationOctetStream,
        'x-csrf-token': this._csrfToken,
        'If-Match': '*'
      }
    };
    return this._client.post(reqOptions);
  }

  /**
   * Updates remote file
   *
   * @param {string} filePath File path to be updated
   * @param {string} fileContent File content to be updated
   * @returns {Promise} HTTP response
   */
  async updateFile(filePath, fileContent) {
    this.logger.info('Updating file', this._abapRepository.bspApplication + filePath);
    const path = BSP_PATH + '/' + encodeURIComponent(this._abapRepository.bspApplication) + encodeURIComponent(filePath) + CONTENT_PATH;
    const isBinary = await isBinaryFile(fileContent);
    const reqOptions = {
      url: path,
      body: (fileContent.length > 0) ? fileContent : ' ',
      searchParams: {
        charset: fileCharset,
        isBinary,
        corrNr: this._abapRepository.transportRequest
      },
      headers: {
        'Content-Type': contentType.applicationOctetStream,
        'x-csrf-token': this._csrfToken,
        'If-Match': '*'
      }
    };
    return this._client.put(reqOptions);
  }

  /**
   * Deletes remote file
   *
   * @param {string} filePath File path to be deleted
   * @returns {Promise} HTTP response
   */
  async deleteFile(filePath) {
    this.logger.info('Deleting file', this._abapRepository.bspApplication + filePath);
    const path = BSP_PATH + '/' + encodeURIComponent(this._abapRepository.bspApplication) + encodeURIComponent(filePath) + CONTENT_PATH;
    const reqOptions = {
      url: path,
      searchParams: {
        corrNr: this._abapRepository.transportRequest
      },
      headers: {
        'Content-Type': contentType.applicationOctetStream,
        'x-csrf-token': this._csrfToken,
        'If-Match': '*'
      }
    };
    return this._client.delete(reqOptions);
  }

  /**
   * Calculates Application Index (ABAP report /UI5/APP_INDEX_CALCULATE)
   *
   * @returns {Promise} HTTP response
   */
  async appIndexCalculation() {
    if (this._abapRepository.appIndexCalculate) {
      this.logger.info('Calculating app index');
      const reqOptions = {
        url: APP_INDEX_CALCULATE + '/' + encodeURIComponent(this._abapRepository.bspApplication),
        headers: {
          'Content-Type': contentType.applicationOctetStream,
          'x-csrf-token': this._csrfToken
        }
      };
      return this._client.post(reqOptions);
    }
  }

  /**
   * Checks whether a given ABAP Package is local
   *
   * @param {string} abapPackage ABAP Package
   * @returns {boolean} True if it's a local ABAP Package
   */
  _isLocalPackage(abapPackage) {
    return abapPackage.substring(0, 1) === '$';
  }

  /**
   * Returns a client/request with new default values
   *
   * @param {object} options Parameters to be set as default for HTTP requests
   * @returns {object} Client/Request object
   */
  _getDefaultRequest(options = {}) {
    const query = {};
    if (options.abapRepository && options.abapRepository.client) {
      query['sap-client'] = options.abapRepository.client;
    }
    if (options.abapRepository && options.abapRepository.language) {
      query['sap-language'] = options.abapRepository.language.toUpperCase();
    }
    const cookieJar = new CookieJar();
    const reqOptions = {
      prefixUrl: options.connection.url,
      decompress: true,
      cookieJar,
      searchParams: query,
      retry: 0,
      headers: {
        accept: '*/*',
        Connection: 'keep-alive'
      },
      https: {
        rejectUnauthorized: !!options.connection.strictSSL
      },
      hooks: {
        beforeError: [
          (err) => {
            this._responseError(err.response);
            return err;
          }
        ]
      }
    };
    if (options.proxy) {
      throw new Error('Proxy not supported at the moment!');
      // TODO: Proxy not supported now, must be reimplemented!
      // reqOptions.proxy = options.connection.proxy;
    }
    if (options.connection.strictSSL && options.connection.SSLCertificatePath) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      reqOptions.https.certificateAuthority = fs.readFileSync(options.connection.SSLCertificatePath);
    }
    return got.extend(reqOptions);
  }

  /**
   * Triggers response error
   *
   * @param {object} response HTTP response
   * @throws Will throw an error for failed HTTP responses
   */
  _responseError(response) {
    this.logger.error(response.statusCode, response.statusMessage);
    this.logger.error('Request:');
    this.logger.error(response.request.options.url.href);
    this.logger.error('Request headers:');
    this.logger.error(response.request.options.headers);
    this.logger.error('Response headers:');
    this.logger.error(response.headers);
    this.logger.error('Response body:');
    this.logger.error(response.body);
    throw new Error(response.statusCode + ' - ' + response.statusMessage);
  }
}

module.exports = AdtClient;
