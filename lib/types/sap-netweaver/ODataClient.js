'use strict';

const got = require('got');
const {CookieJar} = require('tough-cookie');
const fs = require('fs');
const {readFile} = require('fs/promises');
const ODATA_PATH = 'sap/opu/odata/UI5/ABAP_REPOSITORY_SRV';
const METADATA_PATH = ODATA_PATH + '/$metadata';
const contentType = {
  atomXml: 'application/atom+xml',
  octetStream: 'application/octet-stream',
  json: 'application/json',
};

/**
 * Class to handle SAP ABAP Repositories OData APIs
 *
 */
class ODataClient {
  /**
   * Constructor
   *
   * @param {object} parameters
   * @param {object} parameters.project Project configuration
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
    await this._authenticate(this._credentials);
  }

  async syncRemoteServer(archivePath) {
    const response = await this._getBspApplication();
    const payload = await this.getPayload(archivePath);
    if (response && response.body) {
      await this._updateBspApplication(payload);
    } else {
      await this._createBspApplication(payload);
    }
  }

  /**
   * Authenticates given credentials against the backend
   */
  async _authenticate({username, password}) {
    this.logger.info('Connecting to', this._connection.url);
    this.logger.info(`OData API: ${ this._connection.url }/${ ODATA_PATH }`);
    const authToken = username + ':' + password;
    const reqOptions = {
      url: METADATA_PATH,
      headers: {
        'Authorization': 'Basic ' + Buffer.from(authToken).toString('base64'),
        'x-csrf-token': 'Fetch',
      },
    };
    const response = await this._client.get(reqOptions);
    this._csrfToken = response.headers['x-csrf-token'];
    return response;
  }

  /**
   * Gets ABAP BSP Application
   *
   * @return {Promise} HTTP response
   */
  async _getBspApplication() {
    const path = `${ ODATA_PATH }/Repositories('${ encodeURIComponent(this._abapRepository.bspApplication) }')`;
    this.logger.info('Getting BSP Application:', this._abapRepository.bspApplication);
    this.logger.info(path);
    const reqOptions = {
      url: path,
    };
    try {
      return await this._client.get(reqOptions);
    } catch (err) {
      if (err.response.statusCode !== 404) {
        throw err;
      }
    }
  }

  /**
   * Creates ABAP BSP Application
   *
   * @return {Promise} HTTP response
   */
  async _createBspApplication(payload) {
    const path = `${ ODATA_PATH }/Repositories`;
    this.logger.info('Creating BSP Application', path);
    const reqOptions = this.getRequestOptions();
    reqOptions.url = path;
    reqOptions.body = payload;
    return this._client.post(reqOptions);
  }

  /**
   * Updates ABAP BSP Application
   *
   * @return {Promise} HTTP response
   */
  async _updateBspApplication(payload) {
    const path = `${ ODATA_PATH }/Repositories('${ encodeURIComponent(this._abapRepository.bspApplication) }')`;
    this.logger.info('Updating BSP Application', path);
    const reqOptions = this.getRequestOptions();
    reqOptions.url = path;
    reqOptions.body = payload;
    return this._client.put(reqOptions);
  }

  /**
   * Builds and returns the payload
   *
   * @param {string} archivePath Path to read the archive file
   * @returns {Promise<string>} Payload containing app details + the archive file content converted to base64
   */
  async getPayload(archivePath) {
    const archiveFile = await readFile(archivePath, {encoding: 'base64'});
    return [
      '<entry xmlns="http://www.w3.org/2005/Atom"',
      'xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata"',
      'xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices"',
      'xml:base="https://ffs.finlync.com/sap/opu/odata/UI5/ABAP_REPOSITORY_SRV">',
      `<id>https://ffs.finlync.com/sap/opu/odata/UI5/ABAP_REPOSITORY_SRV/Repositories('${ this._abapRepository.bspApplication }')</id>`,
      `<title type="text">Repositories('${ this._abapRepository.bspApplication }')</title>`,
      `<updated>${ new Date().toISOString() }</updated>`,
      '<category term="/UI5/ABAP_REPOSITORY_SRV.Repository" scheme="http://schemas.microsoft.com/ado/2007/08/dataservices/scheme"/>',
      `<link href="Repositories('${ this._abapRepository.bspApplication }')" rel="edit" title="Repository"/>`,
      '<content type="application/xml">',
      '<m:properties>',
      `<d:Name>${ this._abapRepository.bspApplication }</d:Name>`,
      `<d:Package>${ this._abapRepository.package === null || this._abapRepository.package === void 0 ? void 0 : this._abapRepository.package.toUpperCase() }</d:Package>`,
      `<d:Description>${ this._abapRepository.bspApplicationText }</d:Description>`,
      `<d:ZipArchive>${ archiveFile }</d:ZipArchive>`,
      '<d:Info/>',
      '</m:properties>',
      '</content>',
      '</entry>',
    ].join(' ');
  }

  /**
   * Get OData request options
   *
   * @returns {object} OData request options
   */
  getRequestOptions() {
    return {
      searchParams: {
        CodePage: 'UTF8',
        CondenseMessagesInHttpResponseHeader: 'X',
        format: 'json',
        TransportRequest: this._abapRepository.transportRequest,
      },
      headers: {
        'Content-Type': contentType.atomXml,
        'x-csrf-token': this._csrfToken,
        'type': 'entry',
        'charset': 'UTF8',
      },
    };
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
    const cookieJar = new CookieJar();
    const reqOptions = {
      prefixUrl: options.connection.url,
      decompress: true,
      cookieJar,
      searchParams: query,
      retry: 0,
      headers: {
        accept: '*/*',
        Connection: 'keep-alive',
      },
      https: {
        rejectUnauthorized: !!options.connection.strictSSL,
      },
      hooks: {
        beforeError: [
          (err) => {
            this._responseError(err.response);
            return err;
          },
        ],
      },
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
   * @throw Will throw an error for failed HTTP responses
   */
  _responseError(response) {
    this.logger.error(response.statusCode, response.statusMessage);
    this.logger.error('Request:');
    this.logger.error(response.request.options.url.href);
    this.logger.error('Request headers:');
    this.logger.error(response.request.options.headers);
    this.logger.error('Response headers:');
    this.logger.error(response.headers);
    if (response.statusCode !== 404) {
      this.logger.error('Response body:');
      this.logger.error(response.body);
    }
    throw new Error(response.statusCode + ' - ' + response.statusMessage);
  }
}

module.exports = ODataClient;
