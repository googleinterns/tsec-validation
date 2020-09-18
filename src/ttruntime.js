// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
//     You may obtain a copy of the License at
//
// https://www.apache.org/licenses/LICENSE-2.0
//
//     Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
//     WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//     See the License for the specific language governing permissions and
// limitations under the License.

const puppeteer = require('puppeteer');
const yargs = require('yargs');

const argv = yargs
    .option('endpoint', {
        alias: 'e',
        description: 'Endpoint of running application to scan. Default: http://localhost:8080',
        type: 'string',
    })
    .option('verbose', {
        alias: 'v',
        description: 'Verbose logging',
        type: 'boolean'
    })
    .option('no-headless', {
        alias: 'hl',
        description: 'Open browser in the headless mode. Default: true',
        type: 'boolean'
    })
    .option('path', {
        alias: 'p',
        description: 'Path to the tested project\'s root. Default: this project\'s root',
        type: 'string',
    })
    .help()
    .alias('help', 'h')
    .argv;

const violations = new Map();

function parseViolation(data) {
    const report = JSON.parse(data)['csp-report'];
    if (report) {
        const location = `${report['source-file']}:${report['line-number']}:${report['column-number']}`;
        if (!violations.has(location)) {
            violations.set(location, []);
        }
        violations.get(location).push(report);
    }
}

async function intercept(page) {
    const client = await page.target().createCDPSession();

    await client.send('Fetch.enable', {
        patterns: [
            {requestStage: 'Response', resourceType: 'Document'},
            {requestStage: 'Response', resourceType: 'Script'},
            {requestStage: 'Response', resourceType: 'CSPViolationReport'},
        ]
    });

    client.on('Fetch.requestPaused', async event => {
        const { requestId, resourceType, request, responseHeaders } = event;
        if (argv.verbose) {
            console.log(`Intercepted ${request.url} {interception id: ${requestId}}`);
        }
        if (resourceType === 'CSPViolationReport') {
            parseViolation(event.request.postData);
        }
        const response = await client.send('Fetch.getResponseBody',{ requestId });

        const newHeaders = responseHeaders;
        newHeaders.push({
            name: 'Content-Security-Policy-Report-Only', value: `require-trusted-types-for \'script\'; report-uri ${argv.endpoint || 'http://127.0.0.1:8080'}`
        });
        if (argv.verbose) {
            console.log(`Continuing interception ${requestId}`)
        }
        await client.send('Fetch.fulfillRequest', {
            requestId: requestId,
            responseHeaders: newHeaders,
            responseCode: 200,
            body: response.body
        });
    });
}

function printReport() {
    const violationsCount = Array.from(violations.values())
        .map((arr) => arr.length)
        .reduce((x, y) => x + y);
    console.log(`Found ${violationsCount} violation${violationsCount === 1 ? '' : 's'}.`);
    // TODO add ts file localization
}

(async function main(){
    const browser = await puppeteer.launch({
        headless: argv.headless || true,
        devtools: true,
    });

    const page = (await browser.pages())[0];

    await intercept(page);

    await page.goto(argv.endpoint || 'http://127.0.0.1:8080', 'networkidle2');

    // FIXME do it better
    setTimeout(printReport, 3000);
})()