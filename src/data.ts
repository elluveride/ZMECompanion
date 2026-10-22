import data from 'virtual:zme-data';
import type { Dataset, Doc, Discrepancy, Airport } from '../schema/schema';

export const DS: Dataset = data;

const docs = new Map(DS.docs.map((d) => [d.id, d]));
const discrepancies = new Map(DS.discrepancies.map((d) => [d.id, d]));
const airports = new Map(DS.airports.map((a) => [a.id, a]));

export const docById = (id: string): Doc | undefined => docs.get(id);
export const discrepancyById = (id: string): Discrepancy | undefined => discrepancies.get(id);
export const airportById = (id: string): Airport | undefined => airports.get(id);
