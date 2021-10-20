import { EntityKind } from "../../io/hubspot.js";
import { Company } from "./company.js";
import { Entity } from "./entity.js";
import { EntityManager, PropertyTransformers } from "./manager.js";

export type ContactType = 'Partner' | 'Customer';

export type ContactProps = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;

  contactType: ContactType;

  country: string | null;
  region: string | null;

  hosting: string | null;
  deployment: 'Cloud' | 'Data Center' | 'Server' | 'Multiple' | null;

  relatedProducts: Set<string>;
  licenseTier: number | null;
  lastMpacEvent: string | null;

  otherEmails: string[];
};

export class Contact extends Entity<ContactProps> {

  companies = this.makeDynamicAssociation<Company>('company');

  get allEmails() { return [this.data.email, ...this.data.otherEmails]; }
  get isPartner() { return this.data.contactType === 'Partner'; }
  get isCustomer() { return this.data.contactType === 'Customer'; }

}

export class ContactManager extends EntityManager<ContactProps, Contact> {

  override Entity = Contact;
  override kind: EntityKind = 'contact';

  override associations: EntityKind[] = [
    "company",
  ];

  override apiProperties: string[] = [
    'email',
    'city',
    'state',
    'country',
    'region',
    'contact_type',
    'hosting',
    'firstname',
    'lastname',
    'phone',
    'deployment',
    'related_products',
    'license_tier',
    'last_mpac_event',
    'hs_additional_emails',
  ];

  override fromAPI(data: { [key: string]: string | null }): ContactProps | null {
    return {
      contactType: data.contact_type as ContactProps['contactType'],

      email: data.email ?? '',
      hosting: data.hosting,
      country: data.country,
      region: data.region,

      firstName: data.firstname || '',
      lastName: data.lastname || '',
      phone: data.phone || '',
      city: data.city || '',
      state: data.state || '',

      relatedProducts: new Set(data.related_products ? data.related_products.split(';') : []),
      licenseTier: !data.license_tier ? null : +data.license_tier,
      deployment: data.deployment as ContactProps['deployment'],
      lastMpacEvent: data.last_mpac_event,

      otherEmails: data.hs_additional_emails?.split(';') || [],
    };
  }

  override toAPI: PropertyTransformers<ContactProps> = {
    contactType: contactType => ['contact_type', contactType],

    email: email => ['email', email],
    hosting: hosting => ['hosting', hosting ?? ''],
    country: country => ['country', country ?? ''],
    region: region => ['region', region ?? ''],

    firstName: firstName => ['firstname', firstName?.trim() || ''],
    lastName: lastName => ['lastname', lastName?.trim() || ''],
    phone: phone => ['phone', phone?.trim() || ''],
    city: city => ['city', city?.trim() || ''],
    state: state => ['state', state?.trim() || ''],

    relatedProducts: relatedProducts => ['related_products', [...relatedProducts].join(';')],
    licenseTier: licenseTier => ['license_tier', licenseTier?.toFixed() ?? ''],
    deployment: deployment => ['deployment', deployment ?? ''],
    lastMpacEvent: lastMpacEvent => ['last_mpac_event', lastMpacEvent ?? ''],

    // Never sync'd up
    otherEmails: () => ['', ''],
  };

  override identifiers: (keyof ContactProps)[] = [
    'email',
  ];

  private contactsByEmail = new Map<string, Contact>();

  getByEmail(email: string) {
    return this.contactsByEmail.get(email);
  }

  override addIndexes(contacts: Iterable<Contact>) {
    for (const contact of contacts) {
      for (const email of contact.allEmails) {
        this.contactsByEmail.set(email, contact);
      }
    }
  }

  removeExternallyCreatedContacts(contacts: Set<Contact>) {
    for (const contact of contacts) {
      this.entities.delete(contact.guaranteedId());
      for (const email of contact.allEmails) {
        this.contactsByEmail.delete(email);
      }
    }
  }

}
