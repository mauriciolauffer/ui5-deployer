'use strict';

/**
 * @module ui5-deployer
 * @public
 */
module.exports = {
  deployer: require('./deployer/deployer'),
  /**
     * @private
     * @see module:ui5-deployer.types
     * @namespace
     */
  types: {
    AbstractDeployer: require('./types/AbstractDeployer'),
    sapNetWeaver: require('./types/sap-netweaver/sapNetWeaverType'),
    sapCpNeo: require('./types/sap-cp-neo/sapCpNeoType'),
    sapCpCf: require('./types/sap-cp-cf/sapCpCfType'),
    typeRepository: require('./types/typeRepository'),
  },
};
