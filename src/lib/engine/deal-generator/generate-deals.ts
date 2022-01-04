import assert from "assert";
import { saveForInspection } from "../../cache/inspection";
import log from "../../log/logger";
import { Table } from "../../log/table";
import { Database } from "../../model/database";
import { Deal } from "../../model/deal";
import { LicenseData } from "../../model/license";
import { formatMoney } from "../../util/formatters";
import { isPresent, sorter } from "../../util/helpers";
import { RelatedLicenseSet } from "../license-matching/license-grouper";
import { ActionGenerator } from "./actions";
import { EventGenerator } from "./events";
import { DealDataLogger } from "./logger";


export type IgnoredLicense = LicenseData & {
  reason: string;
  details: string;
};

/** Generates deal actions based on match data */
export class DealGenerator {

  private actionGenerator: ActionGenerator;

  private ignoredLicenseSets: (IgnoredLicense)[][] = [];
  private ignoredAmounts = new Map<string, number>();

  public constructor(private db: Database) {
    this.actionGenerator = new ActionGenerator(db.dealManager);
  }

  public run(matches: RelatedLicenseSet[]) {
    const logger = new DealDataLogger();

    for (const relatedLicenseIds of matches) {
      const { records, events, actions } = this.generateActionsForMatchedGroup(relatedLicenseIds);

      logger.logTestID(relatedLicenseIds);
      logger.logRecords(records);
      logger.logEvents(events);
      logger.logActions(actions);

      for (const action of actions) {
        const deal = (action.type === 'create'
          ? this.db.dealManager.create(action.properties)
          : action.deal);

        if (deal) {
          deal.records = records;
          this.associateDealContactsAndCompanies(relatedLicenseIds, deal);
          this.flagPartnerTransacted(deal);
        }
      }
    }

    saveForInspection('ignored', this.ignoredLicenseSets);

    for (const [reason, amount] of this.ignoredAmounts) {
      this.db.tallier.less('Ignored: ' + reason, amount);
    }

    this.printIgnoredTransactionsTable();

    logger.close();
  }

  private printIgnoredTransactionsTable() {
    const table = new Table([
      { title: 'Reason Ignored' },
      { title: 'Amount Ignored', align: 'right' },
    ]);
    for (const [reason, amount] of this.ignoredAmounts) {
      table.rows.push([reason, formatMoney(amount)]);
    }

    log.info('Deal Actions', 'Amount of Transactions Ignored');
    for (const row of table.eachRow()) {
      log.info('Deal Actions', '  ' + row);
    }
  }

  public generateActionsForMatchedGroup(group: RelatedLicenseSet) {
    assert.ok(group.length > 0);

    const eventGenerator = new EventGenerator(this.db);

    const records = eventGenerator.getSortedRecords(group);
    const events = eventGenerator.interpretAsEvents(records);
    const actions = this.actionGenerator.generateFrom(events);

    return { records, events, actions };
  }

  private associateDealContactsAndCompanies(group: RelatedLicenseSet, deal: Deal) {
    const records = group.flatMap(license => [license, ...license.transactions]);
    const emails = [...new Set(records.flatMap(r => r.allContacts.map(c => c.data.email)))];
    const contacts = (emails
      .map(email => this.db.contactManager.getByEmail(email))
      .filter(isPresent));
    contacts.sort(sorter(c => c.isCustomer ? -1 : 0));

    const companies = (contacts
      .filter(c => c.isCustomer)
      .flatMap(c => c.companies.getAll()));

    deal.contacts.clear();
    for (const contact of contacts) {
      deal.contacts.add(contact);
    }

    deal.companies.clear();
    for (const company of companies) {
      deal.companies.add(company);
    }
  }

  public flagPartnerTransacted(deal: Deal) {
    if (deal.records.length === 0) {
      log.error('Deal Actions', "Deal has no associated MPAC records:", deal.id);
      return;
    }

    /**
     * If any record in any of the deal's groups have partner contacts
     * then use the most recent record's partner contact's domain.
     * Otherwise set this to null.
     */
    const lastPartner = (deal
      .records
      .flatMap(r => r.allContacts)
      .reverse()
      .find(c => c.isPartner));

    deal.data.associatedPartner = lastPartner?.getPartnerDomain(this.db.partnerDomains) ?? null;
  }

}
