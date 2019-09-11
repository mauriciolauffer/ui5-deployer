# Introduction 
This is an experimental module integrated with ui5-tooling to deploy Fiori/UI5 apps to SAP environments. This module is under development and it is not part of the official SAP ui5-tooling. For now, it uses a custom version of ui5-cli for deployment capabilities.

It's an experimental module, don't use it for real! There's no NPM module for it, you consume it from GitHub only.

# Deploy to
You should be able to deploy to:
- SAP Netweaver: ABAP server
- SAP Cloud Platform: NEO environment (TODO)
- SAP Cloud Platform: Cloud Foundry environment (TODO)
 
# Getting Started
The ui5.yaml from your Fiori/UI5 application/library should have a new section called **deployer**. Deployer section has the following parameters:

```yml
specVersion: '1.0'
metadata:
  name: ui5-deployer-app-test
type: application
deployer:
  type: sap-netweaver
  sourcePath: /dist
  connection:
    url: https://dev.my-sap-server.com
    proxy:
    strictSSL: false
    SSLCertificatePath: /certs/ssl-certificate.pem
  abapRepository:
    client: 100
    language: EN
    transportRequest: ABAPDK999999
    package: ZMYPACKAGE
    bspApplication: ZDEPLOYAPP001
    bspApplicationText: TEST DEPLOY APP x1
  credentials:
    username: MyUsername
    password: MyPassword
```

You can see an example here:
https://github.com/mauriciolauffer/ui5-deployer-app-test

The modified ui5-cli can be found here: https://github.com/mauriciolauffer/ui5-cli-deployer

TODO: Needs more details

# Build and Test
TODO: Describe and show how to build your code and run the tests.
