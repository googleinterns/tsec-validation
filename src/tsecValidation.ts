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

import {execSync} from 'child_process';
import {ViolationReport} from "./violationReport";
import {DiskLocation} from "./localization";

const TRUSTED_TYPES_ERROR = 'TS21228';

export function compareWithTsecResults(tsecOutput: string, tsecValidationOutput: Array<ViolationReport>): void {
    const command = `cat ${tsecOutput} | grep ${TRUSTED_TYPES_ERROR} | cut -d' ' -f1`;
    const stdout = execSync(command);
    const tsecErrors = parseTsecOutput(stdout);
    const missedErrors = tsecValidationOutput.filter(report => tsecErrors
        .every(err => !report.locationEquals(err)));
    printReport(missedErrors);
}

function parseTsecOutput(buffer: Buffer): Array<DiskLocation> {
    return buffer.toString()
        // remove all ANSI color codes
        .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
        .split('\n')
        .filter(err => err.length)
        .map(err => {
            const [file, line, column] = err.split(':');
            return <DiskLocation>{
                path: file,
                line: +line,
                column: +column,
            };
        });
}

function printReport(missedErrors: Array<ViolationReport>) {
    const violationsCount = missedErrors.length;
    console.error(`Found ${violationsCount} violation${violationsCount === 1 ? '' : 's'} not found by tsec.`);
    missedErrors.forEach((value, idx) => {
        console.error(`${idx + 1}. ${value}`);
    });
}
