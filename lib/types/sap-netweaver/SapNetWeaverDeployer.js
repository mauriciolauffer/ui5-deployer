const AdtClient = require("./AdtClient");
const AdtResourceManager = require("./AdtResourceManager");
const AbstractDeployer = require("../AbstractDeployer");

class SapNetWeaverDeployer extends AbstractDeployer {
	deploy() {
		const adtClient = new AdtClient({
			project: this.project,
			parentLogger: this.taskLog
		});
		const adtResourceManager = new AdtResourceManager({
			adtClient,
			project: this.project
		});
		return adtClient.connect()
			.then(this.getLocalResources.bind(this))
			.then(adtResourceManager.saveResources.bind(adtResourceManager));
	}
}

module.exports = SapNetWeaverDeployer;
