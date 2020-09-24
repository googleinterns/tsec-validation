/*
Copyright 2020 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

https://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
limitations under the License.
*/

import {Page, CDPSession, launch} from "puppeteer";
import * as yargs from 'yargs';
import Protocol from "devtools-protocol";
import HeaderEntry = Protocol.Fetch.HeaderEntry;
import {getOriginalLocation, Location} from './localization';

const argv = yargs
    .option('endpoint', {
        alias: 'e',
        description: 'Endpoint of running application to scan. Default: http://localhost:8080',
        type: 'string',
    })
    .option('verbose', {
        alias: 'v',
        description: 'Verbose logging',
        type: 'boolean',
    })
    .option('headless', {
        alias: 'hl',
        description: 'Open browser in the headless mode. Default: true',
        type: 'boolean',
    })
    .option('path', {
        alias: 'p',
        description: 'Path to the tested project\'s root. Default: this project\'s root',
        type: 'string',
    })
    .help()
    .alias('help', 'h')
    .argv;

let violations = new Map<Location, Array<string>>();

function saveViolation(data: string) {
    const report = JSON.parse(data)['csp-report'];
    if (report) {
        const location = {
            path: report['source-file'],
            line: report['line-number'],
            column: report['column-number'],
        };
        if (!violations.has(location)) {
            violations = violations.set(location, []);
        }
        violations.get(location)?.push(report['script-sample']);
    }
}

async function addCSPReportOnlyHeader(client: CDPSession, requestId: string, responseHeaders: Array<HeaderEntry>) {
    const newHeaders = responseHeaders;
    newHeaders.push({
        name: 'Content-Security-Policy-Report-Only',
        value: `require-trusted-types-for 'script'; report-uri ${argv.endpoint || 'http://127.0.0.1:8080'}`,
    });

    if (argv.verbose) {
        console.log(`Continuing interception ${requestId}`);
    }
    const response = <{ body: string, base64Encoded: boolean}>await client.send('Fetch.getResponseBody', {requestId});
    await client.send('Fetch.fulfillRequest', <Protocol.Fetch.GetResponseBodyRequest>{
        requestId: requestId,
        responseHeaders: newHeaders,
        responseCode: 200,
        body: response.body,
    });
}

async function intercept(page: Page) {
    const client = await page.target().createCDPSession();

    await client.send('Fetch.enable', {
        patterns: [
            {requestStage: 'Response', resourceType: 'Document'},
            {requestStage: 'Request', resourceType: 'CSPViolationReport'},
        ],
    });

    client.on('Fetch.requestPaused', async (event) => {
        const {requestId, resourceType, request, responseHeaders} = event;
        if (argv.verbose) {
            console.log(`Intercepted ${request.url} {interception id: ${requestId}}`);
        }
        switch (resourceType) {
        case 'CSPViolationReport':
            saveViolation(event.request.postData);
            return;
        case 'Document':
            await addCSPReportOnlyHeader(client, requestId, responseHeaders);
            return;
        default:
            return;
        }
    });
}

function printReport() {
    const violationsCount = Array.from(violations.values())
        .reduce((x, y) => x + y.length, 0);
    console.log(`Found ${violationsCount} violation${violationsCount === 1 ? '' : 's'}.`);
    let i = 1;
    violations.forEach(async (value: Array<string>, key: Location) => {
        const location = await getOriginalLocation(key, argv.path || '.')
        console.error(`${i++}. source: ${location ? `${location.path}:${location.line}:${location.column}` : key}, violations: [${value.join('\n')}]`);
    });
}

(async function main() {
    const browser = await launch({
        headless: argv.headless || true,
        devtools: true,
    });

    const page = (await browser.pages())[0];

    await intercept(page);

    await page.goto(argv.endpoint || 'http://127.0.0.1:8080', {
        waitUntil: 'networkidle2',
    });

    printReport()
})();
