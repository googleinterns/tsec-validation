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
import * as path from 'path';

export interface DiskLocation {
    path: string;
    line: number;
    column: number;
}

export interface WebLocation {
    url: string;
    line: number;
    column: number;
}

/**
 * Find the path of a source TypeScript file on the disk
 * for a JS file in the web app.
 */
export async function getOriginalLocation(location: WebLocation, projectRoot: string): Promise<DiskLocation | undefined> {
    const {url, line, column} = location;
    if (!url) {
        return undefined;
    }
    const localPath = webUrlToDiskPath(url, projectRoot);
    const sourceMapPath = getSourceMapFile(localPath);
    try {
        if (!sourceMapPath || !fs.existsSync(sourceMapPath)) {
            return undefined;
        }

        const rawData = fs.readFileSync(sourceMapPath, { encoding: 'utf8' });
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

/**
 * Translates a static file web URL to local file path.
 * Assumes that the files are served from ${webUri}/static path
 */
function webUrlToDiskPath(webPath: string, projectRoot: string): string {
    const [, file] = webPath.split('static/');
    return path.join(projectRoot, file);
}

/**
 * Searches for the path to source map file
 * that should be in the comment at the end of corresponding JS file.
 */
function getSourceMapFile(localJSPath: string): string | undefined {
    const jsFile = fs.readFileSync(localJSPath, { encoding: 'utf8' });

    const match = jsFile.trimEnd().match(/\/\/# sourceMappingURL=(.*\.map)/);
    if (match) {
        const sourceMapPath = match[1];
        return path.resolve(localJSPath, '..', sourceMapPath);
    }
}