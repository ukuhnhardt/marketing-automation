import { cliParams } from "../lib/cli/arg-parser.js";
import { getIoFromCli } from "../lib/cli/index.js";
import Engine from "../lib/engine/engine.js";
import { Database } from "../lib/model/database.js";

const { downloader, uploader } = getIoFromCli();
cliParams.failIfExtraOpts();

const db = new Database(downloader, uploader);

await new Engine().run(db);
