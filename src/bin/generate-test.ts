import 'source-map-support/register';
import util from 'util';
import { engineConfigFromENV } from '../lib/config/env';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { Hubspot } from '../lib/hubspot';
import { Logger } from '../lib/log';
import { License } from '../lib/model/license';
import { abbrActionDetails, abbrEventDetails } from '../tests/deal-generator/utils';

function TEMPLATE({ runDealGenerator, RECORDS, EVENTS, ACTIONS }: any) {
  it(`describe test`, () => {
    const { events, actions } = runDealGenerator({
      records: RECORDS,
    });
    expect(events).toEqual(EVENTS);
    expect(actions).toEqual(ACTIONS);
  });
}

function main(template: string, licenseIds: string[]) {
  const engine = new Engine(Hubspot.memory(), engineConfigFromENV(), new Logger());
  const data = new DataSet(DataDir.root.subdir('in')).load();
  const { dealGeneratorResults } = engine.run(data);

  for (const licenseId of licenseIds) {
    const results = dealGeneratorResults.get(licenseId);
    if (results) {
      const { actions, records, events } = results;
      const licenses = records.filter(r => r instanceof License) as License[];
      console.log(template
        .replace('RECORDS', format(licenses.map(abbrRecordDetails), 150))
        .replace('EVENTS', format(events.map(abbrEventDetails)))
        .replace('ACTIONS', format(actions.map(abbrActionDetails)))
      );
    }
    else {
      console.log(`Can't find results for ${licenseId}`);
    }
  }
}

function format(o: any, breakLength = 50) {
  return util.inspect(o, {
    depth: null,
    breakLength,
    maxArrayLength: null,
    maxStringLength: null,
  });
}

const template = (TEMPLATE
  .toString()
  .split(/\n/g)
  .slice(1, -1)
  .join('\n'));

main(template, process.argv.slice(2));

function abbrRecordDetails(license: License) {
  return [
    license.id,
    license.data.maintenanceStartDate,
    license.data.licenseType,
    license.data.status,
    license.transactions.map(transaction => [
      transaction.data.transactionId,
      transaction.data.saleDate,
      transaction.data.licenseType,
      transaction.data.saleType,
      transaction.data.transactionId,
      transaction.data.vendorAmount,
    ])
  ];
}
