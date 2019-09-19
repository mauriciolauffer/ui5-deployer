const { XmlDocument } = require("xmldoc");
const ESCAPED_FORWARDSLASH = "%2f";

function getResourcesToBeUpdated(localResources = [], remoteResources = []) {
	return localResources.filter(local => remoteResources.find(remote => {
		const regxp = new RegExp(remote + "$")
		return regxp.test(local)
	}));
}

function getResourcesToBeCreated(localResources = [], remoteResources = []) {
	return localResources.filter(local => {
		const foundIndex = remoteResources.findIndex(remote => {
			const regxp = new RegExp(remote + "$");
			return regxp.test(local);
		});
		return foundIndex < 0;
	});
}

function getResourcesToBeDeleted(localResources = [], remoteResources = []) {
	return remoteResources.filter(remote => {
		const foundIndex = localResources.findIndex(local => {
			const regxp = new RegExp(remote + "$");
			return regxp.test(local);
		});
		return foundIndex < 0;
	});
}

function sortFromRootToBottomFolder(a, b) {
	return a.split("/").length - b.split("/").length;
}

function sortFromBottomToRootFolder(a, b) {
	return b.split("/").length - a.split("/").length;
}


class AdtResourceManager {
	constructor({ adtClient, project }) {
		this._adtClient = adtClient;
		this._project = project;
		this._localResources = [];
		this._localFolders = [];
		this._localFiles = [];
		this._remoteFolders = [];
		this._remoteFiles = [];
		this.crud = {
			files: { create: [], update: [], delete: [] },
			folders: { create: [], update: [], delete: [] },
		};
	}

	async saveResources(localResources) {
		this._localResources = localResources;
		const path = encodeURIComponent(this._project.deployer.abapRepository.bspApplication);
		await this._getRemoteResources(path);
		this._getLocalResources();
		this._defineCrudOperations();
		await this._syncResources();
		/*return this._getRemoteResources(path)
			.then(this._getLocalResources.bind(this))
			.then(this._defineCrudOperations.bind(this))
			.then(this._syncResources.bind(this));*/
	}

	async _getRemoteResources(path) {
		return this._adtClient.getResources(path)
			.then(response => {
				const regex = new RegExp(ESCAPED_FORWARDSLASH, "g");
				const bspApplication = this._project.deployer.abapRepository.bspApplication;
				const xml = new XmlDocument(response.body);
				const xmlNodes = xml.childrenNamed("atom:entry");
				const folderNodes = xmlNodes.filter((node) => node.valueWithPath('atom:category@term') === "folder");
				const fileNodes = xmlNodes.filter((node) => node.valueWithPath('atom:category@term') === "file");
				const remoteFiles = fileNodes.map(node => node.valueWithPath('atom:id').replace(regex, "/").replace(bspApplication, ""));
				const remoteFolders = folderNodes.map(node => node.valueWithPath('atom:id').replace(regex, "/").replace(bspApplication, ""));
				this._remoteFiles.push(...remoteFiles);
				this._remoteFolders.push(...remoteFolders);
				return Promise.all(
					folderNodes.map(folder => this._getRemoteResources(folder.valueWithPath('atom:id')))
				);
			});
	}

	_getLocalResources() {
		this._localFiles = this._getLocalFiles();
		this._localFolders = this._getLocalFolders();
	}

	_getLocalFiles() {
		return this._localResources.map(resource => resource._path);
	}

	_getLocalFolders() {
		const folders = [];
		this._localResources.map(resource => {
			const pathParts = resource._path.split("/");
			for (let i = 0; pathParts.length > 2; i++) {
				pathParts.pop();
				folders.push(pathParts.join("/"));
			}
		});
		return [...new Set(folders)];
	}

	_defineCrudOperations() {
		this._localFiles.sort().sort(sortFromRootToBottomFolder);
		this._localFolders.sort().sort(sortFromRootToBottomFolder);
		this._remoteFiles.sort().sort(sortFromRootToBottomFolder);
		this._remoteFolders.sort().sort(sortFromRootToBottomFolder);
		this._defineCrudOperationForFolders();
		this._defineCrudOperationForFiles();
	}

	_defineCrudOperationForFolders() {
		this.crud.folders.create = getResourcesToBeCreated(this._localFolders, this._remoteFolders);
		this.crud.folders.update = getResourcesToBeUpdated(this._localFolders, this._remoteFolders);
		this.crud.folders.delete = getResourcesToBeDeleted(this._localFolders, this._remoteFolders);
		this.crud.folders.delete.sort(sortFromBottomToRootFolder);
	}

	_defineCrudOperationForFiles() {
		this.crud.files.create = getResourcesToBeCreated(this._localFiles, this._remoteFiles);
		this.crud.files.update = getResourcesToBeUpdated(this._localFiles, this._remoteFiles);
		this.crud.files.delete = getResourcesToBeDeleted(this._localFiles, this._remoteFiles);
	}

	_getLocalRootFolder() {
		return;
	}

	async _syncResources() {
		await this.deleteRemoteResources();
		await this.updateRemoteResources();
		await this.createRemoteResources();
	}

	async createRemoteResources() {
		for (const folder of this.crud.folders.create) {
			await this._adtClient.createFolder(folder);
		}
		for (const file of this.crud.files.create) {
			const localResource = this._localResources.find(resource => file === resource._path);
			if (localResource) {
				await this._adtClient.createFile(file, await localResource.getBuffer());
			}
		}
	}

	async updateRemoteResources() {
		for (const file of this.crud.files.update) {
			const localResource = this._localResources.find(resource => file === resource._path);
			if (localResource) {
				await this._adtClient.updateFile(file, await localResource.getBuffer());
			}
		}
	}

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
