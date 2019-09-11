const SapCpCfDeployer = require("./SapCpCfDeployer");

module.exports = {
	deploy: function({resourceCollections, project, parentLogger}) {
		return new SapCpCfDeployer({resourceCollections, project, parentLogger}).deploy();
	},

	// Export type classes for extensibility
	Deployer: SapCpCfDeployer
};
