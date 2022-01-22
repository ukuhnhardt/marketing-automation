import promiseAllProperties from 'promise-all-properties';
import DataDir from "../data/dir";
import { MultiDownloadLogger } from "../log/download-logger";
import log from "../log/logger";
import { CompanyAdapter } from '../model/company';
import { ContactAdapter } from '../model/contact';
import { DealAdapter } from '../model/deal';
import { FullEntity } from "../model/hubspot/interfaces";
import { downloadHubspotEntities } from '../model/hubspot/manager';
import { RawLicense, RawTransaction } from "../model/marketplace/raw";
import { HubspotCreds, MpacCreds } from "../parameters/interfaces";
import { EmailProviderAPI } from "./free-email-services";
import HubspotAPI from "./hubspot";
import { Data } from "./interfaces";
import { MarketplaceAPI } from "./marketplace";
import { TldListAPI } from "./tlds";

export function loadDataFromDisk(dataDir: DataDir): Data {
  return {
    licensesWithDataInsights: dataDir.file<readonly RawLicense[]>('licenses-with.csv').readArray(),
    licensesWithoutDataInsights: dataDir.file<readonly RawLicense[]>('licenses-without.csv').readArray(),
    transactions: dataDir.file<readonly RawTransaction[]>('transactions.csv').readArray(),
    tlds: dataDir.file<readonly { tld: string }[]>('tlds.csv').readArray().map(({ tld }) => tld),
    freeDomains: dataDir.file<readonly { domain: string }[]>('domains.csv').readArray().map(({ domain }) => domain),
    rawDeals: dataDir.file<FullEntity[]>('deals.csv').readArray(),
    rawCompanies: dataDir.file<FullEntity[]>('companies.csv').readArray(),
    rawContacts: dataDir.file<FullEntity[]>('contacts.csv').readArray(),
  }
}

type DownloadConfig = {
  hubspotCreds: HubspotCreds;
  mpacCreds: MpacCreds;
};

export class Downloader {

  constructor(
    private dataDir: DataDir,
    private config: DownloadConfig,
  ) { }

  async downloadData(): Promise<Data> {
    const hubspot = new HubspotAPI(this.config.hubspotCreds);
    const marketplace = new MarketplaceAPI(this.config.mpacCreds);
    const emailProviderLister = new EmailProviderAPI();
    const tldLister = new TldListAPI();

    log.info('Downloader', 'Starting downloads with API');
    const logbox = new MultiDownloadLogger();

    const data = await promiseAllProperties({
      tlds: logbox.wrap('Tlds', () =>
        tldLister.downloadAllTlds()),

      licensesWithDataInsights: logbox.wrap('Licenses With Data Insights', (progress) =>
        marketplace.downloadLicensesWithDataInsights(progress)),

      licensesWithoutDataInsights: logbox.wrap('Licenses Without Data Insights', () =>
        marketplace.downloadLicensesWithoutDataInsights()),

      transactions: logbox.wrap('Transactions', () =>
        marketplace.downloadTransactions()),

      freeDomains: logbox.wrap('Free Email Providers', () =>
        emailProviderLister.downloadFreeEmailProviders()),

      rawDeals: logbox.wrap('Deals', () =>
        downloadHubspotEntities(hubspot, DealAdapter)),

      rawCompanies: logbox.wrap('Companies', () =>
        downloadHubspotEntities(hubspot, CompanyAdapter)),

      rawContacts: logbox.wrap('Contacts', () =>
        downloadHubspotEntities(hubspot, ContactAdapter)),
    });

    this.dataDir.file('transactions.csv').writeArray(data.transactions);
    this.dataDir.file('licenses-without.csv').writeArray(data.licensesWithoutDataInsights);
    this.dataDir.file('licenses-with.csv').writeArray(data.licensesWithDataInsights);
    this.dataDir.file('domains.csv').writeArray(data.freeDomains.map(domain => ({ domain })));
    this.dataDir.file('tlds.csv').writeArray(data.tlds.map(tld => ({ tld })));
    this.dataDir.file('deals.csv').writeArray(data.rawDeals);
    this.dataDir.file('companies.csv').writeArray(data.rawCompanies);
    this.dataDir.file('contacts.csv').writeArray(data.rawContacts);

    logbox.done();
    log.info('Downloader', 'Done');

    return data;
  }

}
