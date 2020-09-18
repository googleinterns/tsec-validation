# tsec validation

**This is not an officially supported Google product.**

This repository contains the code for a tool identifying runtime
Trusted Types (TT) violations that were not found through static
analysis tools like https://github.com/googleinterns/tsec

## Build and run
### Build
```shell script
# Clone the repository
git clone https://github.com/googleinterns/tsec-validation.git

# Install dependencies
yarn
```

### Run
The tested application must be already running.
```shell script
node src/ttruntime.js
```

Options:  
* `-e {TEST_ENDPOINT}` – tested application's URL, default: `http://127.0.0.1:8080`
* `-p {TEST_PATH}` – project root of tested application's source code
* `--no-headless` – open browser while running tests
* `--verbose` – enable verbose logging on request interception

## Source Code Headers

Every file containing source code must include copyright and license
information. This includes any JS/CSS files that you might be serving out to
browsers. (This is to help well-intentioned people avoid accidental copying that
doesn't comply with the license.)

Apache header:

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
