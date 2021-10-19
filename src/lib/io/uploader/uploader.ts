import { Company } from "../../types/company.js";
import { Contact, GeneratedContact } from "../../types/contact.js";
import { Deal, DealAssociationPair, DealCompanyAssociationPair, DealUpdate } from "../../types/deal.js";
import { EntityKind, NewEntity, ExistingEntity, Association } from "../hubspot.js";

export interface Uploader {
  createAllContacts(contacts: Array<{ properties: GeneratedContact }>): Promise<Contact[]>;
  updateAllContacts(contacts: Array<{ id: string; properties: Partial<GeneratedContact> }>): Promise<void>;

  updateAllCompanies(contacts: Array<{ id: string; properties: Partial<Omit<Company, 'id'>> }>): Promise<void>;

  createAllDeals(deals: Omit<Deal, 'id'>[]): Promise<Deal[]>;
  updateAllDeals(deals: DealUpdate[]): Promise<void>;

  associateDealsWithContacts(fromTos: DealAssociationPair[]): Promise<void>;
  disassociateDealsFromContacts(fromTos: DealAssociationPair[]): Promise<void>;

  associateDealsWithCompanies(fromTos: DealCompanyAssociationPair[]): Promise<void>;
  disassociateDealsFromCompanies(fromTos: DealCompanyAssociationPair[]): Promise<void>;

  createEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]>;
  updateEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]>;

  createAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
  deleteAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
}
