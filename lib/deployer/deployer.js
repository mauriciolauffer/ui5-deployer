'use strict';

const logger = require('@ui5/logger').getGroupLogger('deployer:deployer');
const {resourceFactory} = require('@ui5/fs');
const typeRepository = require('../types/typeRepository');

require('dotenv').config();

/**
 * Calculates the elapsed deploy time and returns a prettified output
 *
 * @private
 * @param {array[number]} startTime Array provided by <code>process.hrtime()</code>
 * @return {string} Difference between now and the provided time array as formatted string
 */
function getElapsedTime(startTime) {
  const prettyHrtime = require('pretty-hrtime');
  const timeDiff = process.hrtime(startTime);
  return prettyHrtime(timeDiff);
}

function setPropertiesWithEnv(deployerConfig) {
  if (process.env.UI5_DEPLOYER_USERNAME) {
    deployerConfig.credentials.username = process.env.UI5_DEPLOYER_USERNAME;
  }
  if (process.env.UI5_DEPLOYER_PASSWORD) {
    deployerConfig.credentials.password = process.env.UI5_DEPLOYER_PASSWORD;
  }
  if (process.env.UI5_DEPLOYER_ABAP_TR && deployerConfig.abapRepository) {
    deployerConfig.abapRepository.transportRequest = process.env.UI5_DEPLOYER_ABAP_TR;
  }
  if (process.env.UI5_DEPLOYER_NEO_CLIPATH && deployerConfig.sapCloudPlatform.neo) {
    deployerConfig.sapCloudPlatform.neo.cliPath = process.env.UI5_DEPLOYER_NEO_CLIPATH;    
}
}

function setPropertiesWithCLI(deployerConfig, transportRequest, username, password) {
  if (transportRequest && deployerConfig.abapRepository) {
    deployerConfig.abapRepository.transportRequest = transportRequest;
  }
  if (username) {
    deployerConfig.credentials.username = username;
  }
  if (password) {
    deployerConfig.credentials.password = password;
  }
}

function getExclusions(deployerConfig) {
  if (deployerConfig.resources && deployerConfig.resources.excludes) {
    return deployerConfig.resources.excludes
        .map((excludedPath) => excludedPath.replace(deployerConfig.sourcePath, '/'));
  } else {
    return [];
  }
}

/**
 * Deployer
 *
 * @public
 * @namespace
 * @alias module:ui5-deployer.deployer
 */
module.exports = {
  /**
     * Configures the project deploy and starts it.
     *
     * @public
     * @param {object} parameters Parameters
     * @param {object} parameters.tree Dependency tree
     * @param {string} parameters.transportRequest ABAP Transport Request
     * @param {string} parameters.username Username to log into the target system
     * @param {string} parameters.password Password to log into the target system
     * @return {Promise} Promise resolving to <code>undefined</code> once deploy has finished
     */
  async deploy({tree, transportRequest, username, password}) {
    logger.info(`Deploying project ${tree.metadata.name}`);
    const startTime = process.hrtime();
    const project = tree;
    if (parseFloat(tree.specVersion) > 2 || (tree.customConfiguration && tree.customConfiguration.deployer)) {
      project.deployer = tree.customConfiguration.deployer;
    }
    if (!project.deployer.credentials) {
      project.deployer.credentials = {};
    }
    setPropertiesWithEnv(project.deployer);
    setPropertiesWithCLI(project.deployer, transportRequest, username, password);
    const excludes = getExclusions(project.deployer);
    const projectType = typeRepository.getType(project.deployer.type);
    const workspace = resourceFactory.createAdapter({
      fsBasePath: './' + project.deployer.sourcePath,
      virBasePath: '/',
      excludes: excludes,
    });

    try {
      await projectType.deploy({
        resourceCollections: {
          workspace,
        },
        project,
        parentLogger: logger,
      });
      logger.verbose('Finished deploying project %s. Writing out files...', project.metadata.name);
      logger.info(`Deploy succeeded in ${getElapsedTime(startTime)}`);
    } catch (err) {
      logger.error(err);
      logger.error(`Deploy failed in ${getElapsedTime(startTime)}`);
      throw err;
    }
  },
};
