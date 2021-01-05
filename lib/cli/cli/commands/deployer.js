// Deploy

const baseMiddleware = require('../middlewares/base.js');

const deploy = {
  command: 'deploy',
  describe: 'Deploy project in current directory',
  handler: handleDeploy,
  middlewares: [baseMiddleware],
};

deploy.builder = function(cli) {
  return cli
      .option('transport-request', {
        describe: 'ABAP Transport Request',
        default: '',
        type: 'string',
      })
      .option('username', {
        describe: 'Username to log into the target system',
        default: '',
        type: 'string',
      })
      .option('password', {
        describe: 'Password to log into the target system',
        default: '',
        type: 'string',
      })
      .example('ui5 deploy', 'Deploy project with all parameters from ui5.yaml file.')
      .example('ui5 deploy --transport-request=ABAPDK99999', 'Deploy project with the given ABAP Transport Request')
      .example('ui5 deploy --username=MyUsername --password=MyPassword', 'Deploy project with the given credentials');
};

async function handleDeploy(argv) {
  const normalizer = require('@ui5/project').normalizer;
  const deployer = require('../../../index').deployer;
  const logger = require('@ui5/logger');

  logger.setShowProgress(true);

  const normalizerOptions = {
    translatorName: argv.translator,
    configPath: argv.config,
  };

  const tree = await normalizer.generateProjectTree(normalizerOptions);
  await deployer.deploy({
    tree: tree,
    transportRequest: argv['transport-request'],
    username: argv.username,
    password: argv.password,
  });
}

module.exports = deploy;
