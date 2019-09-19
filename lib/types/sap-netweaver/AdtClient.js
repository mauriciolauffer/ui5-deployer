const { promisify } = require("util");
const request = promisify(require("request"));
const path = require('path');
const fs = require("fs");
const { readFile } = promisify(require("fs").readFile);
const { isBinaryFile } = require("isbinaryfile");
const ADT_PATH = "/sap/bc/adt";
const BSP_PATH = ADT_PATH + "/filestore/ui5-bsp/objects";
const CTS_PATH = ADT_PATH + '/cts/transportrequests';
const CTS_CHECKS_PATH = "/consistencychecks";
const PACKAGE_PATH = ADT_PATH + '/packages';
const CONTENT_PATH = "/content";
const DISCOVERY_PATH = ADT_PATH + "/discovery";
const escapedForwardSlash = "%2f";
const fileCharset = 'UTF-8';

class AdtClient {
	constructor({ project, parentLogger }) {
		this.logger = parentLogger;
		this.project = project;
		this._credentials = project.deployer.credentials;
		this._abapRepository = project.deployer.abapRepository;
		this._connection = project.deployer.connection;
		this._csrfToken = "";
		this._client = this._getDefaultRequest(project.deployer);
	}

	getClient() {
		return this._client;
	}

	async connect() {
		const response = await this._authenticate(this._credentials.username, this._credentials.password);
		await this._validateAdtDiscovery(response);
		await this._getPackage(this._abapRepository.package);
		if (this._isLocalPackage(this._abapRepository.package)) {
			this._abapRepository.transportRequest = "";
		} else {
			await this._getTransportRequest(this._abapRepository.transportRequest);
		}
		await this._getBspApplication(this._abapRepository.bspApplication);
	}

	_validateAdtDiscovery(response) {
		let isValid = true;
		const errorMessage = " not found in discovery!"
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
			this.logger.error("For more information, check " + DISCOVERY_PATH);
			throw new Error("ADT does not have all required services available!");
		}
	}

	_validateAdtPath(path, xml) {
		const regxp = new RegExp('<app:collection href="' + path + '">');
		return regxp.test(xml);
	}

	async _authenticate(username, password) {
		this.logger.info("Connecting to", this._connection.url);
		const reqOptions = {
			uri: DISCOVERY_PATH,
			headers: {
				"x-csrf-token": "Fetch"
			},
			auth: {
				user: username,
				pass: password,
				sendImmediately: true
			}
		}
		const response = await this._client(reqOptions);
		if (response.statusCode !== 200) {
			this._responseError(response);
		}
		this._csrfToken = response.headers["x-csrf-token"];
		return response;
	}

	async _getPackage(abapPackage) {
		this.logger.info("Getting ABAP package", PACKAGE_PATH + "/" + abapPackage);
		const response = await this._client({ uri: PACKAGE_PATH + "/" + encodeURIComponent(abapPackage) });
		if (response.statusCode !== 200) {
			this._responseError(response);
		}
		return response;
	}

	async _getTransportRequest(transportRequest) {
		this.logger.info("Getting ABAP Transport Request", CTS_PATH + "/" + transportRequest);
		const reqOptions = {
			uri: CTS_PATH + "/" + encodeURIComponent(transportRequest) + CTS_CHECKS_PATH,
			method: "POST",
			headers: {
				"x-csrf-token": this._csrfToken
			}
		}
		const response = await this._client(reqOptions);
		if (response.statusCode !== 200) {
			this._responseError(response);
		}
		return response;
	}

	async _getBspApplication(bspApplication) {
		this.logger.info("Getting BSP Application", BSP_PATH + "/" + bspApplication);
		const response = await this._client({ uri: BSP_PATH + "/" + encodeURIComponent(bspApplication) })
		if (response.statusCode === 404) {
			return await this._createBspApplication();
		} else if (response.statusCode !== 200) {
			this._responseError(response);
		}
		return response;
	}

	async _createBspApplication() {
		this.logger.info("Creating BSP Application", BSP_PATH + "/" + this._abapRepository.bspApplication);
		const path = BSP_PATH + "/%20" + CONTENT_PATH;
		const qs = {
			type: "folder",
			isBinary: false,
			name: this._abapRepository.bspApplication,
			description: this._abapRepository.bspApplicationText,
			devclass: this._abapRepository.package,
			corrNr: this._abapRepository.transportRequest
		}
		const reqOptions = {
			method: "POST",
			url: path,
			qs: qs,
			headers: {
				"Content-Type": "application/octet-stream",
				"x-csrf-token": this._csrfToken
			}
		};
		const response = await this._client(reqOptions);
		if (response.statusCode !== 201) {
			this._responseError(response);
		}
		return response;
	}

	async getResources(resourcePath) {
		const regex = new RegExp(escapedForwardSlash, "g");
		this.logger.info("Getting files from", resourcePath.replace(regex, "/"));
		return this._client({ uri: BSP_PATH + "/" + resourcePath + CONTENT_PATH })
			.then((response) => {
				if (response.statusCode === 200) {
					return response;
				} else {
					this._responseError(response);
				}
			});
	}

	async createFolder(folderPath) {
		this.logger.info("Creating folder", this._abapRepository.bspApplication + folderPath);
		const folderStructure = folderPath.split("/");
		const folderName = folderStructure.pop();
		const path = BSP_PATH + "/" + this._abapRepository.bspApplication + encodeURIComponent(folderStructure.join("/")) + CONTENT_PATH;
		const qs = {
			type: "folder",
			isBinary: false,
			name: folderName,
			devclass: this._abapRepository.package,
			corrNr: this._abapRepository.transportRequest
		}
		const reqOptions = {
			method: "POST",
			url: path,
			qs: qs,
			headers: {
				"Content-Type": "application/octet-stream",
				"x-csrf-token": this._csrfToken,
				"If-Match": "*"
			}
		};
		const response = await this._client(reqOptions);
		if (response.statusCode !== 201) {
			this._responseError(response);
		}
		return response;
	}

	async deleteFolder(folderPath) {
		this.logger.info("Deleting folder", this._abapRepository.bspApplication + folderPath);
		const path = BSP_PATH + "/" + this._abapRepository.bspApplication + encodeURIComponent(folderPath) + CONTENT_PATH;
		const qs = {
			deleteChildren: true,
			corrNr: this._abapRepository.transportRequest
		}
		const reqOptions = {
			method: "DELETE",
			url: path,
			qs: qs,
			headers: {
				"Content-Type": "application/octet-stream",
				"x-csrf-token": this._csrfToken,
				"If-Match": "*"
			}
		};
		const response = await this._client(reqOptions);
		if (response.statusCode !== 200) {
			this._responseError(response);
		}
		return response;
	}

	async createFile(filePath, fileContent) {
		this.logger.info("Creating file", this._abapRepository.bspApplication + filePath);
		const isBinary = await isBinaryFile(fileContent);
		const folderStructure = filePath.split("/");
		const fileName = folderStructure.pop();
		const path = BSP_PATH + "/" + this._abapRepository.bspApplication + encodeURIComponent(folderStructure.join("/")) + CONTENT_PATH;
		const qs = {
			type: "file",
			isBinary,
			name: fileName,
			charset: fileCharset,
			devclass: this._abapRepository.package,
			corrNr: this._abapRepository.transportRequest
		}
		const reqOptions = {
			method: "POST",
			url: path,
			qs: qs,
			headers: {
				"Content-Type": "application/octet-stream",
				"x-csrf-token": this._csrfToken,
				"If-Match": "*"
			}
		};
		reqOptions.body = (fileContent.length > 0) ? fileContent : ' ';
		const response = await this._client(reqOptions);
		if (response.statusCode !== 201) {
			this._responseError(response);
		}
		return response;
	}

	async updateFile(filePath, fileContent) {
		this.logger.info("Updating file", this._abapRepository.bspApplication + filePath);
		const isBinary = await isBinaryFile(fileContent);
		const path = BSP_PATH + "/" + this._abapRepository.bspApplication + encodeURIComponent(filePath) + CONTENT_PATH;
		const qs = {
			charset: fileCharset,
			isBinary,
			corrNr: this._abapRepository.transportRequest
		}
		const reqOptions = {
			method: "PUT",
			url: path,
			qs: qs,
			headers: {
				"Content-Type": "application/octet-stream",
				"x-csrf-token": this._csrfToken,
				"If-Match": "*"
			}
		};
		reqOptions.body = (fileContent.length > 0) ? fileContent : ' ';
		const response = await this._client(reqOptions);
		if (response.statusCode !== 200) {
			this._responseError(response);
		}
		return response;
	}

	async deleteFile(filePath) {
		this.logger.info("Deleting file", this._abapRepository.bspApplication + filePath);
		const path = BSP_PATH + "/" + this._abapRepository.bspApplication + encodeURIComponent(filePath) + CONTENT_PATH;
		const qs = {
			corrNr: this._abapRepository.transportRequest
		}
		const reqOptions = {
			method: "DELETE",
			url: path,
			qs: qs,
			headers: {
				"Content-Type": "application/octet-stream",
				"x-csrf-token": this._csrfToken,
				"If-Match": "*"
			}
		};
		const response = await this._client(reqOptions);
		if (response.statusCode !== 200) {
			this._responseError(response);
		}
		return response;
	}

	_isLocalPackage(abapPackage) {
		return abapPackage.substring(0, 1) === "$";
	}

	_getDefaultRequest(options = {}) {
		const query = {}
		if (options.abapRepository && options.abapRepository.client) {
			query['sap-client'] = options.abapRepository.client;
		}
		if (options.abapRepository && options.abapRepository.language) {
			query['sap-language'] = options.abapRepository.language.toUpperCase();
		}
		const reqOptions = {
			baseUrl: options.connection.url,
			uri: "",
			gzip: true,
			jar: true,
			headers: {
				'accept': '*/*'
			},
			qs: query,
			strictSSL: !!options.connection.strictSSL
		};
		if (options.proxy) {
			reqOptions.proxy = options.connection.proxy;
		}
		if (options.connection.strictSSL && options.connection.SSLCertificatePath) {
			reqOptions.agentOptions = {
				ca: fs.readFileSync(options.connection.SSLCertificatePath)
			};
		}
		return request.defaults(reqOptions);
	}

	_responseError(response) {
		this.logger.error(response.statusCode, response.statusMessage);
		this.logger.error(response.body);
		throw new Error(response.statusCode + " - " + response.statusMessage)
	}
}

module.exports = AdtClient;
