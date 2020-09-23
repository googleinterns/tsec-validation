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

import {SourceMapConsumer} from 'source-map';
import * as fs from 'fs';

interface Location {
    path: string;
    line: number;
    column: number;
}

/**
 * Find the path of a source TypeScript file on the disk
 * for a JS file in the web app.
 */
async function getOriginalLocation(location: Location, projectRoot: string): Promise<Location | undefined> {
    const {path, line, column} = location;
    if (!path) {
        return undefined;
    }
    const sourceMapPath = `${projectRoot}/${path}.map`;
    try {
        if (!fs.existsSync(sourceMapPath)) {
            return location;
        }

        const rawData = fs.readFileSync(sourceMapPath, 'utf8');
        const rawSourceMap = JSON.parse(rawData);

        const result = await SourceMapConsumer.with(rawSourceMap, null, (consumer: SourceMapConsumer) => {
            return consumer.originalPositionFor({
                line: line - 1,
                column: column - 1
            });
        });
        if (result.source && result.line && result.column) {
            return {
                path: result.source,
                line: result.line + 1,
                column: result.column + 1,
            };
        }
    } catch (err) {
        console.error(err);
    }
}
