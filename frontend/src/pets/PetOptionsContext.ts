import { createContext, useContext } from 'react';

export type PetOptions = {
  species: string[];
  breeds: Record<string, string[]>;
  sizes: string[];
  sexes: string[];
  cities: string[];
  traits: string[];
  age_buckets: Record<string, [number, number]>;
};

export const PetOptionsContext = createContext<PetOptions | null>(null);

export function usePetOptions(): PetOptions | null {
  return useContext(PetOptionsContext);
}
