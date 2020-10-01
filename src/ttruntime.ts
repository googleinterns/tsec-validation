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
import {getOriginalLocation} from './localization';
import {ViolationReport} from './violationReport';
import * as readline from 'readline';

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
        description: 'Open browser in the headless mode. Default: false',
        type: 'boolean',
    })
    .option('path', {
        alias: 'p',
        description: 'Path to the tested project\'s root. If it\'s not provided only the Web violation locations will be reported.',
        type: 'string',
    })
    .option('timeout', {
        alias: 't',
        description: 'How long (in ms) to wait for the incoming violation reports. Default: 10000',
        type: 'number'
    })
    .option('interactive', {
        alias: 'i',
        description: 'Interactive mode. Leaves the browser open. Prints the report after user kills the app. Default: false',
        type: 'boolean',
    })
    .help()
    .alias('help', 'h')
    .argv;

const violations = new Map<string, ViolationReport>();

function saveViolation(data: string) {
    const report = JSON.parse(data)['csp-report'];
    if (report) {
        const key = ViolationReport.toKey(report['source-file'], report['line-number'], report['column-number']);
        if (!violations.has(key)) {
            violations.set(key, new ViolationReport({
                url: report['source-file'],
                line: report['line-number'],
                column: report['column-number'],
            }));
        }
        violations.get(key)!.addOccurrence(report['script-sample']);
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

async function resolveLocations(): Promise<Array<ViolationReport>> {
    const sortedByLocation = Array.from(violations.entries())
        .sort(([loc1,], [loc2,]) => loc1 > loc2 ? 1 : -1)

    const locationsValues = await Promise.all(
        sortedByLocation.map(([, viol]) => getOriginalLocation(viol.webLocation, argv.path))
    );
    return sortedByLocation.map(([, viol], idx) => {
        viol.diskLocation = locationsValues[idx];
        return viol;
    })
}

async function printReport() {
    const violationsCount = Array.from(violations.values())
        .reduce((x, y) => x + y.count, 0);
    console.error(`Found ${violationsCount} violation${violationsCount === 1 ? '' : 's'}.`);

    const violationsWithResolvedLocations = await resolveLocations();
    violationsWithResolvedLocations.forEach((value, idx) => {
        console.error(`${idx + 1}. ${value}`);
    });
}

async function printReportOnExit() {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    await process.stdin.on('keypress', async (str, key) => {
        if (key.ctrl && key.name === 'c') {
            await printReport();
            process.exit();
        } else {
            console.log('Press CTRL+C to print report and finish.');
        }
    });
    console.log('Press CTRL+C to print report and finish.');
}

(async function main() {
    const browser = await launch({
        headless: argv.headless || false,
        devtools: true,
    });

    const page = (await browser.pages())[0];

    await intercept(page);

    if (argv.interactive) {
        await printReportOnExit();
    } else {
        try {
            await page.goto(argv.endpoint || 'http://127.0.0.1:8080', {
                waitUntil: 'networkidle2',
                timeout: argv.timeout || 10000,
            });
        } catch (e) {
            console.error(e);
        } finally {
            await printReport();
            await browser.close();
        }
    }
})();
