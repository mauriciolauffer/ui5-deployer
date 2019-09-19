const sapNetWeaverType = require('./sap-netweaver/sapNetWeaverType');
const sapCpNeoType = require('./sap-cp-neo/sapCpNeoType');
const sapCpCfType = require('./sap-cp-cf/sapCpCfType');

const types = {
  'sap-netweaver': sapNetWeaverType,
  'sap-cp-neo': sapCpNeoType,
  'sap-cp-cf': sapCpCfType,
};

/**
 * Gets a type
 *
 * @param {string} typeName unique identifier for the type
 * @return {Object} type identified by name
 * @throws {Error} if not found
 */
function getType(typeName) {
  const type = types[typeName];

  if (!type) {
    throw new Error('Unknown type *' + typeName + '*');
  }
  return type;
}

/**
 * Adds a type
 *
 * @param {string} typeName unique identifier for the type
 * @param {Object} type
 * @throws {Error} if duplicate with same name was found
 */
function addType(typeName, type) {
  if (types[typeName]) {
    throw new Error('Type already registered *' + typeName + '*');
  }
  types[typeName] = type;
}

module.exports = {
  getType: getType,
  addType: addType,
};
