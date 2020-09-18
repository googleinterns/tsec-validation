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

const sourceMap = require('source-map');
const fs = require('fs');

async function getOriginalLocation(location, projectRoot) {
    const [path, line, col] = location;
    if (!path) {
        return undefined;
    }
    const sourceMapPath = `${projectRoot}/${path}.map`;
    try {
        if (!fs.existsSync(sourceMapPath)) {
            return location;
        }
        const tsPath = `${projectRoot}/${path.replace('.js', '.ts')}`;

        const rawData = fs.readFileSync(sourceMapPath, 'utf8');
        const rawSourceMap = JSON.parse(rawData);

        const result = await sourceMap.SourceMapConsumer.with(rawSourceMap, null, (consumer) => {
            return consumer.originalPositionFor({
                source: tsPath,
                line: line - 1,
                column: col - 1
            });
        });
        return [result.source, result.line + 1, result.column + 1];
    } catch (err) {
        console.error(err);
    }
}