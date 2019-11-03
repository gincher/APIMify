# APIMify

Sync automatically your ExpressJs server with Azure Api Management Service.

[![NPM Version](https://img.shields.io/npm/v/apimify.svg)](https://npmjs.org/package/apimify) [![Dependency Status](https://david-dm.org/GINCHER/APIMify.svg)](https://david-dm.org/GINCHER/APIMify) ![GitHub top language](https://img.shields.io/github/languages/top/GINCHER/APIMify) ![GitHub](https://img.shields.io/github/license/GINCHER/APIMify)

```typescript
import { APIMify } from "apimify";
import { router } from "./routes";

new APIMify({
  express: router,
  resourceGroupName: "resourceGroup",
  serviceName: "serviceName",
  apiId: "api"
}).sync();
```

* [Installation](#installation)
* [Usage](#usage)
* [Configuration Options](#configuration-options)
* [Operation Configuration](#operation-configuration)
* [Operation Policies](#operation-policies)
* [Warning!](#warning)
* [License](#license)

## Installation

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/):

```sh
$ npm install apimify
```

## Usage

### Simple Usage (Simply sync the routes with APIM)

```typescript
import { APIMify } from "apimify";
import express from "express";

const app = express();

app.get("/", (req, res) => res.json({hello: "world"}).status(200));
app.post("/", (req, res) => res.json({hello: req.body}).status(200));

new APIMify({
  express: app,
  resourceGroupName: "resourceGroup",
  serviceName: "serviceName",
  apiId: "api"
}).sync();
```

### Authenticating using username and password

```typescript
import { APIMify } from 'apimify';
import express from 'express';

const app = express();

app.get('/', (req, res) => res.send("Hey!"));

new APIMify({
  express: app,
  resourceGroupName: 'resourceGroup',
  serviceName: 'serviceName',
  apiId: 'api',
  auth: {
    username: "username",
    password: "qwerty",
    subscription: "AzureSubscription"
  }
}).sync();

```

### Manually setting operation information

```typescript
import { APIMify, Metadata } from "apimify";
import express from "express";

const app = express();

app.get(
  '/',
  Metadata.set({ displayName: 'Greeting' }), 
  Metadata.set({ tags: ['useless endpoint'] }), 
  (req, res) => res.json({ hello: 'world' }).status(200)
);
app.post(
  '/',
  Metadata.set({
    displayName: 'Personal Greeting',
    description: 'This endpoint will return a custom made JSON object based on the POST payload. Cool, hah?'
  }),
  Metadata.set({
    responses: [
      { 
        representations: [
          { contentType: 'application/json', sample: '{ hello: "John Doe" }' }
        ], 
        statusCode: 200
      }
    ]
  }),
  (req, res) => res.json({ hello: req.body }).status(200)
);

new APIMify({
  express: app,
  resourceGroupName: 'resourceGroup',
  serviceName: 'serviceName',
  apiId: 'api'
}).sync();
```

### Setting policies

```typescript
import { APIMify, rateLimit, Policy } from 'apimify';
import express from 'express';

const app = express();

app.get('/', (req, res) => res.send("I have no limits!"));
app.get('/rate-limited', rateLimit({"calls": 100, "renewal-period": 60}), (req, res) => res.send("I do :)"));

app.use(
  Policy.create(`
    <validate-jwt header-name="Authorization" require-scheme="Bearer">
      <issuer-signing-keys>
        <!-- You can use named values -->
        <key>{{jwt-signing-key}}</key>
      </issuer-signing-keys>
      <audiences>
        <!-- You can use any expression you need - It's simply being passed to APIM -->
        <audience>@(context.Request.OriginalUrl.Host)</audience>
      </audiences>
    </validate-jwt>
  `, "inbound")
);
app.post('/authenticated', (req, res) => res.send("Do you have a JWT?"));
app.delete('/jwt-required', (req, res) => res.send("You Betcha!"));


new APIMify({
  express: app,
  resourceGroupName: 'resourceGroup',
  serviceName: 'serviceName',
  apiId: 'api',
  apiVersion: "v2"
}).sync();
```

## Configuration Options

### `new APIMify(configuration).sync()`

Returns an empty promise when sync is complete.

**`configuration`:**

* `express`: An express instance `express()` or a router.
* `auth`: *(optional)* Azure authentication:
  - `{}` - will try to authenticate using Azure CLI. This is the default.
  - `{ subscription: string }` - will initiate an interactive authentication
  - `{ subscription: string, credentials: AzureCredentials }` - you can use any authentication method in `@azure/ms-rest-js`, and pass the credentials.
  - `{ subscription: string, username: string", password: string }` - authenticating using username and password (won't work if MFA enabled).
* `resourceGroupName`: A string with the name of the resource group.
* `serviceName`: A string with the name of the API Management service.
* `apiId`: A string with the API identifier. If you want to use a specific revision you can append `;rev=` and the revision number
* `apiVersion`: *(optional)* A string with the API version.
* `basePath`: *(optional)* A string with a path to append to the express routes.
* `breakOnSamePath`: *(optional)* Set to true if you want an error to be thrown in case of path overlap, for example, in case of a route with `/user/:id(\d*)` as path, and another route with the same method and `/user/:name([A-z\-]*)` as path - APIM can't distinguish between the two. Default: false.
* `generateNewRevision`: *(optional)* Set to true if you want to create a new revision on sync. Default: true.
* `makeNewRevisionAsCurrent`: *(optional)* Set to true if you want to mark the revision as current. Default: match `generateNewRevision`.
* `logger`: *(optional)* A logger. Defaults to `console`
* `logLevel`: *(optional)* An object with log level as keys and boolean as values indicating wether to log a level or not. Default: log all levels.


## Operation Configuration

### `Metadata.set(configuration)`

Returns an express middleware that you can use just like any other middleware.

**`configuration`:**

* `description`: *(optional)* Description of the operation. May include HTML formatting tags.
* `request`: *(optional)* An entity containing request details.
* `responses`: *(optional)* Array of Operation responses.
* `displayName`: *(optional)* Operation Name.
* `operationId`: *(optional)* Operation identifier within an API. Must be unique in the current API Management service instance.
* `tags`: *(optional)* Array of tags

## Operation Policies

### `Policy.create(XML, Location)`

Returns an express middleware that you can use just like any other middleware.

* `XML`: A string with valid APIM policy XML. You can use named values and any other expression
* `Location`:
  - `inbound`: The XML will be applied to the request.
  - `backend`: The XML will be applied before the request is forwarded to the backend service.
  - `outbound`: The XML will be applied to the response.
  - `on-error`: The XML will be applied if there is an error condition.

### Ready to use policies

* **`checkHeader(configuration, 'inbound' | 'outbound')`:** [configuration and information](https://docs.microsoft.com/en-us/azure/api-management/api-management-access-restriction-policies#CheckHTTPHeader)
* **`rateLimit(configuration)`:** [configuration and information](https://docs.microsoft.com/en-us/azure/api-management/api-management-access-restriction-policies#LimitCallRate)
* **`rateLimitByKey(configuration)`:** [configuration and information](https://docs.microsoft.com/en-us/azure/api-management/api-management-access-restriction-policies#LimitCallRateByKey)

I'll be adding more soon

## Warning!

Running `sync()` will **delete all existing operations if they don't have an express route** - so be carful! Start by setting `generateNewRevision` to true and `makeNewRevisionAsCurrent` to false, check if everything works, make sure that the deletion of the operations don't affect your API, look for policies you might forgot, etc. If all looks OK, you can set `makeNewRevisionAsCurrent` to true and forget from the APIM portal.

This is a slow process, so I recommend using it as a CI/CD step and not on every app initiation - place APIMify in a separate file from the one initiates the express server and call it only when you need it.

## License

[MIT License](LICENSE)
