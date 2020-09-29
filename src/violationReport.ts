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

import {DiskLocation, WebLocation} from "./localization";

export class ViolationReport {
    webLocation: WebLocation;
    scriptSample: Array<string>;
    diskLocation: DiskLocation | undefined;

    constructor(webLocation: WebLocation) {
        this.webLocation = webLocation;
        this.scriptSample = new Array<string>();
    }
    static toKey(url: string, line: number, column: number): string {
        return `${url}:${line}:${column}`;
    }
    get key(): string {
        if (this.diskLocation) {
            return `${this.diskLocation.path}:${this.diskLocation.line}:${this.diskLocation.column}`;
        }
        return `${this.webLocation.url}:${this.webLocation.line}:${this.webLocation.column}`;
    }
    get count(): number {
        return this.scriptSample.length;
    }
    addOccurrence(scriptSample: string): void {
        this.scriptSample.push(scriptSample);
    }
    toString(): string {
        return `source: ${this.key}\n code samples: ${this.scriptSample.join('\n')}`;
    }
}