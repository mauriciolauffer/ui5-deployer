# Introduction

This is an experimental module integrated with ui5-tooling to deploy Fiori/UI5 apps to SAP environments. This module is under development and it is not part of the official SAP ui5-tooling. For now, it uses a custom version of ui5-cli for deployment capabilities. It's heavily inspired on ui5-build.

It's an experimental module, don't use it for real! There's no NPM module for it, you consume it from GitHub only.

## Deploy to

You should be able to deploy to:

- SAP Netweaver: ABAP server
- SAP Cloud Platform: NEO environment
- SAP Cloud Platform: Cloud Foundry environment

## Project Configuration

Typically located in a ui5.yaml file per project. You have 3 options for remote systems. They share some configuration, but each one has its own specific details.

This is the basic setup for ui5-deployer shared across all remote system options, it does not include the specific details for a given remote system. Some of the properties are not required, some are.

### Properties

#### *\<root>*

The ui5.yaml file from your Fiori/UI5 application/library should have a new section called **deployer**. Deployer section has the following parameters:

#### ui5.yaml file for *deployer*

`deployer`: root attribute, all deployer details go under it
- `type`: Indicates the remote system where the project will be deployed. Must be `sap-netweaver` || `sap-cp-neo` || `sap-cp-cf`
- `sourcePath`: Path to the folder where your production ready project is
- `connection`: Connection details to the remote system
  - `url`: URL endpoint to connect to the remote system
  - `proxy` (optional): an HTTP proxy to be used
  - `strictSSL` (optional): if true, requires SSL certificates to be valid. Note: to use your own certificate authority, you need to specify the path to the SSL Certificate. Must be `true` || `false`. Default is `false`.
  - `SSLCertificatePath` (optional): path to the SSL Certificate in case you are using your own certificate authority
- `credentials`: Credentials to be used when accessing the remote system. This section will be removed soon as it might be a huge security issue. One might end up pushing username/password to the git repo. Username/password should be passed via CLI command only.
  - `username`: Username
  - `password`: Password
- `sapCloudPlatform` (optional): SAP Cloud Platform target
  - `neo` (optional): NEO environment target
    - `account`: SAP CP NEO Account
    - `cliPath` (optional):  In case neo CLI is not global, inform the path to it. <https://help.sap.com/viewer/65de2977205c403bbc107264b8eccf4b/Cloud/en-US/7613dee4711e1014839a8273b0e91070.html>
  - `cloudFoundry` (optional): CF environment target
    - `org`: Organization
    - `space`: Space
    - `cliPath` (optional): In case cf CLI is not global, inform the path to it. <https://docs.cloudfoundry.org/cf-cli>
- `abapRepository` (optional): SAP NetWeaver ABAP Repository target
  - `client`: SAP client/mandt
  - `language`: SAP Logon Language
  - `transportRequest`: ABAP Transport Request Number
  - `package`: ABAP Package
  - `bspApplication`: BSP Application name
  - `bspApplicationText`: BSP Application description
  - `skipAdtValidations` (optional): Does not validate the existence of some ADT APIs, ABAP packages and Transport Requests used during deployment. Used for older ABAP versions where these ADT APIs are not available. Must be `true` || `false`. Default is `false`.

## SAP Netweaver: ABAP server

```yml
specVersion: '1.0'
metadata:
  name: ui5-deployer-app-test
type: application
deployer:
  type: sap-netweaver
  sourcePath: dist/ # Path to the project to be deployed
  resources:
    excludes:
      - "dist/path_to_excluded/**"
  connection:
    url: https://dev.my-sap-server.com
    proxy: https://my.proxy.com:43000
    strictSSL: true
    SSLCertificatePath: /certs/my-ssl-certificate.pem
  credentials:
    username: MyUsername
    password: MyPassword
  abapRepository:
    client: 100
    language: EN
    transportRequest: ABAPDK999999
    package: ZMYPACKAGE
    bspApplication: ZDEPLOYAPP001
    bspApplicationText: TEST DEPLOY APP x1
    skipAdtValidations: true
```

## SAP Cloud Platform: NEO environment

```yml
specVersion: '1.0'
metadata:
  name: ui5-deployer-app-test
type: application
deployer:
  type: sap-cp-neo
  sourcePath: /dist/*.mtar # Path to the .mtar file to be deployed
  connection:
    url: https://hanatrial.ondemand.com
  credentials:
    username: MyUsername
    password: MyPassword
  sapCloudPlatform:
    neo:
      account: myNEO12345Account
      cliPath: C:\neo-java-web-sdk\tools
```

## SAP Cloud Platform: Cloud Foundry environment

```yml
specVersion: '1.0'
metadata:
  name: ui5-deployer-app-test
type: application
deployer:
  type: sap-cp-cf
  sourcePath: /dist # Path to the manifest.yml file: https://docs.cloudfoundry.org/devguide/deploy-apps/manifest.html
  connection:
    url: https://api.cf.eu10.hana.ondemand.com
  credentials:
    username: MyUsername
    password: MyPassword
  sapCloudPlatform:
    cloudFoundry:
      org: myORG
      space: mySPACE
      cliPath: C:\cf-cli\tools
```

### For projects using ui5.yaml specVersion 2.1 or higher

Projects using ui5.yaml specVersion 2.1 or higher must use the new `customConfiguration` property.
https://sap.github.io/ui5-tooling/pages/Configuration/#custom-configuration

```yml
specVersion: '2.1'
metadata:
  name: ui5-deployer-app-test
type: application
customConfiguration:
  deployer:
    type: sap-netweaver
    sourcePath: dist/ # Path to the project to be deployed
    connection:
      url: https://dev.my-sap-server.com
      strictSSL: false
    credentials:
      username: MyUsername
      password: MyPassword
    abapRepository:
      client: 100
      language: EN
      transportRequest: ABAPDK999999
      package: ZMYPACKAGE
      bspApplication: ZDEPLOYAPP001
      bspApplicationText: TEST DEPLOY APP x1
```

## Getting Started

Pick one of the remote systems above and edit your ui5.yaml file according to it.

You have the option to use all parameters as is from the ui5.yaml file or overwrite few of them when executing ui5-cli.

You can overwrite: `abapRepository.transportRequest` || `credentials.username` || `credentials.password`

```shell script
$ ui5-deployer deploy
```

```shell script
$ ui5-deployer deploy --transport-request=ABAPDK99999
```

```shell script
$ ui5-deployer deploy --username=MyUsername --password=MyPassword
```

You can see an example here:
<https://github.com/mauriciolauffer/ui5-deployer-app-test>

The modified ui5-cli can be found here: <https://github.com/mauriciolauffer/ui5-cli-deployer>

TODO: Needs more details

## Build and Test

TODO: Describe and show how to build your code and run the tests.
